import { describe, expect, it } from "vitest";
import { isMonthStart } from "../src/sim/00-core/time";
import { billingTick } from "../src/sim/45-billing/billing";
import { goLivePlan } from "../src/sim/80-business/portal";
import { createProduct, createProductGroup, importExisting } from "../src/sim/90-actions/portal";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { openShop, readyGame } from "./fixtures";

describe("Bestandskunden übernehmen", () => {
  it("moves running Books customers into the shop and links services that match a product", () => {
    const s = openShop(readyGame(7));
    const plan = goLivePlan(s), v = plan.services[0];
    expect(plan.customers.length).toBeGreaterThan(0);
    const g = (createProductGroup(s, "Hosting") as { id: string }).id;
    const p = (createProduct(s, g, "Start", v.product) as { id: string }).id;
    s.shop.products = s.shop.products.map((x) => (x.id === p ? { ...x, packageName: v.pkg ?? "", spec: v.spec } : x));
    expect(goLivePlan(s).matched).toBeGreaterThan(0);
    const open = s.invoices.filter((i) => i.status === "open").map((i) => i.id);

    expect(importExisting(s)).toEqual({ ok: true });
    expect(s.customers.filter((c) => c.churnedAt === null).every((c) => c.source === "shop")).toBe(true);
    expect(s.services.find((x) => x.id === v.id)!.productId).toBe(p);
    expect(s.invoices.filter((i) => open.includes(i.id)).every((i) => i.source === undefined)).toBe(true);
    expect(importExisting(s)).toEqual({ ok: false, error: "error.nothingToImport" });
    expect(deserialize(serialize(s)).services.find((x) => x.id === v.id)!.productId).toBe(p);

    // The next monthly run is the shop's: issued at once instead of waiting as a Books draft.
    const before = s.invoices.length;
    do s.hour++; while (!isMonthStart(s.hour));
    billingTick(s);
    const fresh = s.invoices.slice(before).filter((i) => i.customerId === v.customerId);
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.every((i) => i.source === "shop" && i.status !== "draft")).toBe(true);
  });
});
