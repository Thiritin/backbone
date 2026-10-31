// GDD, Specs: every order, request and service names its own resources, drawn from the size its customer's profile
// starts from. Numbers in economy.md, Custom orders and Per-resource pricing.
import { t } from "../../i18n/en";
import { textRecord } from "../00-core/text";
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { cores, marketPrice, marketSetup, SIZES, sizeSpec, specPrice, type Resources, type Sla, type Spec } from "../10-catalog/products";
import type { Product, Service } from "../30-customers/customers";
import { x86Share } from "../10-catalog/cpus";
import type { GameState } from "../50-state";

// What each line is called in requests, emails and lists.
export const LINE_NAME: Record<Product, string> = textRecord("sim.line", {
  webHosting: "Web hosting", vps: "VPS", gameServer: "Game server", dns: "DNS hosting", vpn: "VPN", storage: "Storage",
  cloud: "Cloud server", dedicated: "Dedicated server", colocation: "Colocation", domain: "Domain", ssl: "SSL certificate", gpu: "GPU server",
});
// Lines whose customers scale their size; the others take it as it is.
const SCALED: Product[] = ["webHosting", "vps", "gameServer", "dns", "vpn"];

// Each customer scales their profile's size by one of these factors, which average to one.
const FACTORS = [0.5, 0.75, 1, 1, 1.25, 1.5];
// An upgrade asks for this much more of everything.
export const UPGRADE_FACTORS = [1.5, 2];
const half = (x: number) => Math.max(0.5, Math.round(x * 2) / 2);
const quarter = (x: number) => Math.max(0.25, Math.round(x * 4) / 4);

export const sizeOf = (x: Resources): Resources => ({ vcpu: x.vcpu, ramGb: x.ramGb, diskGb: x.diskGb, ...(x.gpus ? { gpus: x.gpus } : {}), ...(x.arch ? { arch: x.arch } : {}) });
// Lines whose orders can need x86 (Windows VMs, old images, most game servers); the rest run anywhere.
const ARCH_LINES: Product[] = ["vps", "gameServer", "cloud"];

// A spec around size i of the line; key makes it stable for a seed. A share of VPS, game server and cloud orders needs x86.
export function specFor(seed: number, key: number, product: Product, size: number, year: number, factor?: number): Spec {
  const spec = sizedSpec(seed, key, product, size, year, factor);
  return ARCH_LINES.includes(product) && rand(hashRng(seed, key, 227)) < x86Share(year) ? { ...spec, arch: "x86" } : spec;
}
function sizedSpec(seed: number, key: number, product: Product, size: number, year: number, factor?: number): Spec {
  const base = sizeSpec(product, size, year);
  if (!SCALED.includes(product)) return base;
  const r = hashRng(seed, key, 211);
  const f = factor ?? FACTORS[Math.floor(rand(r) * FACTORS.length)];
  const trafficGb = Math.max(1, Math.round(base.trafficGb * f));
  if (product === "webHosting") return { vcpu: 0.1, ramGb: 0.25, diskGb: half(base.diskGb * f), trafficGb, mailboxes: 1 + Math.floor(rand(r) * 5 * f) };
  if (product === "dns") return { ...base, trafficGb, zones: Math.max(1, Math.round(base.zones! * f)) };
  if (product === "vpn") return { ...base, trafficGb, users: Math.max(1, Math.round(base.users! * f)) };
  const ramGb = quarter(base.ramGb * f);
  const vcpu = cores(base.vcpu * f) + (rand(r) < 0.3 ? 1 : 0);
  return { vcpu, ramGb, diskGb: Math.max(5, Math.round((base.diskGb * f * (0.75 + 0.5 * rand(r))) / 5) * 5), trafficGb, mailboxes: 0 };
}

// The next bigger spec an upgrade asks for: every resource it has times the factor.
export function grownSpec(seed: number, key: number, product: Product, spec: Spec, factor?: number): Spec {
  const f = factor ?? UPGRADE_FACTORS[Math.floor(rand(hashRng(seed, key, 223)) * UPGRADE_FACTORS.length)];
  const by = (x: number | undefined, round: (x: number) => number) => (x ? round(x * f) : x);
  if (product === "webHosting") return { ...spec, diskGb: half(spec.diskGb * f), trafficGb: Math.round(spec.trafficGb * f), mailboxes: Math.ceil(spec.mailboxes * f) };
  if (product === "dns" || product === "vpn") return { ...spec, trafficGb: Math.round(spec.trafficGb * f), zones: by(spec.zones, Math.ceil), users: by(spec.users, Math.ceil) };
  return {
    ...spec, vcpu: by(spec.vcpu, cores)!, ramGb: by(spec.ramGb, quarter)!, diskGb: by(spec.diskGb, Math.round)!, trafficGb: Math.round(spec.trafficGb * f),
    units: by(spec.units, Math.ceil), watts: by(spec.watts, Math.round),
  };
}

// What the market charges for a running service's spec this year.
export const serviceMarket = (v: Pick<Service, "product" | "sla" | "spec">, year: number): number => marketPrice(v.product, v.spec, year, v.sla);
// A spec at the player's rates for its line (Products app), per month for hourly lines.
export const offerPrice = (s: GameState, product: Product, spec: Spec, sla: Sla = "basic"): number =>
  specPrice(product, spec, yearOf(s.hour), sla, s.rates[product]);

// The one-time fee an order form order pays on top of its first month (Products app), the market's where unset.
export const setupFee = (s: GameState, product: Product): number => s.rates[product]?.setup ?? marketSetup(product, yearOf(s.hour));
// Customers weigh a setup fee as if spread over this many months of the line's middle size.
export const SETUP_MONTHS = 36;
// How much dearer a setup fee above the market's makes the order form, as a share of the monthly price; negative below it.
export function setupPremium(s: GameState, product: Product): number {
  const year = yearOf(s.hour), monthly = marketPrice(product, sizeSpec(product, Math.floor((SIZES[product].length - 1) / 2), year), year);
  return monthly > 0 ? (setupFee(s, product) - marketSetup(product, year)) / (SETUP_MONTHS * monthly) : 0;
}

const num = (n: number) => `${+n.toFixed(n < 1 ? 2 : 1)}`;
// A spec in one line, as every request, email, list and card shows it: "VPS, 2 vCPU, 4 GB, 80 GB".
export function specText(product: Product, spec: Spec): string {
  const gb = (n: number) => `${num(n)} GB`;
  const parts: string[] =
    product === "webHosting" ? [gb(spec.diskGb), t("sim.spec.mailboxes", { n: spec.mailboxes })]
      : product === "vps" || product === "gameServer" || product === "cloud" ? [`${num(spec.vcpu)} vCPU`, gb(spec.ramGb), gb(spec.diskGb)]
        : product === "gpu" ? [t("sim.spec.gpus", { n: spec.gpus ?? 0 }), `${num(spec.vcpu)} vCPU`, gb(spec.ramGb), gb(spec.diskGb)]
        : product === "storage" ? [gb(spec.diskGb)]
          : product === "dedicated" ? [t("sim.spec.ram", { size: gb(spec.ramGb) })]
            : product === "colocation" ? [`${spec.units ?? 0}U`, `${spec.watts ?? 0} W`]
              : product === "dns" ? [t("sim.spec.zones", { n: spec.zones ?? 0 })]
                : product === "vpn" ? [t("sim.spec.users", { n: spec.users ?? 0 })]
              : [];
  const addresses = [...(spec.ipv4 ? [t("sim.spec.ipv4", { n: spec.ipv4 })] : []), ...(spec.ipv6 ? ["IPv6"] : [])];
  return [LINE_NAME[product], ...parts, ...(spec.arch ? [spec.arch] : []), ...addresses].join(", ");
}
