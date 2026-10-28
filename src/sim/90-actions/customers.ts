import type { GameState } from "../50-state";
import type { Customer, Product, Profile, PaymentHabit } from "../30-customers/customers";
import type { Sla } from "../10-catalog/products";
import { webDomain } from "../30-customers/domains";

export function addCustomer(s: GameState, name: string, profile: Profile, habit: PaymentHabit = "prompt"): string {
  const id = `cus${s.nextId++}`;
  s.customers.push({ id, name, profile, since: s.hour, happiness: 70, habit, churnedAt: null, history: [] } satisfies Customer);
  return id;
}

// Records a contract without placing it; provisionService in clusters.ts also places it on hardware.
export function addService(s: GameState, customerId: string, product: Product, label: string, price: number, period: "hour" | "year", commitMonths = 0, zone: string | null = null,
  plan: string | null = null, sla: Sla = "basic"): string {
  const id = `svc${s.nextId++}`;
  const domain = product === "webHosting" ? webDomain(s, customerId, label, zone, id) : undefined;
  s.services.push({ id, customerId, product, label: domain ?? label, price, period, commitMonths, startedAt: s.hour, endedAt: null, zone, plan, sla, ...(domain && { domain }) });
  return id;
}
