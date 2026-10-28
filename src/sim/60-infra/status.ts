import { modelById, PATCH_JACKS, type DeviceKind } from "../10-catalog/hardware";
import { BASEMENT, datacenterById, MOVE, RACK_MODELS } from "../20-world/datacenters";
import type { Device, End, GameState, Location } from "../50-state";

export interface LinkStatus { online: boolean; gbit: number; warning: "bondNotGrouped" | null }

const same = (x: End, y: End) => x.device === y.device && x.port === y.port;
const kindOf = (s: GameState, id: string) => modelById(s.devices.find((d) => d.id === id)!.model).kind;
const gbitOf = (s: GameState, e: End) => modelById(s.devices.find((d) => d.id === e.device)!.model).ports[e.port].gbit;
const bridged = (port: number) => (port < PATCH_JACKS ? port + PATCH_JACKS : port - PATCH_JACKS);

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
function farEnd(s: GameState, from: End): { end: End; gbit: number } | null {
  const gbit = gbitOf(s, from);
  let peer = peerOf(s, from);
  for (let hops = 0; peer && kindOf(s, peer.device) === "patch" && hops < 64; hops++) peer = peerOf(s, { device: peer.device, port: bridged(peer.port) });
  if (!peer || kindOf(s, peer.device) === "patch") return null;
  return { end: peer, gbit: Math.min(gbit, gbitOf(s, peer)) };
}

// Servers never forward traffic; switches forward between all ports, patch panels between a jack's front and back.
function reachesGateway(s: GameState, start: End, origin: string): boolean {
  const seen = new Set([origin]);
  const queue = [start];
  while (queue.length) {
    const at = queue.shift()!;
    const kind = kindOf(s, at.device);
    if (!powered(s, at.device)) continue;
    if (kind === "gateway") return true;
    const key = kind === "patch" ? `${at.device}:${at.port}` : at.device;
    if (kind === "server" || seen.has(key)) continue;
    seen.add(key);
    const exits = kind === "patch" ? [bridged(at.port)] : modelById(s.devices.find((d) => d.id === at.device)!.model).ports.map((_, i) => i);
    for (const port of exits) {
      const peer = peerOf(s, { device: at.device, port });
      if (peer) queue.push(peer);
    }
  }
  return false;
}

// A device is online when it has power and a cable path through powered switches and patch panels reaches a gateway.
export function linkStatus(s: GameState, deviceId: string): LinkStatus {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d || !powered(s, d.id)) return { online: false, gbit: 0, warning: null };
  const ports = modelById(d.model).ports;
  if (modelById(d.model).kind === "gateway") return { online: true, gbit: Math.max(...ports.map((p) => p.gbit)), warning: null };
  const up = ports
    .map((_, port) => farEnd(s, { device: deviceId, port }))
    .filter((f): f is NonNullable<typeof f> => f !== null && reachesGateway(s, f.end, deviceId));
  if (!up.length) return { online: false, gbit: 0, warning: null };
  const fastest = Math.max(...up.map((f) => f.gbit));
  if (d.bond === "failover" || up.length === 1) return { online: true, gbit: fastest, warning: null };
  const sw = s.devices.find((x) => x.id === up[0].end.device)!;
  const grouped = modelById(sw.model).kind === "switch" && up.every((f) => f.end.device === sw.id)
    && sw.groups.some((g) => up.every((f) => g.includes(f.end.port)));
  return grouped ? { online: true, gbit: up.reduce((sum, f) => sum + f.gbit, 0), warning: null } : { online: true, gbit: fastest, warning: "bondNotGrouped" };
}

// Every slot where a device of this height fits, lowest first.
export function freeSlots(s: GameState, rackId: string, height: number): number[] {
  const rack = s.racks.find((r) => r.id === rackId);
  if (!rack) return [];
  const used = new Set(s.devices.filter((d) => d.rackId === rackId).flatMap((d) => {
    const h = modelById(d.model).height;
    return Array.from({ length: h }, (_, i) => d.slot + i);
  }));
  const free: number[] = [];
  const units = RACK_MODELS.find((m) => m.id === rack.model)!.units;
  for (let slot = 1; slot + height - 1 <= units; slot++) {
    if (Array.from({ length: height }, (_, i) => slot + i).every((u) => !used.has(u))) free.push(slot);
  }
  return free;
}

const MONTH = 730;

// The location a device is in, or undefined in storage.
export function locationOf(s: GameState, d: Device): Location | undefined {
  const id = d.panel ?? s.racks.find((r) => r.id === d.rackId)?.locationId;
  return s.locations.find((l) => l.id === id);
}

// 100% to 80% over the first month, then down to 20% over the next 24 months.
export function resaleValue(s: GameState, price: number, boughtAt: number): number {
  const months = Math.max(0, s.hour - boughtAt) / MONTH;
  const share = months <= 1 ? 1 - 0.2 * months : Math.max(0.2, 0.8 - (0.6 * (months - 1)) / 24);
  return Math.round(price * share * 100) / 100;
}

// ponytail: full rated power for every device; load-based draw comes with workloads.
export function rackPower(s: GameState, rackId: string): { watts: number; limitWatts: number; tripped: boolean } {
  const rack = s.racks.find((r) => r.id === rackId);
  const loc = rack && s.locations.find((l) => l.id === rack.locationId);
  if (!rack || !loc) return { watts: 0, limitWatts: 0, tripped: false };
  const watts = rack.arriveAt === null ? s.devices.filter((d) => d.rackId === rackId).reduce((sum, d) => sum + modelById(d.model).watts, 0) : 0;
  const limitWatts = 1000 * (loc.dc ? datacenterById(loc.dc).kwPerPosition : BASEMENT.kw);
  return { watts, limitWatts, tripped: watts > limitWatts };
}

// Stored devices, devices in a moving or tripped rack and devices in a location that is not ready have no power.
// ponytail: recomputes the rack's draw per call, O(devices) each; cache per tick if large fleets get slow.
export function powered(s: GameState, deviceId: string): boolean {
  const d = s.devices.find((x) => x.id === deviceId);
  const loc = d && locationOf(s, d);
  if (!d || !loc || loc.readyAt > s.hour) return false;
  if (!d.rackId) return true;
  const rack = s.racks.find((r) => r.id === d.rackId)!;
  return rack.arriveAt === null && !rackPower(s, rack.id).tripped;
}

export function freePositions(s: GameState, locationId: string): number[] {
  const loc = s.locations.find((l) => l.id === locationId);
  if (!loc) return [];
  const taken = new Set(s.racks.filter((r) => r.locationId === locationId).map((r) => r.position));
  return Array.from({ length: loc.positions }, (_, i) => i + 1).filter((p) => !taken.has(p));
}

const KIND_ORDER: DeviceKind[] = ["server", "switch", "patch", "gateway"];

// Stored devices grouped by model and brand.
export function storageStacks(s: GameState): { model: string; brand: string; ids: string[] }[] {
  const stacks = new Map<string, { model: string; brand: string; ids: string[] }>();
  for (const d of s.devices.filter((x) => !x.rackId && !x.panel)) {
    const key = `${d.model}|${d.brand}`;
    if (!stacks.has(key)) stacks.set(key, { model: d.model, brand: d.brand, ids: [] });
    stacks.get(key)!.ids.push(d.id);
  }
  const rank = (m: string) => KIND_ORDER.indexOf(modelById(m).kind);
  return [...stacks.values()].sort((a, b) => rank(a.model) - rank(b.model) || a.model.localeCompare(b.model) || a.brand.localeCompare(b.brand));
}

// Price and travel hours of moving a rack: same city or another city.
export function moveCost(s: GameState, rackId: string, toLocationId: string): { price: number; hours: number } {
  const from = s.locations.find((l) => l.id === s.racks.find((r) => r.id === rackId)?.locationId);
  const to = s.locations.find((l) => l.id === toLocationId);
  return from && to && from.city === to.city ? MOVE.sameCity : MOVE.otherCity;
}
