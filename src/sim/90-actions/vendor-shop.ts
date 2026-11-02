// docs/design/plans/software-licences.md, lanes vendor-shop and my-account: buying licence keys on a vendor site and cancelling
// a term licence from My account.
import { cents } from "../45-billing/billing";
import type { GameState } from "../50-state";
import { cardReady, cardSpent } from "../46-finance/bank";
import { invoice } from "../46-finance/payables";
import { updateKey } from "../60-infra/licence";
import { cartOf, editionBlock, editionChange, lineMajor, lineOffer, sendKeys, vendorName, type CartLine, type KeyLine } from "../80-business/vendor-shop";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
type LineId = Pick<CartLine, "product" | "edition" | "from" | "replaces">;
const same = (a: LineId) => (b: CartLine) => a.product === b.product && a.edition === b.edition && a.from === b.from && a.replaces === b.replaces;

// from puts the upgrade from that major in the cart instead of an edition.
export function addToCart(s: GameState, product: string, edition: string | null, from?: string): ActionResult {
  const id = { product, edition, from };
  if (!lineOffer(s, id)) return fail("error.notForSale");
  const line = s.cart.find(same(id));
  s.cart = line ? s.cart.map((l) => (l === line ? { ...l, qty: l.qty + 1 } : l)) : [...s.cart, { product, edition, qty: 1, ...(from ? { from } : {}) }];
  return { ok: true };
}

// Puts the change of a key to another edition in the cart, one line per key.
export function changeEdition(s: GameState, keyId: string, edition: string): ActionResult {
  const k = s.licenses.find((x) => x.id === keyId);
  if (!k) return fail("error.unknownLicence");
  if (!editionChange(s, keyId, edition)) return fail("error.notForSale");
  const blocked = editionBlock(s, keyId, edition);
  if (blocked) return fail(blocked);
  s.cart = [...s.cart.filter((l) => l.replaces !== keyId), { product: k.product, edition, qty: 1, replaces: keyId }];
  return { ok: true };
}

export function removeFromCart(s: GameState, product: string, edition: string | null, from?: string, replaces?: string): ActionResult {
  const id = { product, edition, from, replaces };
  if (!s.cart.some(same(id))) return fail("error.notInCart");
  s.cart = s.cart.filter((l) => !same(id)(l));
  return { ok: true };
}

export type LicencePayment = "card" | "transfer";

// Places the site's cart lines as one order. A card pays at once and the keys come with the order email; a transfer gets an
// invoice, and the keys come once the money arrives. A one-time licence costs its price; a term licence pays its first term
// for one unit; an upgrade is a key for the next major.
export function checkout(s: GameState, host: string, payment: LicencePayment): ActionResult {
  const lines = cartOf(s, host);
  if (!lines.length) return fail("error.cartEmpty");
  const fees = lines.map((l) => lineOffer(s, l)?.fee);
  if (fees.some((f) => f === undefined)) return fail("error.notForSale");
  const total = cents(lines.reduce((n, l, i) => n + fees[i]! * l.qty, 0));
  if (!s.bank && total > 0) return fail("error.noBank");
  if (lines.some((l) => l.replaces && editionBlock(s, l.replaces, l.edition))) return fail("error.licenceCap");
  if (total > 0 && payment === "card" && !cardReady(s)) return fail("error.noCard");
  if (total > 0 && payment === "card" && cardSpent(s) + total > s.bank!.card!.limit) return fail("error.cardLimit");
  const order = `ORD-${s.nextId++}`, vendor = vendorName(lines[0].product);
  const keys: KeyLine[] = lines.map((l) => { const to = lineMajor(s, l); return { product: l.product, edition: l.edition, qty: l.qty, ...(to && { to }), ...(l.replaces && { replaces: l.replaces }) }; });
  const entry = { hour: s.hour, category: "licenses", key: "ledger.order", params: { vendor, order }, amount: -total };
  s.cart = s.cart.filter((l) => !lines.includes(l));
  // A free order, such as an edition change on a term key, needs no payment.
  if (total === 0) { sendKeys(s, vendor, order, keys, total, false); return { ok: true, id: order }; }
  if (payment === "card") {
    s.bank = { ...s.bank!, card: { ...s.bank!.card!, spent: [...s.bank!.card!.spent, entry] } };
    sendKeys(s, vendor, order, keys, total, true);
    return { ok: true, id: order };
  }
  const p = invoice(s, "software", vendor, [entry]);
  // A direct debit mandate pays the invoice as it is issued.
  if (p.paidAt !== null) sendKeys(s, vendor, order, keys, total, false);
  else s.payables = s.payables.map((x) => (x.id === p.id ? { ...x, keys: { order, lines: keys } } : x));
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
