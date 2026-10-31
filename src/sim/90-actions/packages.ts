import type { Spec } from "../10-catalog/products";
import { SERVES } from "../10-catalog/platforms";
import { type Cluster } from "../60-infra/cluster";
import { PACKAGE_LIMIT, PACKAGE_NAME, packageNamed, packageUse, packagesOf, type PackageDef } from "../80-business/packages";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const KEYS = ["vcpu", "ramGb", "diskGb"] as const;
const validSpec = (spec: Spec): boolean => KEYS.every((k) => Number.isFinite(spec[k]) && spec[k] > 0);
const installed = (c: Cluster): boolean => !!(c.panel || c.platform);

// Adds a package to a software installation. The name is the key and cannot change later.
export function addPackage(s: GameState, clusterId: string, def: PackageDef): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  const name = def.name.trim();
  if (!installed(c) || !SERVES[c.kind].includes(def.product)) return fail("error.packageProduct");
  if (!PACKAGE_NAME.test(name)) return fail("error.packageName");
  if (packageNamed(c, name)) return fail("error.packageTaken");
  if (!validSpec(def.spec)) return fail("error.packageSpec");
  if (packagesOf(c).length >= PACKAGE_LIMIT) return fail("error.packageLimit");
  c.packages = [...packagesOf(c), { ...def, name }];
  return { ok: true, id: name };
}

// Changes the spec for accounts created afterwards; existing services keep their booking.
export function editPackage(s: GameState, clusterId: string, name: string, spec: Spec): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId), p = c && packageNamed(c, name);
  if (!p) return fail(c ? "error.packageMissing" : "error.unknownCluster");
  if (!validSpec(spec)) return fail("error.packageSpec");
  p.spec = spec;
  return { ok: true, id: p.name };
}

export function deletePackage(s: GameState, clusterId: string, name: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId), p = c && packageNamed(c, name);
  if (!c || !p) return fail(c ? "error.packageMissing" : "error.unknownCluster");
  const inUse = packageUse(s, c, p.name) > 0;
  if (inUse) return fail("error.packageInUse");
  c.packages = packagesOf(c).filter((x) => x !== p);
  return { ok: true, id: p.name };
}

// Adds the source's packages the target lacks; only packages of a product the target sells are copied. Returns the count copied in id.
export function copyPackages(s: GameState, fromClusterId: string, toClusterId: string): ActionResult {
  const from = s.clusters.find((x) => x.id === fromClusterId), to = s.clusters.find((x) => x.id === toClusterId);
  if (!from || !to) return fail("error.unknownCluster");
  let n = 0;
  for (const p of packagesOf(from)) {
    if (packageNamed(to, p.name) || packagesOf(to).length >= PACKAGE_LIMIT || !SERVES[to.kind].includes(p.product)) continue;
    to.packages = [...packagesOf(to), structuredClone(p)];
    n++;
  }
  return { ok: true, id: String(n) };
}
