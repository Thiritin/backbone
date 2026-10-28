import type { Product } from "../30-customers/customers";
import { priceAt, vpsPlanGb, vpsRatePerGb, WEB_BASE } from "./economy";

// What one unit of a product takes from a node: booked vCPUs, GB of RAM and GB of disk.
export interface Resources { vcpu: number; ramGb: number; diskGb: number }
// cluster: a workload on a cluster node; server: a whole server; rack: units and power in a datacenter rack; none: resold.
export type RunsOn = "cluster" | "server" | "rack" | "none";
// price is per month for hourly products and per year for yearly ones. size and price take the game year: fixed-price plans keep their price and grow, priced plans follow the base rates.
// A rack plan books units and watts; a server plan sets the smallest server it accepts.
export interface Plan { id: string; name: string; size: (year: number) => Resources; price: (year: number) => number; units?: number; watts?: number }
export interface ProductSpec { runsOn: RunsOn; period: "hour" | "year"; commitMonths: number; ha?: boolean; plans: Plan[] }

export type Sla = "basic" | "business" | "premium";
// economy.md, Requests, SLAs and growth: monthly uptime, first response, price factor and the share of the month's bill credited when missed.
export const SLAS: Record<Sla, { uptime: number; responseHours: number; factor: number; credit: number }> = {
  basic: { uptime: 0.995, responseHours: 48, factor: 1, credit: 0 },
  business: { uptime: 0.999, responseHours: 8, factor: 1.2, credit: 0.1 },
  premium: { uptime: 0.9999, responseHours: 1, factor: 1.5, credit: 0.25 },
};

// economy.md, Usage curves and overcommit: the most a cluster books per physical core, GB of RAM and GB of disk.
export const OVERCOMMIT = { cpu: 8, ram: 1.5, disk: 2 } as const;

const NONE: Resources = { vcpu: 0, ramGb: 0, diskGb: 0 };
const fixed = (price: number) => () => price;
const grow = (year: number) => vpsPlanGb(year);
// A web space uses 0.1 vCPU, 0.25 GB of RAM and its plan's disk; plan disk grows like VPS RAM.
const web = (id: string, name: string, diskGb: number, price: number): Plan =>
  ({ id, name, size: (y) => ({ vcpu: 0.1, ramGb: 0.25, diskGb: Math.round(diskGb * grow(y)) }), price: fixed(price) });
// A VM of a share of the year's base plan RAM: one vCPU per 2 GB (at least one) and 20 GB of disk per GB of RAM.
const vm = (id: string, name: string, share: number): Plan => ({
  id, name,
  size: (y) => { const ramGb = share * grow(y); return { vcpu: Math.max(1, Math.round(ramGb / 2)), ramGb, diskGb: Math.round(20 * ramGb) }; },
  price: (y) => share * grow(y) * vpsRatePerGb(y),
});
// Game servers start at 2 vCPUs and 4 GB, doubling like VPS plans, at 1.6 × the VPS rate per GB (the low end of €2.40 to €6.10).
const game = (id: string, name: string, share: number): Plan => ({
  id, name, size: (y) => ({ vcpu: 2 * share * grow(y), ramGb: 4 * share * grow(y), diskGb: Math.round(10 * share * grow(y)) }),
  price: (y) => 4 * share * grow(y) * 1.6 * vpsRatePerGb(y),
});
// Storage hosting: €2.60 per TB in 2026 with the storage multiplier of 32.
const volume = (id: string, name: string, gb: number): Plan => ({ id, name, size: () => ({ ...NONE, diskGb: gb }), price: (y) => (gb / 1000) * priceAt(2.6, 32, y) });
const dedicated = (id: string, name: string, ramGb: number, price: number): Plan => ({ id, name, size: (y) => ({ ...NONE, ramGb: ramGb * grow(y) }), price: fixed(price) });
const colo = (id: string, name: string, units: number, watts: number, price: number): Plan => ({ id, name, size: () => NONE, price: fixed(price), units, watts });
const resold = (id: string, name: string, price: (y: number) => number): Plan => ({ id, name, size: () => NONE, price });
const small = (id: string, name: string, r: Resources, price: number): Plan => ({ id, name, size: () => r, price: fixed(price) });

export const PRODUCTS: Record<Product, ProductSpec> = {
  webHosting: { runsOn: "cluster", period: "hour", commitMonths: 1, plans: [web("web-s", "Web S", 1, 3), web("web-m", "Web M", 2, WEB_BASE), web("web-l", "Web L", 5, 12)] },
  vps: { runsOn: "cluster", period: "hour", commitMonths: 1, plans: [vm("vps-s", "VPS S", 0.5), vm("vps-m", "VPS M", 1), vm("vps-l", "VPS L", 2), vm("vps-xl", "VPS XL", 4)] },
  gameServer: { runsOn: "cluster", period: "hour", commitMonths: 1, plans: [game("game-s", "Game S", 1), game("game-l", "Game L", 2)] },
  dns: { runsOn: "cluster", period: "hour", commitMonths: 1, plans: [small("dns", "DNS", { vcpu: 0.05, ramGb: 0.1, diskGb: 1 }, 2)] },
  vpn: { runsOn: "cluster", period: "hour", commitMonths: 1, plans: [small("vpn", "VPN", { vcpu: 1, ramGb: 0.5, diskGb: 1 }, 5)] },
  storage: { runsOn: "cluster", period: "hour", commitMonths: 1, plans: [volume("store-100", "Storage 100 GB", 100), volume("store-500", "Storage 500 GB", 500), volume("store-1000", "Storage 1 TB", 1000)] },
  cloud: { runsOn: "cluster", period: "hour", commitMonths: 0, ha: true, plans: [{ ...vm("cloud-m", "Cloud M", 1), price: (y) => 1.25 * grow(y) * vpsRatePerGb(y) }] },
  dedicated: { runsOn: "server", period: "hour", commitMonths: 12, plans: [dedicated("ded-s", "Dedicated S", 8, 79), dedicated("ded-l", "Dedicated L", 32, 299)] },
  colocation: { runsOn: "rack", period: "hour", commitMonths: 12, plans: [colo("colo-1u", "1U", 1, 150, 60), colo("colo-q", "Quarter rack", 10, 1000, 420), colo("colo-h", "Half rack", 21, 2000, 840), colo("colo-f", "Full rack", 42, 4000, 1600)] },
  domain: { runsOn: "none", period: "year", commitMonths: 12, plans: [resold("domain", "Domain", fixed(15))] },
  ssl: { runsOn: "none", period: "year", commitMonths: 12, plans: [resold("ssl", "SSL certificate", (y) => (y < 2016 ? 50 : 0))] },
};

export function planOf(product: Product, planId: string | null): Plan {
  const plans = PRODUCTS[product].plans;
  return plans.find((p) => p.id === planId) ?? plans[0];
}

// What a customer expects to pay for a plan in a year, per month for hourly products and per year for yearly ones.
export const marketPrice = (product: Product, planId: string | null, year: number, sla: Sla = "basic"): number =>
  Math.round(planOf(product, planId).price(year) * SLAS[sla].factor * 100) / 100;
