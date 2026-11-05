// docs/design/plans/billing-by-hand.md, 9d: saves from before editions. Taxware with modules runs the smallest edition that
// covers them, any other program its smallest; the module licence mails and newsletters go with the modules.
import { booksVendor, smallestWith } from "../10-catalog/bookkeeping";
import type { GameState } from "../50-state";
import { fillSetup, newSetup } from "../80-business/books-guide";

const BOOK_MODULES = ["helpdesk-link", "monthly-run", "match-by-reference", "auto-reminders", "hbci"];
const OLD_MAILS = ["lexwear.licence", "lexwear.newsletter", "books.licence"];

export function migrateBooks(s: GameState): void {
  // Finance became part of Books: a save that only had Finance runs the free program.
  if (s.installed.includes("Books") && !s.books.vendor) s.books = { vendor: "gnucache", installedAt: s.hour, edition: "free", seats: 0, download: null, addons: [], setup: newSetup() };
  const v = booksVendor(s.books.vendor), owned = s.modules.filter((m) => BOOK_MODULES.includes(m) && m !== "auto-reminders");
  // Taxware sells HBCI as an add-on, so the old module becomes one.
  const addon = v?.id === "lexwear" && !s.books.edition && owned.includes("hbci");
  const edition = !v ? null : v.editions.some((e) => e.id === s.books.edition) ? s.books.edition
    : (smallestWith(v, v.id === "lexwear" ? owned.filter((m) => m !== "hbci") : []) ?? v.editions.at(-1)!).id;
  s.books = { ...s.books, edition, seats: s.books.seats ?? 0, addons: addon ? ["hbci"] : s.books.addons };
  s.modules = s.modules.filter((m) => !BOOK_MODULES.includes(m));
  s.tickets = s.tickets.filter((x) => !(x.kind === "mail" && OLD_MAILS.includes(x.topic)));
  fillSetup(s);
}
