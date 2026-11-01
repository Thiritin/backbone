import type { Spec } from "../10-catalog/products";
import { SERVES } from "../10-catalog/platforms";
import { workloadsOf, type Cluster } from "../60-infra/cluster";
import { ACTION_MINUTES, logActivity } from "../47-staff/activity";
import { belowFloor, bookingFor, PACKAGE_LIMIT, PACKAGE_NAME, packageNamed, packageUse, packagesOf, type PackageDef } from "../80-business/packages";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";
import { placeService } from "./clusters";

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

// Books another package of the host on a running service, in place while the node holds the RAM and disk; the service keeps its sold spec.
export function changePackage(s: GameState, serviceId: string, name: string): ActionResult {
  const v = s.services.find((x) => x.id === serviceId && x.endedAt === null), w = v && workloadsOf(s, v.id)[0];
  const c = w && s.clusters.find((x) => x.id === w.clusterId);
  if (!v || !w || !c) return fail("error.unknownService");
  const pkg = packageNamed(c, name);
  if (!pkg) return fail("error.packageMissing");
  if (pkg.product !== v.product) return fail("error.packageProduct");
  if (belowFloor(pkg, v.spec)) return fail("error.packageTooSmall");
  const { book, promised } = bookingFor(pkg, v.spec);
  // Checked on a copy: the booking must be placeable on the node the service already runs on.
  const trial = { ...s, workloads: s.workloads.filter((x) => x.id !== w.id), services: s.services.map((x) => (x.id === v.id ? { ...x, pkg: pkg.name, pkgBook: book } : x)) };
  if (!placeService(trial, v.id, c.id, w.deviceId).ok) return fail("error.noCapacity");
  s.workloads = s.workloads.map((x) => (x.id === w.id ? { ...x, ...book, promised } : x));
  s.services = s.services.map((x) => (x.id === v.id ? { ...x, pkg: pkg.name, pkgBook: book } : x));
  logActivity(s, { customerId: v.customerId, serviceId: v.id, by: null, key: "activity.changePackage", params: { pkg: pkg.name }, minutes: ACTION_MINUTES.techOp });
  return { ok: true };
}
