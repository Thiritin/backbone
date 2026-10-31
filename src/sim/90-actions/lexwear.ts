// docs/design/plans/billing-by-hand.md, lane vendor-sites: buying a module on Lexwear's site and registering it in Books.
import { yearOf } from "../00-core/time";
import { hasModule, moduleById, MODULES } from "../10-catalog/modules";
import { cents, dueStep, isUnpaid, sendStep, STEPS } from "../45-billing/billing";
import { bought, licenceKey, licenceMail, matchByReference, monthlyRun } from "../80-business/lexwear";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

export function buyLicence(s: GameState, id: string): ActionResult {
  const m = moduleById(id);
  if (!m || m.year > yearOf(s.hour)) return fail("error.unknownModule");
  if (bought(s, id)) return fail("error.moduleBought");
  if (s.cash < m.price) return fail("error.noCash");
  s.cash = cents(s.cash - m.price);
  s.ledger = [...s.ledger, { hour: s.hour, category: "licenses", key: `ledger.module.${id}`, params: {}, amount: -m.price }];
  return { ok: true };
}

// A key from a licence email turns its module on; Automatic reminders also switches the reminder rule on.
export function registerLicence(s: GameState, key: string): ActionResult {
  const k = key.trim().toUpperCase();
  const m = MODULES.find((x) => licenceMail(s, x.id) && licenceKey(s, x.id) === k);
  if (!m) return fail("error.licenceKey");
  if (hasModule(s, m.id)) return fail("error.moduleRegistered");
  s.modules = [...s.modules, m.id];
  if (m.id === "auto-reminders") s.billingRules = { ...s.billingRules, autoRemind: true };
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
