import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { marketPrice, marketRates, sizeSpec } from "../src/sim/10-catalog/products";
import { CYCLE_SHARE } from "../src/sim/10-catalog/cycles";
import { BARE_REFERENCE, billingTick } from "../src/sim/45-billing/billing";
import { TIER_IDS } from "../src/sim/10-catalog/hosttoast";
import { hosttoastList } from "../src/sim/80-business/hosttoast";
import { NEEDS } from "../src/sim/30-market/market";
import { fillAt, fillOf, FILL_MAX, resellerAbuse, resellersOn, resellerTick, resellerLeadsOpen } from "../src/sim/30-customers/resellers";
import { newLead } from "../src/sim/30-market/sales";
import { newGame } from "../src/sim/50-state";
import { workloadUse } from "../src/sim/60-infra/usage";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { panelServer, withServer } from "./fixtures";

const year = (y: number) => hourOf(new Date(Date.UTC(y, 0, 1)));
const ok = (r: { ok: boolean; id?: string; error?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };
const MONTH = 730;

function world(size = 1, panel = "directadmen") {
  const s = withServer(newGame(4));
  s.hour = year(2010);
  const host = panelServer(s, "dev3", panel);
  const cust = addCustomer(s, "Webshop Agentur", "reseller");
  const spec = sizeSpec("reseller", size, 2010);
  const id = ok(provisionService(s, cust, "reseller", { label: "block", spec, clusterId: host }));
  const v = s.services.find((x) => x.id === id)!;
  return { s, host, cust, id, v, spec };
}

describe("reseller blocks", () => {
  it("sizes the three blocks and prices them per GB, a medium block at half the web space price per account", () => {
    expect([0, 1, 2].map((i) => sizeSpec("reseller", i, 2010)).map((x) => [x.accounts, x.trafficGb])).toEqual([[20, 500], [50, 1500], [100, 4000]]);
    const web = marketPrice("webHosting", sizeSpec("webHosting", 1, 2010), 2010), medium = sizeSpec("reseller", 1, 2010);
    expect(marketPrice("reseller", medium, 2010)).toBeCloseTo(0.5 * web * medium.accounts!, 0);
    expect(marketRates("reseller", 2010).diskGb).toBeCloseTo((0.5 * web * medium.accounts!) / medium.diskGb, 4);
  });

  it("bills the share of the block in use", () => {
    const { s, v, cust } = world();
    s.hour = hourOf(new Date(Date.UTC(2010, 3, 1)));
    billingTick(s);
    const from = hourOf(new Date(Date.UTC(2010, 2, 1))), hours = s.hour - from;
    const line = s.invoices.filter((i) => i.customerId === cust).flatMap((i) => i.lines).find((l) => l.key === "invoice.line.hours")!;
    expect(line.amount).toBeCloseTo(hours * v.price * fillAt(v, from + hours / 2), 1);
    expect(line.amount).toBeLessThan(hours * v.price * FILL_MAX);
  });

  it("lists reseller blocks on HOSTtoast per GB, yours at your rate", () => {
    const { s } = world();
    s.hosttoast.tier = TIER_IDS[0];
    s.rates = { reseller: { diskGb: 0.42 } };
    const rows = hosttoastList(s, "reseller", null), market = marketRates("reseller", 2010).diskGb!;
    expect(rows.find((r) => r.id === "you")?.price).toBe(0.42);
    const rival = rows.find((r) => r.id !== "you")!;
    expect(rival.price).toBeCloseTo(market * s.competitors.find((c) => c.id === rival.id)!.priceFactor, 6);
  });

  it("fills linearly to 70% in six months and books the whole block while using the filled share", () => {
    const { s, v, cust, id } = world();
    const w = s.workloads.find((x) => x.serviceId === id)!;
    expect(w.diskGb).toBe(v.spec.diskGb);
    resellerTick(s);
    expect(fillOf(s, id)).toBe(0);
    s.hour += 3 * MONTH;
    resellerTick(s);
    expect(s.webpanel.resellers[cust].fillRate).toBeCloseTo(FILL_MAX / 2, 2);
    s.hour += 10 * MONTH;
    resellerTick(s);
    expect(fillOf(s, id)).toBeCloseTo(FILL_MAX, 5);
    const use = workloadUse(s, w);
    expect(use.diskGb).toBeLessThanOrEqual(w.diskGb * FILL_MAX + 1e-9);
    expect(resellersOn(s, w.clusterId!).map((x) => x.id)).toEqual([id]);
  });

  it("fills faster for a cheaper block", () => {
    const a = world(), b = world();
    b.v.price *= 0.6;
    for (const x of [a, b]) { x.s.hour += 2 * MONTH; resellerTick(x.s); }
    expect(b.s.webpanel.resellers[b.cust].fillRate).toBeGreaterThan(a.s.webpanel.resellers[a.cust].fillRate);
  });

  it("sends half the filled accounts' abuse to the player", () => {
    const { s, cust } = world();
    expect(resellerAbuse(s, "other")).toBe(1);
    s.hour += 10 * MONTH;
    resellerTick(s);
    expect(resellerAbuse(s, cust)).toBeCloseTo(50 * FILL_MAX * 0.5, 5);
  });

  it("drops the record when the block ends", () => {
    const { s, v, cust } = world();
    resellerTick(s);
    expect(s.webpanel.resellers[cust]).toBeDefined();
    v.endedAt = s.hour;
    resellerTick(s);
    expect(s.webpanel.resellers[cust]).toBeUndefined();
  });

  it("opens leads from 2008 once a DirectAdmen or cPanic host exists", () => {
    const s = withServer(newGame(4));
    s.hour = year(2012);
    expect(resellerLeadsOpen(s)).toBe(false);
    panelServer(s, "dev3", "directadmen");
    expect(resellerLeadsOpen(s)).toBe(true);
    s.hour = year(2006);
    expect(resellerLeadsOpen(s)).toBe(false);
  });

  it("writes a reseller lead as a block order", () => {
    const s = withServer(newGame(4));
    s.hour = year(2012);
    const r = newLead(s, "reseller", "Frankfurt", [], { product: "reseller", size: 1, sla: "business" });
    expect(r.product).toBe("reseller");
    expect(r.spec.accounts).toBe(50);
    expect(r.thread[0].key).toMatch(/^sales\.msg\.reseller\./);
  });

  it("loads old saves without resellers", () => {
    const s = newGame(4);
    const raw = JSON.parse(serialize(s));
    delete raw.webpanel.resellers;
    expect(deserialize(JSON.stringify(raw)).webpanel.resellers).toEqual({});
  });

  it("has an entry for the reseller profile in every profile table", () => {
    for (const table of [CYCLE_SHARE, BARE_REFERENCE, NEEDS]) expect(table.reseller).toBeDefined();
  });
});
