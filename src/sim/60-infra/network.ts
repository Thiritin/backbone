// Traffic, exits, routing, billing, peering and DDoS per zone. Values come from docs/design/economy.md (Traffic and bandwidth).
import { hashRng, rand } from "../00-core/rng";
import { dateOf, isMonthStart, yearOf } from "../00-core/time";
import {
  carrierById, COMMITS, DC_BANDWIDTH, dcPerTb, DDOS, DECLINE_COOLDOWN_HOURS, EXCHANGE_FEES, exchangeById, exchangePortPrice, PEERS, PROTECTIONS,
  REQUEST_DAILY, REQUEST_DAYS, SATURATION_FLOOR, SATURATION_PENALTY, TB_PER_MBPS_HOUR, transitPerMbps, zoneLinkPrice,
  type Peer, type Protection, type ZoneLinkKind,
} from "../10-catalog/network";
import { trafficGb } from "../10-catalog/products";
import { datacenterById, homeLineById } from "../20-world/datacenters";
import type { Service } from "../30-customers/customers";
import { bump, createTicket, OUTAGE_WRITE_CHANCE, profileStats } from "../40-support/tickets";
import { isSuspended } from "../45-billing/billing";
import type { GameState, LedgerEntry, Location } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { workloadsOf } from "./cluster";
import { working } from "./status";

// A link takes one router port; it carries traffic from readyAt on, while its router works.
export interface UplinkLink { id: string; gbit: number; device: string; port: number; readyAt: number }
// A contract with one carrier (transit) or one exchange's ports in one zone. commit is the share of capacity always billed;
// samples are the Mbit/s carried in each of the last 30 days of hours.
export interface Uplink { id: string; locationId: string; kind: "transit" | "exchange"; partner: string; commit: number; links: UplinkLink[]; samples: number[] }
export interface ZoneLink { id: string; a: string; b: string; kind: ZoneLinkKind; gbit: number; readyAt: number; carried: number }
export interface PeeringRequest { id: string; peer: string; exchange: string; at: number }
export interface Session { peer: string; exchange: string; since: number }
export interface Attack { id: string; serviceId: string; locationId: string; mbps: number; startedAt: number; endsAt: number; blackholed: boolean }
export interface Network {
  asn: number | null;
  memberships: string[];
  uplinks: Uplink[];
  zoneLinks: ZoneLink[];
  sessions: Session[];
  requests: PeeringRequest[];
  // The hour a network last turned you down or was turned down; neither side asks again for a while.
  declined: Record<string, number>;
  protection: Protection;
  attacks: Attack[];
  // Industry contacts from trade fairs, 0 to 1: cheaper transit and more peering.
  goodwill: number;
  // Per location: [demand, carried] Mbit/s for each of the last 7 days of hours.
  history: Record<string, [number, number][]>;
  // TB carried over each location's datacenter bandwidth since the last bill.
  dcTb: Record<string, number>;
  saturated: string[];
}

export const newNetwork = (): Network => ({
  asn: null, memberships: [], uplinks: [], zoneLinks: [], sessions: [], requests: [], declined: {},
  protection: "none", attacks: [], goodwill: 0, history: {}, dcTb: {}, saturated: [],
});

const HISTORY_HOURS = 168, SAMPLE_HOURS = 720, GOODWILL_DECAY = 0.05;
const round2 = (v: number) => Math.round(v * 100) / 100;
const cents = round2;

// ponytail: a day/night wave that peaks at 21:00 and averages 1; swap for the usage curves once workloads have them.
export function loadAt(s: GameState, _v: Service): number {
  return 1 + 0.9 * Math.cos((2 * Math.PI * (dateOf(s.hour).getUTCHours() - 21)) / 24);
}

// A running service's Mbit/s this hour: GB per month spread over the month's seconds, times the load.
export const serviceMbps = (s: GameState, v: Service): number =>
  ((v.spec?.trafficGb ?? trafficGb(v.product, v.plan, yearOf(s.hour))) * 8000) / (730 * 3600) * loadAt(s, v);

export const zoneOf = (s: GameState, v: Service): Location | undefined => (v.zone ? s.locations.find((l) => l.az === v.zone) : undefined);
const running = (s: GameState, v: Service) => v.endedAt === null && !isSuspended(s, v.customerId) && workloadsOf(s, v.id).length > 0;

// The attack's Mbit/s that reaches your links: always-on filters it, on-demand after the detection delay, a blackhole drops it.
export function attackMbps(s: GameState, a: Attack): number {
  if (a.blackholed || s.network.protection === "alwaysOn") return 0;
  if (s.network.protection === "onDemand") return s.hour === a.startedAt ? a.mbps * DDOS.detectShare : 0;
  return a.mbps;
}

// Mbit/s each location sends this hour, attacks included.
export function zoneDemand(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of s.services) {
    const loc = zoneOf(s, v);
    if (loc && running(s, v)) out[loc.id] = (out[loc.id] ?? 0) + serviceMbps(s, v);
  }
  for (const a of s.network.attacks) out[a.locationId] = (out[a.locationId] ?? 0) + attackMbps(s, a);
  return out;
}

export const linkUp = (s: GameState, l: UplinkLink): boolean => l.readyAt <= s.hour && working(s, l.device);
export const uplinkMbps = (s: GameState, u: Uplink): number => u.links.filter((l) => linkUp(s, l)).reduce((n, l) => n + l.gbit * 1000, 0);
export const capacityMbps = (u: Uplink): number => u.links.reduce((n, l) => n + l.gbit * 1000, 0);

// Peers reached through an exchange: the route-server networks there, plus your sessions on it.
export function peersVia(s: GameState, exchange: string): Peer[] {
  return PEERS.filter((p) => p.exchanges.includes(exchange)
    && (p.policy === "routeServer" || s.network.sessions.some((x) => x.peer === p.id && x.exchange === exchange)));
}

// tier 0 is exchange peering, limited to the traffic its peers take; 1 is transit; 2 the datacenter's own transit or the home line.
interface Exit { id: string; tier: number; cap: number; used: number; share: number }

export function exitsOf(s: GameState, loc: Location): Exit[] {
  if (!loc.dc) return [{ id: "home", tier: 2, cap: homeLineById(s.homeLine.id).up, used: 0, share: 1 }];
  const exits: Exit[] = [];
  const seen = new Set<string>();
  for (const u of s.network.uplinks.filter((x) => x.locationId === loc.id)) {
    let share = 1;
    if (u.kind === "exchange") {
      // A network on two of your exchanges counts on the first one only.
      const fresh = peersVia(s, u.partner).filter((p) => !seen.has(p.id));
      fresh.forEach((p) => seen.add(p.id));
      share = fresh.reduce((n, p) => n + p.share, 0);
    }
    exits.push({ id: u.id, tier: u.kind === "exchange" ? 0 : 1, cap: uplinkMbps(s, u), used: 0, share });
  }
  exits.push({ id: `dc:${loc.id}`, tier: 2, cap: DC_BANDWIDTH.mbps, used: 0, share: 1 });
  return exits;
}

// Spreads amount over the group by spare capacity and returns what it took.
function spread(group: Exit[], amount: number): number {
  const spare = group.reduce((n, e) => n + e.cap - e.used, 0);
  const take = Math.min(amount, spare);
  if (take > 0) for (const e of group) e.used += (take * (e.cap - e.used)) / spare;
  return take;
}

// Cheapest exit first; equal exits share; whatever does not fit is returned.
function fill(exits: Exit[], amount: number): number {
  let left = amount;
  for (const e of exits.filter((x) => x.tier === 0)) left -= spread([e], Math.min(left, amount * e.share));
  for (const tier of [1, 2]) left -= spread(exits.filter((e) => e.tier === tier), left);
  return left;
}

export interface ZoneRoute { demand: number; carried: number; dropped: number; exits: Record<string, number> }
export interface Routing { zones: Record<string, ZoneRoute>; links: Record<string, number> }

// Routes this hour's traffic: each zone through its own exits, then overflow over links to other zones' spare capacity.
export function route(s: GameState): Routing {
  const demand = zoneDemand(s);
  const exits: Record<string, Exit[]> = {}, left: Record<string, number> = {};
  for (const loc of s.locations) {
    exits[loc.id] = exitsOf(s, loc);
    left[loc.id] = fill(exits[loc.id], demand[loc.id] ?? 0);
  }
  const links: Record<string, number> = {};
  for (const loc of s.locations) {
    for (const zl of s.network.zoneLinks.filter((z) => z.readyAt <= s.hour && (z.a === loc.id || z.b === loc.id))) {
      const other = zl.a === loc.id ? zl.b : zl.a;
      const send = Math.min(left[loc.id], zl.gbit * 1000 - (links[zl.id] ?? 0));
      if (send <= 0 || !exits[other]) continue;
      const moved = send - fill(exits[other], send);
      links[zl.id] = (links[zl.id] ?? 0) + moved;
      left[loc.id] -= moved;
    }
  }
  const zones: Record<string, ZoneRoute> = {};
  for (const loc of s.locations) {
    const d = demand[loc.id] ?? 0, dropped = Math.max(0, left[loc.id]);
    zones[loc.id] = { demand: d, carried: d - dropped, dropped, exits: Object.fromEntries(exits[loc.id].map((e) => [e.id, e.used])) };
  }
  return { zones, links };
}

// The 95th percentile: the top 5% of hours are dropped.
export function p95(samples: number[]): number {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

// A transit contract's month: the 95th percentile, never below the commit, at the carrier's price less the commit discount and fair goodwill.
export function transitBill(s: GameState, u: Uplink): { mbps: number; amount: number } {
  const carrier = carrierById(u.partner)!;
  const commit = COMMITS.find((c) => c.share === u.commit) ?? COMMITS[0];
  const mbps = Math.max(p95(u.samples), capacityMbps(u) * commit.share);
  const price = transitPerMbps(carrier, yearOf(s.hour)) * (1 - commit.discount) * (1 - 0.1 * s.network.goodwill);
  return { mbps: round2(mbps), amount: cents(mbps * price) };
}

export const crossConnects = (s: GameState, u: Uplink): number => {
  const loc = s.locations.find((l) => l.id === u.locationId);
  return loc?.dc ? u.links.length * datacenterById(loc.dc).crossConnect : 0;
};

export function zoneLinkMonthly(s: GameState, zl: ZoneLink): number {
  const a = s.locations.find((l) => l.id === zl.a), b = s.locations.find((l) => l.id === zl.b);
  return zoneLinkPrice(zl.kind, zl.gbit, a?.city === b?.city, yearOf(s.hour));
}

// Every bill of the coming month start, as ledger lines.
export function networkBills(s: GameState): LedgerEntry[] {
  const year = yearOf(s.hour), n = s.network, out: LedgerEntry[] = [];
  const line = (key: string, params: LedgerEntry["params"], amount: number) => {
    if (amount > 0) out.push({ hour: s.hour, category: "transit", key, params, amount: -cents(amount) });
  };
  const name = (id: string) => s.locations.find((l) => l.id === id)?.name ?? "";
  for (const u of n.uplinks) {
    if (!u.links.some((l) => l.readyAt <= s.hour)) continue;
    if (u.kind === "transit") {
      const bill = transitBill(s, u);
      line("ledger.transit", { carrier: carrierById(u.partner)!.name, location: name(u.locationId), mbps: Math.round(bill.mbps) }, bill.amount);
    } else {
      line("ledger.exchangePorts", { exchange: exchangeById(u.partner)!.name, location: name(u.locationId), count: u.links.length },
        u.links.reduce((sum, l) => sum + exchangePortPrice(l.gbit, year), 0));
    }
    line("ledger.crossConnects", { location: name(u.locationId), count: u.links.length }, crossConnects(s, u));
  }
  for (const x of n.memberships) line("ledger.exchangeMember", { exchange: exchangeById(x)!.name }, EXCHANGE_FEES.yearly / 12);
  for (const [id, tb] of Object.entries(n.dcTb)) line("ledger.dcBandwidth", { location: name(id), tb: round2(tb) }, tb * dcPerTb(year));
  for (const zl of n.zoneLinks.filter((z) => z.readyAt <= s.hour)) line("ledger.zoneLink", { a: name(zl.a), b: name(zl.b) }, zoneLinkMonthly(s, zl));
  if (n.protection !== "none") line("ledger.ddosProtection", { name: PROTECTIONS[n.protection].name }, PROTECTIONS[n.protection].monthly);
  return out;
}
export const monthlyNetworkCost = (s: GameState): number => -networkBills(s).reduce((n, b) => n + b.amount, 0);

// Your busiest hour of the last day over all zones, in Mbit/s; peers judge you by it.
export function peakMbps(s: GameState): number {
  const totals = Array.from({ length: 24 }, (_, i) => Object.values(s.network.history).reduce((n, h) => n + (h[h.length - 1 - i]?.[1] ?? 0), 0));
  return Math.max(0, ...totals);
}

// Chance a network says yes when you ask it.
export function acceptChance(s: GameState, p: Peer): number {
  const size = p.minMbps ? Math.min(1, peakMbps(s) / p.minMbps) : 1, g = s.network.goodwill;
  if (p.policy === "routeServer" || p.policy === "open") return 1;
  if (p.policy === "selective") return Math.min(1, 0.9 * size + 0.1 * g);
  return Math.min(1, 0.3 * size * size + 0.1 * g);
}

// Exchanges where you are a member with a port ready in some zone.
export const activeExchanges = (s: GameState): string[] =>
  s.network.memberships.filter((x) => s.network.uplinks.some((u) => u.kind === "exchange" && u.partner === x && u.links.some((l) => l.readyAt <= s.hour)));

export const coolingDown = (s: GameState, peer: string): boolean => s.hour - (s.network.declined[peer] ?? -Infinity) < DECLINE_COOLDOWN_HOURS;

// Trade fairs call this: contacts make transit cheaper and peers friendlier, and fade by 5% a month.
export function addGoodwill(s: GameState, amount: number): void {
  s.network = { ...s.network, goodwill: Math.min(1, s.network.goodwill + amount * (1 - s.network.goodwill)) };
}

export const blackholed = (s: GameState, serviceId: string): boolean => s.network.attacks.some((a) => a.serviceId === serviceId && a.blackholed);

function requests(s: GameState, events: SimEvent[]) {
  const n = s.network;
  let reqs = n.requests.filter((r) => s.hour - r.at < REQUEST_DAYS * 24);
  const peak = peakMbps(s);
  activeExchanges(s).forEach((x, xi) => {
    PEERS.forEach((p, pi) => {
      if (p.policy === "routeServer" || !p.exchanges.includes(x) || coolingDown(s, p.id)) return;
      if (n.sessions.some((z) => z.peer === p.id && z.exchange === x) || reqs.some((r) => r.peer === p.id)) return;
      const size = p.policy === "open" ? 1 : Math.min(1, peak / p.minMbps);
      if (rand(hashRng(s.seed, s.hour, 0x9ee7, xi, pi)) >= REQUEST_DAILY[p.policy] * size * (1 + n.goodwill)) return;
      reqs = [...reqs, { id: `peer${s.nextId++}`, peer: p.id, exchange: x, at: s.hour }];
      events.push({ app: "Network", key: "event.peeringRequest", params: { network: p.name, exchange: exchangeById(x)!.name } });
    });
  });
  s.network = { ...s.network, requests: reqs };
}

function attacks(s: GameState, events: SimEvent[]) {
  const year = yearOf(s.hour);
  let list = s.network.attacks.filter((a) => a.endsAt > s.hour);
  s.services.forEach((v, i) => {
    const loc = zoneOf(s, v);
    if (!loc || !running(s, v)) return;
    const c = s.customers.find((x) => x.id === v.customerId);
    const r = hashRng(s.seed, s.hour, 0xdd05, i);
    if (rand(r) >= (c?.profile === "gamer" ? DDOS.gamerMonthly : DDOS.otherMonthly) / 730) return;
    const mbps = Math.round(DDOS.mbps2005 * Math.pow(DDOS.growth, year - 2005) * (0.5 + rand(r)));
    const hours = DDOS.minHours + Math.floor(rand(r) * (DDOS.maxHours - DDOS.minHours + 1));
    list = [...list, { id: `ddos${s.nextId++}`, serviceId: v.id, locationId: loc.id, mbps, startedAt: s.hour, endsAt: s.hour + hours, blackholed: false }];
    events.push({ app: "Network", key: "event.ddos", params: { service: v.label, location: loc.name, gbit: round2(mbps / 1000) } });
    if (s.network.protection === "onDemand") {
      const fee = PROTECTIONS.onDemand.perIncident;
      s.cash = cents(s.cash - fee);
      s.ledger = [...s.ledger, { hour: s.hour, category: "transit", key: "ledger.ddosIncident", params: { name: PROTECTIONS.onDemand.name, service: v.label }, amount: -fee }];
    }
  });
  s.network = { ...s.network, attacks: list };
}

// Customers behind a saturated zone lose a quarter of their outage penalty each hour; when the zone first saturates, some write in.
function saturation(s: GameState, r: Routing, events: SimEvent[]) {
  const now = s.locations.filter((l) => r.zones[l.id].demand > 0 && r.zones[l.id].dropped / r.zones[l.id].demand > SATURATION_FLOOR).map((l) => l.id);
  if (now.length) {
    s.customers = s.customers.map((c) => ({ ...c }));
    const byId = new Map(s.customers.map((c) => [c.id, c]));
    for (const v of s.services) {
      const loc = zoneOf(s, v), c = byId.get(v.customerId);
      if (!loc || !c || !now.includes(loc.id) || !running(s, v)) continue;
      const p = profileStats(c.profile);
      bump(c, -p.outagePenalty * SATURATION_PENALTY);
      const fresh = !s.network.saturated.includes(loc.id);
      if (fresh && rand(hashRng(s.seed, s.hour, 0x5a7, Number(v.id.replace(/\D/g, "")) || 0)) < OUTAGE_WRITE_CHANCE[p.budget] / 2) createTicket(s, c, "outage", v.id);
    }
    for (const id of now.filter((x) => !s.network.saturated.includes(x))) {
      events.push({ app: "Network", key: "event.saturated", params: { location: s.locations.find((l) => l.id === id)!.name } });
    }
  }
  s.network = { ...s.network, saturated: now };
}

export function networkTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  for (const u of s.network.uplinks) {
    for (const l of u.links) {
      if (l.readyAt === s.hour) events.push({ app: "Network", key: "event.uplinkReady", params: { partner: carrierById(u.partner)?.name ?? exchangeById(u.partner)!.name, gbit: l.gbit } });
    }
  }
  attacks(s, events);
  const r = route(s);
  const n = s.network, history = { ...n.history }, dcTb = { ...n.dcTb };
  for (const loc of s.locations) {
    const z = r.zones[loc.id];
    history[loc.id] = [...(history[loc.id] ?? []), [round2(z.demand), round2(z.carried)] as [number, number]].slice(-HISTORY_HOURS);
    const dc = z.exits[`dc:${loc.id}`] ?? 0;
    if (dc > 0) dcTb[loc.id] = (dcTb[loc.id] ?? 0) + dc * TB_PER_MBPS_HOUR;
  }
  s.network = {
    ...n, history, dcTb,
    uplinks: n.uplinks.map((u) => ({ ...u, samples: [...u.samples, round2(r.zones[u.locationId]?.exits[u.id] ?? 0)].slice(-SAMPLE_HOURS) })),
    zoneLinks: n.zoneLinks.map((z) => ({ ...z, carried: round2(r.links[z.id] ?? 0) })),
  };
  saturation(s, r, events);
  if (s.hour % 24 === 0) requests(s, events);
  if (isMonthStart(s.hour)) {
    const bills = networkBills(s);
    const total = cents(-bills.reduce((sum, b) => sum + b.amount, 0));
    s.cash = cents(s.cash - total);
    s.ledger = [...s.ledger, ...bills];
    s.network = { ...s.network, dcTb: {}, goodwill: s.network.goodwill * (1 - GOODWILL_DECAY) };
    if (total > 0) events.push({ app: "Network", key: "event.networkBills", params: { total } });
  }
  return events;
}
