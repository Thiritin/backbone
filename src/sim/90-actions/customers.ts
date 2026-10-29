import type { GameState } from "../50-state";
import type { Customer, Product, Profile, PaymentHabit } from "../30-customers/customers";
import { sizeSpec, type Sla, type Spec } from "../10-catalog/products";
import { yearOf } from "../00-core/time";
import { drawApp } from "../10-catalog/apps";
import { webDomain } from "../30-customers/domains";
import { serviceHostname } from "../30-customers/hostnames";
import { isSuspended, SUSPEND_HAPPINESS } from "../45-billing/billing";
import { bump, createTicket, profileStats } from "../40-support/tickets";
import type { ActionResult } from "./hardware";

export function addCustomer(s: GameState, name: string, profile: Profile, habit: PaymentHabit = "prompt"): string {
  const id = `cus${s.nextId++}`;
  s.customers.push({ id, name, profile, since: s.hour, happiness: 70, habit, churnedAt: null, history: [], credit: 0 } satisfies Customer);
  return id;
}

// Records a contract without placing it; provisionService in clusters.ts also places it on hardware.
export function addService(s: GameState, customerId: string, product: Product, label: string, price: number, period: "hour" | "year", commitMonths = 0, zone: string | null = null,
  spec: Spec = sizeSpec(product, 0, yearOf(s.hour)), sla: Sla = "basic"): string {
  const id = `svc${s.nextId++}`;
  // A web hosting service runs an app drawn from the year's shares.
  if (product === "webHosting" && !spec.app) spec = { ...spec, app: drawApp(s.seed, Number(id.slice(3)), yearOf(s.hour)), appVersion: yearOf(s.hour), appUpdatedAt: s.hour };
  const domain = product === "webHosting" ? webDomain(s, customerId, label, zone, id) : undefined;
  const hostname = serviceHostname(s, product);
  s.services.push({ id, customerId, product, label: domain ?? label, price, period, commitMonths, startedAt: s.hour, endedAt: null, zone, spec, sla, ...(domain && { domain }), ...(hostname && { hostname }) });
  return id;
}

const live = (s: GameState, id: string) => s.customers.find((c) => c.id === id && c.churnedAt === null);

// A credit note: the customer's next invoice is lower by the amount.
export function creditCustomer(s: GameState, customerId: string, amount: number): ActionResult {
  const c = live(s, customerId);
  if (!c) return { ok: false, error: "error.unknownCustomer" };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "error.creditAmount" };
  c.credit = Math.round((c.credit + amount) * 100) / 100;
  return { ok: true, id: c.id };
}

// Holds every service of the customer offline, or brings them back. The first hold costs happiness and brings a ticket, as an invoice suspension does.
export function suspendCustomer(s: GameState, customerId: string, suspended: boolean): ActionResult {
  const c = live(s, customerId);
  if (!c) return { ok: false, error: "error.unknownCustomer" };
  if (suspended === s.heldCustomers.includes(c.id)) return { ok: true, id: c.id };
  const first = suspended && !isSuspended(s, c.id);
  s.heldCustomers = suspended ? [...s.heldCustomers, c.id] : s.heldCustomers.filter((id) => id !== c.id);
  if (first) {
    bump(c, -SUSPEND_HAPPINESS[profileStats(c.profile).budget]);
    createTicket(s, c, "billing").topic = "suspended";
  }
  return { ok: true, id: c.id };
}
