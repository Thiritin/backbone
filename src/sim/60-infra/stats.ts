// docs/design/software.md, section 9: the usage history a hypervisor console graphs on a VM's page.
import type { GameState } from "../50-state";
import { hostOfVm, isOwnVm, lostDisk, vmById, type Workload } from "./cluster";
import { serviceMbps } from "./network";
import { workloadUse } from "./usage";

export const STATS_HOURS = 24;
// Shares of the VM's booked vCPU, RAM and disk, and the Mbit/s its traffic runs at.
export interface VmSample { cpu: number; ram: number; disk: number; netMbit: number }

const share = (used: number, of: number) => (of > 0 ? Math.min(1, used / of) : 0);
const up = (s: GameState, w: Workload) => !w.stopped && !!w.deviceId && !lostDisk(s, w);

// An own VM's traffic is that of the web spaces its panel hosts; a customer workload's is its service's.
function netMbit(s: GameState, w: Workload): number {
  if (!up(s, w)) return 0;
  const host = isOwnVm(w) ? hostOfVm(s, w.id) : undefined;
  const ids = isOwnVm(w) ? s.workloads.filter((x) => host && x.clusterId === host.id).map((x) => x.serviceId) : [w.serviceId];
  return s.services.filter((v) => ids.includes(v.id)).reduce((n, v) => n + serviceMbps(s, v), 0);
}

export function sample(s: GameState, w: Workload, hour: number = s.hour): VmSample {
  const u = workloadUse(s, w, hour);
  return { cpu: share(u.vcpu, w.vcpu), ram: share(u.ramGb, w.ramGb), disk: share(u.diskGb, w.diskGb), netMbit: netMbit(s, w) };
}

// Hourly: every own VM appends a sample, keeping the last STATS_HOURS, and notes the hour it came up.
export function statsTick(s: GameState): void {
  for (const w of s.workloads) {
    if (!isOwnVm(w)) continue;
    w.stats = [...(w.stats ?? []), sample(s, w)].slice(-STATS_HOURS);
    w.upSince = up(s, w) ? w.upSince ?? s.hour : undefined;
  }
}

export interface VmStats {
  ring: VmSample[]; now: VmSample; uptimeHours: number | null;
  // Over the ring: booked resources times hours used, and the traffic moved.
  totals: { vcpuHours: number; ramGbHours: number; diskGbHours: number; trafficGb: number };
}

// A customer workload keeps no history; its load is drawn from the seed per hour, so its ring is recomputed.
// ponytail: recomputed traffic uses today's rate for every hour; store customer rings too if that ever shows.
export function vmStats(s: GameState, vmId: string): VmStats | null {
  const w = vmById(s, vmId);
  if (!w) return null;
  const ring = isOwnVm(w)
    ? (w.stats ?? []).slice(-STATS_HOURS)
    : Array.from({ length: STATS_HOURS }, (_, i) => sample(s, w, s.hour - STATS_HOURS + 1 + i));
  const sum = (f: (x: VmSample) => number) => ring.reduce((n, x) => n + f(x), 0);
  return {
    ring, now: sample(s, w), uptimeHours: up(s, w) ? Math.max(0, s.hour - (w.upSince ?? w.placedAt)) : null,
    totals: {
      vcpuHours: sum((x) => x.cpu * w.vcpu), ramGbHours: sum((x) => x.ram * w.ramGb), diskGbHours: sum((x) => x.disk * w.diskGb),
      trafficGb: sum((x) => (x.netMbit * 3600) / 8000),
    },
  };
}
