import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { ALL_DATACENTERS as DATACENTERS, spacePrice } from "../src/sim/20-world/datacenters";
import { leaseOffers } from "../src/sim/10-catalog/leasing";
import type { GameState } from "../src/sim/50-state";
import { addLocation, buyCart, type CartLine } from "../src/sim/90-actions/hardware";
import { buyLicence } from "../src/sim/90-actions/licences";
import { install } from "../src/sim/90-actions/store";
import { addToCart, checkout } from "../src/sim/90-actions/vendor-shop";
import { hostOf } from "../src/sim/80-business/vendor-shop";
import { freeFloor, newGame, orderDetails, withCard, withServer } from "./fixtures";

const CART: CartLine[] = [{ model: "g1-compute", brand: "Dwell", qty: 2 }, { model: "sw-8", brand: "Sysko", qty: 1 }];
const FR5 = DATACENTERS.find((d) => d.id === "equinox-fr5")!;
const bank = (s: GameState) => withCard(s);
const ours = (s: GameState, supplier: string) => s.payables.filter((p) => p.supplier === supplier);

describe("hardware cart", () => {
  it("leaves one receipt for a cash order while there is no bank account", () => {
    const s = { ...withServer(newGame(1)), cash: 10_000 };
    expect(buyCart(s, CART, { kind: "cash" }, "loc1").ok).toBe(true);
    expect(ours(s, "hardware")).toMatchObject([{ method: "cash", doc: "receipt", amount: 5060, name: "Alternatte" }]);
    expect(s.cash).toBe(10_000 - 5060);
  });

  it("refuses cash once a bank exists and leaves nothing behind", () => {
    const s = bank({ ...withServer(newGame(1)), cash: 10_000 }), devices = s.devices.length;
    expect(buyCart(s, CART, { kind: "cash" }, "loc1")).toEqual({ ok: false, error: "error.noCash" });
    expect(s.payables).toEqual([]);
    expect(s.devices).toHaveLength(devices);
  });

  it("leaves one paid invoice for a card order and one open invoice for a transfer", () => {
    const s = bank({ ...withServer(newGame(1)), cash: 10_000 });
    buyCart(s, CART, { kind: "card" }, "loc1");
    expect(ours(s, "hardware")).toMatchObject([{ method: "card", doc: "invoice", paidAt: s.hour }]);
    buyCart(s, CART, { kind: "transfer" }, "loc1");
    expect(ours(s, "hardware")).toHaveLength(2);
    expect(ours(s, "hardware")[1]).toMatchObject({ method: "transfer", doc: "invoice", paidAt: null });
    expect(s.cash).toBe(10_000);
  });

  it("leaves one contract document for a lease", () => {
    const s = { ...withServer(newGame(1)), cash: 0 };
    const offer = leaseOffers(s, 5060)[0];
    expect(buyCart(s, CART, { kind: "lease", offerId: offer.id }, "loc1").ok).toBe(true);
    expect(ours(s, "hardware")).toMatchObject([{ doc: "contract", amount: 0 }]);
  });

  it("counts only paid hardware orders towards buying on account", () => {
    const s = bank({ ...withServer(newGame(1)), cash: 100_000 });
    for (let i = 0; i < 3; i++) buyCart(s, CART, { kind: "card" }, "loc1");
    expect(buyCart(s, CART, { kind: "onAccount" }, "loc1").ok).toBe(true);
    expect(ours(s, "hardware").at(-1)).toMatchObject({ method: "onAccount", doc: "invoice", paidAt: null });
    expect(ours(s, "hardware")).toHaveLength(4);
  });
});

describe("licence checkout", () => {
  it("sends an invoice document for a card order and still sends the keys", () => {
    const s = bank({ ...newGame(31), cash: 10_000 });
    expect(addToCart(s, "windoors", null).ok).toBe(true);
    expect(checkout(s, hostOf("windoors")!, orderDetails(s, "card")).ok).toBe(true);
    expect(ours(s, "software")).toMatchObject([{ method: "card", doc: "invoice", paidAt: s.hour }]);
    expect(s.licenses).toHaveLength(1);
  });

  it("leaves one open invoice for a transfer that holds the keys", () => {
    const s = bank({ ...newGame(31), cash: 10_000 });
    addToCart(s, "windoors", null);
    expect(checkout(s, hostOf("windoors")!, orderDetails(s, "transfer")).ok).toBe(true);
    expect(ours(s, "software")).toMatchObject([{ method: "transfer", paidAt: null, keys: expect.anything() }]);
    expect(s.licenses).toHaveLength(0);
  });
});

describe("Pear store", () => {
  it("leaves a receipt for an install paid in cash and an invoice once a bank exists", () => {
    const s = { ...newGame(1), cash: 10_000, unlocks: ["people", "monitoring", "automation"] };
    expect(install(s, "clipsy").ok).toBe(true);
    expect(ours(s, "pear")).toMatchObject([{ method: "cash", doc: "receipt" }]);
    const b = bank({ ...newGame(1), cash: 10_000, unlocks: ["people", "monitoring", "automation"] });
    expect(install(b, "clipsy").ok).toBe(true);
    expect(ours(b, "pear")).toMatchObject([{ doc: "invoice", paidAt: null }]);
    expect(b.installed).toContain("clipsy");
  });

  it("leaves nothing when the cash is missing", () => {
    const s = { ...newGame(1), cash: 0, unlocks: ["people", "monitoring", "automation"] };
    expect(install(s, "clipsy")).toEqual({ ok: false, error: "error.noCash" });
    expect(s.payables).toEqual([]);
  });
});

describe("shop module", () => {
  it("leaves one document from the shop vendor", () => {
    const s = { ...newGame(1), cash: 10_000 };
    s.shop = { ...s.shop, variant: "modemBill" };
    expect(buyLicence(s, "shop-link").ok).toBe(true);
    expect(ours(s, "shopVendor")).toHaveLength(1);
  });

  it("refuses a second order while the transfer is open", () => {
    const s = bank(freeFloor({ ...newGame(1), cash: 10_000 }));
    s.shop = { ...s.shop, variant: "modemBill" };
    expect(buyLicence(s, "shop-link", "transfer").ok).toBe(true);
    expect(buyLicence(s, "shop-link", "transfer")).toEqual({ ok: false, error: "error.orderOpen" });
    expect(ours(s, "shopVendor")).toHaveLength(1);
  });
});

describe("colocation", () => {
  it("leaves a contract document that bills the rest of the month", () => {
    const s = freeFloor({ ...newGame(1), cash: 1_000_000 });
    s.hour = hourOf(new Date(Date.UTC(2005, 0, 20)));
    const cash = s.cash, monthly = spacePrice(FR5, "share", 2);
    expect(addLocation(s, FR5.id, "share", 2).ok).toBe(true);
    const [p] = ours(s, "datacenter");
    expect(p).toMatchObject({ doc: "contract", method: "cash", name: FR5.name, paidAt: s.hour });
    expect(p.amount).toBeGreaterThan(0);
    expect(p.amount).toBeLessThan(monthly);
    expect(s.cash).toBeCloseTo(cash - p.amount, 2);
  });

  it("orders on account once a bank exists", () => {
    const s = bank(freeFloor({ ...newGame(1), cash: 1_000_000 }));
    s.hour = hourOf(new Date(Date.UTC(2005, 0, 20)));
    const cash = s.cash;
    expect(addLocation(s, FR5.id, "share", 2).ok).toBe(true);
    const [contract, invoice] = ours(s, "datacenter");
    expect(contract).toMatchObject({ doc: "contract", method: "onAccount", amount: 0 });
    expect(invoice).toMatchObject({ doc: "invoice", method: "onAccount", paidAt: null });
    expect(invoice.amount).toBeGreaterThan(0);
    expect(s.cash).toBe(cash);
  });
});
