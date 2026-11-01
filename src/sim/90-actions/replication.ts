// economy.md, Storage replication and Ceph: a second copy of a VM disk on another node, and a shared pool built from node disks.
import { yearOf } from "../00-core/time";
import { softwareById } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import { lostDisk, nodeTakes } from "../60-infra/cluster";
import { FAILOVER_MINUTES, servicesIn } from "../60-infra/ha";
import { quorumBlock } from "../60-infra/quorum";
import { CEPH_FROM_NODES, cephCapacity, cephDown, cephOn, cephUsed, REPLICA_EVERY, replicaHost, replicaReady, replicaStale, type ReplicaEvery } from "../60-infra/replica";
import { working } from "../60-infra/status";
import type { ActionResult } from "./hardware";
import { settleLoss } from "./vms";

const fail = (error: string): ActionResult => ({ ok: false, error });
const gated = (s: GameState, platform = "proxmocks"): boolean => { const y = softwareById(platform).cluster; return y === null || yearOf(s.hour) < y; };

// Replicates a VM's disk to another node of its Proxmocks cluster, or on HyperVee to a second host, or stops with null.
export function setReplication(s: GameState, workloadId: string, toNode: string | null, every: ReplicaEvery = "hourly"): ActionResult {
  const w = s.workloads.find((x) => x.id === workloadId), c = s.clusters.find((x) => x.id === w?.clusterId);
  if (!w || !c || !w.deviceId) return fail("error.unknownWorkload");
  const platform = c.platform ?? "";
  if (c.kind !== "cloud" || !(platform in REPLICA_EVERY) || gated(s, platform)) return fail("error.noReplication");
  const q = quorumBlock(s, c);
  if (q) return fail(q);
  if (toNode === null) {
    s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, replica: null } : x));
    return { ok: true };
  }
  if (!REPLICA_EVERY[platform].includes(every)) return fail("error.noReplication");
  if (cephOn(c) || w.datastore) return fail("error.replicaShared");
  const d = s.devices.find((x) => x.id === toNode), n = s.clusters.flatMap((x) => x.nodes).find((x) => x.deviceId === toNode);
  if (!d || !n || toNode === w.deviceId || !replicaHost(s, c, toNode)) return fail("error.notNode");
  if (n.state !== "active" || !working(s, toNode)) return fail("error.nodeNotActive");
  const freed = w.replica?.toNode === toNode ? { vcpu: 0, ramGb: 0, diskGb: w.diskGb } : undefined;
  if (!nodeTakes(s, d, { vcpu: 0, ramGb: 0, diskGb: w.diskGb }, freed)) return fail("error.noCapacity");
  const lastAt = w.replica?.toNode === toNode ? w.replica.lastAt : null;
  s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, replica: { toNode, every, lastAt } } : x));
  return { ok: true };
}

// HyperVee Failover: starts the VM on its replica host. A healthy primary hands over without losing data and the roles swap;
// a dead primary loses what was written since the last copy.
export function failoverReplica(s: GameState, workloadId: string): ActionResult {
  const w = s.workloads.find((x) => x.id === workloadId), c = s.clusters.find((x) => x.id === w?.clusterId);
  if (!w || !c || !w.deviceId) return fail("error.unknownWorkload");
  const r = w.replica;
  if (!r || !replicaReady(s, w)) return fail("error.noReplica");
  const q = quorumBlock(s, c);
  if (q) return fail(q);
  const to = s.clusters.find((x) => x.nodes.some((n) => n.deviceId === r.toNode)), d = s.devices.find((x) => x.id === r.toNode);
  if (!to || !d || w.busyUntil > s.hour) return fail("error.notNode");
  if (!nodeTakes(s, d, { vcpu: w.vcpu, ramGb: w.ramGb, diskGb: 0 })) return fail("error.noCapacity");
  const planned = working(s, w.deviceId) && !lostDisk(s, w), from = w.deviceId;
  const move = { deviceId: r.toNode, clusterId: to.id, placedAt: s.hour, stuck: undefined, ...(planned ? { replica: { toNode: from, every: r.every, lastAt: s.hour }, busyUntil: s.hour + 1 } : { replica: null }) };
  s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, ...move } : x));
  if (!planned) {
    settleLoss(s, w, s.hour, s.hour - replicaStale(s, w));
    for (const id of servicesIn(s, w)) s.downHours = { ...s.downHours, [id]: (s.downHours[id] ?? 0) + FAILOVER_MINUTES / 60 };
  }
  return { ok: true };
}

// Turns the cluster's node disks into one shared pool that keeps size copies of every disk, or removes it.
export function setCeph(s: GameState, clusterId: string, enabled: boolean, size: 2 | 3 = 3): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  if (c.kind !== "cloud" || c.platform !== "proxmocks" || c.nodes.length < CEPH_FROM_NODES || gated(s)) return fail("error.noCeph");
  const q = quorumBlock(s, c);
  if (q) return fail(q);
  if (!enabled) {
    s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, ceph: undefined } : x));
    return { ok: true };
  }
  if (size !== 2 && size !== 3) return fail("error.noCeph");
  const next = { ...c, ceph: { enabled: true, size, down: 0, rebalanceUntil: null } };
  if (cephUsed(s, next) > cephCapacity(s, next)) return fail("error.cephFull");
  s.workloads = s.workloads.map((x) => (x.clusterId === c.id && x.replica ? { ...x, replica: null } : x));
  s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...next, ceph: { ...next.ceph, down: cephDown(s, c) } } : x));
  return { ok: true };
}
