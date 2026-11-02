import type { Resources, Sla, Spec } from "../10-catalog/products";
import type { Cycle } from "../10-catalog/cycles";
import type { MethodId } from "../10-catalog/payments";
import type { Address } from "./addresses";

export type Profile = "private" | "gamer" | "hobbyDev" | "soleProp" | "smallBiz" | "agency" | "office" | "onlineShop" | "enterprise" | "reseller";
export type Product = "webHosting" | "domain" | "ssl" | "dns" | "gameServer" | "vps" | "vpn" | "dedicated" | "storage" | "cloud" | "colocation" | "gpu" | "reseller";
// A friend always pays on time.
export type PaymentHabit = "prompt" | "late" | "bad" | "friend";
// history holds happiness at each of the last 12 month starts, oldest first.
export interface Customer { id: string; name: string; profile: Profile; since: number; happiness: number; habit: PaymentHabit; churnedAt: number | null; history: number[];
  // The balance of credit notes the next invoice takes off.
  credit: number;
  // Postal address from the order, printed on invoices.
  address: Address;
  // A customer who draws abuse reports and legal requests; never shown to the player. Set on customers won from a shady request.
  shady?: boolean;
  // A fraudster's order: the hour the stolen payment is charged back. Never shown to the player.
  chargebackAt?: number;
  // The organiser of a sponsored event: churned from the start so no customer count, mail or churn roll sees them, while their free services run.
  sponsor?: true;
  // Created by the shop system; absent reads as entered in Books. synced false hides it from Books until an import.
  source?: "manual" | "shop";
  synced?: boolean;
  // How a shop customer pays; absent reads as bank transfer. fraud is set once a fraud chargeback is booked.
  method?: MethodId;
  fraud?: true }
// price is per hour for period "hour" (invoiced monthly in arrears) and per year for period "year" (invoiced in advance).
// spec is what the customer ordered and the service books; its workloads point back at it by serviceId.
export interface Service { id: string; customerId: string; product: Product; label: string; price: number; period: "hour" | "year"; commitMonths: number; startedAt: number; endedAt: number | null; zone: string | null;
  spec: Spec; sla: Sla;
  // The package the service was provisioned from; absent reads as Custom.
  pkg?: string;
  // What the package booked when it is not the sold size; a restore books the same.
  pkgBook?: Resources;
  // Web hosting only: the account's login name.
  username?: string;
  // Traffic over the plan (80-business/overuse.ts): held at the booked traffic, and the hour the last overage bill or upgrade offer went out.
  throttled?: true;
  overuseAt?: number;
  // The last hour the service ran slowed; a month without one earns a review.
  slowedAt?: number;
  // Hourly price from before the first of a run of raises; unset once the price is back at or below it.
  before?: number;
  // Hourly price invoiced until the next month start: a raise takes effect from the month after it is made.
  held?: number;
  // Web hosting only: the customer's domain, fixed at sign-up (domains.ts).
  domain?: string;
  // The machine name customers quote in tickets: a product prefix and an eight-digit number; domain and SSL services have none.
  hostname?: string;
  // Ordered through a shop system, whose revenue cut it then carries.
  viaShop?: boolean;
  // The hour up to which an email order's first invoice paid it.
  prepaidUntil?: number;
  // A multi-month billing cycle: the hour the paid term ends, its cycle, and the term end the churn roll already ran for.
  termEnd?: number;
  cycle?: Cycle;
  rolledAt?: number;
  // A retention discount: the hourly price from before it and the month starts left until the price returns.
  discount?: { was: number; months: number };
  // The hour a termination with notice ends the service.
  endsAt?: number }
// Why the hoster terminates a contract.
export type TerminateReason = "payment" | "abuse" | "usage" | "capacity";
export const activeServices = (services: Service[], customerId: string): Service[] => services.filter((v) => v.customerId === customerId && v.endedAt === null);
