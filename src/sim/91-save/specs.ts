import { yearOf } from "../00-core/time";
import { sizeSpec, type Spec } from "../10-catalog/products";
import type { Product } from "../30-customers/customers";
import type { GameState } from "../50-state";

// The package ids older saves stored, smallest first like SIZES.
const PLAN_IDS: Record<Product, string[]> = {
  webHosting: ["web-s", "web-m", "web-l"], vps: ["vps-s", "vps-m", "vps-l", "vps-xl"], gameServer: ["game-s", "game-l"], dns: ["dns"], vpn: ["vpn"],
  storage: ["store-100", "store-500", "store-1000"], cloud: ["cloud-m"], dedicated: ["ded-s", "ded-l"],
  colocation: ["colo-1u", "colo-q", "colo-h", "colo-f"], domain: ["domain"], ssl: ["ssl"],
};

type Old = { product: Product; plan?: string | null; spec?: Spec; packaged?: boolean };
// A record from before specs takes its package's size in the year it started; the plan and packaged fields go.
function filled<T extends Old>(x: T, hour: number): Omit<T, "plan" | "packaged"> & { spec: Spec } {
  const { plan, packaged: _, ...rest } = x;
  return { ...rest, spec: x.spec ?? sizeSpec(x.product, Math.max(0, PLAN_IDS[x.product]?.indexOf(plan ?? "") ?? 0), yearOf(hour)) };
}

// Saves from before per-resource pricing: services, requests and lost sales get specs, and the packages list is dropped.
export function fillSpecs(s: GameState): GameState {
  const { packages: _, ...marketing } = s.marketing as GameState["marketing"] & { packages?: unknown };
  return {
    ...s, marketing, rates: s.rates ?? {},
    services: s.services.map((v) => filled(v, v.startedAt)),
    sales: {
      requests: s.sales.requests.map((r) => filled(r, r.createdAt)),
      lost: s.sales.lost.map((l) => filled(l, l.hour)),
    },
  };
}
