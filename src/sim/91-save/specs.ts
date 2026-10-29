import { hourOf, yearOf } from "../00-core/time";
import { drawApp } from "../10-catalog/apps";
import { marketRates, SLAS, sizeSpec, type Sla, type Spec } from "../10-catalog/products";
import type { Product, Service } from "../30-customers/customers";
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

// Saves from before DNS zones and VPN users: the count that a monthly price buys at this year's market rates.
function counted<T extends Old>(old: T, at: number, monthly: number, sla: Sla | undefined, hour: number) {
  const x = filled(old, at), key = x.product === "dns" ? "zones" : x.product === "vpn" ? "users" : null;
  if (!key || old.spec?.[key] !== undefined) return x;
  const m = marketRates(x.product, yearOf(hour)), each = m[key === "zones" ? "zone" : "user"]!;
  const n = (monthly / SLAS[sla ?? "basic"].factor - (m.base ?? 0) - ((m.traffic ?? 0) * x.spec.trafficGb) / 100) / each;
  return { ...x, spec: { ...x.spec, [key]: Math.max(1, Math.round(n)) } };
}

// Saves from before customer apps: web hosting services draw the app by their start year. They run the release of two years
// ago or of their start when that is later, so an old save has something to update without being hacked at once.
function withApp(v: Service, seed: number, hour: number): Service {
  if (v.product !== "webHosting" || v.spec.app) return v;
  const version = Math.max(yearOf(v.startedAt), yearOf(hour) - 2);
  return { ...v, spec: { ...v.spec, app: drawApp(seed, Number(v.id.replace(/\D/g, "")) || 0, yearOf(v.startedAt)), appVersion: version, appUpdatedAt: Math.max(v.startedAt, hourOf(new Date(Date.UTC(version, 0, 1)))) } };
}

// Saves from before per-resource pricing: services, requests and lost sales get specs, and the packages list is dropped.
export function fillSpecs(s: GameState): GameState {
  const { packages: _, ...marketing } = s.marketing as GameState["marketing"] & { packages?: unknown };
  return {
    ...s, marketing, rates: s.rates ?? {},
    services: s.services.map((v) => withApp(counted(v, v.startedAt, v.price * 730, v.sla, s.hour), s.seed, s.hour)),
    sales: {
      requests: s.sales.requests.map((r) => counted(r, r.createdAt, r.reference, r.sla, s.hour)),
      lost: s.sales.lost.map((l) => counted(l, l.hour, l.reference, "basic", s.hour)),
    },
  };
}
