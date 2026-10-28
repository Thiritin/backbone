import type { Sla } from "../10-catalog/products";

export type Profile = "private" | "gamer" | "hobbyDev" | "soleProp" | "smallBiz" | "agency" | "office" | "onlineShop" | "enterprise";
export type Product = "webHosting" | "domain" | "ssl" | "dns" | "gameServer" | "vps" | "vpn" | "dedicated" | "storage" | "cloud" | "colocation";
// A friend always pays on time.
export type PaymentHabit = "prompt" | "late" | "bad" | "friend";
// history holds happiness at each of the last 12 month starts, oldest first.
export interface Customer { id: string; name: string; profile: Profile; since: number; happiness: number; habit: PaymentHabit; churnedAt: number | null; history: number[];
  // Set on customers won from a shady request; incidents read it for abuse and legal follow-ups.
  malicious?: boolean }
// price is per hour for period "hour" (invoiced monthly in arrears) and per year for period "year" (invoiced in advance).
// plan is a PRODUCTS plan id, null for the product's first plan; its workloads point back at it by serviceId.
export interface Service { id: string; customerId: string; product: Product; label: string; price: number; period: "hour" | "year"; commitMonths: number; startedAt: number; endedAt: number | null; zone: string | null;
  plan: string | null; sla: Sla }
export const activeServices = (services: Service[], customerId: string): Service[] => services.filter((v) => v.customerId === customerId && v.endedAt === null);
