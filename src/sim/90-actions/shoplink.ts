// docs/design/plans/billing-by-hand.md, lanes shop-link and payment-methods: the Import from shop button in Books and the
// shop modules sold on the shop vendors' sites.
import { importShop, unsynced } from "../80-business/shoplink";
import type { ShopId } from "../10-catalog/shops";
import { hasModule } from "../10-catalog/modules";
import type { MethodId } from "../10-catalog/payments";
import type { GameState } from "../50-state";
import { buyLicence } from "./lexwear";
import type { ActionResult } from "./hardware";

export function importFromShop(s: GameState): ActionResult {
  if (!unsynced(s) && !s.transfers.some((x) => x.covers && x.invoiceId === null)) return { ok: false, error: "error.nothingToImport" };
  importShop(s);
  return { ok: true };
}

// Shop link or a payment method on a shop vendor's site; it works only in that vendor's shop system.
export function buyShopLink(s: GameState, shop: ShopId, id = "shop-link"): ActionResult {
  if (s.shop.variant !== shop) return { ok: false, error: "error.noShopSystem" };
  return buyLicence(s, id);
}

// Switches a registered payment method on or off in the shop's checkout.
export function setPaymentMethod(s: GameState, id: MethodId, on: boolean): ActionResult {
  if (!hasModule(s, id)) return { ok: false, error: "error.unknownModule" };
  const off = s.shop.methodsOff.filter((x) => x !== id);
  s.shop = { ...s.shop, methodsOff: on ? off : [...off, id] };
  return { ok: true };
}
