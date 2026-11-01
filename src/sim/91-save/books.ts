// docs/design/plans/billing-by-hand.md, 9d: saves from before editions. Lexwear with modules runs the smallest edition that
// covers them, any other program its smallest; the module licence mails and newsletters go with the modules.
import { booksVendor, smallestWith } from "../10-catalog/bookkeeping";
import type { GameState } from "../50-state";

const BOOK_MODULES = ["helpdesk-link", "monthly-run", "match-by-reference", "auto-reminders", "hbci"];
const OLD_MAILS = ["lexwear.licence", "lexwear.newsletter", "books.licence"];

export function migrateBooks(s: GameState): void {
  // Finance became part of Books: a save that only had Finance runs the free program.
  if (s.installed.includes("Books") && !s.books.vendor) s.books = { vendor: "gnucache", installedAt: s.hour, edition: "free", seats: 0 };
  const v = booksVendor(s.books.vendor), owned = s.modules.filter((m) => BOOK_MODULES.includes(m));
  const edition = !v ? null : v.editions.some((e) => e.id === s.books.edition) ? s.books.edition
    : (smallestWith(v, v.id === "lexwear" ? owned : []) ?? v.editions.at(-1)!).id;
  s.books = { ...s.books, edition, seats: s.books.seats ?? 0 };
  s.modules = s.modules.filter((m) => !BOOK_MODULES.includes(m));
  s.tickets = s.tickets.filter((x) => !(x.kind === "mail" && OLD_MAILS.includes(x.topic)));
}
