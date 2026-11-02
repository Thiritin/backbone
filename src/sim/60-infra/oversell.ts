import { IN_VM } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import { coreSpeed, installedRamGb } from "./status";
import { nodeVcpu, vmById, type Cluster } from "./cluster";

// economy/usage-curves-and-overcommit.md, Usage curves and overcommit: past OVERSELL_KNEE booked vCPU per physical vCPU a panel host slows at every hour,
// by OVERSELL_SLOPE per extra booked vCPU down to OVERSELL_FLOOR.
export const OVERSELL_KNEE = 4;
export const OVERSELL_SLOPE = 0.04;
export const OVERSELL_FLOOR = 0.85;

export const oversold = (c: Cluster): boolean => c.kind === "panel" || c.kind === "game";

// What a panel host physically has: its VM's size inside a VM, else the sum of its servers. With work, each vCPU counts at
// its core's speed.
export function physicalOf(s: GameState, c: Cluster, work = false): { vcpu: number; ramGb: number } {
  const vm = vmById(s, c.vm), speed = (id: string | null) => { const d = work && s.devices.find((x) => x.id === id); return d ? coreSpeed(d, s.hour) : 1; };
  if (vm) return { vcpu: vm.vcpu * IN_VM * speed(vm.deviceId), ramGb: vm.ramGb * IN_VM };
  let vcpu = 0, ramGb = 0;
  for (const n of c.nodes) {
    const d = s.devices.find((x) => x.id === n.deviceId);
    if (d) { vcpu += nodeVcpu(s, d) * speed(d.id); ramGb += installedRamGb(d); }
  }
  return { vcpu, ramGb };
}

export function bookedOn(s: GameState, c: Cluster): { vcpu: number; ramGb: number } {
  let vcpu = 0, ramGb = 0;
  for (const w of s.workloads) if (w.clusterId === c.id) { vcpu += w.vcpu; ramGb += w.ramGb; }
  return { vcpu, ramGb };
}

// Booked over physical, for vCPU and RAM.
export function oversellRatio(s: GameState, c: Cluster): { cpu: number; ram: number } {
  const p = physicalOf(s, c), b = bookedOn(s, c);
  return { cpu: p.vcpu > 0 ? b.vcpu / p.vcpu : 0, ram: p.ramGb > 0 ? b.ramGb / p.ramGb : 0 };
}

// Whether the cluster stays within its cap with add more vCPU booked.
export function withinOversell(s: GameState, c: Cluster, add: { vcpu: number }): boolean {
  if (c.oversell == null || !oversold(c)) return true;
  const p = physicalOf(s, c);
  return p.vcpu > 0 && (bookedOn(s, c).vcpu + add.vcpu) / p.vcpu <= c.oversell + 1e-9;
}

export function contention(s: GameState, c: Cluster | undefined): number {
  if (!c || !oversold(c)) return 1;
  const p = physicalOf(s, c, true).vcpu, ratio = p > 0 ? bookedOn(s, c).vcpu / p : 0;
  return Math.max(OVERSELL_FLOOR, 1 - OVERSELL_SLOPE * Math.max(0, ratio - OVERSELL_KNEE));
}
