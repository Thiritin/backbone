// economy.md, Storage replication and Ceph: a VM's disk copied to a second node, and a shared pool built from node disks.
import { dateOf } from "../00-core/time";
import type { GameState } from "../50-state";
import { LAN_GB_PER_HOUR, moveGbit } from "../85-products/products";
import { deltaGb, lostDisk, type Cluster, type Workload } from "./cluster";
import { quorate } from "./quorum";
import { drivesOf, raidUsable, working } from "./status";

export type ReplicaEvery = "15min" | "hourly" | "daily";
export interface Replica { toNode: string; every: ReplicaEvery; lastAt: number | null }
export interface Ceph { enabled: boolean; size: 2 | 3; down: number; rebalanceUntil: number | null }

// Hours between two copies; the sim copies on the hour, so the first two both run every hour and differ in staleness.
export const REPLICA_HOURS: Record<ReplicaEvery, number> = { "15min": 0.25, hourly: 1, daily: 24 };
export const REPLICA_DAILY_HOUR = 3;
export const CEPH_FROM_NODES = 3;

export const replicaDue = (every: ReplicaEvery, hour: number): boolean => every !== "daily" || dateOf(hour).getUTCHours() === REPLICA_DAILY_HOUR;

// Whether the replica can take over now: one copy finished and its node is up.
export const replicaReady = (s: GameState, w: Workload): boolean => !!w.replica && w.replica.lastAt !== null && working(s, w.replica.toNode);
// Hours of writes a takeover loses: since the last copy, plus half an interval of writes not yet sent.
export const replicaStale = (s: GameState, w: Workload): number => (s.hour - (w.replica?.lastAt ?? s.hour)) + REPLICA_HOURS[w.replica?.every ?? "hourly"] / 2;

export const cephOn = (c: Cluster): boolean => !!c.ceph?.enabled;
export const cephDown = (s: GameState, c: Cluster): number => c.nodes.filter((n) => !working(s, n.deviceId)).length;
// Every node holds a copy of an object until it is down; at one copy the pool is read-only.
export const cephCopies = (s: GameState, c: Cluster): number => (c.ceph ? Math.max(0, c.ceph.size - cephDown(s, c)) : 0);
export const cephReadOnly = (s: GameState, c: Cluster): boolean => cephOn(c) && cephCopies(s, c) <= 1;
export const cephCapacity = (s: GameState, c: Cluster): number =>
  c.ceph ? c.nodes.reduce((n, x) => { const d = s.devices.find((y) => y.id === x.deviceId); return n + (d ? raidUsable(d) : 0); }, 0) / c.ceph.size : 0;
export const cephUsed = (s: GameState, c: Cluster): number => s.workloads.reduce((n, w) => n + (w.clusterId === c.id && w.deviceId ? w.diskGb + deltaGb(w) : 0), 0);
export const cephOsds = (s: GameState, c: Cluster): { deviceId: string; drives: number; up: boolean }[] =>
  c.nodes.map((n) => ({ deviceId: n.deviceId, drives: drivesOf(s.devices.find((d) => d.id === n.deviceId)!).length, up: working(s, n.deviceId) }));
export const cephRebalancing = (s: GameState, c: Cluster): boolean => !!c.ceph?.rebalanceUntil && c.ceph.rebalanceUntil > s.hour;

// Hourly: copies that are due, replicas whose node is gone are dropped, and Ceph notes a node's return.
export function replicaTick(s: GameState): void {
  if (s.workloads.some((w) => w.replica)) {
    s.workloads = s.workloads.map((w) => {
      const r = w.replica;
      if (!r) return w;
      const c = s.clusters.find((x) => x.id === w.clusterId);
      if (!c || !w.deviceId || r.toNode === w.deviceId || !c.nodes.some((n) => n.deviceId === r.toNode)) return { ...w, replica: null };
      if (!replicaDue(r.every, s.hour) || w.stopped || lostDisk(s, w) || !working(s, w.deviceId) || !working(s, r.toNode) || !quorate(s, c)) return w;
      return { ...w, replica: { ...r, lastAt: s.hour } };
    });
  }
  s.clusters = s.clusters.map((c) => {
    if (!c.ceph) return c;
    const down = cephDown(s, c);
    if (down === c.ceph.down) return c;
    if (down > c.ceph.down) return { ...c, ceph: { ...c.ceph, down } };
    const gbit = Math.max(0.1, moveGbit(s, c.az, c.az)), hours = Math.max(1, Math.ceil(cephUsed(s, c) / (gbit * LAN_GB_PER_HOUR)));
    return { ...c, ceph: { ...c.ceph, down, rebalanceUntil: s.hour + hours } };
  });
}
