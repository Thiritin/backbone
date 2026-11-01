// docs/design/plans/billing-by-hand.md, lane payment-methods: how a shop customer pays, what the gateways take back and
// what Books does when the player matches it. Numbers in docs/design/economy.md, Payment methods.
import { chance, hashRng, rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { hasModule } from "../10-catalog/modules";
import {
  CARD_CHARGEBACK_CHANCE, CARD_CHARGEBACK_DAYS, DEBIT_RETURN_DAYS, DEBIT_RETURN_FEE, DISPUTE_AFTER_DAYS, DISPUTE_CHANCE, DISPUTE_DAYS,
  methodById, MISSING_CONVERT, NEVER_WITHOUT, PREFERENCE, type MethodId,
} from "../10-catalog/payments";
import { shopById } from "../10-catalog/shops";
import { inUs } from "../20-world/datacenters";
import type { Customer, Profile } from "../30-customers/customers";
import type { GameState, LedgerEntry } from "../50-state";
import { cents, DUE_DAYS, invoiceTotal, PAY_ODDS, payDelay, renewTerms, type BackKind, type Invoice, type Transfer } from "./billing";
import { CHARGEBACK_FEE, WATCHED_FEE } from "./fraud";

const DAY = 24;

// The method a shop customer reaches for first, among those that exist this year.
export function preferredMethod(s: GameState, profile: Profile, city: string, shady: boolean, key: number): MethodId {
  const home = s.locations[0]?.city ?? city, year = yearOf(s.hour);
  const row = shady ? PREFERENCE.shady : inUs(city) !== inUs(home) ? PREFERENCE.international : PREFERENCE[profile];
  const ws = (Object.entries(row) as [MethodId, number][]).filter(([id]) => methodById(id).year <= year);
  let x = rand(hashRng(s.seed, key, 337)) * ws.reduce((n, [, w]) => n + w, 0);
  for (const [id, w] of ws) {
    if (x < w) return id;
    x -= w;
  }
  return "transfer";
}

// Bank transfer always; every other method once its module is registered and while it is switched on.
export const offers = (s: GameState, id: MethodId): boolean => id === "transfer" || (hasModule(s, id) && !s.shop.methodsOff.includes(id));

// The method a shop order checks out with: the preferred one, else bank transfer by chance, else null and the sale is lost.
export function checkoutMethod(s: GameState, preferred: MethodId, key: number): MethodId | null {
  if (offers(s, preferred)) return preferred;
  if (NEVER_WITHOUT.includes(preferred)) return null;
  return rand(hashRng(s.seed, key, 347)) < MISSING_CONVERT ? "transfer" : null;
}

// Who sends a method's money: its provider, or the shop system for direct debit and the old single gateway.
export const payeeOf = (s: GameState, id?: MethodId): string => (id && methodById(id).payee) || (s.shop.variant ? shopById(s.shop.variant).name : "");

// A shop invoice the customer pays by their method: the gateways collect at checkout and pay out weekly; Instantly's
// transfer arrives at once. Bank transfer leaves the invoice as Books sent it.
export function checkout(s: GameState, inv: Invoice, c: Customer | undefined): void {
  if (!c?.method || c.method === "transfer") return;
  const m = methodById(c.method);
  inv.method = m.id;
  if (m.instant) {
    inv.payAt = s.hour;
    return;
  }
  Object.assign(inv, { gateway: true, shopPaid: true, payAt: null });
  delete inv.bank;
}

// Rolled when a payout carries the invoice: a bad payer's debit returns, a PayPail payment may be disputed and an honest
// card payment may be charged back. A stolen card's chargeback comes from fraud.ts instead.
export function rollBack(s: GameState, inv: Invoice, c: Customer | undefined): Invoice["back"] {
  const r = hashRng(s.seed, Number(inv.id.slice(3)) || 0, 353);
  const after = ([a, b]: [number, number]) => s.hour + (a + Math.floor(rand(r) * (b - a + 1))) * DAY;
  if (inv.method === "debit" && c?.habit === "bad" && inv.payStep > 0) return { kind: "return", at: after(DEBIT_RETURN_DAYS) };
  if (inv.method === "paypail" && chance(r, DISPUTE_CHANCE)) return { kind: "dispute", at: after(DISPUTE_AFTER_DAYS) };
  if (inv.method === "card" && c?.chargebackAt === undefined && chance(r, CARD_CHARGEBACK_CHANCE)) return { kind: "chargeback", at: after(CARD_CHARGEBACK_DAYS) };
  return undefined;
}

// The provider takes a paid invoice's money back with its fee, as a negative transfer in Books.
export function takeBack(s: GameState, inv: Invoice, kind: Exclude<BackKind, "release">, fraud = false): void {
  const c = s.customers.find((x) => x.id === inv.customerId), total = invoiceTotal(inv);
  const fee = kind === "return" ? DEBIT_RETURN_FEE : kind === "chargeback" ? (s.chargebackStrikes >= 2 ? WATCHED_FEE : CHARGEBACK_FEE) : 0;
  const tr: Transfer = {
    id: `trf${s.nextId++}`, hour: s.hour, from: payeeOf(s, inv.method), reference: `payment-methods.ref.${kind}`, params: { number: inv.number },
    amount: -cents(total + fee), invoiceId: null, matchedAt: null, forInvoice: inv.id, back: kind, atBank: true, ...(fraud && { fraud: true as const }),
  };
  const lines: LedgerEntry[] = kind === "chargeback"
    ? [{ hour: s.hour, category: "payments", key: "ledger.chargeback", params: { customer: c?.name ?? "" }, amount: -total },
      { hour: s.hour, category: "fees", key: "ledger.chargebackFee", params: { customer: c?.name ?? "" }, amount: -fee }]
    : [{ hour: s.hour, category: "payments", key: `ledger.${kind}`, params: { invoice: inv.number }, amount: -cents(total + fee) }];
  s.transfers = [...s.transfers, tr];
  s.cash = cents(s.cash - total - fee);
  s.ledger = [...s.ledger, ...lines];
}

// Hourly: due returns, disputes and chargebacks arrive, and a dispute's money comes back DISPUTE_DAYS later.
export function paymentsTick(s: GameState): void {
  for (const inv of s.invoices.filter((i) => i.back && s.hour >= i.back.at)) {
    const kind = inv.back!.kind, total = invoiceTotal(inv);
    const next = kind === "dispute" && inv.status === "paid" ? { kind: "release" as const, at: s.hour + DISPUTE_DAYS * DAY } : undefined;
    s.invoices = s.invoices.map((i) => (i.id === inv.id ? { ...i, back: next } : i));
    if (kind !== "release") {
      if (inv.status === "paid") takeBack(s, inv, kind);
      continue;
    }
    const from = payeeOf(s, inv.method);
    s.transfers = [...s.transfers, { id: `trf${s.nextId++}`, hour: s.hour, from, reference: "books.ref.invoice", params: { number: inv.number }, amount: total, invoiceId: null, matchedAt: null, forInvoice: inv.id, atBank: true }];
    s.cash = cents(s.cash + total);
    s.ledger = [...s.ledger, { hour: s.hour, category: "payments", key: "ledger.transfer", params: { from }, amount: total }];
  }
}

// Matching money taken back reopens the invoice. A disputed one waits for its release; the others go back to bank
// transfer and the dunning steps. A stolen card's chargeback marks the customer as fraud and suspends their services.
export function reopen(s: GameState, tr: Transfer, inv: Invoice): void {
  s.transfers = s.transfers.map((x) => (x === tr ? { ...x, invoiceId: inv.id, matchedAt: s.hour } : x));
  Object.assign(inv, { status: "open", paidAt: null, dueAt: s.hour + DUE_DAYS * DAY, reminders: [], suspended: false, suspendedAt: null, extendedUntil: null });
  renewTerms(s, inv, -1);
  delete inv.shopPaid;
  delete inv.received;
  if (tr.back === "dispute") return;
  delete inv.gateway;
  inv.bank = true;
  if (!tr.fraud) {
    inv.payAt = inv.payStep === 0 ? s.hour + payDelay(s.rng) : null;
    return;
  }
  Object.assign(inv, { payStep: PAY_ODDS.prompt.length - 1, payAt: null, suspended: true, suspendedAt: s.hour });
  s.customers = s.customers.map((c) => (c.id === inv.customerId ? { ...c, fraud: true } : c));
}
