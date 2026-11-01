import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { offerPrice, setupFee } from "../src/sim/30-market/spec";
import { defaultSpecFor } from "../src/sim/80-business/packages";
import { addProduct, removeProduct, updateProduct } from "../src/sim/90-actions/catalog";
import { deserialize, serialize } from "../src/sim/91-save/save";
import type { Product } from "../src/sim/30-customers/customers";
import type { GameState } from "../src/sim/50-state";
import { newGame } from "./fixtures";

const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);
const added = (s: GameState, line: Product): string => {
  const r = addProduct(s, line);
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};

describe("product catalog", () => {
  it("adds a product at the middle size, the player's rate and the line's setup fee", () => {
    const s = newGame(1), spec = defaultSpecFor("vps", yearOf(s.hour));
    const id = added(s, "vps");
    expect(s.catalog).toEqual([{ id, name: "VPS 1", line: "vps", spec, sla: "basic", prices: { monthly: offerPrice(s, "vps", spec) }, setup: setupFee(s, "vps"), hidden: false }]);
    expect(addProduct(s, "vps").ok).toBe(true);
    expect(s.catalog[1].name).toBe("VPS 2");
  });

  it("updates and removes a product", () => {
    const s = newGame(2), id = added(s, "webHosting");
    expect(err(updateProduct(s, id, { name: " Starter ", prices: { monthly: 4, annual: 40 }, setup: 0, hidden: true, sla: "business" }))).toBe("ok");
    expect(s.catalog[0]).toMatchObject({ name: "Starter", prices: { monthly: 4, annual: 40 }, setup: 0, hidden: true, sla: "business", line: "webHosting" });
    expect(err(updateProduct(s, id, { prices: {} }))).toBe("error.productPrice");
    expect(err(updateProduct(s, id, { prices: { monthly: -1 } }))).toBe("error.productPrice");
    expect(err(updateProduct(s, id, { name: "x".repeat(25) }))).toBe("error.productName");
    expect(err(removeProduct(s, id))).toBe("ok");
    expect(s.catalog).toEqual([]);
    expect(err(removeProduct(s, id))).toBe("error.productMissing");
  });

  it("keeps names unique per line", () => {
    const s = newGame(3), a = added(s, "vps"), b = added(s, "vps"), c = added(s, "dedicated");
    expect(err(updateProduct(s, a, { name: "Pro" }))).toBe("ok");
    expect(err(updateProduct(s, b, { name: "pro" }))).toBe("error.productTaken");
    expect(err(updateProduct(s, c, { name: "Pro" }))).toBe("ok");
    expect(err(updateProduct(s, a, { name: "PRO" }))).toBe("ok");
  });

  it("fails in Books once a shop is chosen", () => {
    const s = newGame(4), id = added(s, "vps");
    s.shop.variant = "modemBill";
    expect(err(addProduct(s, "vps"))).toBe("error.catalogInShop");
    expect(err(updateProduct(s, id, { name: "Pro" }))).toBe("error.catalogInShop");
    expect(err(removeProduct(s, id))).toBe("error.catalogInShop");
  });

  it("loads a save without a catalog", () => {
    const s = newGame(5);
    const { catalog: _, ...old } = JSON.parse(serialize(s));
    expect(deserialize(JSON.stringify(old)).catalog).toEqual([]);
  });
});
