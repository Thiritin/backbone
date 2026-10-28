// GDD, Custom orders: before the online order form sells packages, every order names its own resources.
// Numbers in economy.md, Custom orders.
import { hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { vpsPlanGb, vpsRatePerGb, WEB_BASE } from "../10-catalog/economy";
import { marketPrice, planOf, SLAS, trafficGb, type Resources, type Sla } from "../10-catalog/products";
import type { Product, Service } from "../30-customers/customers";
import type { GameState } from "../50-state";

// What a custom order or service books, plus the web extras: traffic per month and mailboxes.
export interface CustomSpec extends Resources { trafficGb: number; mailboxes: number }

export const CUSTOM_NAME: Partial<Record<Product, string>> = { webHosting: "Web hosting", vps: "VPS", gameServer: "Game server" };
export const customizable = (p: Product): boolean => p in CUSTOM_NAME;

// Each order scales its profile's usual plan by one of these factors.
const FACTORS = [0.5, 0.75, 1, 1.25, 1.5, 2];
// After the order form, a quarter of email orders still ask for something off the packages.
export const CUSTOM_LATER = 0.25;
// An upgrade asks for this much more of everything.
export const UPGRADE_FACTORS = [1.5, 2];
const half = (x: number) => Math.max(0.5, Math.round(x * 2) / 2);
const quarter = (x: number) => Math.max(0.25, Math.round(x * 4) / 4);

export const sizeOf = (x: Resources): Resources => ({ vcpu: x.vcpu, ramGb: x.ramGb, diskGb: x.diskGb });

// A custom spec around the plan the profile would have picked; key makes it stable for a seed.
export function customSpec(seed: number, key: number, product: Product, plan: string, year: number, factor?: number): CustomSpec {
  const r = hashRng(seed, key, 211), base = planOf(product, plan).size(year);
  const f = factor ?? FACTORS[Math.floor(rand(r) * FACTORS.length)];
  const traffic = Math.max(1, Math.round(trafficGb(product, plan, year) * f));
  if (product === "webHosting") return { vcpu: 0.1, ramGb: 0.25, diskGb: half(base.diskGb * f), trafficGb: traffic, mailboxes: 1 + Math.floor(rand(r) * 5 * f) };
  const ramGb = quarter(base.ramGb * f);
  const vcpu = Math.max(1, Math.round(base.vcpu * f)) + (rand(r) < 0.3 ? 1 : 0);
  return { vcpu, ramGb, diskGb: Math.max(5, Math.round((base.diskGb * f * (0.75 + 0.5 * rand(r))) / 5) * 5), trafficGb: traffic, mailboxes: 0 };
}

// The next bigger spec an upgrade asks for: every resource times the factor.
export function grownSpec(seed: number, key: number, product: Product, spec: CustomSpec): CustomSpec {
  const f = UPGRADE_FACTORS[Math.floor(rand(hashRng(seed, key, 223)) * UPGRADE_FACTORS.length)];
  if (product === "webHosting") return { ...spec, diskGb: half(spec.diskGb * f), trafficGb: Math.round(spec.trafficGb * f), mailboxes: Math.ceil(spec.mailboxes * f) };
  return { ...spec, vcpu: Math.ceil(spec.vcpu * f), ramGb: quarter(spec.ramGb * f), diskGb: Math.round(spec.diskGb * f), trafficGb: Math.round(spec.trafficGb * f) };
}

// Web space priced along Web S, M and L by disk (in that year's GB), 30 cents per mailbox past two.
const WEB_POINTS: [number, number][] = [[0, 1.5], [1, 3], [2, WEB_BASE], [5, 12]];
function webPrice(gb: number): number {
  let i = 1;
  while (i < WEB_POINTS.length - 1 && WEB_POINTS[i][0] < gb) i++;
  const [x0, y0] = WEB_POINTS[i - 1], [x1, y1] = WEB_POINTS[i];
  return y0 + ((y1 - y0) * (gb - x0)) / (x1 - x0);
}

// The monthly market price of a custom spec at the basic SLA factor times sla: the VPS rate per GB of RAM (1.6 times for
// game servers), half a GB's rate per vCPU past one per 2 GB, and disk past 20 GB per GB of RAM at 1/40 of the rate.
export function customMarket(product: Product, spec: CustomSpec, year: number, sla: Sla = "basic"): number {
  let price: number;
  if (product === "webHosting") price = webPrice(spec.diskGb / vpsPlanGb(year)) + 0.3 * Math.max(0, spec.mailboxes - 2);
  else {
    const rate = vpsRatePerGb(year), cpus = Math.max(0, spec.vcpu - Math.max(1, Math.round(spec.ramGb / 2)));
    price = rate * ((product === "gameServer" ? 1.6 : 1) * spec.ramGb + 0.5 * cpus + Math.max(0, spec.diskGb - 20 * spec.ramGb) / 40);
  }
  return Math.round(price * SLAS[sla].factor * 100) / 100;
}

// What the market charges for a running service: its custom spec's price or its plan's.
export const serviceMarket = (v: Pick<Service, "product" | "plan" | "sla" | "spec">, year: number): number =>
  v.spec ? customMarket(v.product, v.spec, year, v.sla) : marketPrice(v.product, v.plan, year, v.sla);

// What a request books: its custom spec, or its plan's size this year.
export const requestSize = (s: GameState, r: { product: Product; plan: string; spec?: CustomSpec }): Resources =>
  r.spec ? sizeOf(r.spec) : planOf(r.product, r.plan).size(yearOf(s.hour));
