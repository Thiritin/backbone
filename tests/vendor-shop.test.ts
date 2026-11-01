import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { serverOsAt } from "../src/sim/10-catalog/server-os";
import { newGame } from "../src/sim/50-state";
import { assignKey, licenceStatus } from "../src/sim/60-infra/licence";
import { renewKeys } from "../src/sim/85-products/products";
import { cartOf, keysOf, lineMajor, offers, ORDER, orderKeys } from "../src/sim/80-business/vendor-shop";
import { registerLicence } from "../src/sim/90-actions/lexwear";
import { addToCart, cancelLicence, checkout, removeFromCart } from "../src/sim/90-actions/vendor-shop";
import { deserialize, serialize } from "../src/sim/91-save/save";

const PLESKIT = "pleskit.com", WINDOORS = "windoors.macrosoft.com";
const Y = (year: number) => hourOf(new Date(Date.UTC(year, 0, 1)));
const game = (cash = 10_000) => Object.assign(newGame(31), { cash });

describe("vendor shop", () => {
  it("names the major a one-time key in the cart covers, and none for a term key", () => {
    const s = game();
    expect(lineMajor(s, { product: "vmwhere", edition: null })).toBe("2");
    s.hour = Y(2017);
    expect(lineMajor(s, { product: "windoors", edition: null })).toBeUndefined();
  });
  it("sells the editions and prices of the game year, and nothing for free software", () => {
    expect(offers("pleskit", Y(2005)).map((o) => o.edition)).toEqual(["webAdmin", "webPro", "webHost"]);
    expect(offers("windoors", Y(2010))).toEqual([{ edition: null, fee: 600, kind: "once" }]);
    expect(offers("windoors", Y(2017))).toEqual([{ edition: null, fee: 4, kind: "core" }]);
    expect(offers("lunix", Y(2010))).toEqual([]);
    const s = game();
    expect(addToCart(s, "lunix", null)).toEqual({ ok: false, error: "error.notForSale" });
    expect(addToCart(s, "cpanic", "gold")).toEqual({ ok: false, error: "error.notForSale" });
  });

  it("keeps one cart line per edition and removes it", () => {
    const s = game();
    addToCart(s, "pleskit", "webAdmin");
    addToCart(s, "pleskit", "webAdmin");
    addToCart(s, "pleskit", "webPro");
    expect(s.cart).toEqual([{ product: "pleskit", edition: "webAdmin", qty: 2 }, { product: "pleskit", edition: "webPro", qty: 1 }]);
    expect(removeFromCart(s, "pleskit", "webPro")).toEqual({ ok: true });
    expect(removeFromCart(s, "pleskit", "webPro")).toEqual({ ok: false, error: "error.notInCart" });
    expect(s.cart).toEqual([{ product: "pleskit", edition: "webAdmin", qty: 2 }]);
  });

  it("checks out one site's lines as one order paid from the bank, with unassigned keys by email", () => {
    const s = game(1000);
    addToCart(s, "pleskit", "webAdmin");
    addToCart(s, "pleskit", "webAdmin");
    addToCart(s, "pleskit", "webPro");
    addToCart(s, "windoors", null);
    const r = checkout(s, PLESKIT);
    expect(r.ok).toBe(true);
    const order = r.ok ? r.id! : "";
    expect(s.cash).toBe(982);
    expect(s.ledger.at(-1)).toMatchObject({ category: "licenses", key: "ledger.order", params: { vendor: "Pleskit", order }, amount: -18 });
    expect(orderKeys(s, order).map((k) => [k.edition, k.machineId, k.covers.kind])).toEqual([["webAdmin", null, "term"], ["webAdmin", null, "term"], ["webPro", null, "term"]]);
    expect(new Set(orderKeys(s, order).map((k) => k.key)).size).toBe(3);
    expect(s.tickets.at(-1)).toMatchObject({ kind: "mail", topic: ORDER, mail: { from: "Pleskit", params: { order, total: 18 } } });
    expect(cartOf(s, PLESKIT)).toEqual([]);
    expect(cartOf(s, WINDOORS)).toEqual([{ product: "windoors", edition: null, qty: 1 }]);
    expect(checkout(s, PLESKIT)).toEqual({ ok: false, error: "error.cartEmpty" });
  });

  it("refuses an order the bank balance cannot pay and changes nothing", () => {
    const s = game(500);
    addToCart(s, "windoors", null);
    const before = { ledger: s.ledger.length, licenses: s.licenses.length, tickets: s.tickets.length };
    expect(checkout(s, WINDOORS)).toEqual({ ok: false, error: "error.noCash" });
    expect({ ledger: s.ledger.length, licenses: s.licenses.length, tickets: s.tickets.length }).toEqual(before);
    expect(s.cash).toBe(500);
    expect(s.cart).toHaveLength(1);
  });

  it("binds a one-time Windoors key to the version on sale", () => {
    const s = game();
    addToCart(s, "windoors", null);
    checkout(s, WINDOORS);
    expect(keysOf(s, WINDOORS)).toMatchObject([{ kind: "once", covers: { kind: "version", major: serverOsAt("windoors", 2005).version }, renewsAt: null }]);
    expect(cancelLicence(s, keysOf(s, WINDOORS)[0].id)).toEqual({ ok: false, error: "error.notCancellable" });
  });

  it("cancels a monthly licence, which runs until its term ends and is not renewed", () => {
    const s = game();
    addToCart(s, "pleskit", "webHost");
    checkout(s, PLESKIT);
    const k = keysOf(s, PLESKIT)[0];
    assignKey(s, k.id, "srv1");
    expect(cancelLicence(s, k.id)).toEqual({ ok: true, id: k.id });
    expect(cancelLicence(s, k.id)).toEqual({ ok: false, error: "error.notCancellable" });
    const until = k.covers.kind === "term" ? k.covers.until : 0;
    expect(until).toBe(hourOf(new Date(Date.UTC(2005, 1, 1))));
    s.hour = until - 1;
    expect(licenceStatus(s, "srv1", "pleskit")).toBe("active");
    s.hour = until;
    renewKeys(s);
    expect(s.licenses[0].covers).toEqual({ kind: "term", until });
    expect(licenceStatus(s, "srv1", "pleskit")).toBe("lapsed");
  });

  it("registers only Lexwear keys in Books", () => {
    const s = game();
    addToCart(s, "pleskit", "webAdmin");
    checkout(s, PLESKIT);
    expect(registerLicence(s, s.licenses[0].key)).toEqual({ ok: false, error: "error.licenceKey" });
  });

  it("keeps the cart in the save, and older saves load with an empty one", () => {
    const s = game();
    addToCart(s, "pleskit", "webPro");
    expect(deserialize(serialize(s)).cart).toEqual([{ product: "pleskit", edition: "webPro", qty: 1 }]);
    const old = JSON.parse(serialize(s));
    delete old.cart;
    expect(deserialize(JSON.stringify(old)).cart).toEqual([]);
  });
});
