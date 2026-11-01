// Proxmocks Datacenter > HA: groups of nodes with priorities, and the VMs that follow them.
import type { GameState } from "../50-state";
import type { HaGroup } from "../60-infra/cluster";
import { quorumBlock } from "../60-infra/quorum";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
export const MAX_HA_GROUPS = 8;

const proxmocks = (s: GameState, id: string) => {
  const c = s.clusters.find((x) => x.id === id);
  return c && c.kind === "cloud" && c.platform === "proxmocks" ? c : undefined;
};

export interface HaGroupDraft { id?: string; name: string; nodes: { deviceId: string; priority: number }[]; restricted: boolean; noFailback?: boolean }

// Creates a group, or replaces the one named by draft.id.
export function saveHaGroup(s: GameState, clusterId: string, draft: HaGroupDraft): ActionResult {
  const c = proxmocks(s, clusterId);
  if (!c) return fail("error.unknownCluster");
  const q = quorumBlock(s, c);
  if (q) return fail(q);
  const groups = c.haGroups ?? [], old = draft.id ? groups.find((g) => g.id === draft.id) : undefined;
  if (draft.id && !old) return fail("error.unknownHaGroup");
  if (!old && groups.length >= MAX_HA_GROUPS) return fail("error.haGroupLimit");
  const nodes = draft.nodes.filter((n, i, a) => c.nodes.some((x) => x.deviceId === n.deviceId) && a.findIndex((m) => m.deviceId === n.deviceId) === i)
    .map((n) => ({ deviceId: n.deviceId, priority: Math.max(0, Math.min(1000, Math.round(n.priority))) }));
  const name = draft.name.trim().slice(0, 40);
  if (!nodes.length || !name) return fail("error.haGroupInvalid");
  const g: HaGroup = { id: old?.id ?? `hag${s.nextId}`, name, nodes, restricted: draft.restricted, noFailback: draft.noFailback };
  if (!old) s.nextId++;
  s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, haGroups: old ? groups.map((h) => (h.id === g.id ? g : h)) : [...groups, g] } : x));
  return { ok: true, id: g.id };
}

export function deleteHaGroup(s: GameState, clusterId: string, id: string): ActionResult {
  const c = proxmocks(s, clusterId);
  if (!c) return fail("error.unknownCluster");
  const q = quorumBlock(s, c);
  if (q) return fail(q);
  if (!c.haGroups?.some((g) => g.id === id)) return fail("error.unknownHaGroup");
  s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, haGroups: (x.haGroups ?? []).filter((g) => g.id !== id) } : x));
  s.workloads = s.workloads.map((w) => (w.clusterId === c.id && w.haGroup === id ? { ...w, haGroup: null, failbackAt: undefined } : w));
  return { ok: true };
}

// Puts a VM of the cluster in a group, or takes it out with null.
export function setHaGroup(s: GameState, workloadId: string, groupId: string | null): ActionResult {
  const w = s.workloads.find((x) => x.id === workloadId);
  if (!w || !w.clusterId) return fail("error.unknownWorkload");
  const c = proxmocks(s, w.clusterId);
  if (!c) return fail("error.unknownCluster");
  const q = quorumBlock(s, c);
  if (q) return fail(q);
  if (groupId !== null && !c.haGroups?.some((g) => g.id === groupId)) return fail("error.unknownHaGroup");
  s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, haGroup: groupId, failbackAt: undefined } : x));
  return { ok: true };
}
