// High availability per hypervisor cluster (gdd.md, Compute): automatic failover and auto-balancing. Clustered panel hosts fail over too.
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { insideVm, isOwnVm, liveBetween, lostDisk, moveControlPlaneOff, pickNode, type Cluster, type Workload } from "./cluster";
import { working } from "./status";
import { nodeUsage } from "./usage";

// economy.md, High availability: a failed node's VMs are back on other nodes after five minutes; a node runs hot from 90%
// of its installed RAM or with more busy vCPUs than cores.
export const FAILOVER_MINUTES = 5;
export const HOT_RAM = 0.9;

const patch = (s: GameState, id: string, p: Partial<Workload>) => {
  s.workloads = s.workloads.map((w) => (w.id === id ? { ...w, ...p } : w));
};
const cluster = (s: GameState, id: string): Cluster => s.clusters.find((c) => c.id === id)!;

// The services a VM carries: its own, or every web space in a panel VM.
const servicesIn = (s: GameState, w: Workload): string[] =>
  isOwnVm(w) ? insideVm(s, w.id).map((x) => x.serviceId) : [w.serviceId];

// Restarts the VMs of failed nodes on working nodes with room; the control plane moves first when its node failed. A VM
// that fits nowhere stays down, and the player hears about it once.
function failover(s: GameState, c: Cluster, events: SimEvent[]) {
  const dead = new Set(c.nodes.filter((n) => !working(s, n.deviceId)).map((n) => n.deviceId));
  if (!dead.size) return;
  if (c.controlPlane && dead.has(c.controlPlane)) moveControlPlaneOff(s, c.id, c.controlPlane);
  let moved = 0, stuck = 0;
  for (const w of s.workloads.filter((x) => x.clusterId === c.id && x.deviceId && dead.has(x.deviceId) && !lostDisk(s, x))) {
    const to = pickNode(s, cluster(s, c.id), w, w.deviceId, "spread");
    if (!to) {
      if (!w.stuck) stuck++;
      patch(s, w.id, { stuck: true });
      continue;
    }
    patch(s, w.id, { deviceId: to, placedAt: s.hour, stuck: undefined });
    for (const id of servicesIn(s, w)) s.downHours = { ...s.downHours, [id]: (s.downHours[id] ?? 0) + FAILOVER_MINUTES / 60 };
    moved++;
  }
  if (moved) events.push({ app: "Locations", key: "event.failedOver", params: { cluster: c.name, count: moved, web: c.kind === "panel" ? 1 : 0 } });
  if (stuck) events.push({ app: "Locations", key: "event.failoverStuck", params: { cluster: c.name, count: stuck, web: c.kind === "panel" ? 1 : 0 } });
}

// A node runs hot when its RAM in use nears the installed RAM or its busy vCPUs outnumber its cores.
export function runsHot(s: GameState, deviceId: string): boolean {
  if (!s.devices.some((x) => x.id === deviceId)) return false;
  const u = nodeUsage(s, deviceId);
  return u.used.ramGb > HOT_RAM * u.physical.ramGb || u.used.vcpu > u.physical.vcpu;
}

// Moves the smallest running VM off each hot node to the idlest node that is not hot itself, live, one per node an hour; a
// node of another CPU vendor takes it only in compatibility mode.
// ponytail: smallest-first is a plain heuristic; weigh by what the VM uses once balancing needs to be smarter.
function balance(s: GameState, c: Cluster) {
  for (const n of c.nodes) {
    if (n.state !== "active" || !working(s, n.deviceId) || !runsHot(s, n.deviceId)) continue;
    const vms = s.workloads.filter((w) => w.clusterId === c.id && w.deviceId === n.deviceId && !w.stopped && w.busyUntil <= s.hour && !lostDisk(s, w))
      .sort((a, b) => a.ramGb - b.ramGb);
    for (const w of vms) {
      const to = pickNode(s, cluster(s, c.id), w, n.deviceId, "spread");
      if (!to || runsHot(s, to) || !liveBetween(s, s.devices.find((d) => d.id === n.deviceId)!, s.devices.find((d) => d.id === to)!)) continue;
      patch(s, w.id, { deviceId: to, placedAt: s.hour });
      break;
    }
  }
}

// Hourly, before the down hours are counted.
export function haTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  const back = (w: Workload) => w.stuck && !!w.deviceId && working(s, w.deviceId);
  if (s.workloads.some(back)) s.workloads = s.workloads.map((w) => (back(w) ? { ...w, stuck: undefined } : w));
  for (const id of s.clusters.filter((c) => c.kind === "cloud" && c.platform).map((c) => c.id)) {
    if (cluster(s, id).ha.failover) failover(s, cluster(s, id), events);
    const c = cluster(s, id);
    if (c.ha.balance && c.ha.live) balance(s, c);
  }
  // A clustered panel host restarts the web spaces of a failed server on the others without any research.
  for (const c of s.clusters.filter((x) => x.kind === "panel" && x.nodes.length > 1)) failover(s, c, events);
  return events;
}
