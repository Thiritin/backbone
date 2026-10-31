import { nowHours, yearOf } from "../00-core/time";
import { wanPort, wattsFactorOf, boardVendor, COMPONENTS, cpuWattsShift, genOf, isOobPort, jacksOf, modelById, oobFits, oobPortOf, type ComponentKind, type DeviceKind } from "../10-catalog/hardware";
import { cpuModel, skuOf, SMT_SHARE, type Vendor } from "../10-catalog/cpus";
import { cardWatts } from "../10-catalog/gpu";
import { partPrice } from "../10-catalog/parts";
import { BASEMENT, capacityAt, datacenterById, EXTRA_STEP_KW, extraStepPrice, homeLineById, inUs, MOVE, rackUnits, regionOf, SHARE_RACKS, spacePrice, type Datacenter } from "../20-world/datacenters";
import { CITY_TLD } from "../30-customers/domains";
import { activeServices, type Service } from "../30-customers/customers";
import { serverOsById } from "../10-catalog/server-os";
import { egress, ingress, MGMT_VLAN } from "./switches";
import type { Component, Device, End, GameState, Location, NetFail, Rack, SpaceKind } from "../50-state";
import { gatewayOf } from "./lan";
import type { Workload } from "./cluster";

export interface LinkStatus { online: boolean; gbit: number; warning: "bondNotGrouped" | null }

const same = (x: End, y: End) => x.device === y.device && x.port === y.port;
const kindOf = (s: GameState, id: string) => modelById(s.devices.find((d) => d.id === id)!.model).kind;
const gbitOf = (s: GameState, e: End) => modelById(s.devices.find((d) => d.id === e.device)!.model).ports[e.port].gbit;
const modelOf = (s: GameState, id: string) => modelById(s.devices.find((d) => d.id === id)!.model);
// The other side of a patch panel jack: front i is wired to back jacks + i.
const bridged = (s: GameState, e: End) => {
  const jacks = jacksOf(modelOf(s, e.device));
  return e.port < jacks ? e.port + jacks : e.port - jacks;
};

export function peerOf(s: GameState, e: End): End | null {
  const c = s.cables.find((c) => same(c.a, e) || same(c.b, e));
  return c ? (same(c.a, e) ? c.b : c.a) : null;
}

// The peer of every port on a device, or null for a free port.
export function portPeers(s: GameState, deviceId: string): (End | null)[] {
  const d = s.devices.find((x) => x.id === deviceId);
  return d ? modelById(d.model).ports.map((_, port) => peerOf(s, { device: deviceId, port })) : [];
}

// The first non-patch port behind a port's cable, and the slowest speed on the way.
export function farEnd(s: GameState, from: End): { end: End; gbit: number } | null {
  const gbit = gbitOf(s, from);
  let peer = peerOf(s, from);
  for (let hops = 0; peer && kindOf(s, peer.device) === "patch" && hops < 64; hops++) peer = peerOf(s, { device: peer.device, port: bridged(s, peer) });
  // A management jack on a data port carries no data.
  if (!peer || kindOf(s, peer.device) === "patch" || isOobPort(peer.port)) return null;
  return { end: peer, gbit: Math.min(gbit, gbitOf(s, peer)) };
}

// Servers never forward traffic; switches and firewalls forward between all ports, patch panels between a jack's front and back.
// Firewalls slower than minGbit block the path.
// A router with a DSL port carries traffic only while that port reaches the line jack and a home line is live.
export const jacked = (s: GameState, gatewayId: string): boolean => {
  const wan = wanPort(modelOf(s, gatewayId)), jack = wan >= 0 && farEnd(s, { device: gatewayId, port: wan });
  return !!jack && kindOf(s, jack.end.device) === "jack";
};
const lineUp = (s: GameState, gatewayId: string): boolean => wanPort(modelOf(s, gatewayId)) < 0 || (jacked(s, gatewayId) && !!s.homeLine.id);

// A frame leaves the server untagged; managed switches forward it only between ports of its VLAN (switches.ts), and a
// gateway takes it only untagged.
function reachesGateway(s: GameState, start: End, origin: string, minGbit: number, tag0: number | null = null): boolean {
  const seen = new Set([origin]);
  const queue: { at: End; tag: number | null }[] = [{ at: start, tag: tag0 }];
  while (queue.length) {
    const { at, tag } = queue.shift()!;
    const model = modelOf(s, at.device);
    if (!working(s, at.device)) continue;
    if (model.kind === "gateway") { if (tag === null) return lineUp(s, at.device); continue; }
    if (model.kind === "firewall" && model.throughputGbit! < minGbit) continue;
    const sw = model.managed ? s.devices.find((x) => x.id === at.device)! : null;
    const vlan = sw ? ingress(sw, at.port, tag) : tag;
    const key = `${model.kind === "patch" ? `${at.device}:${at.port}` : at.device}:${vlan}`;
    if (model.kind === "server" || vlan === undefined || seen.has(key)) continue;
    seen.add(key);
    const exits = model.kind === "patch" ? [bridged(s, at)] : model.ports.map((_, i) => i);
    for (const port of exits) {
      const out = sw ? egress(sw, port, vlan!) : vlan;
      const peer = peerOf(s, { device: at.device, port });
      if (out !== undefined && peer && !isOobPort(peer.port)) queue.push({ at: peer, tag: out });
    }
  }
  return false;
}

// Whether a managed switch's management interface, in MGMT_VLAN, reaches the location's gateway: the way the player's desk reaches it.
export function mgmtReachesGateway(s: GameState, d: Device): boolean {
  if (!working(s, d.id)) return false;
  return modelById(d.model).ports.some((_, port) => {
    const tag = egress(d, port, MGMT_VLAN), peer = peerOf(s, { device: d.id, port });
    return tag !== undefined && !!peer && !isOobPort(peer.port) && reachesGateway(s, peer, d.id, 0, tag);
  });
}

// The fastest firewall cap on any path to a gateway: Infinity without a firewall on the way, null without a path.
function gatewayCap(s: GameState, start: End, origin: string): number | null {
  const caps = [...new Set(s.devices.map((d) => modelById(d.model)).filter((m) => m.kind === "firewall").map((m) => m.throughputGbit!))].sort((a, b) => b - a);
  return [Infinity, ...caps].find((cap) => reachesGateway(s, start, origin, cap)) ?? null;
}

// A device is online when it has power and a cable path through powered switches and patch panels reaches a gateway.
function computeLinkStatus(s: GameState, deviceId: string): LinkStatus {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d || !working(s, d.id)) return { online: false, gbit: 0, warning: null };
  const ports = modelById(d.model).ports;
  if (modelById(d.model).kind === "gateway") return { online: lineUp(s, d.id), gbit: Math.max(...ports.map((p) => p.gbit)), warning: null };
  const own = modelById(d.model).throughputGbit ?? Infinity;
  const ends = ports.map((_, port) => farEnd(s, { device: deviceId, port }));
  // An unbonded server only uses its first cabled port.
  const first = ends.findIndex(Boolean);
  const up = (modelById(d.model).kind === "server" && d.bond === "none" ? ends.slice(first, first + 1) : ends)
    .flatMap((f) => {
      const cap = f && gatewayCap(s, f.end, deviceId);
      return f && cap !== null ? [{ ...f, gbit: Math.min(f.gbit, cap, own) }] : [];
    });
  // A server also needs an address from the router whose network it is on (lan.md, The derived layer).
  if (!up.length || (modelById(d.model).kind === "server" && !gatewayOf(s, d.id))) return { online: false, gbit: 0, warning: null };
  const fastest = Math.max(...up.map((f) => f.gbit));
  if (d.bond !== "balance" || up.length === 1) return { online: true, gbit: fastest, warning: null };
  const sw = s.devices.find((x) => x.id === up[0].end.device)!;
  const grouped = modelById(sw.model).kind === "switch" && up.every((f) => f.end.device === sw.id)
    && sw.groups.some((g) => up.every((f) => g.includes(f.end.port)));
  return grouped ? { online: true, gbit: up.reduce((sum, f) => sum + f.gbit, 0), warning: null } : { online: true, gbit: fastest, warning: "bondNotGrouped" };
}

// Where a rack stands, whether it is still in transit, and its height in units.
export function spotOf(s: GameState, id: string | null): { locationId: string; moving: boolean; units: number } | undefined {
  const rack = s.racks.find((r) => r.id === id);
  return rack && { locationId: rack.locationId, moving: rack.arriveAt !== null, units: rackUnits(rack.model) };
}

// One step of a route. device is set for your own hardware; location for a line or uplink, whose load slows it.
export type HopKind = "switch" | "firewall" | "gateway" | "host" | "line" | "uplink" | "domestic" | "european" | "overseas";
export interface Hop { kind: HopKind; name: string; device?: string; location?: string }

const hostName = (d: Device) => d.hostname ?? d.label ?? d.name;
const hopOf = (s: GameState, id: string): Hop => {
  const d = s.devices.find((x) => x.id === id)!, kind = modelById(d.model).kind;
  return { kind: d.model === "handoff" ? "uplink" : kind === "server" ? "host" : (kind as HopKind), name: hostName(d), device: d.id };
};

// The devices on a shortest cabled path from one device to the first that meets goal (patch panels skipped). A server only ends a path.
// With live set, every device on the way must work, except the exempt one.
function cabled(s: GameState, from: string, goal: (id: string) => boolean, live: boolean, exempt = ""): string[] | null {
  const parent = new Map<string, string>();
  const queue = [from];
  for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
    const ok = !live || at === exempt || working(s, at);
    if (goal(at) && ok) {
      const ids = [at];
      while (parent.has(ids[0])) ids.unshift(parent.get(ids[0])!);
      return ids;
    }
    if (!ok || (at !== from && kindOf(s, at) === "server")) continue;
    for (let port = 0; port < modelOf(s, at).ports.length; port++) {
      const next = farEnd(s, { device: at, port })?.end.device;
      if (next && next !== from && !parent.has(next)) { parent.set(next, at); queue.push(next); }
    }
  }
  return null;
}

// Whether a hop of a route is cut: a stopped device, or a basement without an internet line.
export const hopDown = (s: GameState, h: Hop): boolean => (h.device ? !working(s, h.device) : h.kind === "line" && !s.homeLine.id);

// The hops from a device out to its location's edge: the gateway, then the carrier line (basement) or the datacenter's uplink.
function toEdge(s: GameState, id: string, loc: Location, live: boolean, exempt?: string): Hop[] | null {
  const ids = cabled(s, id, (x) => kindOf(s, x) === "gateway", live, exempt);
  if (!ids) return null;
  const hops = ids.map((x) => hopOf(s, x));
  if (!loc.dc) return [...hops, { kind: "line", name: homeLineById(s.homeLine.id).isp || "line", location: loc.id }];
  const uplink: Hop = { kind: "uplink", name: datacenterById(loc.dc).name, location: loc.id };
  if (hops[hops.length - 1].kind === "uplink") hops[hops.length - 1] = { ...hops[hops.length - 1], ...uplink };
  else hops.push(uplink);
  return hops;
}

// The working route from a device out to its location's edge, or null.
export function routeOut(s: GameState, id: string): Hop[] | null {
  const d = s.devices.find((x) => x.id === id), loc = d && locationOf(s, d);
  return loc ? toEdge(s, id, loc, true) : null;
}

// The cabled route from one device to another, through the home line or a datacenter's uplink and the distance between cities when they
// sit in different locations. Null when no route works; with live off the route ignores stopped devices, to show where a trace ends.
export function pathTo(s: GameState, fromId: string, toId: string, live = true): Hop[] | null {
  const a = s.devices.find((d) => d.id === fromId), b = s.devices.find((d) => d.id === toId);
  const la = a && locationOf(s, a), lb = b && locationOf(s, b);
  if (!la || !lb) return null;
  let hops: Hop[] | null;
  if (la.id === lb.id) hops = cabled(s, fromId, (x) => x === toId, live, toId)?.map((x) => hopOf(s, x)) ?? null;
  else {
    const out = toEdge(s, fromId, la, live), back = toEdge(s, toId, lb, live, toId);
    const scope: HopKind | null = la.city === lb.city ? null : inUs(la.city) !== inUs(lb.city) ? "overseas" : CITY_TLD[la.city]?.tld === CITY_TLD[lb.city]?.tld ? "domestic" : "european";
    hops = out && back ? [...out, ...(scope ? [{ kind: scope, name: `core1.${regionOf(lb).id}` }] : []), ...back.reverse()] : null;
  }
  return hops && live && hops.slice(0, -1).some((h) => hopDown(s, h)) ? null : hops;
}

// Every slot where a device of this height fits, lowest first. Units rented out for colocation are taken.
export function freeSlots(s: GameState, rackId: string, height: number): number[] {
  const rack = s.racks.find((r) => r.id === rackId);
  if (!rack) return [];
  const used = new Set(s.devices.filter((d) => d.rackId === rackId).flatMap((d) => {
    const h = modelById(d.model).height;
    return Array.from({ length: h }, (_, i) => d.slot + i);
  }).concat(s.workloads.filter((w) => w.rackId === rackId).flatMap((w) => Array.from({ length: w.units }, (_, i) => w.slot + i))));
  const free: number[] = [];
  const units = rackUnits(rack.model);
  for (let slot = 1; slot + height - 1 <= units; slot++) {
    if (Array.from({ length: height }, (_, i) => slot + i).every((u) => !used.has(u))) free.push(slot);
  }
  return free;
}

// The lowest slot for count devices of this height stacked over the clicked unit, its top on that unit where it fits.
export function mountFrom(s: GameState, rackId: string, height: number, count: number, unit: number): number | undefined {
  const span = height * count;
  return freeSlots(s, rackId, span).find((from) => from <= unit && unit < from + span);
}

// The most devices of this height, up to count, that fit stacked over the clicked unit.
export function mountMax(s: GameState, rackId: string, height: number, count: number, unit: number): number {
  let n = count;
  while (n > 0 && mountFrom(s, rackId, height, n, unit) === undefined) n--;
  return n;
}

const MONTH = 730;

// The location a device is in, or undefined in storage.
export function locationOf(s: GameState, d: Device): Location | undefined {
  const id = d.panel ?? spotOf(s, d.rackId)?.locationId;
  return s.locations.find((l) => l.id === id);
}

export const holdsData = (s: GameState, d: Device): boolean => s.workloads.some((w) => w.deviceId === d.id);

// 100% to 80% over the first month, then down to 20% over the next 24 months.
export function resaleValue(s: GameState, price: number, boughtAt: number): number {
  const months = Math.max(0, s.hour - boughtAt) / MONTH;
  const share = months <= 1 ? 1 - 0.2 * months : Math.max(0.2, 0.8 - (0.6 * (months - 1)) / 24);
  return Math.round(price * share * 100) / 100;
}

// What a device sells for. A sized spare part sells at the current part price, anything else at what was paid.
export const deviceValue = (s: GameState, d: Device): number =>
  resaleValue(s, d.part ? partPrice(d.model.slice(5) as ComponentKind, d.part.size, d.part.ff, yearOf(s.hour), d.part) : d.price, d.boughtAt);

export const psusOf = (d: Device) => d.components.filter((c) => c.kind === "psu");
export const isPlugged = (c: Component) => c.plugged !== false;
// A device gets power through a plugged-in supply that has not failed; one without supplies needs none.
export const pluggedIn = (d: Device) => { const p = psusOf(d); return !p.length || p.some((c) => isPlugged(c) && c.failedAt === null); };
// A server with two live supplies in a rack with feed B splits its draw over both feeds; everything else hangs on feed A.
export const dualFed = (rack: Rack, d: Device): boolean => rack.feedB && psusOf(d).filter((c) => isPlugged(c) && c.failedAt === null).length >= 2;

// The servers that run at least one workload; the rest draw their idle power. Working GPU cards add their watts either way.
// A server under burn-in draws full power and takes no customers.
export const burning = (s: GameState, d: Device): boolean => !!d.burnin && d.burnin.until > s.hour;
export const busyDevices = (s: GameState): Set<string | null> =>
  new Set([...s.workloads.filter((w) => !w.stopped && w.deviceId).map((w) => w.deviceId), ...s.devices.filter((d) => burning(s, d)).map((d) => d.id)]);
// A server's CPUs draw their own watts in place of its preset's (cpuWattsShift); idle they draw the model's idle share of it.
export const deviceWatts = (d: Device): number => { const m = modelById(d.model), k = wattsFactorOf(m, d.brand); return (m.watts + cpuWattsShift(m, d.components)) * k + cardWatts(d.components); };
export const drawWatts = (d: Device, busy: Set<string | null>): number => {
  const m = modelById(d.model), cpus = cpuWattsShift(m, d.components), k = wattsFactorOf(m, d.brand);
  return (busy.has(d.id) ? m.watts + cpus : m.idleWatts + (cpus && (cpus * m.idleWatts) / m.watts)) * k + cardWatts(d.components);
};

const circuitKw = (loc: Location): number => BASEMENT.kw + (loc.extraCircuit ? EXTRA_CIRCUIT_KW : 0);

// ponytail: a device draws its rated power, or its idle power when it runs no workload; no finer load-based draw.
function computeRackPower(s: GameState, rackId: string): RackPower {
  const rack = s.racks.find((r) => r.id === rackId);
  const loc = rack && s.locations.find((l) => l.id === rack.locationId);
  if (!rack || !loc) return { watts: 0, a: 0, b: 0, limitWatts: 0, tripped: false };
  const busy = busyDevices(s);
  let a = 0, b = 0;
  if (rack.arriveAt === null) {
    for (const d of s.devices) {
      if (d.rackId !== rackId || !d.on || !pluggedIn(d) || chassisOut(s, d)) continue;
      const w = drawWatts(d, busy);
      if (dualFed(rack, d)) { a += w / 2; b += w / 2; } else a += w;
    }
    a += s.workloads.reduce((sum, w) => sum + (w.rackId === rackId ? w.watts : 0), 0);
  }
  const share = SHARE_RACKS.find((m) => m.id === rack.model)?.size ?? 1;
  // A high-density feed doubles a position's limit; the basement's extra circuit adds another household circuit.
  const kw = loc.dc ? datacenterById(loc.dc).kwPerPosition * (rack.highDensity ? 2 : 1) : circuitKw(loc);
  // A flat-rate contract's kW replaces the position's limit.
  const limitWatts = rack.flatKw ? Math.round(1000 * rack.flatKw) : Math.round((1000 * kw) / share) + Math.round(1000 * rack.extraKw);
  return { watts: a + b, a, b, limitWatts, tripped: a > limitWatts || b > limitWatts };
}

// Link, rack power and lookup results memoised for one sweep. Only for code that reads the infrastructure and never changes it.
// a and b are the draw on each feed; limitWatts is the limit of one feed.
type RackPower = { watts: number; a: number; b: number; limitWatts: number; tripped: boolean };
let memo: { s: GameState; link: Map<string, LinkStatus>; power: Map<string, RackPower>; groups: Map<string, Map<string, unknown[]>>; other: Map<string, unknown> } | null = null;
export function readOnlySweep<T>(s: GameState, fn: () => T): T {
  if (memo) return fn();
  memo = { s, link: new Map(), power: new Map(), groups: new Map(), other: new Map() };
  try { return fn(); } finally { memo = null; }
}
// Items grouped by key in state order, built once per sweep; null outside a sweep, where callers scan instead.
export function sweepGroups<T>(s: GameState, name: string, items: () => T[], key: (t: T) => string): Map<string, T[]> | null {
  if (memo?.s !== s) return null;
  let groups = memo.groups.get(name) as Map<string, T[]> | undefined;
  if (!groups) {
    groups = new Map();
    for (const t of items()) {
      const list = groups.get(key(t));
      if (list) list.push(t);
      else groups.set(key(t), [t]);
    }
    memo.groups.set(name, groups);
  }
  return groups;
}
export const serviceById = (s: GameState, id: string): Service | undefined => {
  const by = sweepGroups(s, "service", () => s.services, (v) => v.id);
  return by ? by.get(id)?.[0] : s.services.find((v) => v.id === id);
};
export const liveServices = (s: GameState, customerId: string): Service[] => {
  const by = sweepGroups(s, "live", () => s.services.filter((v) => v.endedAt === null), (v) => v.customerId);
  return by ? by.get(customerId) ?? [] : activeServices(s.services, customerId);
};
// The workloads of a customer's services, or every workload outside a sweep; callers filter by service.
export const customerWorkloads = (s: GameState, customerId: string): Workload[] => {
  const by = sweepGroups(s, "customerWorkloads", () => s.workloads, (w) => serviceById(s, w.serviceId)?.customerId ?? "");
  return by ? by.get(customerId) ?? [] : s.workloads;
};
const memoised = <V>(s: GameState, key: string, pick: (m: NonNullable<typeof memo>) => Map<string, V>, compute: () => V): V => {
  if (memo?.s !== s) return compute();
  const map = pick(memo);
  const hit = map.get(key);
  if (hit !== undefined) return hit;
  const v = compute();
  map.set(key, v);
  return v;
};
// Any other derived value memoised for the sweep under its key.
export const sweepMemo = <V>(s: GameState, key: string, compute: () => V): V => memoised(s, key, (m) => m.other as Map<string, V>, compute);
// docs/design/software.md, section 4.2: why a server's cables give it no internet, null when they do. Unlike linkStatus it
// leaves the server's own state out, since an installer runs while the server still counts as booting.
export function cabledOut(s: GameState, deviceId: string): NetFail | null {
  const d = s.devices.find((x) => x.id === deviceId);
  const ends = d ? modelById(d.model).ports.map((_, port) => farEnd(s, { device: deviceId, port })) : [];
  const first = ends.findIndex(Boolean);
  if (first < 0) return "noInterfaces";
  const used = d!.bond === "none" ? ends.slice(first, first + 1) : ends;
  return used.some((f) => f && gatewayCap(s, f.end, deviceId) !== null) ? null : "noLink";
}
export const linkStatus = (s: GameState, deviceId: string): LinkStatus => memoised(s, deviceId, (m) => m.link, () => computeLinkStatus(s, deviceId));
export const rackPower = (s: GameState, rackId: string): RackPower => memoised(s, rackId, (m) => m.power, () => computeRackPower(s, rackId));

// Stored devices, devices in a moving or tripped rack and devices in a location that is not ready have no power.
export const EXTRA_CIRCUIT_KW = 3;

export const isDrive = (c: Component): boolean => c.kind === "hdd" || c.kind === "ssd" || c.kind === "nvme";
export const drivesOf = (d: Device): Component[] => d.components.filter(isDrive);
// Every installed drive is an array member, failed or not, and the smallest sets the size each member contributes.
export const driveGb = (d: Device): number => {
  const sizes = drivesOf(d).map((c) => c.size ?? 0);
  return sizes.length ? Math.min(...sizes) : 0;
};
const partSum = (d: Device, kind: Component["kind"]): number => d.components.reduce((n, c) => n + (c.kind === kind && c.failedAt === null ? c.size ?? 0 : 0), 0);
// Cores and RAM of the working CPUs and sticks; a failed part stops counting.
export const installedCores = (d: Device): number => partSum(d, "cpu");
export const installedRamGb = (d: Device): number => partSum(d, "ram");
// The board's vendor, which every CPU in the server shares.
export const deviceVendor = (d: Device): Vendor => boardVendor(modelById(d.model), d.components);
// The speed of one core of the server's CPUs: its part's, or its vendor generation's, 1 without a known CPU.
export const perCoreOf = (d: Device): number => {
  const c = d.components.find((x) => x.kind === "cpu");
  if (!c) return 1;
  const vendor = c.vendor ?? deviceVendor(d), gen = c.gen ?? genOf(modelById(d.model));
  return skuOf({ ...c, vendor, gen })?.perCore ?? cpuModel(vendor, gen)?.perCore ?? 1;
};
// Threads of the working CPUs; a part without a name counts its cores.
export const installedThreads = (d: Device): number => d.components.reduce((n, c) => n + (c.kind === "cpu" && c.failedAt === null ? skuOf(c)?.threads ?? c.size ?? 0 : 0), 0);
// vCPU of the working CPUs: their cores at the speed of one core, plus SMT_SHARE of a core for every second thread.
export const installedVcpu = (d: Device): number => {
  const cores = installedCores(d);
  return Math.round((cores + (installedThreads(d) - cores) * SMT_SHARE) * perCoreOf(d) * 100) / 100;
};

// Usable GB of the array: all drives, half for mirrors, all but one or two for parity.
export function raidUsable(d: Device): number {
  const n = drivesOf(d).length, g = driveGb(d);
  // A mirror pairs drives, so an odd one out adds nothing.
  return { none: n, "1": Math.floor(n / 2), "5": n - 1, "6": n - 2, "10": Math.floor(n / 2) }[d.raid] * g;
}

// Drives the array can lose at once without losing data; RAID 10 survives one per mirror pair, so this is its guaranteed count.
export const raidTolerance = (d: Device): number => ({ none: 0, "1": 1, "5": 1, "6": 2, "10": 1 })[d.raid];

// Whether the drives that failed or are still rebuilding are more than the array survives.
export function arrayLost(d: Device): boolean {
  const drives = drivesOf(d);
  const out = drives.map((c) => c.failedAt !== null || d.rebuild?.componentId === c.id);
  if (d.raid === "10") return out.some((o, i) => i % 2 === 0 && o && out[i + 1]);
  return out.filter(Boolean).length > raidTolerance(d);
}

// A component can be swapped with the device running if it is a drive in RAID, one of two power supplies while the other works, or a fan.
export function hotSwappable(d: Device, c: Component): boolean {
  return hotKind(d, c.kind, c.id);
}
// The same rule for a part of this kind going into a slot, or out of the one named by except.
export function hotKind(d: Device, kind: Component["kind"], except?: string): boolean {
  const rule = COMPONENTS[kind].hotSwap;
  if (rule === "raid") return d.raid !== "none";
  if (rule === "dual") return d.components.some((x) => x.kind === "psu" && x.id !== except && x.failedAt === null);
  return rule === "yes";
}

// A node of a multi-node chassis is out when the chassis is off, has no working power supply or a fan of its shared wall failed.
export function chassisOut(s: GameState, d: Device): boolean {
  if (!d.chassisId) return false;
  const c = s.devices.find((x) => x.id === d.chassisId);
  return !c || !c.on || !pluggedIn(c) || c.components.some((x) => x.kind === "fan" && x.failedAt !== null);
}
// The nodes in a chassis, in bay order.
export const nodesOf = (s: GameState, chassisId: string): Device[] => s.devices.filter((d) => d.chassisId === chassisId);

// A failure takes the device down: no working power supply, a failed RAM stick, board, CPU or network card, or a lost array.
function failedDown(d: Device): boolean {
  const failed = d.components.filter((c) => c.failedAt !== null);
  const psus = d.components.filter((c) => c.kind === "psu");
  if (psus.length && psus.every((c) => c.failedAt !== null)) return true;
  if (failed.some((c) => c.kind === "ram" || c.kind === "board" || c.kind === "cpu" || c.kind === "nic")) return true;
  return drivesOf(d).some((c) => c.failedAt !== null) && arrayLost(d);
}

export function deviceHealth(s: GameState, deviceId: string): {
  state: "ok" | "booting" | "halting" | "setup" | "degraded" | "hot" | "rebuilding" | "maintenance" | "down" | "hung" | "stuck" | "locked" | "nopower" | "off"; failed: Component[]; worn: Component[];
} {
  const d = s.devices.find((x) => x.id === deviceId)!;
  const failed = d.components.filter((c) => c.failedAt !== null);
  const worn = d.components.filter((c) => c.failedAt === null && s.hour - c.installedAt >= COMPONENTS[c.kind].life * HOURS_PER_YEAR);
  const state = !d.on ? "off" : chassisOut(s, d) ? "down" : d.rackId && !pluggedIn(d) && !failedDown(d) ? "nopower" : booting(s, d) ? (d.setup ? "setup" : "booting") : halting(d) ? "halting" : d.maintenance ? "maintenance" : failedDown(d) ? "down" : d.hung ? "hung" : d.stuck ? "stuck" : d.locked ? "locked" : d.rebuild ? "rebuilding"
    : failed.some((c) => c.kind === "fan") ? "hot" : failed.length ? "degraded" : "ok";
  return { state, failed, worn };
}
export const HOURS_PER_YEAR = 8760;
export const BOOT_MINUTES = 3;
export const BOOT_HOURS = BOOT_MINUTES / 60;
// A server in its BIOS setup never finishes booting.
export const booting = (s: GameState, d: Device) => d.on && (d.setup || (d.bootUntil ?? 0) > nowHours(s));
// An installed OS adds its own boot to POST; an OS still installing (installedAt ahead) has nothing to boot yet.
export const osBootHours = (s: GameState, d: Device): number => (d.os && d.os.installedAt <= nowHours(s) ? serverOsById(d.os.id).bootMinutes / 60 : 0);
export const bootHours = (s: GameState, d: Device): number => BOOT_HOURS + osBootHours(s, d);
export const HALT_MINUTES = 1;
export const halting = (d: Device) => d.on && d.haltUntil !== undefined;
export const haltHours = (s: GameState, d: Device): number => (HALT_MINUTES + (d.os && d.os.installedAt <= nowHours(s) ? serverOsById(d.os.id).haltMinutes : 0)) / 60;

// A device works when it has power, is switched on, and no failure or power-off swap has taken it down.
export function working(s: GameState, deviceId: string): boolean {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d || !d.on || d.hung || d.stuck || d.locked || booting(s, d) || halting(d) || !powered(s, deviceId) || failedDown(d) || d.maintenance?.mount) return false;
  const swap = d.maintenance && d.components.find((c) => c.id === d.maintenance!.componentId);
  return !(swap && !hotSwappable(d, swap));
}

export function powered(s: GameState, deviceId: string): boolean {
  const d = s.devices.find((x) => x.id === deviceId);
  const loc = d && locationOf(s, d);
  if (!d || !loc || loc.readyAt > s.hour || (s.ops.dark[loc.id] ?? 0) > s.hour) return false;
  if (d.chassisId) return !chassisOut(s, d) && powered(s, d.chassisId);
  if (!d.rackId) return true;
  const rack = s.racks.find((r) => r.id === d.rackId)!;
  return rack.arriveAt === null && pluggedIn(d) && !rackPower(s, rack.id).tripped;
}

// A device switched on with every power cord pulled is as safe to open as one switched off.
export const energized = (d: Device): boolean => d.on && (!psusOf(d).length || psusOf(d).some(isPlugged));

export function freePositions(s: GameState, locationId: string): number[] {
  const loc = s.locations.find((l) => l.id === locationId);
  if (!loc) return [];
  const taken = new Set(s.racks.filter((r) => r.locationId === locationId).map((r) => r.position));
  return Array.from({ length: loc.positions }, (_, i) => i + 1).filter((p) => !taken.has(p));
}

const KIND_ORDER: DeviceKind[] = ["server", "chassis", "switch", "firewall", "patch", "ups", "pdu", "kvm", "console", "oob", "gateway", "part"];

// A zone's stored devices grouped by model and brand.
export function storageStacks(s: GameState, locationId: string): { model: string; brand: string; ids: string[] }[] {
  const stacks = new Map<string, { model: string; brand: string; ids: string[] }>();
  for (const d of s.devices.filter((x) => x.store === locationId && !x.chassisId)) {
    const key = `${d.model}|${d.brand}`;
    if (!stacks.has(key)) stacks.set(key, { model: d.model, brand: d.brand, ids: [] });
    stacks.get(key)!.ids.push(d.id);
  }
  const rank = (m: string) => KIND_ORDER.indexOf(modelById(m).kind);
  return [...stacks.values()].sort((a, b) => rank(a.model) - rank(b.model) || a.model.localeCompare(b.model) || a.brand.localeCompare(b.brand));
}

// Price and travel hours of moving a rack: same city or another city.
export function moveCost(s: GameState, rackId: string, toLocationId: string): { price: number; hours: number } {
  return travelCost(s, s.racks.find((r) => r.id === rackId)?.locationId, toLocationId);
}

// Price and hours of shipping between two zones: within a region, to another region, or across the Atlantic.
export function travelCost(s: GameState, fromId: string | undefined, toId: string): { price: number; hours: number } {
  const from = s.locations.find((l) => l.id === fromId), to = s.locations.find((l) => l.id === toId);
  if (from && to && from.city === to.city) return MOVE.sameCity;
  return from && to && inUs(from.city) !== inUs(to.city) ? MOVE.overseas : MOVE.otherCity;
}

// Why a cable between a and b can't be plugged in, or null when it can.
export function connectError(s: GameState, a: End, b: End): string | null {
  const da = s.devices.find((x) => x.id === a.device);
  const db = s.devices.find((x) => x.id === b.device);
  if (!da || !db) return "error.unknownDevice";
  const ma = modelById(da.model), mb = modelById(db.model);
  const pa = ma.ports[a.port], pb = mb.ports[b.port], oa = oobPortOf(ma, a.port), ob = oobPortOf(mb, b.port);
  if (!(pa ?? oa) || !(pb ?? ob)) return "error.unknownPort";
  if (da.id === db.id) return "error.sameDevice";
  if (peerOf(s, a) || peerOf(s, b)) return "error.portInUse";
  const la = locationOf(s, da), lb = locationOf(s, db);
  if (!la || !lb) return "error.notMounted";
  if (s.racks.some((r) => (r.id === da.rackId || r.id === db.rackId) && r.arriveAt !== null)) return "error.rackMoving";
  if (la.id !== lb.id) return "error.otherLocation";
  if (oa || ob) return oobFits(ma, (oa ?? pa)!, mb, (ob ?? pb)!) ? null : "error.mediaMismatch";
  if (pa.media !== pb.media) return "error.mediaMismatch";
  // A patch panel is passive, so the speed check happens between the devices on either side of it.
  if (ma.kind !== "patch" && mb.kind !== "patch" && pa.gbit !== pb.gbit) return "error.speedMismatch";
  return null;
}

// The size a location was rented at: n for a 1/n share, read from its provider rack; positions otherwise.
function rentedSize(s: GameState, loc: Location): number {
  if (loc.space !== "share") return loc.positions;
  const shareRack = s.racks.find((r) => r.locationId === loc.id && r.provided);
  return SHARE_RACKS.find((m) => m.id === shareRack?.model)?.size ?? 1;
}

// Monthly rent of a location.
export function locationRent(s: GameState, loc: Location): number {
  if (!loc.dc) return 0;
  const dc = datacenterById(loc.dc);
  const extra = s.racks.filter((r) => r.locationId === loc.id).reduce((sum, r) => sum + (r.extraKw / EXTRA_STEP_KW) * extraStepPrice(dc), 0);
  return spacePrice(dc, loc.space as Exclude<SpaceKind, "basement">, rentedSize(s, loc)) + extra;
}

// How a rack in this location can bill power: flat-rate contracts are offered on own racks in cages and suites.
export function flatOffer(s: GameState, locationId: string): Datacenter["power"] {
  const loc = s.locations.find((l) => l.id === locationId);
  return loc?.dc && loc.space !== "share" ? datacenterById(loc.dc).power : "metered";
}

// Floor space in eighths of a position, so a 1/8 share is 1 and a position is 8.
export const eighthsOf = (space: Exclude<SpaceKind, "basement">, size: number): number => (space === "share" ? 8 / size : 8 * size);

// Positions in a datacenter: competitors', the player's, those held for the waitlist, and what is free.
export function dcAvailability(s: GameState, dcId: string): { capacity: number; others: number; mine: number; held: number; free: number; freeEighths: number } {
  const capacity = capacityAt(datacenterById(dcId), yearOf(s.hour));
  const others = s.dcs[dcId]?.others ?? 0;
  const mineEighths = s.locations.filter((l) => l.dc === dcId).reduce((sum, l) => sum + eighthsOf(l.space as Exclude<SpaceKind, "basement">, rentedSize(s, l)), 0);
  const heldEighths = s.waitlist.filter((w) => w.dc === dcId && w.heldUntil !== null).reduce((sum, w) => sum + eighthsOf(w.space, w.size), 0);
  const freeEighths = Math.max(0, capacity * 8 - others * 8 - mineEighths - heldEighths);
  return { capacity, others, mine: mineEighths / 8, held: heldEighths / 8, free: Math.floor(freeEighths / 8), freeEighths };
}

export const fits = (s: GameState, dcId: string, space: Exclude<SpaceKind, "basement">, size: number): boolean =>
  dcAvailability(s, dcId).freeEighths >= eighthsOf(space, size);
