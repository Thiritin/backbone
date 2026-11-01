// docs/design/plans/billing-by-hand.md, lane shop-link: the shop system keeps its own customers and invoices until Books
// imports them or the Shop link module syncs them as they are created. The shop gateway pays out once a week.
import { dateOf } from "../00-core/time";
import { methodById, methodFee, type MethodId } from "../10-catalog/payments";
import { shopById, type ShopId } from "../10-catalog/shops";
import { bookTransfer, cents, inBooks, invoiceTotal, isUnpaid, renewTerms, synced, type Invoice, type Transfer } from "../45-billing/billing";
import type { GameState } from "../50-state";
import { payeeOf, rollBack } from "../45-billing/payments";

// Each shop vendor's site, named after its product: modembill.com.
export const shopHost = (id: ShopId): string => `${shopById(id).name.toLowerCase().replace(/[^a-z]/g, "")}.com`;
export const shopVendorUrl = (id: ShopId): string => `www.${shopHost(id)}/`;

// Mondays at nine.
export const PAYOUT_DAY = 1, PAYOUT_HOUR = 9;

// The game as Books sees it: only the customers, invoices and transfers it holds.
export const booksView = (s: GameState): GameState => ({ ...s, customers: s.customers.filter(synced), invoices: s.invoices.filter(synced), transfers: s.transfers.filter(inBooks) });
export const unsynced = (s: GameState): number => s.customers.filter((c) => !synced(c)).length + s.invoices.filter((i) => !synced(i)).length;

// Books the payouts whose invoices Books knows: each invoice is paid and the transfer counts as matched. A bookkeeping
// program needs the payout in Books first; without one the shop settles its own invoices.
export function resolvePayouts(s: GameState): void {
  for (const tr of s.transfers) {
    if (!tr.covers || tr.invoiceId !== null || (s.books.vendor && !inBooks(tr))) continue;
    const covers = new Set(tr.covers);
    if (s.invoices.some((i) => covers.has(i.id) && !synced(i))) continue;
    s.invoices = s.invoices.map((i) => {
      if (!covers.has(i.id) || !isUnpaid(i)) return i;
      const paid = { ...i, status: "paid" as const, paidAt: s.hour, suspended: false, payAt: null };
      renewTerms(s, paid);
      return paid;
    });
    s.transfers = s.transfers.map((x) => (x.id === tr.id ? { ...x, invoiceId: tr.covers![0], matchedAt: s.hour } : x));
  }
}

// Flips the shop's records with these ids into Books and books the transfers in Books that were waiting for its invoices.
export function importShop(s: GameState, ids: Set<string>): void {
  const fresh = new Set(s.invoices.filter((i) => !synced(i) && ids.has(i.id)).map((i) => i.id));
  s.customers = s.customers.map((c) => (synced(c) || !ids.has(c.id) ? c : { ...c, synced: true }));
  s.invoices = s.invoices.map((i) => (fresh.has(i.id) ? { ...i, synced: true } : i));
  for (const tr of s.transfers.filter((x) => x.invoiceId === null && inBooks(x) && fresh.has(x.forInvoice))) {
    const inv = s.invoices.find((i) => i.id === tr.forInvoice);
    if (!inv || !isUnpaid(inv)) continue;
    const copy = { ...inv };
    s.invoices = s.invoices.map((i) => (i.id === inv.id ? copy : i));
    bookTransfer(s, tr, copy, false);
  }
  resolvePayouts(s);
}

// Hourly: on the payout hour each gateway sends what it collected since the last payout as one transfer, less its fees.
// Invoices from before payment methods have none and pay out as the shop's own gateway.
export function payoutTick(s: GameState): void {
  const d = dateOf(s.hour);
  if (d.getUTCDay() !== PAYOUT_DAY || d.getUTCHours() !== PAYOUT_HOUR) return;
  const due = new Map<MethodId | undefined, Invoice[]>();
  for (const i of s.invoices) if (i.gateway && !i.payout) due.set(i.method, [...(due.get(i.method) ?? []), i]);
  for (const [id, list] of due) {
    const m = id && methodById(id), from = payeeOf(s, id);
    const gross = cents(list.reduce((n, i) => n + invoiceTotal(i), 0));
    const fees = m ? cents(list.reduce((n, i) => n + methodFee(m, invoiceTotal(i)), 0)) : 0, amount = cents(gross - fees);
    const tr: Transfer = {
      id: `trf${s.nextId++}`, hour: s.hour, from, reference: "shop-link.ref.payout", params: { numbers: list.map((i) => i.number).join(", ") },
      amount, invoiceId: null, matchedAt: null, forInvoice: "", covers: list.map((i) => i.id), atBank: true,
    };
    const ids = new Set(tr.covers);
    s.invoices = s.invoices.map((i) => (ids.has(i.id) ? { ...i, payout: tr.id, back: rollBack(s, i, s.customers.find((c) => c.id === i.customerId)) } : i));
    s.transfers = [...s.transfers, tr];
    s.cash = cents(s.cash + amount);
    s.ledger = [...s.ledger, { hour: s.hour, category: "payments", key: "ledger.transfer", params: { from }, amount: gross },
      ...(fees > 0 ? [{ hour: s.hour, category: "fees", key: "ledger.paymentFees", params: { from }, amount: -fees }] : [])];
  }
  if (due.size) resolvePayouts(s);
}
