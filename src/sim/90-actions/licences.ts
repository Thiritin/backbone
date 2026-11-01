// docs/design/plans/billing-by-hand.md, lanes vendor-sites and shop-link: buying a shop module and registering its key in Books.
import { yearOf } from "../00-core/time";
import { hasModule, moduleById, MODULES } from "../10-catalog/modules";
import { cents } from "../45-billing/billing";
import { bought, licenceKey, licenceMail } from "../80-business/licences";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// A shop module sells on its maker's site with a key.
export function buyLicence(s: GameState, id: string): ActionResult {
  const m = moduleById(id);
  if (!m || m.year > yearOf(s.hour)) return fail("error.unknownModule");
  if (bought(s, id)) return fail("error.moduleBought");
  // The hand-rolled order form has no vendor to link it.
  if (!s.shop.variant || s.shop.variant === "handRolled") return fail("error.noShopSystem");
  if (s.cash < m.price) return fail("error.noCash");
  s.cash = cents(s.cash - m.price);
  s.ledger = [...s.ledger, { hour: s.hour, category: "licenses", key: `ledger.module.${id}`, params: {}, amount: -m.price }];
  return { ok: true };
}

// A key from a licence email turns its module on.
export function registerLicence(s: GameState, key: string): ActionResult {
  const k = key.trim().toUpperCase();
  const m = MODULES.find((x) => licenceMail(s, x.id) && licenceKey(s, x.id) === k);
  if (!m) return fail("error.licenceKey");
  if (hasModule(s, m.id)) return fail("error.moduleRegistered");
  s.modules = [...s.modules, m.id];
  return { ok: true, id: m.id };
}
