// economy.md, Horizont: floating IPs, security groups and volumes of an OpenStash cluster.
import type { GameState } from "../50-state";
import type { Macro } from "./exposure";
import type { Cluster } from "./cluster";

export interface FloatingIp { ip: string; workloadId: string | null; projectId?: string }
export interface SecurityGroup { id: string; name: string; allow: Macro[] }
// Block storage apart from the instance: gb is booked on datastore (a node disk when null); attachedTo is an instance id.
export interface Volume { id: string; name: string; gb: number; attachedTo: string | null; datastore: string | null; projectId?: string }

export const DEFAULT_GROUP: SecurityGroup = { id: "default", name: "default", allow: ["ssh"] };
export const MAX_GROUPS = 10;
export const VOLUME_MIN_GB = 1;
export const VOLUME_MAX_GB = 1000;
// The year OpenStash lets a volume leave a running instance.
export const HOT_DETACH_YEAR = 2012;

export const isHorizont = (c: Cluster | undefined): c is Cluster => !!c && c.kind === "cloud" && c.platform === "openstash";
export const groupsOf = (c: Cluster): SecurityGroup[] => c.groups ?? [DEFAULT_GROUP];
export const floatingOf = (c: Cluster): FloatingIp[] => c.floating ?? [];
export const volumesOf = (c: Cluster): Volume[] => c.volumes ?? [];
// Whether an address is a floating IP of any cluster, so it follows its service when that moves.
export const isFloating = (s: GameState, ip: string): boolean => s.clusters.some((c) => floatingOf(c).some((f) => f.ip === ip));
// The port macros an instance's groups let through, or null for an instance with no groups set.
export function groupAllow(c: Cluster, groupIds: string[] | undefined): Macro[] | null {
  if (!groupIds) return null;
  const all = groupsOf(c);
  return [...new Set(groupIds.flatMap((id) => all.find((g) => g.id === id)?.allow ?? []))];
}
