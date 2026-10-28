import { modelById, PATCH_JACKS } from "../10-catalog/hardware";
import type { End, GameState } from "../50-state";

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

// A device is online when a cable path through switches and patch panels reaches a gateway.
export function linkStatus(s: GameState, deviceId: string): LinkStatus {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return { online: false, gbit: 0, warning: null };
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
  for (let slot = 1; slot + height - 1 <= rack.units; slot++) {
    if (Array.from({ length: height }, (_, i) => slot + i).every((u) => !used.has(u))) free.push(slot);
  }
  return free;
}
