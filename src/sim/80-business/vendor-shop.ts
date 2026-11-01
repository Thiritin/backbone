// docs/design/plans/software-licences.md, lanes vendor-shop and my-account: the cart, checkout and order email every vendor
// site shares.
import { eraAt, type LicenseKind } from "../10-catalog/server-os";
import type { GameState, Licence } from "../50-state";
import { nextMajor, versionAt, versionsOf } from "../10-catalog/software-versions";
import { issueKey, isLicensed, productOf, tiersOnSale, yearAfter } from "../60-infra/licence";
import { deliverMail } from "../40-support/tickets";
import type { Payable } from "../46-finance/payables";

export const ORDER = "vendor.order";
export interface Offer { edition: string | null; fee: number; kind: LicenseKind; period?: "year" }
export type CartLine = GameState["cart"][number];

// The site that sells a product and the name its order emails come from.
export const hostOf = (product: string): string | undefined => productOf(product)?.site?.host;
export const vendorName = (product: string): string => productOf(product)?.name ?? product;

// What a product's site sells at the hour: the editions of its licensing era, and one licence at the era's price when the
// era sells keys for a major or the product has no editions.
export function offers(product: string, hour: number): Offer[] {
  const p = productOf(product);
  const era = p && isLicensed(product) ? eraAt(p, hour) : undefined;
  if (era?.closed) return [];
  const tiers: Offer[] = tiersOnSale(product, hour).map((x) => ({ edition: x.id, fee: x.fee, kind: x.kind }));
  const own = era && era.kind !== "free" && (era.kind === "once" || !tiers.length) ? [{ edition: null, fee: era.fee, kind: era.kind, period: era.period }] : [];
  return [...tiers, ...own];
}
export const offerOf = (line: Pick<CartLine, "product" | "edition">, hour: number): Offer | undefined =>
  offers(line.product, hour).find((o) => o.edition === line.edition);

// The price of a key for the major after fromMajor while the vendor sells keys per major: the upgrade price when the player
// holds a key for fromMajor bought within the last 12 months, the full price otherwise; null in a term era.
export function upgradeOffer(s: GameState, product: string, fromMajor: string): { fee: number; discounted: boolean } | null {
  const p = productOf(product), era = p && eraAt(p, s.hour);
  if (era?.kind !== "once") return null;
  const discounted = era.upgrade !== undefined &&
    s.licenses.some((k) => k.product === product && k.covers.kind === "version" && k.covers.major === fromMajor && s.hour < yearAfter(k.boughtAt));
  return { fee: discounted ? era.upgrade! : era.fee, discounted };
}

// The "Upgrade from N" offers of a product: one per major the player holds a key for whose next major is out, while the
// vendor sells keys per major.
export interface UpgradeOffer { from: string; to: string; fee: number; discounted: boolean }
export function upgradeOffers(s: GameState, product: string): UpgradeOffer[] {
  const majors = [...new Set(s.licenses.flatMap((k) => (k.product === product && k.covers.kind === "version" ? [k.covers.major] : [])))];
  return majors.flatMap((from) => {
    const last = versionsOf(product).filter((v) => v.major === from).at(-1), to = last && nextMajor(product, last.version, s.hour);
    const o = to ? upgradeOffer(s, product, from) : null;
    return to && o ? [{ from, to: to.major, ...o }] : [];
  });
}
// What a cart line sells now, an upgrade at its upgrade price; undefined once it is no longer sold.
export const lineOffer = (s: GameState, line: Pick<CartLine, "product" | "edition" | "from">): Offer | undefined => {
  if (!line.from) return offerOf(line, s.hour);
  const u = upgradeOffers(s, line.product).find((o) => o.from === line.from);
  return u && { edition: null, fee: u.fee, kind: "once" };
};

// The major a cart line's key will cover: the upgrade's target, or the release on sale for a one-time key; undefined for a term key.
export const lineMajor = (s: GameState, line: Pick<CartLine, "product" | "edition" | "from">): string | undefined => {
  if (line.from) return upgradeOffers(s, line.product).find((u) => u.from === line.from)?.to;
  return lineOffer(s, line)?.kind === "once" ? versionAt(line.product, s.hour)?.major : undefined;
};
export const cartOf = (s: GameState, host: string): CartLine[] => s.cart.filter((l) => hostOf(l.product) === host);
export const keysOf = (s: GameState, host: string): Licence[] => s.licenses.filter((k) => hostOf(k.product) === host);
export const orderKeys = (s: GameState, orderId: string): Licence[] => s.licenses.filter((k) => k.orderId === orderId);

export type KeyLine = NonNullable<Payable["keys"]>["lines"][number];

// Issues an unassigned key per licence of the order and sends the order email; card says the card paid rather than a transfer.
export function sendKeys(s: GameState, vendor: string, order: string, lines: KeyLine[], total: number, card: boolean): void {
  lines.forEach((l) => { for (let i = 0; i < l.qty; i++) issueKey(s, l.product, l.edition, order, l.to); });
  deliverMail(s, vendor, ORDER, { order, total, card: card ? 1 : 0 });
}

// Hourly: a licence order whose transfer has arrived gets its keys.
export function deliverPaidOrders(s: GameState): void {
  const paid = s.payables.filter((p) => p.keys && p.paidAt !== null);
  if (!paid.length) return;
  s.payables = s.payables.map((p) => (paid.includes(p) ? { ...p, keys: undefined } : p));
  for (const p of paid) sendKeys(s, p.name, p.keys!.order, p.keys!.lines, p.amount, false);
}
