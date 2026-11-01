// docs/design/plans/billing-by-hand.md, lane shop-link: the Import from shop button in Books.
import { importShop, unsynced } from "../80-business/shoplink";
import type { ShopId } from "../10-catalog/shops";
import type { GameState } from "../50-state";
import { buyLicence } from "./lexwear";
import type { ActionResult } from "./hardware";

export function importFromShop(s: GameState): ActionResult {
  if (!unsynced(s) && !s.transfers.some((x) => x.covers && x.invoiceId === null)) return { ok: false, error: "error.nothingToImport" };
  importShop(s);
  return { ok: true };
}

// Shop link on a shop vendor's site; it connects only that vendor's shop system.
export function buyShopLink(s: GameState, shop: ShopId): ActionResult {
  if (s.shop.variant !== shop) return { ok: false, error: "error.noShopSystem" };
  return buyLicence(s, "shop-link");
}
