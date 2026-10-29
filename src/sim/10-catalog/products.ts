import type { Product } from "../30-customers/customers";
import { priceAt, vpsPlanGb, vpsRatePerGb } from "./economy";

// What one unit of a product takes from a node: booked vCPUs, GB of RAM and GB of disk.
export interface Resources { vcpu: number; ramGb: number; diskGb: number }
// What a customer orders and a service books: its resources, traffic per month, mailboxes (web hosting) and, for
// colocation, rack units and watts. A dedicated server's RAM is the smallest server it accepts.
export interface Spec extends Resources { trafficGb: number; mailboxes: number; units?: number; watts?: number }
// cluster: a workload on a cluster node; server: a whole server; rack: units and power in a datacenter rack; none: resold.
export type RunsOn = "cluster" | "server" | "rack" | "none";
export interface ProductSpec { runsOn: RunsOn; period: "hour" | "year"; commitMonths: number; ha?: boolean }

export type Sla = "basic" | "business" | "premium";
// economy.md, Requests, SLAs and growth: monthly uptime, first response, price factor and the share of the month's bill credited when missed.
export const SLAS: Record<Sla, { uptime: number; responseHours: number; factor: number; credit: number }> = {
  basic: { uptime: 0.995, responseHours: 48, factor: 1, credit: 0 },
  business: { uptime: 0.999, responseHours: 8, factor: 1.2, credit: 0.1 },
  premium: { uptime: 0.9999, responseHours: 1, factor: 1.5, credit: 0.25 },
};

// economy.md, Usage curves and overcommit: the most a cluster books per physical core, GB of RAM and GB of disk.
export const OVERCOMMIT = { cpu: 8, ram: 1.5, disk: 2 } as const;

export const PRODUCTS: Record<Product, ProductSpec> = {
  webHosting: { runsOn: "cluster", period: "hour", commitMonths: 1 },
  vps: { runsOn: "cluster", period: "hour", commitMonths: 1 },
  gameServer: { runsOn: "cluster", period: "hour", commitMonths: 1 },
  dns: { runsOn: "cluster", period: "hour", commitMonths: 1 },
  vpn: { runsOn: "cluster", period: "hour", commitMonths: 1 },
  storage: { runsOn: "cluster", period: "hour", commitMonths: 1 },
  cloud: { runsOn: "cluster", period: "hour", commitMonths: 0, ha: true },
  dedicated: { runsOn: "server", period: "hour", commitMonths: 12 },
  colocation: { runsOn: "rack", period: "hour", commitMonths: 12 },
  domain: { runsOn: "none", period: "year", commitMonths: 12 },
  ssl: { runsOn: "none", period: "year", commitMonths: 12 },
};

type Size = (year: number) => Resources & { units?: number; watts?: number };
const NONE: Resources = { vcpu: 0, ramGb: 0, diskGb: 0 };
const grow = (year: number) => vpsPlanGb(year);
// A web space uses 0.1 vCPU, 0.25 GB of RAM and its disk, which grows like VPS RAM.
const web = (gb: number): Size => (y) => ({ vcpu: 0.1, ramGb: 0.25, diskGb: Math.round(gb * grow(y)) });
// A VM of a share of the year's base RAM: one vCPU per 2 GB (at least one) and 20 GB of disk per GB of RAM.
const vm = (share: number): Size => (y) => { const ramGb = share * grow(y); return { vcpu: Math.max(1, Math.round(ramGb / 2)), ramGb, diskGb: Math.round(20 * ramGb) }; };
// Game servers start at 2 vCPUs and 4 GB, doubling like VMs.
const game = (share: number): Size => (y) => ({ vcpu: 2 * share * grow(y), ramGb: 4 * share * grow(y), diskGb: Math.round(10 * share * grow(y)) });
const volume = (gb: number): Size => () => ({ ...NONE, diskGb: gb });
const dedicated = (ramGb: number): Size => (y) => ({ ...NONE, ramGb: ramGb * grow(y) });
const colo = (units: number, watts: number): Size => () => ({ ...NONE, units, watts });
const fixed = (r: Resources): Size => () => r;

// The sizes a line's customers start from, smallest first: a low budget takes the first, a medium one the second and a
// high one the last (market.ts, needFor); spec.ts scales them per customer.
export const SIZES: Record<Product, Size[]> = {
  webHosting: [web(1), web(2), web(5)],
  vps: [vm(0.5), vm(1), vm(2), vm(4)],
  gameServer: [game(1), game(2)],
  dns: [fixed({ vcpu: 0.05, ramGb: 0.1, diskGb: 1 })],
  vpn: [fixed({ vcpu: 1, ramGb: 0.5, diskGb: 1 })],
  storage: [volume(100), volume(500), volume(1000)],
  cloud: [vm(1)],
  dedicated: [dedicated(8), dedicated(32)],
  colocation: [colo(1, 150), colo(10, 1000), colo(21, 2000), colo(42, 4000)],
  domain: [fixed(NONE)],
  ssl: [fixed(NONE)],
};

// economy.md, Traffic and bandwidth: an average customer's GB per month in 2005, growing 20% a year.
export const TRAFFIC_GB: Record<Product, number> = {
  webHosting: 2, domain: 0, ssl: 0, dns: 1, gameServer: 60, vps: 20, vpn: 300, dedicated: 150, storage: 100, cloud: 20, colocation: 500,
};
export const TRAFFIC_GROWTH = 1.2;

// Size i of a line in a year as a spec. Each size step doubles the traffic; the middle size (the lower middle of an even
// count) is the average customer. A web space comes with two mailboxes.
export function sizeSpec(product: Product, i: number, year: number): Spec {
  const sizes = SIZES[product], k = Math.min(Math.max(0, i), sizes.length - 1);
  const trafficGb = TRAFFIC_GB[product] * Math.pow(TRAFFIC_GROWTH, Math.max(0, year - 2005)) * Math.pow(2, k - Math.floor((sizes.length - 1) / 2));
  return { ...sizes[k](year), trafficGb, mailboxes: product === "webHosting" ? 2 : 0 };
}

// What a line charges for: a base fee per service and a price per resource unit.
export type Unit = "base" | "vcpu" | "ramGb" | "diskGb" | "mailbox" | "unit" | "kw";
const VM: Unit[] = ["base", "vcpu", "ramGb", "diskGb"];
export const UNITS: Record<Product, Unit[]> = {
  webHosting: ["base", "diskGb", "mailbox"], vps: VM, gameServer: VM, cloud: VM, storage: ["base", "diskGb"],
  dns: ["base"], vpn: ["base"], domain: ["base"], ssl: ["base"], dedicated: ["base", "ramGb"], colocation: ["base", "unit", "kw"],
};
// A line's rates in euros per unit; a unit without one charges the market rate.
export type Rates = Partial<Record<Unit, number>>;

// economy.md, Per-resource pricing: the market's rates in a year at the basic SLA, per month for hourly lines and per
// year for yearly ones. They keep the sizes above near their former package prices.
export function marketRates(product: Product, year: number): Rates {
  const r = vpsRatePerGb(year), g = grow(year);
  switch (product) {
    case "webHosting": return { base: 0.9, diskGb: 2.25 / g, mailbox: 0.3 };
    case "vps": return { vcpu: 0.2 * r, ramGb: 0.5 * r, diskGb: 0.02 * r };
    case "gameServer": return { vcpu: 0.4 * r, ramGb: 1.35 * r, diskGb: 0.02 * r };
    case "cloud": return { vcpu: 0.25 * r, ramGb: 0.625 * r, diskGb: 0.025 * r };
    case "storage": return { diskGb: priceAt(2.6, 32, year) / 1000 };
    case "dns": return { base: 2 };
    case "vpn": return { base: 5 };
    case "domain": return { base: 15 };
    case "ssl": return { base: year < 2016 ? 50 : 0 };
    case "dedicated": return { base: 6, ramGb: 220 / 24 / g };
    case "colocation": return { base: 15, unit: 30, kw: 100 };
  }
}

export const unitAmount = (spec: Spec, u: Unit): number =>
  u === "base" ? 1 : u === "mailbox" ? spec.mailboxes : u === "unit" ? spec.units ?? 0 : u === "kw" ? (spec.watts ?? 0) / 1000 : spec[u];

// A spec's price at a line's rates (the market's where unset) and an SLA, rounded to cents.
export function specPrice(product: Product, spec: Spec, year: number, sla: Sla = "basic", rates: Rates = {}): number {
  const market = marketRates(product, year);
  const sum = UNITS[product].reduce((n, u) => n + (rates[u] ?? market[u] ?? 0) * unitAmount(spec, u), 0);
  return Math.round(sum * SLAS[sla].factor * 100) / 100;
}
// What a customer expects to pay for a spec in a year, per month for hourly products and per year for yearly ones.
export const marketPrice = (product: Product, spec: Spec, year: number, sla: Sla = "basic"): number => specPrice(product, spec, year, sla);
