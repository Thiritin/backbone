import { SIZES, marketPrice, sizeSpec, type Resources, type Sla, type Spec } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import { sizeOf } from "../30-market/spec";
import { clustersOf, workloadsOf, type Cluster } from "../60-infra/cluster";
import { SERVES } from "../10-catalog/platforms";
import type { GameState } from "../50-state";

// A named spec saved on a software installation. Only vcpu, ramGb and diskGb are booked; trafficGb and mailboxes are shown and carried.
export interface PackageDef {
  // Unique per installation, compared case-insensitively. It is the key, so a package cannot be renamed.
  name: string;
  product: Product;
  spec: Spec;
  // Reserved for game servers.
  title?: string;
  slots?: number;
}

export const PACKAGE_LIMIT = 12;
export const PACKAGE_NAME = /^[A-Za-z0-9 _-]{1,24}$/;
// The smallest share of the sold size a package may book (economy.md, Packages).
export const PACKAGE_FLOOR: Resources = { vcpu: 0.25, ramGb: 0.5, diskGb: 0.5 };
const KEYS = ["vcpu", "ramGb", "diskGb"] as const;

export const packagesOf = (c: Cluster): PackageDef[] => c.packages ?? [];
export const packageNamed = (c: Cluster, name: string): PackageDef | undefined =>
  packagesOf(c).find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
// Whether the package is at least as large as the sold spec in every booked dimension.
export const covers = (pkg: PackageDef, spec: Resources): boolean => KEYS.every((k) => pkg.spec[k] >= spec[k]);
// Whether the package books less than the floor of the sold size.
export const belowFloor = (pkg: PackageDef, spec: Resources): boolean => KEYS.some((k) => pkg.spec[k] < spec[k] * PACKAGE_FLOOR[k]);
// What a package books for a sold spec. promised is the sold size, set only when the booking is smaller in some dimension.
export function bookingFor(pkg: PackageDef, spec: Resources): { book: Resources; promised?: Resources } {
  const sold = sizeOf(spec), book: Resources = { ...sold, vcpu: pkg.spec.vcpu, ramGb: pkg.spec.ramGb, diskGb: pkg.spec.diskGb };
  return covers(pkg, spec) ? { book } : { book, promised: sold };
}
// A suggested monthly price for a package; it is never stored.
export const referencePrice = (pkg: PackageDef, year: number, sla: Sla = "basic"): number => marketPrice(pkg.product, pkg.spec, year, sla);
// The spec the Add form starts from: the middle size of the line.
export const defaultSpecFor = (product: Product, year: number): Spec => sizeSpec(product, Math.floor((SIZES[product].length - 1) / 2), year);
// The clusters that lack a package of the name.
export const missingOn = (s: GameState, clusterIds: string[], name: string): string[] =>
  clusterIds.filter((id) => { const c = s.clusters.find((x) => x.id === id); return !c || !packageNamed(c, name); });

// Web hosting usernames: 8 characters before 2012, 16 from then on.
export const usernameMax = (year: number): number => (year < 2012 ? 8 : 16);
// The error key for a username that cannot be used, or null.
export function usernameError(s: GameState, name: string, year: number): string | null {
  if (!/^[a-z][a-z0-9]*$/.test(name) || name.length > usernameMax(year)) return "error.username";
  return s.services.some((v) => !v.endedAt && v.username === name) ? "error.usernameTaken" : null;
}
// The domain's letters and digits up to the length limit, with a number added on a clash.
export function suggestedUsername(s: GameState, domain: string, year: number): string {
  const max = usernameMax(year), base = (domain.split(".")[0].toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^[0-9]+/, "") || "user").slice(0, max);
  for (let i = 1; ; i++) {
    const n = i === 1 ? base : base.slice(0, max - String(i).length) + i;
    if (!usernameError(s, n, year)) return n;
  }
}

// The products a package can be made for on an installation.
export const packageProducts = (c: Cluster): Product[] => SERVES[c.kind].filter((p) => p === "webHosting" || p === "vps" || p === "gameServer");
// How many active services on the installation carry the package.
export const packageUse = (s: GameState, c: Cluster, name: string): number =>
  s.services.filter((v) => !v.endedAt && v.pkg?.toLowerCase() === name.toLowerCase() && workloadsOf(s, v.id).some((w) => clustersOf(s, w.deviceId ?? "").some((x) => x.id === c.id))).length;
