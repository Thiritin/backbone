// economy.md, Horizont projects: a quota per project on instances, vCPU, RAM, volume space and floating IPs.
import type { GameState } from "../50-state";
import type { Resources } from "../10-catalog/products";
import type { Cluster } from "./cluster";
import { floatingOf, volumesOf } from "./horizont";

// A null limit is no limit.
export interface Quota { instances: number | null; vcpu: number | null; ramGb: number | null; volumeGb: number | null; floatingIps: number | null }
export interface Project { id: string; name: string; customerId: string | null; quota: Quota }
export type QuotaKey = keyof Quota;

export const ADMIN = "admin";
export const MAX_PROJECTS = 10;
export const NO_QUOTA: Quota = { instances: null, vcpu: null, ramGb: null, volumeGb: null, floatingIps: null };
export const ADMIN_PROJECT: Project = { id: ADMIN, name: ADMIN, customerId: null, quota: NO_QUOTA };

export const projectsOf = (c: Cluster): Project[] => c.projects ?? [ADMIN_PROJECT];

// What a project holds today.
export function projectUsage(s: GameState, c: Cluster, id: string): Record<QuotaKey, number> {
  const mine = s.workloads.filter((w) => w.clusterId === c.id && (w.projectId ?? ADMIN) === id);
  return {
    instances: mine.length,
    vcpu: mine.reduce((n, w) => n + w.vcpu, 0),
    ramGb: mine.reduce((n, w) => n + w.ramGb, 0),
    volumeGb: volumesOf(c).filter((v) => (v.projectId ?? ADMIN) === id).reduce((n, v) => n + v.gb, 0),
    floatingIps: floatingOf(c).filter((f) => (f.projectId ?? ADMIN) === id).length,
  };
}

// The error for adding add to a project (or growing an instance by the difference), else null.
export function quotaBlock(s: GameState, c: Cluster, id: string, add: Partial<Record<QuotaKey, number>>): string | null {
  const p = projectsOf(c).find((x) => x.id === id);
  if (!p) return "error.unknownProject";
  const used = projectUsage(s, c, id);
  for (const k of Object.keys(add) as QuotaKey[]) {
    const limit = p.quota[k];
    if (limit !== null && (add[k] ?? 0) > 0 && used[k] + add[k]! > limit + 1e-9) return "error.quotaExceeded";
  }
  return null;
}

export const sizeAdd = (r: Resources, from?: Resources): Partial<Record<QuotaKey, number>> =>
  ({ instances: from ? 0 : 1, vcpu: r.vcpu - (from?.vcpu ?? 0), ramGb: r.ramGb - (from?.ramGb ?? 0) });
