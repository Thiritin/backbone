// Horizont Identity > Projects: projects with quotas, and the instances that belong to them.
import type { GameState } from "../50-state";
import { isHorizont, volumesOf, floatingOf } from "../60-infra/horizont";
import { quorumBlock } from "../60-infra/quorum";
import { ADMIN, MAX_PROJECTS, projectsOf, quotaBlock, sizeAdd, type Project, type Quota } from "../60-infra/projects";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

export interface ProjectDraft { id?: string; name: string; customerId?: string | null; quota: Quota }

const limit = (n: number | null): number | null | undefined => (n === null ? null : Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined);

// Creates a project or replaces the one named by draft.id; the admin project keeps its name and has no limits.
export function saveProject(s: GameState, clusterId: string, draft: ProjectDraft): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!isHorizont(c)) return fail("error.unknownCluster");
  const q = quorumBlock(s, c);
  if (q) return fail(q);
  const all = projectsOf(c), old = draft.id ? all.find((p) => p.id === draft.id) : undefined;
  if (draft.id && !old) return fail("error.unknownProject");
  if (!old && all.length >= MAX_PROJECTS) return fail("error.projectLimit");
  const name = draft.name.trim().slice(0, 40);
  if (!name) return fail("error.projectName");
  if (draft.customerId && !s.customers.some((x) => x.id === draft.customerId)) return fail("error.unknownCustomer");
  const quota = {} as Quota;
  for (const k of Object.keys(draft.quota) as (keyof Quota)[]) {
    const v = limit(draft.quota[k]);
    if (v === undefined) return fail("error.quotaValue");
    quota[k] = v;
  }
  const p: Project = old?.id === ADMIN ? old : { id: old?.id ?? `proj${s.nextId}`, name, customerId: draft.customerId ?? null, quota };
  if (!old) s.nextId++;
  s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, projects: old ? all.map((y) => (y.id === p.id ? p : y)) : [...all, p] } : x));
  return { ok: true, id: p.id };
}

// Removes an empty project.
export function deleteProject(s: GameState, clusterId: string, id: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!isHorizont(c)) return fail("error.unknownCluster");
  const q = quorumBlock(s, c);
  if (q) return fail(q);
  if (!c.projects?.some((p) => p.id === id)) return fail("error.unknownProject");
  if (id === ADMIN) return fail("error.adminProject");
  const used = s.workloads.some((w) => w.clusterId === c.id && w.projectId === id) || volumesOf(c).some((v) => v.projectId === id) || floatingOf(c).some((f) => f.projectId === id);
  if (used) return fail("error.projectInUse");
  s.clusters = s.clusters.map((x) => (x.id === c.id ? { ...x, projects: x.projects!.filter((p) => p.id !== id) } : x));
  return { ok: true };
}

// Moves an instance to another project of its cluster, as long as that project has the room.
export function setInstanceProject(s: GameState, vmId: string, projectId: string): ActionResult {
  const w = s.workloads.find((x) => x.id === vmId), c = s.clusters.find((x) => x.id === w?.clusterId);
  if (!w || !isHorizont(c)) return fail("error.unknownWorkload");
  const q = quorumBlock(s, c);
  if (q) return fail(q);
  if ((w.projectId ?? ADMIN) === projectId) return { ok: true };
  const bad = quotaBlock(s, c, projectId, sizeAdd(w));
  if (bad) return fail(bad);
  s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, projectId } : x));
  return { ok: true };
}
