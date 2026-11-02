import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { isMonthStart, yearOf } from "../src/sim/00-core/time";
import { acceptChance, acceptMid, cityMarket, leadFlows, missingFor, priceIndex, rivals, share, type SalesRequest } from "../src/sim/30-market/market";
import { addRequest, newLead } from "../src/sim/30-market/sales";
import { createTicket, profileStats } from "../src/sim/40-support/tickets";
import { leadCapShare } from "../src/sim/10-catalog/economy";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { assign } from "../src/sim/90-actions/staff";
import { hire } from "./fixtures";
import { changePrice } from "../src/sim/90-actions/sales";
import { offerUpgrade } from "../src/sim/90-actions/orders";
import { serviceMarket } from "../src/sim/30-market/spec";
import { readyGame } from "./fixtures";
import { deserialize, serialize } from "../src/sim/91-save/save";

const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
const req = (s: GameState, id: string) => s.sales.requests.find((r) => r.id === id)!;
// A web hosting request from Frankfurt with a known budget.
function webRequest(s: GameState, over: Partial<SalesRequest> = {}): SalesRequest {
  return addRequest(s, {
    kind: "order", customerId: null, contact: "Anna Albers", company: "Albers Florist", profile: "soleProp", city: "Frankfurt", product: "webHosting",
    spec: sizeSpec("webHosting", 0, yearOf(s.hour)), sla: "basic", reference: 3, discount: 0, budget: 1.1, shady: false, serviceId: null, ticketId: null, deadline: s.hour + 72, ...over,
  }, "sales.msg.webHosting.0");
}

describe("lead generation", () => {
  it("brings a few requests a month from the basement and more with a website", () => {
    const s = readyGame(1);
    run(s, 730);
    const first = s.sales.requests.length;
    expect(first).toBeGreaterThanOrEqual(2);
    expect(first).toBeLessThanOrEqual(15);
    const before = leadFlows(s).reduce((n, f) => n + f.leads, 0);
    expect(setUpChannel(s, "website").ok).toBe(true);
    expect(leadFlows(s).reduce((n, f) => n + f.leads, 0)).toBeGreaterThan(before + 3);
    // Website leads spill into cities without a location; those arrive greyed out.
    expect(leadFlows(s).some((f) => f.city === "London")).toBe(true);
  });

  it("caps organic leads per city at the level's share of its new customers", () => {
    const s = readyGame(1);
    s.marketing = { ...s.marketing, awareness: Object.fromEntries(Object.keys(s.marketing.awareness).map((p) => [p, 1])) as typeof s.marketing.awareness };
    const flows = leadFlows(s);
    expect(flows.length).toBe(9);
    for (const f of flows) expect(f.leads).toBeCloseTo(leadCapShare(1) * cityMarket("Frankfurt", s.hour) * profileStats(f.profile).mix);
    expect(leadCapShare(1)).toBeCloseTo(0.024);
    expect(leadCapShare(6)).toBeCloseTo(0.064);
  });

  it("raises forum profiles' awareness from staff posting", () => {
    const s = readyGame(1);
    s.cash = 1e6;
    expect(hire(s, s.candidates[0].id).ok).toBe(true);
    expect(assign(s, s.staff[0].id, "forum").ok).toBe(true);
    const before = s.marketing.awareness.hobbyDev;
    run(s, 745);
    expect(s.marketing.awareness.hobbyDev).toBeGreaterThan(before);
  });
});

describe("customer choice", () => {
  it("compares you only with competitors that sell the product to that profile", () => {
    expect(rivals("gamer", "gameServer").map((c) => c.name)).toContain("Nitradoh");
    expect(rivals("private", "gameServer").map((c) => c.name)).not.toContain("Nitradoh");
    expect(rivals("private", "webHosting").map((c) => c.name)).not.toContain("Hetzna");
  });

  it("wins more leads with trust and fewer with high prices", () => {
    const s = readyGame(1);
    const base = share(s, "private", "webHosting", "Frankfurt");
    expect(base).toBeGreaterThan(0.05);
    expect(base).toBeLessThan(0.6);
    s.marketing.platform = "trustPylon";
    expect(share(s, "private", "webHosting", "Frankfurt")).toBeGreaterThan(base);
    s.marketing.platform = null;
    const id = s.customers[0].id;
    provisionService(s, id, "webHosting", { label: "x", spec: sizeSpec("webHosting", 0, yearOf(s.hour)), price: 6 / 730 });
    s.customers[0].habit = "prompt";
    expect(priceIndex(s)).toBeGreaterThan(1);
    expect(share(s, "private", "webHosting", "Frankfurt")).toBeLessThan(base);
  });
});

describe("quotes", () => {
  it("accepts near the reference and refuses far above it, existing customers pay more", () => {
    const s = readyGame(1);
    const r = webRequest(s);
    expect(acceptChance(s, r, 3)).toBeGreaterThan(0.8);
    expect(acceptChance(s, r, 3.6)).toBeLessThan(0.2);
    expect(acceptChance(s, r, 6)).toBeLessThan(0.001);
    expect(acceptChance(s, { ...r, customerId: s.customers[0].id }, 3.6)).toBeGreaterThan(acceptChance(s, r, 3.6));
    expect(acceptChance(s, { ...r, discount: 0.2 }, 3)).toBeLessThan(acceptChance(s, r, 3));
  });
});

describe("lost sales", () => {
  it("greys out requests you cannot serve and records why they got away", () => {
    const s = readyGame(1);
    const r = webRequest(s, { city: "London" });
    expect(missingFor(s, r)).toEqual([{ key: "sales.need.location", params: { city: "London" }, ok: false }]);
    expect(missingFor(s, webRequest(s, { sla: "business" }))).toEqual([]);
    run(s, 73);
    expect(s.sales.lost.find((l) => l.name === "Albers Florist")).toMatchObject({ reason: "sales.need.location", params: { city: "London" } });
  });
});

describe("expansion", () => {
  it("turns an upgrade ticket into a request for a bigger spec and grows the service in place", () => {
    const s = readyGame(1);
    const c = s.customers[0], old = s.services.find((v) => v.customerId === c.id)!;
    const t = createTicket(s, c, "upgrade", old.id);
    tick(s);
    const r = s.sales.requests.find((x) => x.ticketId === t.id)!;
    expect(r).toMatchObject({ kind: "expansion", customerId: c.id, product: "webHosting", serviceId: old.id });
    expect(r.thread[0].key).toBe("sales.msg.upgrade");
    expect(r.spec.diskGb).toBeGreaterThan(old.spec.diskGb);
    expect(offerUpgrade(s, r.id, r.reference * 0.5).ok).toBe(true);
    expect(req(s, r.id).status).toBe("quoted");
    for (let i = 0; i < 25; i++) tick(s);
    expect(req(s, r.id).status).toBe("won");
    expect(s.services.filter((v) => v.customerId === c.id && v.endedAt === null).map((v) => [v.id, v.spec])).toEqual([[old.id, r.spec]]);
    expect(s.tickets.find((x) => x.id === t.id)!.status).toBe("closed");
  });

  it("brings the ticket back to the inbox when the customer counters an upgrade offer", () => {
    const s = readyGame(1);
    const c = s.customers[0], old = s.services.find((v) => v.customerId === c.id)!;
    const t = createTicket(s, c, "upgrade", old.id);
    tick(s);
    const r = s.sales.requests.find((x) => x.ticketId === t.id)!;
    expect(offerUpgrade(s, r.id, r.reference * (acceptMid(s, r) + 0.1)).ok).toBe(true);
    for (let i = 0; i < 25; i++) tick(s);
    expect(req(s, r.id).status).toBe("countered");
    expect(req(s, r.id).thread.at(-1)!.from).toBe("customer");
    expect(s.tickets.find((x) => x.id === t.id)).toMatchObject({ status: "open", unread: true });
    expect(s.services.find((v) => v.id === old.id)!.spec).toEqual(old.spec);
  });
});

describe("price changes", () => {
  it("costs happiness for a raise and makes a far-above-market customer cancel", () => {
    const s = readyGame(1);
    // Starts from the market price, as the friends' €6 is no longer exactly the market for their spec.
    s.services[0] = { ...s.services[0], price: serviceMarket(s.services[0], yearOf(s.hour)) / 730 };
    const v = s.services[0], c = s.customers.find((x) => x.id === v.customerId)!;
    const before = c.happiness, old = v.price * 730;
    expect(changePrice(s, v.id, old * 1.2).ok).toBe(true);
    expect(s.services[0].price * 730).toBeCloseTo(old * 1.2);
    expect(s.customers.find((x) => x.id === c.id)!.happiness).toBeCloseTo(before - 20);
    expect(changePrice(s, v.id, old * 3).ok).toBe(true);
    expect(s.tickets.some((t) => t.customerId === c.id && t.kind === "cancellation")).toBe(true);
    expect(changePrice(s, v.id, 0)).toEqual({ ok: false, error: "error.quotePrice" });
  });

  it("lets happiness drift back toward the market over the months", () => {
    const s = readyGame(1);
    const v = s.services[0];
    changePrice(s, v.id, v.price * 730 * 1.04);
    const c = s.customers.find((x) => x.id === v.customerId)!;
    c.happiness = 40;
    const hit = c.happiness;
    while (!isMonthStart(s.hour + 1)) tick(s);
    tick(s);
    expect(s.customers.find((x) => x.id === v.customerId)!.happiness).toBeGreaterThan(hit);
  });
});

describe("saves", () => {
  it("keeps requests and fills them for old saves", () => {
    const s = readyGame(1);
    newLead(s, "private", "Frankfurt", []);
    expect(deserialize(serialize(s)).sales).toEqual(s.sales);
    const old = JSON.parse(serialize(s));
    delete old.sales;
    expect(deserialize(JSON.stringify(old)).sales).toEqual({ requests: [], lost: [] });
  });
});
