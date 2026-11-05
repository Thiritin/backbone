// docs/design/plans/billing-by-hand.md, lanes vendor-sites and shop-link: buying a shop module and registering its key in Books.
import { yearOf } from "../00-core/time";
import { hasModule, moduleById, MODULES } from "../10-catalog/modules";
import { bought, licenceKey, licenceMail } from "../80-business/licences";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";
import type { Method } from "../46-finance/payables";
import { spend } from "./purchase";
import { vendorName } from "../80-business/vendor-shop";

const fail = (error: string): ActionResult => ({ ok: false, error });

// A shop module sells on its maker's site with a key.
export function buyLicence(s: GameState, id: string, method?: Method): ActionResult {
  const m = moduleById(id);
  if (!m || m.year > yearOf(s.hour)) return fail("error.unknownModule");
  if (bought(s, id)) return fail("error.moduleBought");
  if (!s.shop.variant) return fail("error.noShopSystem");
  const placed = spend(s, { supplier: "shopVendor", name: vendorName(s.shop.variant), lines: [{ hour: s.hour, category: "licenses", key: `ledger.module.${id}`, params: { shop: s.shop.variant }, amount: -m.price }], method });
  if (!placed.ok) return placed;
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
