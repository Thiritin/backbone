import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PREFERENCE } from "../src/sim/10-catalog/payments";
import { SHOP_SETUP_HOURS } from "../src/sim/10-catalog/shops";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { orderLead } from "../src/sim/30-market/orders";
import { referenceFor } from "../src/sim/30-market/market";
import type { GameState } from "../src/sim/50-state";
import { chooseProduct, packageSpec, productCycles } from "../src/sim/80-business/portal";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { chooseShop, createGroup, setGroupSale } from "../src/sim/90-actions/shop";
import { createProduct, createProductGroup, deleteProduct, deleteProductGroup, renameProductGroup, setProductGroupHidden, setProductPrice, updateProduct } from "../src/sim/90-actions/portal";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { automate, readyGame } from "./fixtures";

// Every customer pays by bank transfer here, so no shop order is lost for its payment method.
const saved = { ...PREFERENCE };
beforeEach(() => { for (const k of Object.keys(PREFERENCE) as (keyof typeof PREFERENCE)[]) PREFERENCE[k] = { transfer: 1 }; });
afterEach(() => { Object.assign(PREFERENCE, saved); });

const web = { product: "webHosting" as const, size: 1, sla: "basic" as const };

const shopGame = (seed = 5, id: Parameters<typeof chooseShop>[1] = "modemBill"): GameState => {
  const s = readyGame(seed);
  s.cash = 1e6;
  setUpChannel(s, "website");
  chooseShop(s, "hostBull");
  s.unlocks = [...s.unlocks, "shops"];
  expect(chooseShop(s, id).ok).toBe(true);
  s.hour += SHOP_SETUP_HOURS;
  return automate(s);
};
const idOf = (r: { ok: boolean; id?: string }) => { expect(r.ok).toBe(true); return r.id!; };
const want = (s: GameState, spec = sizeSpec("webHosting", 1, 2005)) => ({ city: "Frankfurt", product: "webHosting" as const, spec, reference: referenceFor(s, "private", "webHosting", spec, "basic") });

describe("shop products", () => {
  it("need a shop and validate groups, products and prices", () => {
    const none = readyGame(1);
    expect(createProductGroup(none, "Web")).toMatchObject({ ok: false, error: "error.needsShop" });
    const s = shopGame();
    expect(createProductGroup(s, " ")).toMatchObject({ ok: false, error: "error.badProductName" });
    const g = idOf(createProductGroup(s, "Web"));
    expect(renameProductGroup(s, g, "Hosting").ok).toBe(true);
    expect(s.shop.productGroups[0]).toMatchObject({ name: "Hosting", hidden: false });
    expect(createProduct(s, "nope", "Mini", "webHosting")).toMatchObject({ ok: false, error: "error.unknownProductGroup" });
    const p = idOf(createProduct(s, g, "Mini", "webHosting"));
    const prod = () => s.shop.products.find((x) => x.id === p)!;
    expect(Object.keys(prod().prices)).toEqual(["monthly", "quarterly", "annual"]);
    expect(setProductPrice(s, p, "biennial", 5)).toMatchObject({ ok: false, error: "error.cycleNotSupported" });
    expect(setProductPrice(s, p, "annual", -1)).toMatchObject({ ok: false, error: "error.badProductPrice" });
    expect(setProductPrice(s, p, "annual", 40).ok).toBe(true);
    expect(prod().prices.annual).toBe(40);
    expect(setProductPrice(s, p, "quarterly", null).ok).toBe(true);
    expect(productCycles(s, prod())).toEqual(["monthly", "annual"]);
    expect(deleteProductGroup(s, g)).toMatchObject({ ok: false, error: "error.groupHasProducts" });
    expect(deleteProduct(s, p).ok).toBe(true);
    expect(setProductGroupHidden(s, g, true).ok).toBe(true);
    expect(deleteProductGroup(s, g).ok).toBe(true);
  });

  it("sell a line without products through its configurable options", () => {
    const s = shopGame();
    expect(chooseProduct(s, want(s))).toBeNull();
    const r = orderLead(s, "private", "Frankfurt", [], web, false);
    expect(s.sales.requests.find((x) => x.id === r.id)).toMatchObject({ status: "won", shop: true });
  });

  it("pick the smallest plan that covers the spec, else the largest near the market, else no fitting plan", () => {
    const s = shopGame();
    const g = idOf(createProductGroup(s, "Web"));
    const small = idOf(createProduct(s, g, "Small", "webHosting")), big = idOf(createProduct(s, g, "Big", "webHosting"));
    const spec = (id: string) => s.shop.products.find((x) => x.id === id)!.spec;
    updateProduct(s, big, { spec: { ...spec(big), vcpu: 0.5, ramGb: 1, diskGb: 5, trafficGb: 10, mailboxes: 5 } });
    setProductPrice(s, small, "monthly", 3);
    setProductPrice(s, big, "monthly", 30);
    const mid = { ...spec(small), ramGb: spec(small).ramGb + 0.5 };
    expect((chooseProduct(s, want(s, spec(small))) as { id: string }).id).toBe(small);
    expect((chooseProduct(s, want(s, mid)) as { id: string }).id).toBe(big);
    const huge = { ...spec(big), diskGb: 5000 };
    expect(chooseProduct(s, { ...want(s, huge), reference: 25 })).toMatchObject({ id: big });
    expect(chooseProduct(s, { ...want(s, huge), reference: 20 })).toBe("soldOut");
    expect(updateProduct(s, small, { hidden: true }).ok).toBe(true);
    expect((chooseProduct(s, want(s, spec(small))) as { id: string }).id).toBe(big);
    updateProduct(s, big, { stock: 0 });
    expect(chooseProduct(s, want(s, spec(small)))).toBe("soldOut");
  });

  it("book the product's spec, price, setup fee and stock on an order", () => {
    const s = shopGame();
    const g = idOf(createProductGroup(s, "Web"));
    const p = idOf(createProduct(s, g, "Small", "webHosting"));
    updateProduct(s, p, { stock: 2, setup: 7 });
    setProductPrice(s, p, "monthly", 9.5);
    const prod = s.shop.products[0];
    const r = orderLead(s, "private", "Frankfurt", [], web, false, undefined, undefined, prod);
    const req = s.sales.requests.find((x) => x.id === r.id)!;
    expect(req).toMatchObject({ productId: p, setup: 7, status: "won" });
    expect(req.quote! * (req.cycle ? { quarterly: 3, annual: 12 }[req.cycle as "annual"] ?? 1 : 1)).toBeGreaterThan(0);
    expect(s.shop.products[0].stock).toBe(1);
    const inv = s.invoices.find((i) => i.customerId === req.customerId)!;
    expect(inv.lines.find((l) => l.key === "invoice.line.setupFee")!.amount).toBe(7);
  });

  it("leave a setup mode of accept or off to the player", () => {
    const s = shopGame();
    const g = idOf(createProductGroup(s, "Web"));
    const p = idOf(createProduct(s, g, "Small", "webHosting"));
    for (const mode of ["accept", "off"] as const) {
      updateProduct(s, p, { setupMode: mode });
      const r = orderLead(s, "private", "Frankfurt", [], web, false, undefined, undefined, s.shop.products[0]);
      const req = s.sales.requests.find((x) => x.id === r.id)!;
      expect(req.status).toBe("accepted");
      expect(req.serviceId).toBeNull();
    }
    updateProduct(s, p, { setupMode: "payment" });
    const r = orderLead(s, "private", "Frankfurt", [], web, false, undefined, undefined, s.shop.products[0]);
    expect(s.sales.requests.find((x) => x.id === r.id)!.status).toBe("won");
  });

  it("sell only from the product's server group", () => {
    const s = shopGame();
    const g = idOf(createProductGroup(s, "Web"));
    const p = idOf(createProduct(s, g, "Small", "webHosting"));
    expect(updateProduct(s, p, { serverGroupId: "nope" })).toMatchObject({ ok: false, error: "error.unknownServerGroup" });
    const empty = idOf(createGroup(s, "panel", "Empty"));
    setGroupSale(s, empty, "webHosting", true);
    updateProduct(s, p, { serverGroupId: empty });
    expect(chooseProduct(s, want(s))).toBe("soldOut");
    updateProduct(s, p, { serverGroupId: null });
    expect(chooseProduct(s, want(s))).toMatchObject({ id: p });
    updateProduct(s, p, { packageName: "Gold" });
    expect(chooseProduct(s, want(s))).toBe("soldOut");
    expect(packageSpec(s, s.shop.products[0])).toEqual(s.shop.products[0].spec);
  });

  it("round trip through a save and load into old saves as empty", () => {
    const s = shopGame();
    const g = idOf(createProductGroup(s, "Web"));
    createProduct(s, g, "Small", "webHosting");
    expect(deserialize(serialize(s)).shop).toEqual(s.shop);
    const old = JSON.parse(serialize(s));
    delete old.shop.products;
    delete old.shop.productGroups;
    expect(deserialize(JSON.stringify(old)).shop).toMatchObject({ products: [], productGroups: [] });
  });
});
