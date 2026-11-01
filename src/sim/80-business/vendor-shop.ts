// docs/design/plans/software-licences.md, lanes vendor-shop and my-account: the cart, checkout and order email every vendor
// site shares, Lexwear's included.
import { tiersOf } from "../10-catalog/licence-tiers";
import { moduleById } from "../10-catalog/modules";
import { licensingAt, type LicenseKind } from "../10-catalog/server-os";
import type { GameState, Licence } from "../50-state";
import { isLicensed, productOf } from "../60-infra/licence";
import { LEXWEAR, LEXWEAR_HOST } from "./lexwear";

export const ORDER = "vendor.order";
export interface Offer { edition: string | null; fee: number; kind: LicenseKind }
export type CartLine = GameState["cart"][number];

// The site that sells a product and the name its order emails come from.
export const hostOf = (product: string): string | undefined => (moduleById(product) ? LEXWEAR_HOST : productOf(product)?.site.host);
export const vendorName = (product: string): string => (moduleById(product) ? LEXWEAR : productOf(product)?.name ?? product);

// What a product's site sells in a year: its editions, or one licence at the price of the year's licensing era.
export function offers(product: string, year: number): Offer[] {
  const m = moduleById(product);
  if (m) return m.year <= year ? [{ edition: null, fee: m.price, kind: "once" }] : [];
  const tiers = tiersOf(product);
  if (tiers.length) return tiers.map((x) => ({ edition: x.id, fee: x.fee, kind: x.kind }));
  const p = productOf(product);
  const era = p && isLicensed(product) ? licensingAt(p, year) : undefined;
  return era && era.kind !== "free" ? [{ edition: null, fee: era.fee, kind: era.kind }] : [];
}
export const offerOf = (line: Pick<CartLine, "product" | "edition">, year: number): Offer | undefined =>
  offers(line.product, year).find((o) => o.edition === line.edition);

export const cartOf = (s: GameState, host: string): CartLine[] => s.cart.filter((l) => hostOf(l.product) === host);
export const keysOf = (s: GameState, host: string): Licence[] => s.licenses.filter((k) => hostOf(k.product) === host);
export const orderKeys = (s: GameState, orderId: string): Licence[] => s.licenses.filter((k) => k.orderId === orderId);
