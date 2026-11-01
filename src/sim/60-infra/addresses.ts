// GDD, Addresses and internet: private and public addresses, address prices, the nightly reconnect of dynamic home lines
// and mail reputation. Numbers in economy.md, Addresses and internet.
import { hashRng, rand } from "../00-core/rng";
import { dateOf, yearOf } from "../00-core/time";
import { modelById } from "../10-catalog/hardware";
import type { Spec } from "../10-catalog/products";
import { homeLineById } from "../20-world/datacenters";
import { ABUSE_HIT, BOUNCE_CHANCE, IPV6_FROM, IPV6_MONTHLY, LINE_EXTRA_V4, LIR_FEES, NOTICES_RECONNECT, OWN_ADDRESS, providerV4, RECONNECT_HOUR, REP, SPAM, STATIC_LINE_ADDRESSES } from "../10-catalog/addresses";
import type { Product } from "../30-customers/customers";
import { bump, createTicket, isFinal, profileStats } from "../40-support/tickets";
import type { GameState, LedgerEntry, Location } from "../50-state";
import { isOwnVm, vmById, type Workload } from "./cluster";
import { isSuspended } from "../45-billing/billing";
import { bounceFactor, listingTick, mailQueueTick } from "./netsvc-mail";
import { jacked, locationOf } from "./status";
import { mountedRouter } from "./routers";
import { addressOf, shareOf } from "./lan";
import type { SimEvent } from "../88-tick/tick";

// line: comes with the home line; lineExtra: bought on a business line; provider: rented in a datacenter; lir: from an own block.
export type AddressSource = "line" | "lineExtra" | "provider" | "lir";
// One public address. holder is the server (device id), the player's VM (workload id) or the customer service (service id)
// using it, null while free. The home line's first address belongs to the router and every basement machine shares it.
// rep is its mail reputation from 0 to 100; spam counts the mails sent from it today; delistAt is the hour a delist
// request clears the listing.
export interface Address {
  id: string; ip: string; v: 4 | 6; locationId: string; holder: string | null; source: AddressSource; blockId: string | null;
  rep: number; listed: boolean; spam: number; delistAt: number | null;
}
// A block of the player's own as a LIR: its prefix, its size in addresses and the location announcing it, by the company's
// own BGP router or by the datacenter provider.
export interface Block { id: string; prefix: string; size: number; locationId: string | null; boughtAt: number; byProvider?: boolean }
// lir holds the membership's start and the company's own AS number.
export interface Ips { addresses: Address[]; lir: { since: number; asn: number } | null; blocks: Block[] }
export const newIps = (): Ips => ({ addresses: [], lir: null, blocks: [] });

// Addresses -----------------------------------------------------------------------------------------------------------

const homeLoc = (s: GameState): Location | undefined => s.locations.find((l) => !l.dc);
export const lineActive = (s: GameState): boolean => homeLineById(s.homeLine.id).id !== "";
export const dynamicLine = (s: GameState): boolean => lineActive(s) && !homeLineById(s.homeLine.id).staticIp;
const ipOf = (seed: number, a: number, b: number, firsts: number[]): string => {
  const r = hashRng(seed, a, b, 251), n = () => Math.floor(rand(r) * 254) + 1;
  return `${firsts[Math.floor(rand(r) * firsts.length)]}.${n()}.${n()}.${n()}`;
};
// Telekom's dial-up pools and a static range; datacenter providers' ranges.
const DIAL_UP = [84, 87, 91, 217], STATIC = [212], DC = [78, 85, 88, 176, 188];
const hex = (r: ReturnType<typeof hashRng>) => Math.floor(rand(r) * 0xffff).toString(16);
const v6Of = (seed: number, n: number, home: boolean): string => {
  const r = hashRng(seed, n, 257);
  return `${home ? "2003" : "2a01"}:${hex(r)}:${hex(r)}:${hex(r)}::1`;
};
const newAddress = (s: GameState, a: Omit<Address, "id" | "rep" | "listed" | "spam" | "delistAt"> & Partial<Address>): Address => {
  const x: Address = { id: `ip${s.nextId++}`, rep: REP.fresh, listed: false, spam: 0, delistAt: null, ...a };
  s.ips = { ...s.ips, addresses: [...s.ips.addresses, x] };
  return x;
};
const patch = (s: GameState, id: string, p: Partial<Address>) => {
  s.ips = { ...s.ips, addresses: s.ips.addresses.map((a) => (a.id === id ? { ...a, ...p } : a)) };
};

// The location a machine, service or VM runs in.
export function machineLocation(s: GameState, id: string): Location | undefined {
  const d = s.devices.find((x) => x.id === id);
  if (d) return locationOf(s, d);
  const v = s.services.find((x) => x.id === id);
  if (v) return s.locations.find((l) => l.az === v.zone);
  const w = s.workloads.find((x) => x.id === id);
  return w ? workloadLocation(s, w) : undefined;
}
function workloadLocation(s: GameState, w: Workload): Location | undefined {
  const d = w.deviceId ? s.devices.find((x) => x.id === w.deviceId) : undefined;
  if (d) return locationOf(s, d);
  const c = s.clusters.find((x) => x.id === w.clusterId);
  if (c) return s.locations.find((l) => l.az === c.az);
  const rack = s.racks.find((r) => r.id === w.rackId);
  return s.locations.find((l) => l.id === rack?.locationId);
}

// A machine's address on its network: a device's DHCP lease (lan.ts), or for an own VM or a customer workload one on its
// host's internal network, 192.168.2.x in the basement and 10.n.1.x elsewhere.
export function machineAddress(s: GameState, id: string): string | null {
  if (s.devices.some((d) => d.id === id)) return addressOf(s, id);
  const loc = machineLocation(s, id);
  if (!loc) return null;
  const host = 10 + ((Number(id.replace(/\D/g, "")) || 0) % 240);
  return loc.dc ? `10.${s.locations.indexOf(loc) + 1}.1.${host}` : `192.168.2.${host}`;
}

// Who holds addresses for a machine: a customer's VM holds them through its service.
export const holderOf = (s: GameState, id: string): string => s.workloads.find((w) => w.id === id && !isOwnVm(w))?.serviceId ?? id;
export const addressesOf = (s: GameState, id: string): Address[] => s.ips.addresses.filter((a) => a.holder === holderOf(s, id));
export const sharedAddress = (s: GameState): Address | undefined =>
  s.ips.addresses.find((a) => a.source === "line" && a.v === 4 && a.holder?.startsWith("gw:"));
// A machine's public IPv4: its own, or in the basement the line's address it shares through the router.
export function publicV4(s: GameState, id: string): { ip: string; shared: boolean } | null {
  const own = addressesOf(s, id).find((a) => a.v === 4);
  if (own) return { ip: own.ip, shared: false };
  const loc = machineLocation(s, id), line = sharedAddress(s);
  return loc && !loc.dc && line ? { ip: line.ip, shared: true } : null;
}
export const publicV6 = (s: GameState, id: string): string | null => addressesOf(s, id).find((a) => a.v === 6)?.ip ?? null;
// A basement machine on the line's shared address is reachable while the line is live and the router shares a port to it.
export const hasPublicAddress = (s: GameState, id: string): boolean =>
  addressesOf(s, id).length > 0 || (lineActive(s) && machineLocation(s, id)?.dc === null && !!shareOf(s, id));

export const v6Offered = (s: GameState, loc: Location): boolean =>
  yearOf(s.hour) >= (loc.dc ? IPV6_FROM.dc : IPV6_FROM.home) && (!!loc.dc || lineActive(s));
const freeIn = (s: GameState, locationId: string, v: 4 | 6) => s.ips.addresses.filter((a) => a.locationId === locationId && a.v === v && a.holder === null);
// Room left in the LIR blocks the location announces: the network and broadcast addresses never count.
const blockRoom = (s: GameState, locationId: string) => s.ips.blocks.filter((b) => b.locationId === locationId)
  .map((b) => ({ b, room: b.size - 2 - s.ips.addresses.filter((a) => a.blockId === b.id).length })).filter((x) => x.room > 0);
export const freeV4 = (s: GameState, locationId: string): number =>
  freeIn(s, locationId, 4).length + blockRoom(s, locationId).reduce((n, x) => n + x.room, 0);

// Takes a free address of the location for a holder: a free one, a new one from an announced block, or for IPv6 a new one.
export function takeAddress(s: GameState, loc: Location, v: 4 | 6, holder: string): Address | null {
  const free = freeIn(s, loc.id, v)[0];
  if (free) { patch(s, free.id, { holder }); return { ...free, holder }; }
  if (v === 6) return v6Offered(s, loc) ? newAddress(s, { ip: v6Of(s.seed, s.nextId, !loc.dc), v: 6, locationId: loc.id, holder, source: loc.dc ? "provider" : "line", blockId: null }) : null;
  const room = blockRoom(s, loc.id)[0];
  if (!room) return null;
  const used = s.ips.addresses.filter((a) => a.blockId === room.b.id).length, base = room.b.prefix.split("/")[0].split(".").map(Number);
  const n = base[3] + used + 1, ip = `${base[0]}.${base[1]}.${base[2] + Math.floor(n / 256)}.${n % 256}`;
  return newAddress(s, { ip, v: 4, locationId: loc.id, holder, source: "lir", blockId: room.b.id });
}
// Buys addresses from a datacenter's provider, free until assigned.
export function buyProvider(s: GameState, loc: Location, v: 4 | 6, holder: string | null = null): Address {
  const ip = v === 4 ? ipOf(s.seed, s.nextId, 1, DC) : v6Of(s.seed, s.nextId, false);
  return newAddress(s, { ip, v, locationId: loc.id, holder, source: "provider", blockId: null });
}
// Buys one more address on the business line, next to the line's own.
export function buyLineExtra(s: GameState, loc: Location): Address {
  const ip = ipOf(s.seed, s.nextId, 4, STATIC);
  return newAddress(s, { ip, v: 4, locationId: loc.id, holder: null, source: "lineExtra", blockId: null, rep: REP.staticLine });
}

// What a service needs: own IPv4 addresses and whether it needs IPv6, in its location. A dedicated server in a datacenter
// brings its own.
export function addressNeed(product: Product, spec: Spec, loc: Location | undefined): { v4: number; v6: boolean } {
  const own = OWN_ADDRESS.includes(product) && !(product === "dedicated" && loc?.dc) ? 1 : 0;
  return { v4: Math.max(own, spec.ipv4 ?? 0), v6: !!spec.ipv6 };
}
// Whether a location can sell a line at all: a datacenter always, the basement on a live line, and on a dynamic line
// only web hosting behind its one address.
export const sellsFrom = (s: GameState, loc: Location, product: Product): boolean =>
  !!loc.dc || (lineActive(s) && (product === "webHosting" || !dynamicLine(s)));
// Whether a location can give a new service the addresses it needs.
export const addressesFit = (s: GameState, loc: Location, product: Product, spec: Spec): boolean => {
  const n = addressNeed(product, spec, loc);
  return sellsFrom(s, loc, product) && freeV4(s, loc.id) >= n.v4 && (!n.v6 || v6Offered(s, loc));
};
// Assigns a new service its addresses; the error key when the location has none free.
export function assignService(s: GameState, serviceId: string): string | null {
  const v = s.services.find((x) => x.id === serviceId), loc = v && machineLocation(s, serviceId);
  if (!v || !loc) return null;
  if (!addressesFit(s, loc, v.product, v.spec)) return "error.noFreeAddress";
  const n = addressNeed(v.product, v.spec, loc);
  for (let i = 0; i < n.v4; i++) takeAddress(s, loc, 4, serviceId);
  if (n.v6) takeAddress(s, loc, 6, serviceId);
  return null;
}

// Renumbering (economy.md, Workloads and migration): a service that moves to another location gives its IPv4 addresses back and
// takes new ones from the target's pool. Addresses of an own block stay when the company announces a block at both ends.
export const RENUMBER_PENALTY = 5;
export const RENUMBER_ANNOUNCED_PENALTY = 2;
const announces = (s: GameState, loc: Location): boolean => s.ips.blocks.some((b) => b.locationId === loc.id);
const keeps = (s: GameState, a: Address, from: Location, to: Location): boolean => a.source === "lir" && announces(s, from) && announces(s, to);
const given = (s: GameState, id: string, from: Location, to: Location): Address[] =>
  s.ips.addresses.filter((a) => a.holder === id && a.v === 4 && !keeps(s, a, from, to));

// The error key when the target holds fewer free IPv4 addresses than the services need, or null.
export function renumberError(s: GameState, serviceIds: string[], from: Location, to: Location): string | null {
  if (from.id === to.id) return null;
  const need = serviceIds.reduce((n, id) => n + given(s, id, from, to).length, 0);
  return need > freeV4(s, to.id) ? "error.noFreeAddress" : null;
}

// Moves the services' addresses to the target location. announced says per service whether its customer was told beforehand;
// a customer with a renumbered IPv4 loses RENUMBER_PENALTY happiness, less when every such service was announced.
export function renumber(s: GameState, serviceIds: string[], from: Location, to: Location, announced: (serviceId: string) => boolean): void {
  if (from.id === to.id) return;
  const late = new Map<string, boolean>();
  for (const id of serviceIds) {
    const v = s.services.find((x) => x.id === id), old = given(s, id, from, to), v6 = s.ips.addresses.some((a) => a.holder === id && a.v === 6);
    // Rented addresses go back to their provider, the others become free, and those of an own block follow the service.
    s.ips = { ...s.ips, addresses: s.ips.addresses.flatMap((a) => {
      if (a.holder !== id) return [a];
      if (a.v === 4 && keeps(s, a, from, to)) return [{ ...a, locationId: to.id }];
      return a.source === "provider" || a.source === "lineExtra" ? [] : [{ ...a, holder: null }];
    }) };
    for (let i = 0; i < old.length; i++) takeAddress(s, to, 4, id);
    if (v6) takeAddress(s, to, 6, id);
    if (v && old.length) late.set(v.customerId, (late.get(v.customerId) ?? false) || !announced(id));
  }
  for (const [customerId, notTold] of late) {
    const c = s.customers.find((x) => x.id === customerId);
    if (c && c.churnedAt === null) bump(c, -(notTold ? RENUMBER_PENALTY : RENUMBER_ANNOUNCED_PENALTY));
  }
}

// Adds spam mails to the address a machine sends from. Compromised panel hosts (reputation) and shady customers' services send through this.
export function addSpam(s: GameState, machineId: string, thousands: number): void {
  const own = addressesOf(s, machineId).find((a) => a.v === 4) ?? (machineLocation(s, machineId)?.dc ? undefined : sharedAddress(s));
  if (own) patch(s, own.id, { spam: own.spam + thousands });
}
// The machine a panel host's mail leaves from: its VM or its first server.
const mailMachine = (s: GameState, clusterId: string): string | undefined => {
  const c = s.clusters.find((x) => x.id === clusterId);
  return c?.vm ?? c?.nodes[0]?.deviceId;
};
// The address a panel host's mail leaves from: its relay's, its server's, or its panel VM's.
export const mailAddress = (s: GameState, clusterId: string): Address | undefined => {
  const via = s.netsvc.relay[clusterId];
  const machine = mailMachine(s, via && s.clusters.some((c) => c.id === via) ? via : clusterId);
  if (!machine) return undefined;
  return addressesOf(s, machine).find((a) => a.v === 4) ?? (machineLocation(s, machine)?.dc ? undefined : sharedAddress(s));
};

// Upkeep --------------------------------------------------------------------------------------------------------------

// The home line's addresses: the router's, dynamic and listed on dynamic lines, plus four more on a static line.
function syncLine(s: GameState): void {
  const loc = homeLoc(s), line = lineActive(s) ? homeLineById(s.homeLine.id) : null;
  const router = loc && mountedRouter(s, loc.id), gw = router && jacked(s, router.id);
  const want = line && gw ? `gw:${line.id}` : null;
  const ofLine = (a: Address) => (a.source === "line" || a.source === "lineExtra") && a.v === 4;
  const current = s.ips.addresses.filter(ofLine);
  if (current.some((a) => a.holder === want) || (!want && !current.length)) return;
  s.ips = { ...s.ips, addresses: s.ips.addresses.filter((a) => !ofLine(a)) };
  if (!line || !loc || !want) return;
  if (!line.staticIp) {
    newAddress(s, { ip: ipOf(s.seed, s.hour, 2, DIAL_UP), v: 4, locationId: loc.id, holder: want, source: "line", blockId: null, rep: REP.dynamic, listed: true });
    return;
  }
  const first = ipOf(s.seed, 7, 3, STATIC).split(".").map(Number), base = first[3] - (first[3] % 8);
  for (let i = 0; i < STATIC_LINE_ADDRESSES; i++) {
    newAddress(s, { ip: `${first[0]}.${first[1]}.${first[2]}.${Math.min(254, base + i + 1)}`, v: 4, locationId: loc.id, holder: i ? null : want, source: "line", blockId: null, rep: REP.staticLine });
  }
}

const isServer = (s: GameState, id: string) => !!s.devices.find((d) => d.id === id && d.rackId && modelById(d.model).server);
// Whether a holder still uses its address where it is.
function stillHeld(s: GameState, a: Address): boolean {
  if (!a.holder || a.holder.startsWith("gw:")) return true;
  if (s.devices.some((d) => d.id === a.holder)) return isServer(s, a.holder) && machineLocation(s, a.holder)?.id === a.locationId;
  const v = s.services.find((x) => x.id === a.holder);
  if (v) return v.endedAt === null && machineLocation(s, v.id)?.id === a.locationId;
  const w = s.workloads.find((x) => x.id === a.holder);
  return !!w && machineLocation(s, w.id)?.id === a.locationId;
}

// Every server in a rented location and every panel VM there holds an IPv4; one is bought when none is free.
function serverAddresses(s: GameState): void {
  const machines = [
    ...s.devices.filter((d) => isServer(s, d.id)).map((d) => d.id),
    ...new Set(s.clusters.map((c) => c.vm).filter((id): id is string => !!id && !!vmById(s, id))),
  ];
  for (const id of machines) {
    const loc = machineLocation(s, id);
    if (!loc?.dc || addressesOf(s, id).some((a) => a.v === 4)) continue;
    if (!takeAddress(s, loc, 4, id)) buyProvider(s, loc, 4, id);
  }
}

// Customer services from before addresses get theirs, bought where none is free.
export function fillAddresses(s: GameState): GameState {
  syncLine(s);
  serverAddresses(s);
  for (const v of s.services.filter((x) => x.endedAt === null)) {
    const loc = machineLocation(s, v.id);
    if (!loc) continue;
    const n = addressNeed(v.product, v.spec, loc), has = s.ips.addresses.filter((a) => a.holder === v.id);
    for (let i = has.filter((a) => a.v === 4).length; i < n.v4; i++) if (!takeAddress(s, loc, 4, v.id) && loc.dc) buyProvider(s, loc, 4, v.id);
    if (n.v6 && !has.some((a) => a.v === 6)) takeAddress(s, loc, 6, v.id);
  }
  return s;
}

// The nightly forced disconnect of a dynamic line: a new address after a few minutes offline, too short to bill. Businesses
// lose patience with it: their mail, VPNs and DNS break on every new address.
function reconnect(s: GameState): void {
  const shared = sharedAddress(s), loc = homeLoc(s);
  if (!shared || !loc) return;
  patch(s, shared.id, { ip: ipOf(s.seed, s.hour, 2, DIAL_UP) });
  const down = s.services.filter((v) => v.endedAt === null && v.zone === loc.az);
  const hit = new Set(down.map((v) => v.customerId));
  s.customers = s.customers.map((c) => {
    if (!hit.has(c.id) || c.churnedAt !== null || !NOTICES_RECONNECT.includes(c.profile)) return c;
    const n = { ...c };
    bump(n, -profileStats(c.profile).outagePenalty / 2);
    return n;
  });
}

// The address a service's traffic and mail leave from: its own, its panel host's, or the basement line's.
export function serviceAddress(s: GameState, serviceId: string): Address | undefined {
  const own = s.ips.addresses.find((a) => a.holder === serviceId && a.v === 4);
  if (own) return own;
  const w = s.workloads.find((x) => x.serviceId === serviceId);
  const host = w?.clusterId ? s.clusters.find((c) => c.id === w.clusterId) : undefined;
  if (host?.kind === "panel") return mailAddress(s, host.id);
  if (w?.deviceId) return addressesOf(s, w.deviceId).find((a) => a.v === 4) ?? (machineLocation(s, serviceId)?.dc ? undefined : sharedAddress(s));
  return machineLocation(s, serviceId)?.dc ? undefined : sharedAddress(s);
}

// Abuse reports from the last day about content on an address cost it reputation (ABUSE_HIT).
function abuseHits(s: GameState): void {
  for (const t of s.tickets) {
    const hit = ABUSE_HIT[`${t.kind}.${t.topic}`];
    if (!hit || !t.serviceId || s.hour - t.createdAt > 24 || s.hour - t.createdAt < 1) continue;
    const a = serviceAddress(s, t.serviceId);
    if (a) patch(s, a.id, { rep: Math.max(0, a.rep - hit) });
  }
}

// Daily: spam and abuse lower reputation, a listing follows below the threshold, clean days bring it back, delist requests clear.
function reputation(s: GameState, events: SimEvent[]): void {
  abuseHits(s);
  const hacked = s.security.hacked, shady = new Set(s.customers.filter((c) => c.shady && c.churnedAt === null && !isSuspended(s, c.id)).map((c) => c.id));
  const spamTo = (a: Address | undefined, n: number) => a && patch(s, a.id, { spam: s.ips.addresses.find((x) => x.id === a.id)!.spam + n });
  for (const id of hacked) spamTo(mailAddress(s, id), SPAM.hacked);
  for (const v of s.services.filter((x) => x.endedAt === null && shady.has(x.customerId))) spamTo(serviceAddress(s, v.id), SPAM.shady);
  // A defaced customer site sends from its host's address.
  for (const id of s.sites.defaced) {
    const host = s.workloads.find((w) => w.serviceId === id)?.clusterId, machine = host ? mailMachine(s, host) : undefined;
    if (machine) addSpam(s, machine, SPAM.shady);
  }
  s.ips = {
    ...s.ips, addresses: s.ips.addresses.map((a) => {
      if (a.v === 6) return a;
      const dynamic = a.source === "line" && dynamicLine(s);
      const rep = Math.max(0, Math.min(100, a.rep - a.spam * REP.perThousand + (a.spam ? 0 : REP.recover)));
      const delisted = a.delistAt !== null && a.delistAt <= s.hour;
      const listed = dynamic || (!delisted && (rep < REP.listAt || (a.listed && rep < REP.clearAt)));
      if (listed && !a.listed) events.push({ app: "Locations", key: "event.addressListed", params: { ip: a.ip } });
      return { ...a, spam: 0, rep: delisted ? Math.max(rep, rep + REP.delist) : dynamic ? Math.min(rep, REP.dynamic) : rep, listed, delistAt: delisted ? null : a.delistAt };
    }),
  };
}

// Mail customers behind a listed address write in when their mail bounces.
function bounces(s: GameState): void {
  for (const c of s.clusters.filter((x) => x.kind === "panel")) {
    const addr = mailAddress(s, c.id);
    if (!addr?.listed) continue;
    const chance = BOUNCE_CHANCE * bounceFactor(s, addr.id);
    const ids = new Set(s.workloads.filter((w) => w.clusterId === c.id && w.serviceId).map((w) => w.serviceId));
    for (const v of s.services.filter((x) => ids.has(x.id) && x.endedAt === null && x.spec.mailboxes > 0)) {
      const cust = s.customers.find((x) => x.id === v.customerId);
      if (!cust || cust.churnedAt !== null || rand(hashRng(s.seed, s.hour, Number(v.id.replace(/\D/g, "")), 263)) >= chance) continue;
      if (s.tickets.some((t) => t.customerId === cust.id && t.topic === "bounce" && !isFinal(t))) continue;
      createTicket(s, cust, "howTo", v.id, "bounce");
    }
  }
}

// Hourly upkeep: line addresses, held addresses, server addresses, the reconnect at 3:00 and the daily reputation run.
export function addressTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  syncLine(s);
  const gone = s.ips.addresses.filter((a) => !stillHeld(s, a));
  if (gone.length) s.ips = { ...s.ips, addresses: s.ips.addresses.map((a) => (gone.includes(a) ? { ...a, holder: null } : a)) };
  serverAddresses(s);
  if (s.hour % 24 === RECONNECT_HOUR && dynamicLine(s)) reconnect(s);
  if (s.hour % 24 === 0) {
    reputation(s, events);
    listingTick(s);
    mailQueueTick(s);
    bounces(s);
  }
  return events;
}

// Monthly bills: provider addresses at the volume tier of their count, extra business line addresses and, in the month the
// LIR joined, the yearly membership fee.
export function addressBills(s: GameState): LedgerEntry[] {
  const year = yearOf(s.hour), mine = s.ips.addresses.filter((a) => a.source === "provider");
  const v4 = mine.filter((a) => a.v === 4).length, v6 = mine.filter((a) => a.v === 6).length;
  const extra = s.ips.addresses.filter((a) => a.source === "lineExtra").length;
  const out: LedgerEntry[] = [];
  const amount = Math.round((v4 * providerV4(year, v4) + v6 * IPV6_MONTHLY + extra * LINE_EXTRA_V4) * 100) / 100;
  if (amount > 0) out.push({ hour: s.hour, category: "rent", key: "ledger.addresses", params: { count: v4 + v6 + extra }, amount: -amount });
  const lir = s.ips.lir;
  if (lir && s.hour > lir.since && dateOf(s.hour).getUTCMonth() === dateOf(lir.since).getUTCMonth()) out.push({ hour: s.hour, category: "rent", key: "ledger.lirYearly", params: {}, amount: -LIR_FEES.yearly });
  return out;
}
