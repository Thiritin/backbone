// GDD, Fraud and chargebacks. Numbers in economy.md, Fraud and chargebacks.
import { hashRng, rand } from "../00-core/rng";
import { isMonthStart, yearOf } from "../00-core/time";
import { priceAt } from "../10-catalog/economy";
import type { Customer, Product } from "../30-customers/customers";
import type { SalesRequest } from "../30-market/market";
import { cancelCustomer } from "../40-support/tickets";
import type { GameState, LedgerEntry } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { cents, invoiceTotal } from "./billing";

const DAY = 24;
// Share of standard orders paid with a stolen card or wallet account.
export const FRAUD_SHARE: Partial<Record<Product, number>> = { vps: 0.05, cloud: 0.05, gpu: 0.06, dedicated: 0.04, vpn: 0.03, gameServer: 0.02, webHosting: 0.01 };
export const OTHER_FRAUD_SHARE = 0.005;
// Card fraud grows with online shopping, peaks with crypto mining and drops with strong customer authentication.
export const FRAUD_YEAR: [number, number][] = [[2005, 1], [2010, 1.3], [2017, 2], [2019, 1.2]];
// An email order pays its invoice by bank transfer.
export const TRANSFER_FACTOR = 0.2;
export function fraudShare(product: Product, year: number, email = false): number {
  const factor = FRAUD_YEAR.filter(([y]) => year >= y).at(-1)?.[1] ?? 1;
  return (FRAUD_SHARE[product] ?? OTHER_FRAUD_SHARE) * factor * (email ? TRANSFER_FACTOR : 1);
}
export const rollFraud = (s: GameState, key: number, product: Product, year: number, email: boolean): boolean =>
  rand(hashRng(s.seed, key, 307)) < fraudShare(product, year, email);

// The fields a customer won from the request gets: a fraudster acts like a shady customer until the chargeback.
export const CHARGEBACK_DAYS: [number, number] = [30, 60];
export function hiddenTraits(s: GameState, r: SalesRequest): Partial<Customer> {
  if (!r.fraud) return r.shady ? { shady: true } : {};
  const days = CHARGEBACK_DAYS[0] + Math.floor(rand(hashRng(s.seed, Number(r.id.slice(3)) || 0, 311)) * (CHARGEBACK_DAYS[1] - CHARGEBACK_DAYS[0] + 1));
  return { shady: true, chargebackAt: s.hour + days * DAY };
}

// Manual review of server orders: staff time on the account step, a catch on fraud and some honest orders lost.
export const REVIEWED: Product[] = ["vps", "cloud", "gpu", "dedicated"];
export const REVIEW_MINUTES = 10;
export const REVIEW_CATCH = 0.7;
export const REVIEW_FALSE = 0.03;
export const reviewing = (s: GameState, product: Product): boolean => s.reviewOrders && REVIEWED.includes(product);
export const failsReview = (s: GameState, r: SalesRequest): boolean =>
  reviewing(s, r.product) && rand(hashRng(s.seed, Number(r.id.slice(3)) || 0, 313)) < (r.fraud ? REVIEW_CATCH : REVIEW_FALSE);

// Order screening by MaxMined scores each standard order as it arrives; manual review only sees the orders it lets through.
export const SCREENING_SKILL = "fraudScreening";
export const SCREEN_CATCH = 0.8;
export const SCREEN_FALSE = 0.01;
// Per check, billed on the first of the month: €0.08 in 2026 with m = 2 (about €0.15 in 2008).
export const screenFee = (year: number): number => priceAt(0.08, 2, year);
export const screening = (s: GameState): boolean => s.screenOrders && s.unlocks.includes(SCREENING_SKILL);
export const failsScreen = (s: GameState, key: number, fraud: boolean): boolean =>
  rand(hashRng(s.seed, key, 317)) < (fraud ? SCREEN_CATCH : SCREEN_FALSE);

// The payment provider, PayPail.
export const CHARGEBACK_FEE = 15;
export const WATCHED_FEE = 25;
export const PROVIDER = { share: 0.01, min: 3, days: 90, monthlyFee: 250 };

// Hourly: due chargebacks take back every payment of the fraudster with a fee; at the month start the provider checks the
// share of chargebacks among payments, warns once and then charges more while it stays high.
export function fraudTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  const booked: LedgerEntry[] = [];
  const book = (category: string, key: string, params: LedgerEntry["params"], amount: number) => {
    booked.push({ hour: s.hour, category, key, params, amount });
    s.cash = cents(s.cash + amount);
  };
  for (const due of s.customers.filter((c) => c.chargebackAt !== undefined && s.hour >= c.chargebackAt)) {
    s.customers = s.customers.map((c) => (c.id === due.id ? { ...c, chargebackAt: undefined } : c));
    const c = s.customers.find((x) => x.id === due.id)!;
    const paid = cents(s.invoices.filter((i) => i.customerId === c.id && i.status === "paid").reduce((n, i) => n + invoiceTotal(i), 0));
    s.invoices = s.invoices.map((i) => (i.customerId === c.id && i.status !== "writtenOff" ? { ...i, status: "writtenOff", payAt: null, suspended: false } : i));
    if (c.churnedAt === null) {
      s.tickets = s.tickets.map((t) => ({ ...t }));
      cancelCustomer(s, c);
    }
    if (paid <= 0) continue;
    const fee = s.chargebackStrikes >= 2 ? WATCHED_FEE : CHARGEBACK_FEE;
    book("payments", "ledger.chargeback", { customer: c.name }, -paid);
    book("fees", "ledger.chargebackFee", { customer: c.name }, -fee);
    events.push({ app: "Billing", key: "event.chargeback", params: { customer: c.name, amount: cents(paid + fee) } });
  }
  if (booked.length) s.ledger = [...s.ledger, ...booked];
  if (!isMonthStart(s.hour)) return events;
  if (s.screenChecks > 0) {
    const fee = cents(s.screenChecks * screenFee(yearOf(s.hour)));
    s.cash = cents(s.cash - fee);
    s.ledger = [...s.ledger, { hour: s.hour, category: "fees", key: "ledger.screening", params: { count: s.screenChecks }, amount: -fee }];
    s.screenChecks = 0;
  }
  const since = s.hour - PROVIDER.days * DAY;
  let backs = 0, payments = 0;
  for (const e of s.ledger) {
    if (e.hour <= since) continue;
    if (e.key === "ledger.chargeback") backs++;
    else if (e.key === "ledger.payment") payments++;
  }
  if (backs < PROVIDER.min || backs <= PROVIDER.share * payments) {
    s.chargebackStrikes = 0;
    return events;
  }
  s.chargebackStrikes = Math.min(2, s.chargebackStrikes + 1);
  if (s.chargebackStrikes === 1) {
    events.push({ app: "Billing", key: "event.chargebackWarning", params: { count: backs } });
  } else {
    s.cash = cents(s.cash - PROVIDER.monthlyFee);
    s.ledger = [...s.ledger, { hour: s.hour, category: "fees", key: "ledger.chargebackProgram", params: {}, amount: -PROVIDER.monthlyFee }];
    events.push({ app: "Billing", key: "event.chargebackFees", params: { fee: PROVIDER.monthlyFee, chargeback: WATCHED_FEE } });
  }
  return events;
}
