// docs/design/plans/billing-by-hand.md, 9c and 9d, and web-presence.md, lane books-download: buying a bookkeeping program on
// its vendor's site, downloading and installing a desktop program, upgrading its edition, buying seats.
import { yearOf } from "../00-core/time";
import { booksVendor, editionById, type BooksVendor, type Edition, type Feature } from "../10-catalog/bookkeeping";
import { MS_PER_HOUR } from "../00-core/time";
import { cents } from "../45-billing/billing";
import { downloadMbps } from "./media";
import { invoicing } from "../46-finance/payables";
import type { GameState } from "../50-state";
import { bill, currentEdition, currentVendor, LICENCE_KEY, licencePrice, matchByReference, monthlyFee, monthlyRun, MONTHLY_KEY, SEAT_KEY, updateOpen, works } from "../80-business/bookkeeping";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// A licence and a desktop seat are paid at once, off the account.
function pay(s: GameState, v: BooksVendor, key: string, amount: number, e: Edition): void {
  if (!amount) return;
  s.cash = cents(s.cash - amount);
  s.ledger = [...s.ledger, { hour: s.hour, category: "licenses", key, params: { program: v.program, edition: e.name }, amount: -amount }];
}

function take(s: GameState, v: BooksVendor, e: Edition, seats: number): ActionResult {
  const price = licencePrice(s, v, e), fee = monthlyFee(v, e, seats);
  if (s.cash < price + (invoicing(s) ? 0 : fee)) return fail("error.noCash");
  pay(s, v, LICENCE_KEY, price, e);
  return { ok: true };
}

// The data stays where it is; the old program's edition, seats and fee go. A program bought before costs only what its
// edition adds.
function setUp(s: GameState, v: BooksVendor, e: Edition): void {
  s.books = { vendor: v.id, installedAt: s.hour, edition: e.id, seats: 0, download: s.books.download?.vendor === v.id ? null : s.books.download };
  if (!s.installed.includes("Books")) s.installed = [...s.installed, "Books"];
  const fee = monthlyFee(v, e, 0);
  if (fee) bill(s, v, MONTHLY_KEY, fee, { edition: e.name });
}

// Whole game hours a desktop program's installer takes over the player's line; null without one.
export function setupHours(s: GameState, v: BooksVendor): number | null {
  const mbps = downloadMbps(s);
  if (!mbps) return null;
  return Math.max(1, Math.ceil(((v.setupMb ?? 0) * 8 * 1000) / mbps / MS_PER_HOUR));
}

// Buying on the vendor's site: a browser program starts at once, a desktop program is paid and starts to download.
export function buyBooks(s: GameState, id: string, editionId?: string): ActionResult {
  const v = booksVendor(id), e = v && (editionId ? editionById(v, editionId) : v.editions[0]);
  if (!v || !e || v.from > yearOf(s.hour)) return fail("error.unknownStoreItem");
  if (s.books.vendor === v.id) return fail("error.installed");
  if (v.deployment === "browser") {
    const r = take(s, v, e, 0);
    if (r.ok) setUp(s, v, e);
    return r;
  }
  if (s.books.download?.vendor === v.id) return fail("error.booksDownloading");
  const hours = setupHours(s, v);
  if (hours === null) return fail("error.booksOffline");
  const r = take(s, v, e, 0);
  if (!r.ok) return r;
  s.books = { ...s.books, download: { vendor: v.id, edition: e.id, startedAt: s.hour, readyAt: s.hour + hours } };
  return { ok: true };
}

// Installing the downloaded program; its licence was paid with the download.
export function installBooks(s: GameState, id: string): ActionResult {
  const v = booksVendor(id), d = s.books.download;
  if (!v || !d || d.vendor !== v.id) return fail("error.booksNotDownloaded");
  if (s.hour < d.readyAt) return fail("error.booksDownloading");
  const e = editionById(v, d.edition);
  if (!e) return fail("error.unknownEdition");
  setUp(s, v, e);
  return { ok: true };
}

// A desktop licence pays the difference to the larger edition; a browser plan switches its fee from the next month.
export function upgradeBooks(s: GameState, editionId: string): ActionResult {
  const v = currentVendor(s), now = currentEdition(s), e = v && editionById(v, editionId);
  if (!v || !now || !e) return fail("error.unknownEdition");
  if (e.id === now.id) return fail("error.installed");
  if (v.deployment === "desktop" && e.price < now.price) return fail("error.unknownEdition");
  if (updateOpen(s)) return fail("error.updateOpen");
  const r = take(s, v, e, s.books.seats);
  if (!r.ok) return r;
  s.books = { ...s.books, edition: e.id, seats: e.seat ? s.books.seats : 0 };
  return { ok: true };
}

// Seats on sale with the edition: a desktop seat is paid once and kept, a browser seat adds to the monthly fee.
export function setSeats(s: GameState, seats: number): ActionResult {
  const v = currentVendor(s), e = currentEdition(s);
  if (!v || !e || !e.seat || !Number.isInteger(seats) || seats < 0) return fail("error.unknownEdition");
  if (v.deployment === "desktop") {
    if (seats < s.books.seats) return fail("error.unknownEdition");
    const price = (seats - s.books.seats) * e.seat;
    if (s.cash < price) return fail("error.noCash");
    pay(s, v, SEAT_KEY, price, e);
  }
  s.books = { ...s.books, seats };
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
