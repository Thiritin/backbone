// economy.md, OpenVeeZee beancounters: failcnt from overselling, burst memory and the live checkpoint.
import type { GameState } from "../50-state";
import { lostDisk, oomKilled, type Cluster, type Workload } from "./cluster";
import { HOT_RAM } from "./alarms";
import { servicesIn } from "./ha";
import { workloadUse, nodeUsage } from "./usage";

export const BURST_MAX = 2;
export const FAIL_SLOW_HOURS = 6;
export const PAGES_PER_GB = 262144;
// Failcounts per hour of contention for a container holding all of the node's RAM; a smaller one collects its share.
export const FAIL_PER_SHARE = 40;
// Checkpoint and restore: one minute plus two seconds per GB of RAM in use.
export const checkpointMinutes = (ramGb: number): number => 1 + (2 * ramGb) / 60;

export const openVeeZee = (c: Cluster | undefined): c is Cluster => c?.kind === "cloud" && c.platform === "openveezee";

export interface Beancounter { resource: string; held: number; maxheld: number; barrier: number; limit: number; failcnt: number }
// /proc/user_beancounters of a container: memory in 4 KB pages, the burst allowance between barrier and limit.
export function beancounters(s: GameState, w: Workload): Beancounter[] {
  const u = workloadUse(s, w), fail = w.failcnt ?? {}, held = u.ramGb * PAGES_PER_GB, peak = Math.max(w.maxheld ?? 0, u.ramGb) * PAGES_PER_GB;
  const barrier = w.ramGb * PAGES_PER_GB, limit = (w.ramGb + (w.burstGb ?? 0)) * PAGES_PER_GB, procs = Math.round(8 + u.vcpu * 24);
  const row = (resource: string, h: number, m: number, b: number, l: number): Beancounter => ({ resource, held: Math.round(h), maxheld: Math.round(m), barrier: Math.round(b), limit: Math.round(l), failcnt: fail[resource] ?? 0 });
  return [
    row("kmemsize", u.ramGb * 40 * 1024 * 1024, peak / PAGES_PER_GB * 40 * 1024 * 1024, w.ramGb * 50 * 1024 * 1024, w.ramGb * 55 * 1024 * 1024),
    row("privvmpages", held, peak, barrier, limit),
    row("oomguarpages", held, peak, barrier, 2147483647),
    row("numproc", procs, procs, w.vcpu * 128, w.vcpu * 128),
    row("numtcpsock", procs * 2, procs * 2, w.vcpu * 256, w.vcpu * 256),
  ];
}

// Hourly: a node past 90% of its RAM takes the burst back first, so only containers with burst collect privvmpages
// failcnt; a node out of RAM makes every container fail. Six failing hours in a row slow the container's site. A node out
// of RAM also has the OOM killer stop one container for an hour: the one furthest past its barrier, then the largest.
export function beancounterTick(s: GameState): void {
  const hot = new Map<string, 0 | 1 | 2>();
  const level = (deviceId: string) => {
    if (!hot.has(deviceId)) {
      const u = nodeUsage(s, deviceId);
      hot.set(deviceId, u.used.ramGb > u.physical.ramGb ? 2 : u.used.ramGb > HOT_RAM * u.physical.ramGb ? 1 : 0);
    }
    return hot.get(deviceId)!;
  };
  const live = (w: Workload) => !w.stopped && !w.frozen && !lostDisk(s, w) && w.busyUntil <= s.hour && !oomKilled(w, s.hour);
  const victim = new Map<string, { w: Workload; over: number; ram: number }>();
  for (const w of s.workloads) {
    if (!openVeeZee(s.clusters.find((x) => x.id === w.clusterId)) || !w.deviceId || !live(w) || level(w.deviceId) !== 2) continue;
    const ram = workloadUse(s, w).ramGb, over = Math.max(0, ram - w.ramGb), best = victim.get(w.deviceId);
    if (!best || over > best.over || (over === best.over && ram > best.ram)) victim.set(w.deviceId, { w, over, ram });
  }
  const slow = new Set<string>(), killed = new Set([...victim.values()].map((v) => v.w.id));
  s.workloads = s.workloads.map((w) => {
    const c = s.clusters.find((x) => x.id === w.clusterId);
    if (!openVeeZee(c) || !w.deviceId) return w;
    const on = live(w);
    const maxheld = Math.max(w.maxheld ?? 0, on ? workloadUse(s, w).ramGb : 0);
    const lv = on ? level(w.deviceId) : 0, fails = lv === 2 || (lv === 1 && (w.burstGb ?? 0) > 0);
    if (!fails) return { ...w, maxheld, failStreak: 0 };
    const share = w.ramGb / Math.max(1, nodeUsage(s, w.deviceId).physical.ramGb), inc = Math.max(1, Math.round(FAIL_PER_SHARE * share));
    const failcnt = { ...w.failcnt, privvmpages: (w.failcnt?.privvmpages ?? 0) + inc };
    const streak = (w.failStreak ?? 0) + 1;
    if (streak >= FAIL_SLOW_HOURS) for (const id of servicesIn(s, w)) slow.add(id);
    if (killed.has(w.id)) return { ...w, maxheld, failcnt, failStreak: 0, oomUntil: s.hour + 1 };
    return { ...w, maxheld, failcnt, failStreak: streak };
  });
  if (slow.size) s.services = s.services.map((v) => (slow.has(v.id) ? { ...v, slowedAt: s.hour } : v));
  for (const w of s.workloads) if (killed.has(w.id)) for (const id of servicesIn(s, w)) s.downHours = { ...s.downHours, [id]: (s.downHours[id] ?? 0) + 1 };
}
