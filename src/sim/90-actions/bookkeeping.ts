// docs/design/plans/billing-by-hand.md, 9c: installing a bookkeeping program from the Pear Store, or switching to another.
import { yearOf } from "../00-core/time";
import { BOOK_MODULES, booksVendor, included } from "../10-catalog/bookkeeping";
import { cents } from "../45-billing/billing";
import { invoicing } from "../46-finance/payables";
import type { GameState } from "../50-state";
import { bill, LICENCE_KEY, licensed, MONTHLY_KEY } from "../80-business/bookkeeping";
import type { ActionResult } from "./hardware";
import { activate } from "./lexwear";

const fail = (error: string): ActionResult => ({ ok: false, error });

// The data stays where it is; the old program's modules and its fee go, the new one's included modules come.
export function installBooks(s: GameState, id: string): ActionResult {
  const v = booksVendor(id);
  if (!v || v.from > yearOf(s.hour)) return fail("error.unknownStoreItem");
  if (s.books.vendor === v.id) return fail("error.installed");
  const price = licensed(s, v) ? 0 : v.licence;
  if (s.cash < price + (invoicing(s) ? 0 : v.monthly)) return fail("error.noCash");
  if (price) {
    s.cash = cents(s.cash - price);
    s.ledger = [...s.ledger, { hour: s.hour, category: "licenses", key: LICENCE_KEY, params: { program: v.program }, amount: -price }];
  }
  s.modules = s.modules.filter((m) => !BOOK_MODULES.includes(m));
  included(v).forEach((m) => activate(s, m));
  s.books = { vendor: v.id, installedAt: s.hour };
  if (!s.installed.includes("Books")) s.installed = [...s.installed, "Books"];
  if (v.monthly) bill(s, v, MONTHLY_KEY, v.monthly);
  return { ok: true };
}
