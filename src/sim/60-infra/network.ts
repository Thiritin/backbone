// Traffic, exits, routing, billing, peering and DDoS per zone. Values come from docs/design/economy.md (Traffic and bandwidth).
import { lineFactor } from "../46-finance/payables";
import { hashRng, rand } from "../00-core/rng";
import { isMonthStart, yearOf } from "../00-core/time";
import {
  carrierById, COMMITS, DC_BANDWIDTH, dcPerTb, DDOS, DECLINE_COOLDOWN_HOURS, EXCHANGE_FEES, exchangeById, exchangePortPrice, PEERS, PROTECTIONS,
  FAST_LINE, LATENCY_MS, QUEUEING, REQUEST_DAILY, REQUEST_DAYS, SATURATION_FLOOR, SATURATION_PENALTY, TB_PER_MBPS_HOUR, transitPerMbps, zoneLinkPrice,
  type Peer, type Protection, type ZoneLinkKind,
} from "../10-catalog/network";
import { TRAFFIC_GROWTH } from "../10-catalog/products";
import { idNum, TRAFFIC_BURST, trafficShape } from "../10-catalog/usage";
import { datacenterById, homeLineById, inUs } from "../20-world/datacenters";
import type { Service } from "../30-customers/customers";
import { bump, createTicket, OUTAGE_WRITE_CHANCE, profileStats, slowed } from "../40-support/tickets";
import { attention, segmentOf } from "../10-catalog/attention";
import { serviceHeld } from "../45-billing/billing";
import type { GameState, LedgerEntry, Location } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { addressBills } from "./addresses";
import { UPLINK_MONTHLY } from "./oob";
import { workloadsOf } from "./cluster";
import { routerMbps, throughputShare } from "./routers";
import { working, type Hop } from "./status";

// A link takes one router port; it carries traffic from readyAt on, while its router works.
export interface UplinkLink { id: string; gbit: number; device: string; port: number; readyAt: number }
// A contract with one carrier (transit) or one exchange's ports in one zone. commit is the share of capacity always billed;
// samples are one 5-minute reading of the Mbit/s carried in each of the last 30 days of hours (see burstFactor).
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

// A running service's Mbit/s this hour: its GB per month, grown 20% a year since it started, spread over the month's seconds and
// shaped by its activity and night job.
export function serviceMbps(s: GameState, v: Service, hour: number = s.hour): number {
  const c = s.customers.find((x) => x.id === v.customerId);
  return (v.spec.trafficGb * Math.pow(TRAFFIC_GROWTH, Math.max(0, hour - v.startedAt) / 8760) * 8000) / (730 * 3600) * (c ? trafficShape(s.seed, v, c.profile, hour) : 1);
}

export const zoneOf = (s: GameState, v: Service): Location | undefined => (v.zone ? s.locations.find((l) => l.az === v.zone) : undefined);
const running = (s: GameState, v: Service) => v.endedAt === null && !serviceHeld(s, v) && workloadsOf(s, v.id).length > 0;

// The attack's Mbit/s that reaches your links: always-on filters it, on-demand after the detection delay, a blackhole drops it.
export function attackMbps(s: GameState, a: Attack): number {
  if (a.blackholed || s.network.protection === "alwaysOn") return 0;
  if (s.network.protection === "onDemand") return s.hour === a.startedAt ? a.mbps * DDOS.detectShare : 0;
  return a.mbps;
}

// Mbit/s each location sends this hour, attacks included, and its burst: how much its 5-minute traffic swings around that.
// Independent senders add up their variance, so many customers smooth each other out.
export function zoneTraffic(s: GameState): { demand: Record<string, number>; burst: Record<string, number> } {
  const demand: Record<string, number> = {}, variance: Record<string, number> = {};
  const add = (id: string, mbps: number, cv: number) => {
    demand[id] = (demand[id] ?? 0) + mbps;
    variance[id] = (variance[id] ?? 0) + (mbps * cv) ** 2;
  };
  for (const v of s.services) {
    const loc = zoneOf(s, v);
    if (loc && running(s, v)) add(loc.id, serviceMbps(s, v), TRAFFIC_BURST[v.product] ?? TRAFFIC_BURST.other);
  }
  for (const a of s.network.attacks) add(a.locationId, attackMbps(s, a), DDOS.burst);
  const burst = Object.fromEntries(Object.keys(demand).map((id) => [id, demand[id] > 0 ? Math.sqrt(variance[id]) / demand[id] : 0]));
  return { demand, burst };
}
export const zoneDemand = (s: GameState): Record<string, number> => zoneTraffic(s).demand;

const PHI = (Math.sqrt(5) - 1) / 2;
// One 5-minute sample standing in for the hour: a lognormal draw with the zone's burst, at a quantile that steps by the
// golden ratio each hour so 30 days of hours cover the spread evenly. Its 95th percentile matches 5-minute billing.
export function burstFactor(seed: number, locationId: string, hour: number, burst: number): number {
  if (burst <= 0) return 1;
  const u = (rand(hashRng(seed, idNum(locationId))) + hour * PHI) % 1;
  const z = 4.91 * (u ** 0.14 - (1 - u) ** 0.14), s2 = Math.log(1 + burst * burst);
  return Math.exp(Math.sqrt(s2) * z - s2 / 2);
}

export const linkUp = (s: GameState, l: UplinkLink): boolean => l.readyAt <= s.hour && working(s, l.device);
// A router passes on at most its throughput, shared among the links on it.
const routedGbit = (s: GameState, device: string): number =>
  s.network.uplinks.flatMap((x) => x.links).filter((l) => l.device === device && linkUp(s, l)).reduce((n, l) => n + l.gbit, 0);
export const uplinkMbps = (s: GameState, u: Uplink): number =>
  u.links.filter((l) => linkUp(s, l)).reduce((n, l) => n + l.gbit * 1000 * throughputShare(s, l.device, routedGbit(s, l.device)), 0);
export const capacityMbps = (u: Uplink): number => u.links.reduce((n, l) => n + l.gbit * 1000, 0);

// Peers reached through an exchange: the route-server networks there, plus your sessions on it.
export function peersVia(s: GameState, exchange: string): Peer[] {
  return PEERS.filter((p) => p.exchanges.includes(exchange)
    && (p.policy === "routeServer" || s.network.sessions.some((x) => x.peer === p.id && x.exchange === exchange)));
}

// tier 0 is exchange peering, limited to the traffic its peers take; 1 is transit; 2 the datacenter's own transit or the home line.
interface Exit { id: string; tier: number; cap: number; used: number; share: number }

export function exitsOf(s: GameState, loc: Location): Exit[] {
  if (!loc.dc) return [{ id: "home", tier: 2, cap: Math.min(homeLineById(s.homeLine.id).up * lineFactor(s), routerMbps(s, loc)), used: 0, share: 1 }];
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

export interface ZoneRoute { demand: number; carried: number; dropped: number; burst: number; exits: Record<string, number> }
export interface Routing { zones: Record<string, ZoneRoute>; links: Record<string, number> }

// Routes this hour's traffic: each zone through its own exits, then overflow over links to other zones' spare capacity.
export function route(s: GameState): Routing {
  const { demand, burst } = zoneTraffic(s);
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
    zones[loc.id] = { demand: d, carried: d - dropped, dropped, burst: burst[loc.id] ?? 0, exits: Object.fromEntries(exits[loc.id].map((e) => [e.id, e.used])) };
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

// Each link runs over a cross-connect to its partner; ones the player ordered in the provider's portal are billed there instead.
export const crossConnects = (s: GameState, u: Uplink): number => {
  const loc = s.locations.find((l) => l.id === u.locationId);
  if (!loc?.dc) return 0;
  const ordered = s.crossConnects.filter((x) => x.to === u.partner && s.contracts.some((c) => c.id === x.contractId && c.locationId === loc.id)).length;
  return Math.max(0, u.links.length - ordered) * datacenterById(loc.dc).crossConnect;
};

export function zoneLinkMonthly(s: GameState, zl: ZoneLink): number {
  const a = s.locations.find((l) => l.id === zl.a), b = s.locations.find((l) => l.id === zl.b);
  return zoneLinkPrice(zl.kind, zl.gbit, a?.city === b?.city, yearOf(s.hour), !!a && !!b && inUs(a.city) !== inUs(b.city));
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
    const xc = crossConnects(s, u), dc = s.locations.find((l) => l.id === u.locationId)?.dc;
    if (dc) line("ledger.crossConnects", { location: name(u.locationId), count: Math.round(xc / datacenterById(dc).crossConnect) }, xc);
  }
  for (const x of n.memberships) line("ledger.exchangeMember", { exchange: exchangeById(x)!.name }, EXCHANGE_FEES.yearly / 12);
  for (const [id, tb] of Object.entries(n.dcTb)) line("ledger.dcBandwidth", { location: name(id), tb: round2(tb) }, tb * dcPerTb(year));
  for (const zl of n.zoneLinks.filter((z) => z.readyAt <= s.hour)) line("ledger.zoneLink", { a: name(zl.a), b: name(zl.b) }, zoneLinkMonthly(s, zl));
  for (const d of s.devices) if (d.uplink) line(d.uplink === "dsl" ? "ledger.mgmtDsl" : "ledger.mgmtModem", { device: d.label ?? d.name }, UPLINK_MONTHLY[d.uplink]);
  if (n.protection !== "none") line("ledger.ddosProtection", { name: PROTECTIONS[n.protection].name }, PROTECTIONS[n.protection].monthly);
  return out;
}
export const monthlyNetworkCost = (s: GameState): number => -[...networkBills(s), ...addressBills(s)].reduce((n, b) => n + b.amount, 0);

// The share of a location's exit capacity in use this hour, 0 to 1.
export function loadOf(s: GameState, r: Routing, locationId: string): number {
  const loc = s.locations.find((l) => l.id === locationId), zone = r.zones[locationId];
  const exits = loc && zone ? exitsOf(s, loc) : [];
  const cap = exits.reduce((n, e) => n + e.cap, 0);
  return cap > 0 ? Math.min(1, exits.reduce((n, e) => n + (zone.exits[e.id] ?? 0), 0) / cap) : 0;
}

// What a route adds up to: the one-way milliseconds each hop adds and the share of packets lost. A line or uplink above
// 80% of its capacity queues, which adds delay and loss.
export function latency(s: GameState, hops: Hop[]): { ms: number[]; loss: number } {
  const r = route(s);
  let loss = 0;
  const ms = hops.map((h) => {
    let base: number = h.kind === "line" && yearOf(s.hour) >= FAST_LINE.from ? FAST_LINE.ms : LATENCY_MS[h.kind];
    const over = h.location ? Math.max(0, loadOf(s, r, h.location) - QUEUEING.knee) : 0;
    base += over * QUEUEING.delayMs;
    loss += over * QUEUEING.lossPerUnit;
    return base;
  });
  return { ms, loss };
}

// Your busiest hour of the last day over all zones, in Mbit/s; peers judge you by it.
export function peakMbps(s: GameState): number {
  const totals = Array.from({ length: 24 }, (_, i) => Object.values(s.network.history).reduce((n, h) => n + (h[h.length - 1 - i]?.[1] ?? 0), 0));
  return Math.max(0, ...totals);
}

// The basement's busiest hour of upload demand over the last 7 days, in Mbit/s.
export function homePeak(s: GameState): number {
  const loc = s.locations.find((l) => !l.dc);
  return Math.max(0, ...(loc ? s.network.history[loc.id] ?? [] : []).map(([demand]) => demand));
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
      events.push({ app: "Locations", key: "event.peeringRequest", params: { network: p.name, exchange: exchangeById(x)!.name } });
    });
  });
  s.network = { ...s.network, requests: reqs };
}

export function attacks(s: GameState, events: SimEvent[]) {
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
    events.push({ app: "Locations", key: "event.ddos", params: { service: v.label, location: loc.name, gbit: round2(mbps / 1000) } });
    if (s.network.protection === "onDemand") {
      const fee = PROTECTIONS.onDemand.perIncident;
      s.cash = cents(s.cash - fee);
      s.ledger = [...s.ledger, { hour: s.hour, category: "transit", key: "ledger.ddosIncident", params: { name: PROTECTIONS.onDemand.name, service: v.label }, amount: -fee }];
    }
  });
  s.network = { ...s.network, attacks: list };
}

// Customers behind a saturated zone lose a quarter of their outage penalty each hour; when the zone first saturates, some write in.
// A full home line slows the basement's sites instead, by the share of traffic it drops, and says so once per line.
function saturation(s: GameState, r: Routing, events: SimEvent[]) {
  const dropShare = (id: string) => r.zones[id].dropped / r.zones[id].demand;
  const now = s.locations.filter((l) => r.zones[l.id].demand > 0 && dropShare(l.id) > SATURATION_FLOOR).map((l) => l.id);
  if (now.length) {
    s.customers = s.customers.map((c) => ({ ...c }));
    const byId = new Map(s.customers.map((c) => [c.id, c]));
    for (const v of s.services) {
      const loc = zoneOf(s, v), c = byId.get(v.customerId);
      if (!loc || !c || !now.includes(loc.id) || !running(s, v)) continue;
      if (!loc.dc) { slowed(s, c, v.id, dropShare(loc.id)); continue; }
      // Only the customers looking at the hour feel it (10-catalog/attention.ts).
      const p = profileStats(c.profile), seen = attention(segmentOf(c.profile, v.product), s.hour);
      bump(c, -p.outagePenalty * SATURATION_PENALTY * seen);
      const fresh = !s.network.saturated.includes(loc.id);
      if (fresh && rand(hashRng(s.seed, s.hour, 0x5a7, Number(v.id.replace(/\D/g, "")) || 0)) < (seen * OUTAGE_WRITE_CHANCE[p.budget]) / 2) createTicket(s, c, "outage", v.id);
    }
    for (const id of now.filter((x) => !s.network.saturated.includes(x))) {
      const loc = s.locations.find((l) => l.id === id)!;
      if (loc.dc) events.push({ app: "Locations", key: "event.saturated", params: { location: loc.name } });
      else if (!s.homeLine.full) {
        s.homeLine = { ...s.homeLine, full: true };
        const line = homeLineById(s.homeLine.id);
        events.push({ app: "Locations", key: "event.lineFull", params: { line: `${line.isp} ${line.name}`, mbit: line.up } });
      }
    }
  }
  s.network = { ...s.network, saturated: now };
}

export function networkTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  for (const u of s.network.uplinks) {
    for (const l of u.links) {
      if (l.readyAt === s.hour) events.push({ app: "Locations", key: "event.uplinkReady", params: { partner: carrierById(u.partner)?.name ?? exchangeById(u.partner)!.name, gbit: l.gbit } });
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
    uplinks: n.uplinks.map((u) => {
      const z = r.zones[u.locationId], used = z?.exits[u.id] ?? 0;
      const sample = used > 0 ? Math.min(uplinkMbps(s, u), used * burstFactor(s.seed, u.locationId, s.hour, z.burst)) : 0;
      return { ...u, samples: [...u.samples, round2(sample)].slice(-SAMPLE_HOURS) };
    }),
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
    if (total > 0) events.push({ app: "Books", key: "event.networkBills", params: { total } });
  }
  return events;
}
