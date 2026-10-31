// Prepaid billing cycles and churn (docs/design/economy.md, Billing cycles).
import { CYCLE_MONTHS } from "../10-catalog/cycles";
import { cents } from "../45-billing/billing";
import type { GameState } from "../50-state";
import type { Customer } from "../30-customers/customers";

const MONTH_HOURS = 730;
// A term ending before the next month start gets its one roll at this month start.
const LONGEST_MONTH = 744;

// Whether the monthly churn roll skips the customer, and how many months one roll covers. A term rolls once, in the month
// before it ends; until then a customer inside a paid term does not roll.
export function termRoll(s: GameState, customerId: string): { committed: boolean; months: number } {
  const active = s.services.filter((v) => v.customerId === customerId && v.endedAt === null);
  const ending = active.filter((v) => v.cycle && v.termEnd !== undefined && v.termEnd > s.hour && v.termEnd <= s.hour + LONGEST_MONTH && v.rolledAt !== v.termEnd);
  if (ending.length) {
    const ids = new Set(ending.map((v) => v.id));
    s.services = s.services.map((v) => (ids.has(v.id) ? { ...v, rolledAt: v.termEnd } : v));
    return { committed: false, months: Math.max(...ending.map((v) => CYCLE_MONTHS[v.cycle!])) };
  }
  return { committed: active.length > 0 && active.every((v) => v.termEnd !== undefined && v.termEnd > s.hour), months: 1 };
}

// A customer who leaves inside a paid term gets the unused whole months back, unless an invoice of theirs is still open.
export function refundUnused(s: GameState, c: Customer): void {
  if (s.invoices.some((i) => i.customerId === c.id && i.status !== "paid" && i.status !== "writtenOff")) return;
  let months = 0, amount = 0;
  for (const v of s.services) {
    if (v.customerId !== c.id || v.endedAt !== null || !v.cycle || v.termEnd === undefined || v.termEnd <= s.hour) continue;
    const left = Math.floor((v.termEnd - s.hour) / MONTH_HOURS);
    months += left;
    amount += left * MONTH_HOURS * v.price;
  }
  amount = cents(amount);
  if (amount <= 0) return;
  s.cash = cents(s.cash - amount);
  s.ledger = [...s.ledger, { hour: s.hour, category: "billing", key: "ledger.refundUnused", params: { customer: c.name, months }, amount: -amount }];
}
