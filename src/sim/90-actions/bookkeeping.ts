// docs/design/plans/billing-by-hand.md, 9c and 9d, and web-presence.md, lane books-download: buying a bookkeeping program on
// its vendor's site, downloading and installing a desktop program, upgrading its edition, buying seats.
import { yearOf } from "../00-core/time";
import { booksVendor, editionById, type BooksVendor, type Edition, type Feature } from "../10-catalog/bookkeeping";
import { MS_PER_HOUR } from "../00-core/time";
import { downloadMbps } from "./media";
import { bill as billVendor, invoicing, type Method } from "../46-finance/payables";
import { placeOrder } from "./purchase";
import type { GameState } from "../50-state";
import { bill, currentEdition, currentVendor, hasFeature, HBCI_KEY, LICENCE_KEY, licencePrice, matchByReference, monthlyFee, monthlyRun, MONTHLY_KEY, SEAT_KEY, updateOpen, works } from "../80-business/bookkeeping";
import type { ActionResult } from "./hardware";
import { matchTransfer } from "./billing";
import { assignPayment } from "./bank";
import { deliverMail } from "../42-mail/sources";
import { bankReady, booksKey, needsActivation, needsKey, newSetup, setupOf, syncBooksGuide, type BooksSetup, type Chart, type TaxMethod } from "../80-business/books-guide";

const fail = (error: string): ActionResult => ({ ok: false, error });

// A licence and a desktop seat are paid at once, off the account unless the player picked another method.
function pay(s: GameState, v: BooksVendor, key: string, amount: number, e: Edition, method?: Method): ActionResult {
  if (!amount) return { ok: true };
  const o = { supplier: "books" as const, name: v.name, lines: [{ hour: s.hour, category: "licenses", key, params: { program: v.program, edition: e.name }, amount: -amount }] };
  if (method) return placeOrder(s, { ...o, method });
  billVendor(s, { ...o, method: s.bank ? "debit" : "cash" });
  return { ok: true };
}

function take(s: GameState, v: BooksVendor, e: Edition, seats: number, method?: Method): ActionResult {
  const price = licencePrice(s, v, e), fee = monthlyFee(v, e, seats);
  if (s.cash < price + (invoicing(s) ? 0 : fee)) return fail("error.noCash");
  return pay(s, v, LICENCE_KEY, price, e, method);
}

// The data stays where it is; the old program's edition, seats and fee go. A program bought before costs only what its
// edition adds. The installer stays in Downloads for a reinstall.
function setUp(s: GameState, v: BooksVendor, e: Edition): void {
  s.books = { vendor: v.id, installedAt: s.hour, edition: e.id, seats: 0, download: s.books.download, setupDone: false, addons: [], setup: newSetup() };
  if (!s.installed.includes("Books")) s.installed = [...s.installed, "Books"];
  const fee = monthlyFee(v, e, 0);
  if (fee) bill(s, v, MONTHLY_KEY, fee, { edition: e.name });
}

// The order mail carries the number a desktop program asks for; a browser program mails the link that confirms the sign-up.
function mailAccess(s: GameState, v: BooksVendor): void {
  const from = { source: "supplier:books" };
  if (v.deployment === "browser") deliverMail(s, v.name, "booksSignup", { program: v.program }, from);
  else if (needsKey(v.id)) deliverMail(s, v.name, "booksKey", { program: v.program, key: booksKey(s, v.id) }, from);
}

// Whole game hours a desktop program's installer takes over the player's line; null without one.
export function setupHours(s: GameState, v: BooksVendor): number | null {
  const mbps = downloadMbps(s);
  if (!mbps) return null;
  return Math.max(1, Math.ceil(((v.setupMb ?? 0) * 8 * 1000) / mbps / MS_PER_HOUR));
}

// Buying on the vendor's site: a browser program starts at once, a desktop program is paid and starts to download.
export function buyBooks(s: GameState, id: string, editionId?: string, method?: Method): ActionResult {
  const v = booksVendor(id), e = v && (editionId ? editionById(v, editionId) : v.editions[0]);
  if (!v || !e || v.from > yearOf(s.hour)) return fail("error.unknownStoreItem");
  if (s.books.vendor === v.id) return fail("error.installed");
  if (v.deployment === "browser") {
    const r = take(s, v, e, 0, method);
    if (r.ok) { setUp(s, v, e); mailAccess(s, v); }
    return r;
  }
  if (s.books.download?.vendor === v.id) return fail("error.booksDownloading");
  const hours = setupHours(s, v);
  if (hours === null) return fail("error.booksOffline");
  const r = take(s, v, e, 0, method);
  if (!r.ok) return r;
  s.books = { ...s.books, download: { vendor: v.id, edition: e.id, startedAt: s.hour, readyAt: s.hour + hours } };
  mailAccess(s, v);
  return { ok: true };
}

// Installing the downloaded program; its licence was paid with the download.
export function installBooks(s: GameState, id: string): ActionResult {
  const v = booksVendor(id), d = s.books.download;
  if (!v || !d || d.vendor !== v.id) return fail("error.booksNotDownloaded");
  if (s.books.vendor === v.id) return fail("error.installed");
  if (s.hour < d.readyAt) return fail("error.booksDownloading");
  const e = editionById(v, d.edition);
  if (!e) return fail("error.unknownEdition");
  setUp(s, v, e);
  return { ok: true };
}

// A desktop licence pays the difference to the larger edition; a browser plan switches its fee from the next month.
export function upgradeBooks(s: GameState, editionId: string, method?: Method): ActionResult {
  const v = currentVendor(s), now = currentEdition(s), e = v && editionById(v, editionId);
  if (!v || !now || !e) return fail("error.unknownEdition");
  if (e.id === now.id) return fail("error.installed");
  if (v.deployment === "desktop" && e.price < now.price) return fail("error.unknownEdition");
  if (updateOpen(s)) return fail("error.updateOpen");
  const r = take(s, v, e, s.books.seats, method);
  if (!r.ok) return r;
  const d = s.books.download;
  s.books = { ...s.books, edition: e.id, seats: e.seat ? s.books.seats : 0, download: d?.vendor === v.id ? { ...d, edition: e.id } : d };
  return { ok: true };
}

// Seats on sale with the edition: a desktop seat is paid once and kept, a browser seat adds to the monthly fee.
export function setSeats(s: GameState, seats: number, method?: Method): ActionResult {
  const v = currentVendor(s), e = currentEdition(s);
  if (!v || !e || !e.seat || !Number.isInteger(seats) || seats < 0) return fail("error.unknownEdition");
  if (v.deployment === "desktop") {
    if (seats < s.books.seats) return fail("error.unknownEdition");
    const price = (seats - s.books.seats) * e.seat;
    if (s.cash < price) return fail("error.noCash");
    const paid = pay(s, v, SEAT_KEY, price, e, method);
    if (!paid.ok) return paid;
  }
  s.books = { ...s.books, seats };
  return { ok: true };
}

// An add-on the installed program's vendor sells for every edition: a desktop add-on is paid once, a browser one each month.
export function buyAddon(s: GameState, id: Feature, method?: Method): ActionResult {
  const v = currentVendor(s), e = currentEdition(s), price = v?.addons?.[id];
  if (!v || !e || price === undefined) return fail("error.unknownEdition");
  if (hasFeature(s, id)) return fail("error.installed");
  if (v.deployment === "desktop") {
    if (s.cash < price) return fail("error.noCash");
    const paid = pay(s, v, HBCI_KEY, price, e, method);
    if (!paid.ok) return paid;
  }
  s.books = { ...s.books, addons: [...s.books.addons, id] };
  return { ok: true };
}

// An edition feature's chore at once, from its button in Books.
export function runFeature(s: GameState, id: Feature): ActionResult {
  if (!works(s, id)) return fail("error.unknownEdition");
  if (id === "monthly-run") monthlyRun(s);
  else if (id === "match-by-reference") matchByReference(s);
  else return fail("error.unknownEdition");
  return { ok: true };
}

// Finishing or closing the setup wizard keeps what it set; the program's settings open it again.
export function finishBooksSetup(s: GameState): ActionResult {
  if (!s.books.vendor) return fail("error.booksNotDownloaded");
  s.books = { ...s.books, setupDone: true };
  return { ok: true };
}

// Kontomix's booking form: a booking from the account against the invoice or supplier invoice number typed in. settle
// writes off what a short payment leaves open.
export function bookByNumber(s: GameState, bookingId: string, number: string, settle = false): ActionResult {
  const n = number.trim(), tr = s.transfers.find((x) => x.id === bookingId);
  const id = tr ? s.invoices.find((i) => i.number === n && i.synced !== false)?.id : s.payables.find((p) => p.number === n)?.id;
  if (!id) return { ok: false, error: "books-screens.noDocument", params: { number: n } };
  return tr ? matchTransfer(s, tr.id, id, settle) : assignPayment(s, bookingId, id);
}

// The installer, the licence and the program's own assistants run in order; each action fails until the one before is done.
const order = (): ActionResult => fail("error.booksSetupOrder");
const installed = (s: GameState) => (s.books.vendor ? booksVendor(s.books.vendor) : undefined);
// What the program wants before it opens a company: the licence, its number and the activation, where it has them.
const opened = (s: GameState, v: BooksVendor): boolean => {
  const u = setupOf(s);
  return (v.deployment === "browser" || u.licence) && (!needsKey(v.id) || u.key !== "") && (!needsActivation(v.id) && v.deployment !== "browser" || u.activated);
};
function step(s: GameState, change: (v: BooksVendor) => ActionResult | void): ActionResult {
  const v = installed(s);
  if (!v) return fail("error.booksNotDownloaded");
  const r = change(v) ?? { ok: true as const };
  if (r.ok) syncBooksGuide(s);
  return r;
}
const patch = (s: GameState, p: Partial<BooksSetup>) => { s.books = { ...s.books, setup: { ...setupOf(s), ...p } }; };

export const acceptBooksLicence = (s: GameState): ActionResult => step(s, (v) => v.deployment === "browser" ? order() : patch(s, { licence: true }));

export const enterBooksKey = (s: GameState, key: string): ActionResult => step(s, (v) => {
  if (!needsKey(v.id) || !setupOf(s).licence) return order();
  const norm = (x: string) => x.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (norm(key) !== norm(booksKey(s, v.id))) return fail("error.booksKey");
  patch(s, { key: booksKey(s, v.id) });
});

// Desktop activation goes over the line; a browser program is confirmed from the sign-up mail.
export const activateBooks = (s: GameState): ActionResult => step(s, (v) => {
  if (v.deployment === "desktop") {
    if (!needsActivation(v.id) || !setupOf(s).licence || (needsKey(v.id) && setupOf(s).key === "")) return order();
    if (!downloadMbps(s)) return fail("error.booksOffline");
  }
  patch(s, { activated: true });
});

export const createBooksCompany = (s: GameState, o: { chart: Chart; fiscalStart: number; method: TaxMethod }): ActionResult => step(s, (v) => {
  if (!opened(s, v)) return order();
  if (!["skr03", "skr04"].includes(o.chart) || !Number.isInteger(o.fiscalStart) || o.fiscalStart < 1 || o.fiscalStart > 12 || !["soll", "ist", "euer"].includes(o.method)) return fail("error.booksCompany");
  patch(s, { company: true, chart: o.chart, fiscalStart: o.fiscalStart, method: o.method });
});

// The steps after the company need it to exist.
const inCompany = (s: GameState, p: Partial<BooksSetup>): ActionResult => step(s, () => setupOf(s).company ? patch(s, p) : order());
export const enterOpening = (s: GameState): ActionResult => inCompany(s, { opening: true });
export const setBooksTemplate = (s: GameState): ActionResult => inCompany(s, { template: true });
export const backupBooks = (s: GameState): ActionResult => inCompany(s, { backupAt: s.hour });
export const linkBooksBank = (s: GameState): ActionResult => step(s, () => {
  if (!setupOf(s).company) return order();
  if (!bankReady(s)) return fail("error.booksBank");
  patch(s, { bank: true });
});
