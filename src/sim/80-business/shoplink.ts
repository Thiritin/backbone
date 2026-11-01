// docs/design/plans/billing-by-hand.md, lane shop-link: the shop system keeps its own customers and invoices until Books
// imports them or the Shop link module syncs them as they are created. The shop gateway pays out once a week.
import { dateOf } from "../00-core/time";
import { shopById, type ShopId } from "../10-catalog/shops";
import { bookTransfer, cents, invoiceTotal, isUnpaid, renewTerms, synced, type Transfer } from "../45-billing/billing";
import type { GameState } from "../50-state";

// Each shop vendor's site, named after its product: modembill.com.
export const shopHost = (id: ShopId): string => `${shopById(id).name.toLowerCase().replace(/[^a-z]/g, "")}.com`;
export const shopVendorUrl = (id: ShopId): string => `www.${shopHost(id)}/`;

// Mondays at nine.
export const PAYOUT_DAY = 1, PAYOUT_HOUR = 9;

// The game as Books sees it: only the customers and invoices it holds.
export const booksView = (s: GameState): GameState => ({ ...s, customers: s.customers.filter(synced), invoices: s.invoices.filter(synced) });
export const unsynced = (s: GameState): number => s.customers.filter((c) => !synced(c)).length + s.invoices.filter((i) => !synced(i)).length;

// Books the payouts whose invoices Books knows: each invoice is paid and the transfer counts as matched.
export function resolvePayouts(s: GameState): void {
  for (const tr of s.transfers) {
    if (!tr.covers || tr.invoiceId !== null) continue;
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

// Flips every record the shop holds into Books and books the transfers that were waiting for its invoices.
export function importShop(s: GameState): void {
  const fresh = new Set(s.invoices.filter((i) => !synced(i)).map((i) => i.id));
  s.customers = s.customers.map((c) => (synced(c) ? c : { ...c, synced: true }));
  s.invoices = s.invoices.map((i) => (synced(i) ? i : { ...i, synced: true }));
  for (const tr of s.transfers.filter((x) => x.invoiceId === null && fresh.has(x.forInvoice))) {
    const inv = s.invoices.find((i) => i.id === tr.forInvoice);
    if (!inv || !isUnpaid(inv)) continue;
    const copy = { ...inv };
    s.invoices = s.invoices.map((i) => (i.id === inv.id ? copy : i));
    bookTransfer(s, tr, copy, false);
  }
  resolvePayouts(s);
}

// Hourly: on the payout hour the gateway sends what it collected since the last payout as one transfer.
export function payoutTick(s: GameState): void {
  const d = dateOf(s.hour);
  if (d.getUTCDay() !== PAYOUT_DAY || d.getUTCHours() !== PAYOUT_HOUR) return;
  const due = s.invoices.filter((i) => i.gateway && !i.payout);
  if (!due.length) return;
  const from = s.shop.variant ? shopById(s.shop.variant).name : "";
  const amount = cents(due.reduce((n, i) => n + invoiceTotal(i), 0));
  const tr: Transfer = {
    id: `trf${s.nextId++}`, hour: s.hour, from, reference: "shop-link.ref.payout", params: { numbers: due.map((i) => i.number).join(", ") },
    amount, invoiceId: null, matchedAt: null, forInvoice: "", covers: due.map((i) => i.id),
  };
  const ids = new Set(tr.covers);
  s.invoices = s.invoices.map((i) => (ids.has(i.id) ? { ...i, payout: tr.id } : i));
  s.transfers = [...s.transfers, tr];
  s.cash = cents(s.cash + amount);
  s.ledger = [...s.ledger, { hour: s.hour, category: "payments", key: "ledger.transfer", params: { from }, amount }];
  resolvePayouts(s);
}
