// docs/design/plans/billing-by-hand.md, lane vendor-sites: Lexwear sells the Books modules on its site. A purchase is a
// ledger line, the licence key follows by email a minute later, and the newsletter offers each module once.
import { t } from "../../i18n/en";
import { keyCode } from "../00-core/rng";
import { dateOf } from "../00-core/time";
import { BOOKS_VENDORS, booksVendor, type BooksVendor, type BooksVendorId } from "../10-catalog/bookkeeping";
import { hasModule, MODULES, type ModuleCount } from "../10-catalog/modules";
import { deliverMail, type Ticket } from "../40-support/tickets";
import { bookTransfer, isUnpaid, issue, owed, type Invoice, type Transfer } from "../45-billing/billing";
import { logActivity } from "../47-staff/activity";
import type { GameState, LedgerEntry } from "../50-state";
import type { SimEvent } from "../88-tick/tick";

export const LEXWEAR = "Lexwear";
export const LEXWEAR_HOST = "lexwear.de";
export const lexwearUrl = (id?: string): string => `www.${LEXWEAR_HOST}/${id ? `module/${id}` : ""}`;
export const MONTHLY_RUN_HOUR = 9;

// Fixed per game, vendor and module.
export const licenceKey = (s: GameState, id: string, vendor: BooksVendorId = "lexwear"): string =>
  keyCode(s.seed, MODULES.findIndex((m) => m.id === id) + 1, 607 + BOOKS_VENDORS.findIndex((v) => v.id === vendor));

// Lexwear's module purchases keep their own ledger lines; the other bookkeeping vendors' lines carry the vendor's name.
const LEDGER = "ledger.module.", VENDOR_LEDGER = "ledger.bookModule.";
export const purchaseEntry = (s: GameState, v: BooksVendor, id: string, price: number): LedgerEntry => v.id === "lexwear"
  ? { hour: s.hour, category: "licenses", key: LEDGER + id, params: {}, amount: -price }
  : { hour: s.hour, category: "licenses", key: VENDOR_LEDGER + id, params: { vendor: v.name }, amount: -price };
const purchaseOf = (e: LedgerEntry): { vendor: BooksVendorId; module: string } | null => e.key.startsWith(LEDGER)
  ? { vendor: "lexwear", module: e.key.slice(LEDGER.length) }
  : e.key.startsWith(VENDOR_LEDGER) ? { vendor: BOOKS_VENDORS.find((v) => v.name === e.params.vendor)?.id ?? "lexwear", module: e.key.slice(VENDOR_LEDGER.length) } : null;
export const bought = (s: GameState, id: string, vendor: BooksVendorId = "lexwear"): boolean =>
  s.ledger.some((e) => { const p = purchaseOf(e); return p?.vendor === vendor && p.module === id; });
export const LICENCE = "lexwear.licence", NEWSLETTER = "lexwear.newsletter", BOOKS_LICENCE = "books.licence";
export const licenceMail = (s: GameState, id: string, vendor: BooksVendorId = "lexwear"): Ticket | undefined =>
  s.tickets.find((x) => x.kind === "mail" && x.mail?.params.module === id
    && (vendor === "lexwear" ? x.topic === LICENCE : x.topic === BOOKS_LICENCE && x.mail.from === booksVendor(vendor)?.name));

// A Lexwear email's params as shown: the module's name and pitch in the player's language.
export const vendorParams = (p: Record<string, string | number>): Record<string, string> => ({
  module: t(`vendor-sites.module.${p.module}`), pitch: t(`vendor-sites.pitch.${p.module}`), key: String(p.key ?? ""),
});

function mail(s: GameState, topic: string, params: Record<string, string>, from = LEXWEAR): SimEvent {
  const m = deliverMail(s, from, topic, params);
  return { app: "Support", key: "event.ticket", params: { ...params, ...vendorParams(params), ticketId: m.id, name: from, subject: `ticket.mail.${topic}.subject` } };
}

// Every minute and hour: purchases of the last hour without their licence email get it now.
export function deliverLicences(s: GameState): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = s.ledger.length - 1; i >= 0 && s.ledger[i].hour >= s.hour - 1; i--) {
    const p = purchaseOf(s.ledger[i]), v = p && booksVendor(p.vendor);
    if (!p || !v?.keys || licenceMail(s, p.module, v.id)) continue;
    const key = licenceKey(s, p.module, v.id);
    out.push(v.id === "lexwear" ? mail(s, LICENCE, { module: p.module, key }) : mail(s, BOOKS_LICENCE, { module: p.module, key, program: v.program }, v.name));
  }
  return out;
}

export const COUNTS: Record<ModuleCount, (s: GameState) => number> = {
  domainsByHand: (s) => s.domains.filter((d) => d.customerId !== null && !d.transfer).length,
  matched: (s) => s.transfers.filter((x) => x.matchedAt !== null).length,
  customers: (s) => s.customers.filter((c) => !c.sponsor).length,
  suspended: (s) => s.invoices.filter((i) => i.suspendedAt !== null).length,
};
// Sent newsletters are kept in arrived, like the apps' emails.
const newsId = (id: string) => `lexwear.${id}`;

// Lexwear stops writing once the company runs another vendor's program.
function newsletters(s: GameState): SimEvent[] {
  if (s.books.vendor && s.books.vendor !== "lexwear") return [];
  return MODULES.filter((m) => m.trigger && !s.arrived.includes(newsId(m.id)) && COUNTS[m.trigger.count](s) >= m.trigger.at).flatMap((m) => {
    s.arrived = [...s.arrived, newsId(m.id)];
    return bought(s, m.id) ? [] : [mail(s, NEWSLETTER, { module: m.id })];
  });
}

const logged = (s: GameState, inv: Invoice, key: string, by: string, minutes = 0) =>
  logActivity(s, { customerId: inv.customerId, serviceId: null, by, key: `activity.${key}`, params: { invoice: inv.number }, minutes });

// Sends one draft as the given worker; the invoice record is copied, since the tick works on a shallow copy of the state.
export function sendDraft(s: GameState, inv: Invoice, by: string, minutes = 0): void {
  const copy = { ...inv };
  s.invoices = s.invoices.map((x) => (x.id === inv.id ? copy : x));
  issue(s, copy);
  logged(s, copy, "sendInvoice", by, minutes);
}

export function bookFor(s: GameState, tr: Transfer, inv: Invoice, settle: boolean, by: string, minutes = 0): void {
  const copy = { ...inv };
  s.invoices = s.invoices.map((x) => (x.id === inv.id ? copy : x));
  bookTransfer(s, tr, copy, settle);
  logged(s, copy, "matchTransfer", by, minutes);
}

export const monthlyRun = (s: GameState): void => s.invoices.filter((i) => i.status === "draft").forEach((inv) => sendDraft(s, inv, LEXWEAR));

// The open invoice a transfer's reference names, when the amount is exactly what it owes.
export function referenced(s: GameState, tr: Transfer): Invoice | undefined {
  if (tr.invoiceId !== null || tr.reference !== "books.ref.invoice") return undefined;
  const inv = s.invoices.find((i) => i.number === tr.params.number && isUnpaid(i));
  return inv && owed(inv) === tr.amount ? inv : undefined;
}

export const matchByReference = (s: GameState): void => [...s.transfers].forEach((tr) => {
  const inv = referenced(s, tr);
  if (inv) bookFor(s, tr, inv, false, LEXWEAR);
});

// Hourly, after billing and before staff: newsletters, late licence emails and the modules' chores.
export function lexwearTick(s: GameState): SimEvent[] {
  const events = [...newsletters(s), ...deliverLicences(s)];
  const d = dateOf(s.hour);
  if (hasModule(s, "monthly-run") && d.getUTCDate() === 1 && d.getUTCHours() === MONTHLY_RUN_HOUR) monthlyRun(s);
  if (hasModule(s, "match-by-reference")) matchByReference(s);
  return events;
}
