// docs/design/plans/software-licences.md, lanes vendor-shop and my-account: buying licence keys on a vendor site and cancelling
// a term licence from My account.
import { yearOf } from "../00-core/time";
import { moduleById } from "../10-catalog/modules";
import { deliverMail } from "../40-support/tickets";
import { cents } from "../45-billing/billing";
import type { GameState } from "../50-state";
import { issueKey, updateKey } from "../60-infra/licence";
import { bought } from "../80-business/lexwear";
import { cartOf, offerOf, ORDER, vendorName, type CartLine } from "../80-business/vendor-shop";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const same = (a: Pick<CartLine, "product" | "edition">) => (b: CartLine) => a.product === b.product && a.edition === b.edition;

// A Lexwear module is bought once, so its line never holds more than one.
export function addToCart(s: GameState, product: string, edition: string | null): ActionResult {
  if (!offerOf({ product, edition }, yearOf(s.hour))) return fail("error.notForSale");
  const line = s.cart.find(same({ product, edition }));
  if (moduleById(product) && (line || bought(s, product))) return fail("error.moduleBought");
  s.cart = line ? s.cart.map((l) => (l === line ? { ...l, qty: l.qty + 1 } : l)) : [...s.cart, { product, edition, qty: 1 }];
  return { ok: true };
}

export function removeFromCart(s: GameState, product: string, edition: string | null): ActionResult {
  if (!s.cart.some(same({ product, edition }))) return fail("error.notInCart");
  s.cart = s.cart.filter((l) => !same({ product, edition })(l));
  return { ok: true };
}

// Pays the site's cart lines from the bank as one order: a ledger line, an unassigned key per licence and the order email.
// A one-time licence costs its price; a term licence pays its first month for one unit.
export function checkout(s: GameState, host: string): ActionResult {
  const lines = cartOf(s, host), year = yearOf(s.hour);
  if (!lines.length) return fail("error.cartEmpty");
  const fees = lines.map((l) => offerOf(l, year)?.fee);
  if (fees.some((f) => f === undefined)) return fail("error.notForSale");
  const total = cents(lines.reduce((n, l, i) => n + fees[i]! * l.qty, 0));
  if (s.cash < total) return fail("error.noCash");
  const order = `ORD-${s.nextId++}`, vendor = vendorName(lines[0].product);
  s.cash = cents(s.cash - total);
  s.ledger = [...s.ledger, { hour: s.hour, category: "licenses", key: "ledger.order", params: { vendor, order }, amount: -total }];
  for (const l of lines) for (let i = 0; i < l.qty; i++) issueKey(s, l.product, l.edition, order);
  s.cart = s.cart.filter((l) => !lines.includes(l));
  deliverMail(s, vendor, ORDER, { order, total });
  return { ok: true, id: order };
}

// Stops a term licence from renewing; it keeps running until the end of the term it paid for.
export function cancelLicence(s: GameState, keyId: string): ActionResult {
  const k = s.licenses.find((x) => x.id === keyId);
  if (!k) return fail("error.unknownLicence");
  if (k.covers.kind !== "term" || k.renewsAt === null) return fail("error.notCancellable");
  updateKey(s, k.id, { renewsAt: null });
  return { ok: true, id: k.id };
}
