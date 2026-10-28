import type { GameState } from "../50-state";
import type { Customer, Product, Profile, PaymentHabit } from "../30-customers/customers";

export function addCustomer(s: GameState, name: string, profile: Profile, habit: PaymentHabit = "prompt"): string {
  const id = `cus${s.nextId++}`;
  s.customers.push({ id, name, profile, since: s.hour, happiness: 70, habit, churnedAt: null, history: [] } satisfies Customer);
  return id;
}

export function addService(s: GameState, customerId: string, product: Product, label: string, price: number, period: "hour" | "year", commitMonths = 0, zone: string | null = null): string {
  const id = `svc${s.nextId++}`;
  s.services.push({ id, customerId, product, label, price, period, commitMonths, startedAt: s.hour, endedAt: null, zone });
  return id;
}
