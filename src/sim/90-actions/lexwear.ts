// docs/design/plans/billing-by-hand.md, lane vendor-sites: buying a module on Lexwear's site and registering it in Books.
import { yearOf } from "../00-core/time";
import { booksVendor, modulePrice, type BooksVendorId } from "../10-catalog/bookkeeping";
import { hasModule, moduleById, MODULES } from "../10-catalog/modules";
import { cents, dueStep, isUnpaid, sendStep, STEPS } from "../45-billing/billing";
import { updateOpen } from "../80-business/bookkeeping";
import { bought, licenceKey, licenceMail, matchByReference, monthlyRun, purchaseEntry } from "../80-business/lexwear";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Automatic reminders also switches the reminder rule on.
export function activate(s: GameState, id: string): void {
  s.modules = [...s.modules, id];
  if (id === "auto-reminders") s.billingRules = { ...s.billingRules, autoRemind: true };
}

// A shop module sells on its maker's site with a key; a licence key sells without the program; a keyless vendor's module turns on in the program, so that one must run.
export function buyLicence(s: GameState, id: string, vendor: BooksVendorId = "lexwear"): ActionResult {
  const m = moduleById(id);
  if (m?.vendor === "shop") {
    if (m.year > yearOf(s.hour)) return fail("error.unknownModule");
    if (bought(s, id)) return fail("error.moduleBought");
    // The hand-rolled order form has no vendor to link it.
    if (!s.shop.variant || s.shop.variant === "handRolled") return fail("error.noShopSystem");
    if (s.cash < m.price) return fail("error.noCash");
    s.cash = cents(s.cash - m.price);
    s.ledger = [...s.ledger, { hour: s.hour, category: "licenses", key: `ledger.module.${id}`, params: {}, amount: -m.price }];
    return { ok: true };
  }
  const v = booksVendor(vendor), year = yearOf(s.hour);
  const price = v ? modulePrice(v, id) : "never";
  if (!m || !v || m.year > year || v.from > year || price === "never") return fail("error.unknownModule");
  if (!v.keys && s.books.vendor !== v.id) return fail("error.programMissing");
  if (price === "included" || (!v.keys && hasModule(s, id))) return fail("error.moduleRegistered");
  if (v.keys && bought(s, id, v.id)) return fail("error.moduleBought");
  if (v.update && updateOpen(s)) return fail("error.updateOpen");
  if (s.cash < price) return fail("error.noCash");
  s.cash = cents(s.cash - price);
  s.ledger = [...s.ledger, purchaseEntry(s, v, id, price)];
  if (!v.keys) activate(s, id);
  return { ok: true };
}

// A key from a licence email of the running program's vendor turns its module on.
export function registerLicence(s: GameState, key: string): ActionResult {
  const k = key.trim().toUpperCase(), vendor = s.books.vendor ?? "lexwear";
  // A shop module's key comes from its maker, outside the bookkeeping vendors.
  const m = MODULES.find((x) => { const v = x.vendor === "shop" ? "lexwear" : vendor; return licenceMail(s, x.id, v) && licenceKey(s, x.id, v) === k; });
  if (!m) return fail("error.licenceKey");
  if (hasModule(s, m.id)) return fail("error.moduleRegistered");
  activate(s, m.id);
  return { ok: true, id: m.id };
}

// A registered module's chore at once, from its button in Books.
export function runModule(s: GameState, id: string): ActionResult {
  if (!hasModule(s, id)) return fail("error.unknownModule");
  if (id === "monthly-run") monthlyRun(s);
  else if (id === "match-by-reference") matchByReference(s);
  else if (id === "auto-reminders") {
    for (const inv of s.invoices) {
      const i = isUnpaid(inv) ? dueStep(inv, s.hour) : null;
      if (i !== null && STEPS[i].key !== "collections") sendStep(s, inv, i);
    }
  } else return fail("error.unknownModule");
  return { ok: true };
}
