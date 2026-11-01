// Proxmocks HA groups: failover and failback pick nodes by group priority.
import type { GameState } from "../50-state";
import { pickNode, type Cluster, type HaGroup, type Workload } from "./cluster";

export const FAILBACK_HOURS = 1;

export const groupOf = (c: Cluster, w: Workload): HaGroup | undefined => (w.haGroup ? c.haGroups?.find((g) => g.id === w.haGroup) : undefined);

// The node a VM of a group starts on: the highest priority node with room, then, unless the group is restricted, any node.
export function groupNode(s: GameState, c: Cluster, w: Workload, skip: string | null): string | null {
  const g = groupOf(c, w);
  if (!g) return pickNode(s, c, w, skip, "spread");
  const tiers = [...new Set(g.nodes.map((n) => n.priority))].sort((a, b) => b - a);
  for (const p of tiers) {
    const ids = new Set(g.nodes.filter((n) => n.priority === p).map((n) => n.deviceId));
    const to = pickNode(s, { ...c, nodes: c.nodes.filter((n) => ids.has(n.deviceId)) }, w, skip, "spread");
    if (to) return to;
  }
  return g.restricted ? null : pickNode(s, c, w, skip, "spread");
}

// Priority of a node in the VM's group; a node outside the group ranks below every member.
export const rank = (g: HaGroup, deviceId: string | null): number => g.nodes.find((n) => n.deviceId === deviceId)?.priority ?? -1;
