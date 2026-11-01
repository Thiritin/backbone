// docs/design/plans/billing-by-hand.md, 9c and 9d: the installed bookkeeping program, its edition, fees, seats and chores.
import { dateOf, isMonthStart } from "../00-core/time";
import { booksVendor, editionById, type BooksVendor, type Edition, type Feature } from "../10-catalog/bookkeeping";
import { bookTransfer, cents, isUnpaid, issue, owed, synced, type Invoice, type Transfer } from "../45-billing/billing";
import { effectOf, invoice, invoicing } from "../46-finance/payables";
import { logActivity } from "../47-staff/activity";
import type { Employee } from "../47-staff/staff";
import type { GameState, LedgerEntry } from "../50-state";

export const YEAR_HOURS = 365 * 24;
export const MONTHLY_RUN_HOUR = 9;
export const LICENCE_KEY = "ledger.booksLicence", MONTHLY_KEY = "ledger.booksMonthly", UPDATE_KEY = "ledger.booksUpdate", SEAT_KEY = "ledger.booksSeat";

export const currentVendor = (s: GameState): BooksVendor | undefined => booksVendor(s.books.vendor);
export const currentEdition = (s: GameState): Edition | undefined => {
  const v = currentVendor(s);
  return v && editionById(v, s.books.edition);
};
export const LEXWEAR_HOST = "lexwear.de";
export const booksHost = (v: BooksVendor): string => (v.id === "gnucache" ? "gnucache.org" : `${v.id}.de`);
// The vendor's shop, or its page for one edition.
export const booksUrl = (v: BooksVendor, edition?: string): string => `www.${booksHost(v)}/${edition ? `edition/${edition}` : ""}`;

// A browser program is unusable while the internet line is missing, throttled or cut.
export const booksOffline = (s: GameState): boolean => currentVendor(s)?.deployment === "browser" && (!s.homeLine.id || effectOf(s, "upstream") !== null);
// The edition has the feature; works says whether it runs right now.
export const hasFeature = (s: GameState, f: Feature): boolean => !!currentEdition(s)?.features.includes(f);
export const works = (s: GameState, f: Feature): boolean => hasFeature(s, f) && !booksOffline(s);

// Staff who may work in the program besides the player: the licence's further users and the bought seats.
export const seatsFor = (s: GameState): number => Math.max(0, (currentEdition(s)?.users ?? 1) - 1 + s.books.seats);
const clerk = (e: Employee) => e.role === "bookkeeper" || e.role === "accountant";
// Clerks on the staff take the seats in hiring order; one without a seat idles. Bots work inside the program.
export const seated = (s: GameState, e: Employee): boolean => {
  const i = s.staff.filter(clerk).indexOf(e);
  return !clerk(e) || i < seatsFor(s);
};

// An unpaid Lexwear update stops upgrades until it is paid.
export const updateOpen = (s: GameState): boolean => s.payables.some((p) => p.paidAt === null && p.lines.some((e) => e.key === UPDATE_KEY));

// What the program has cost so far, so a reinstall or an upgrade pays only the difference.
export const paidFor = (s: GameState, v: BooksVendor): number =>
  -s.ledger.filter((e) => e.key === LICENCE_KEY && e.params.program === v.program).reduce((n, e) => n + e.amount, 0);
export const licencePrice = (s: GameState, v: BooksVendor, e: Edition): number => (v.deployment === "browser" ? 0 : Math.max(0, cents(e.price - paidFor(s, v))));
export const monthlyFee = (v: BooksVendor, e: Edition, seats: number): number => (v.deployment === "browser" ? cents(e.price + seats * e.seat) : 0);

// A fee goes out as the vendor's invoice once the company banks, and straight off the cash before.
export function bill(s: GameState, v: BooksVendor, key: string, amount: number, params: LedgerEntry["params"] = {}): void {
  const line: LedgerEntry = { hour: s.hour, category: "licenses", key, params: { program: v.program, ...params }, amount: -amount };
  if (invoicing(s)) { invoice(s, "books", v.name, [line]); return; }
  s.cash = cents(s.cash - amount);
  s.ledger = [...s.ledger, line];
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

const by = (s: GameState) => currentVendor(s)?.name ?? "";
export const monthlyRun = (s: GameState): void => s.invoices.filter((i) => i.status === "draft").forEach((inv) => sendDraft(s, inv, by(s)));

// The open invoice a transfer's reference names, when the amount is exactly what it owes; for money taken back, the paid one.
export function referenced(s: GameState, tr: Transfer): Invoice | undefined {
  if (tr.invoiceId === null && tr.back) return s.invoices.find((i) => i.number === tr.params.number && i.status === "paid" && synced(i));
  if (tr.invoiceId !== null || tr.reference !== "books.ref.invoice") return undefined;
  const inv = s.invoices.find((i) => i.number === tr.params.number && isUnpaid(i) && synced(i));
  return inv && owed(inv) === tr.amount ? inv : undefined;
}

export const matchByReference = (s: GameState): void => [...s.transfers].forEach((tr) => {
  const inv = referenced(s, tr);
  if (inv) bookFor(s, tr, inv, false, by(s));
});

// Hourly: the monthly fee at each month start, the update fee on each anniversary of the install, and the edition's chores.
export function booksTick(s: GameState): void {
  const v = currentVendor(s), e = currentEdition(s);
  if (!v || !e) return;
  const fee = monthlyFee(v, e, s.books.seats);
  if (fee && isMonthStart(s.hour)) bill(s, v, MONTHLY_KEY, fee, { edition: e.name });
  const age = s.hour - s.books.installedAt;
  if (e.update && age > 0 && age % YEAR_HOURS === 0) bill(s, v, UPDATE_KEY, e.update, { edition: e.name });
  const d = dateOf(s.hour);
  if (works(s, "monthly-run") && d.getUTCDate() === 1 && d.getUTCHours() === MONTHLY_RUN_HOUR) monthlyRun(s);
  if (works(s, "match-by-reference")) matchByReference(s);
}
