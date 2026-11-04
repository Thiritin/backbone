import { describe, expect, it } from "vitest";
import { orderLead } from "../src/sim/30-market/orders";
import type { Product } from "../src/sim/30-customers/customers";
import type { Sla } from "../src/sim/10-catalog/products";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { createQuote } from "../src/sim/90-actions/orders";
import { readyGame } from "./fixtures";

describe("books without a catalog", () => {
  const need = { product: "vps" as Product, size: 1, sla: "basic" as Sla };

  it("prices every email request in its own quote", () => {
    const s = readyGame(14);
    const r = orderLead(s, "private", "Frankfurt", [], need, true, undefined, { budget: 100 });
    expect(r.productId).toBeUndefined();
    expect(r.cycle).toBeUndefined();
    expect(createQuote(s, r.ticketId!).ok).toBe(true);
    expect(s.quotes.at(-1)!.monthly).toBe(r.reference);
  });

  it("drops the catalog from old saves and keeps an open request's price", () => {
    const s = readyGame(14);
    const r = orderLead(s, "private", "Frankfurt", [], need, true, undefined, { budget: 100 });
    const old = JSON.parse(serialize(s));
    old.catalog = [{ id: "prd1", name: "VPS 1", line: "vps", spec: r.spec, sla: "basic", prices: { monthly: 9.99 }, setup: 0, hidden: false }];
    old.marketing.published = old.catalog;
    old.marketing.unmet = { month: { vps: 2 }, last: {} };
    old.sales.requests = old.sales.requests.map((x: { id: string }) => (x.id === r.id ? { ...x, productId: "prd1", quote: 9.99 } : x));
    const loaded = deserialize(JSON.stringify(old));
    expect("catalog" in loaded).toBe(false);
    expect("published" in loaded.marketing).toBe(false);
    expect("unmet" in loaded.marketing).toBe(false);
    expect(loaded.sales.requests.find((x) => x.id === r.id)!.quote).toBe(9.99);
  });
});
