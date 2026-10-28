import { modelById } from "../10-catalog/hardware";
import type { Device, GameState } from "../50-state";
import { workloadsOf, workloadsOn } from "./cluster";
import { loadAt, serviceMbps } from "./network";
import { portPeers, raidUsable, working } from "./status";

// Shares of each resource in use, 0 to 1.
export interface Usage { cpu: number; ram: number; disk: number; net: number }

// ponytail: fixed shares of what customers book; replace with per-plan usage curves when workloads have them.
export const BUSY = { cpu: 0.35, ram: 0.8, disk: 0.6 };

interface Sums { cores: number; cpu: number; ramGb: number; ram: number; diskGb: number; disk: number; gbit: number; mbps: number }

function serverSums(s: GameState, d: Device, out: Sums) {
  const v = modelById(d.model).server;
  if (!v) return;
  out.cores += v.cores; out.ramGb += v.ramGb; out.diskGb += raidUsable(d);
  out.gbit += portPeers(s, d.id).reduce((n, p, i) => n + (p ? modelById(d.model).ports[i].gbit : 0), 0);
  if (!working(s, d.id)) return;
  for (const w of workloadsOn(s, d.id)) {
    const svc = s.services.find((x) => x.id === w.serviceId);
    const load = svc ? loadAt(s, svc) : 1;
    out.cpu += w.vcpu * BUSY.cpu * load; out.ram += w.ramGb * BUSY.ram; out.disk += w.diskGb * BUSY.disk;
    if (svc) out.mbps += serviceMbps(s, svc) / workloadsOf(s, svc.id).length;
  }
}

// A switch carries the traffic of the servers plugged straight into it.
function switchSums(s: GameState, d: Device, out: Sums) {
  const m = modelById(d.model), peers = portPeers(s, d.id);
  out.gbit += peers.reduce((n, p, i) => n + (p ? m.ports[i].gbit : 0), 0);
  if (!working(s, d.id)) return;
  for (const p of peers) {
    const peer = p && s.devices.find((x) => x.id === p.device);
    if (peer && modelById(peer.model).server) {
      const sub: Sums = { cores: 0, cpu: 0, ramGb: 0, ram: 0, diskGb: 0, disk: 0, gbit: 0, mbps: 0 };
      serverSums(s, peer, sub);
      out.mbps += sub.mbps;
    }
  }
}

const share = (used: number, cap: number) => (cap > 0 ? Math.min(1, used / cap) : 0);

// Usage of one device, a rack or a whole location; network counts server links, or switch ports when only switches are given.
export function usageOf(s: GameState, devices: Device[]): Usage {
  const sums: Sums = { cores: 0, cpu: 0, ramGb: 0, ram: 0, diskGb: 0, disk: 0, gbit: 0, mbps: 0 };
  const servers = devices.filter((d) => modelById(d.model).server);
  if (servers.length) for (const d of servers) serverSums(s, d, sums);
  else for (const d of devices) if (modelById(d.model).kind === "switch" || modelById(d.model).kind === "firewall") switchSums(s, d, sums);
  return { cpu: share(sums.cpu, sums.cores), ram: share(sums.ram, sums.ramGb), disk: share(sums.disk, sums.diskGb), net: share(sums.mbps, sums.gbit * 1000) };
}
