import { describe, expect, it } from "vitest";
import { isMonthStart } from "../src/sim/00-core/time";
import { acceptChance, leadFlows, missingFor, priceIndex, rivals, share, type SalesRequest } from "../src/sim/30-market/market";
import { addRequest, newLead, shadyLead } from "../src/sim/30-market/sales";
import { createTicket } from "../src/sim/40-support/tickets";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { assign, hire } from "../src/sim/90-actions/staff";
import { changePrice, decline, quote } from "../src/sim/90-actions/sales";
import { startGame } from "../src/sim/90-actions/start";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { checkDone } from "../src/sim/checklist";

const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
const req = (s: GameState, id: string) => s.sales.requests.find((r) => r.id === id)!;
// A web hosting request from Frankfurt with a known budget.
function webRequest(s: GameState, over: Partial<SalesRequest> = {}): SalesRequest {
  return addRequest(s, {
    kind: "new", customerId: null, contact: "Anna Albers", company: "Albers Florist", profile: "soleProp", city: "Frankfurt", product: "webHosting",
    plan: "web-s", sla: "basic", reference: 3, discount: 0, budget: 1.1, shady: false, serviceId: null, ticketId: null, deadline: s.hour + 72, ...over,
  }, "sales.msg.webHosting.0");
}
const replied = (s: GameState, id: string) => { while (req(s, id).status === "quoted") tick(s); return req(s, id); };

describe("lead generation", () => {
  it("brings a few requests a month from the basement and more with a website", () => {
    const s = startGame(1);
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

  it("raises forum profiles' awareness from staff posting", () => {
    const s = startGame(1);
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
    const s = startGame(1);
    const base = share(s, "private", "webHosting", "Frankfurt");
    expect(base).toBeGreaterThan(0.05);
    expect(base).toBeLessThan(0.6);
    s.marketing.platform = "trustPylon";
    expect(share(s, "private", "webHosting", "Frankfurt")).toBeGreaterThan(base);
    s.marketing.platform = null;
    const id = s.customers[0].id;
    provisionService(s, id, "webHosting", { label: "x", plan: "web-s", price: 6 / 730 });
    s.customers[0].habit = "prompt";
    expect(priceIndex(s)).toBeGreaterThan(1);
    expect(share(s, "private", "webHosting", "Frankfurt")).toBeLessThan(base);
  });
});

describe("quotes", () => {
  it("accepts near the reference and refuses far above it, existing customers pay more", () => {
    const s = startGame(1);
    const r = webRequest(s);
    expect(acceptChance(s, r, 3)).toBeGreaterThan(0.8);
    expect(acceptChance(s, r, 3.6)).toBeLessThan(0.2);
    expect(acceptChance(s, r, 6)).toBeLessThan(0.001);
    expect(acceptChance(s, { ...r, customerId: s.customers[0].id }, 3.6)).toBeGreaterThan(acceptChance(s, r, 3.6));
    expect(acceptChance(s, { ...r, discount: 0.2 }, 3)).toBeLessThan(acceptChance(s, r, 3));
  });

  it("provisions the service when the customer accepts", () => {
    const s = startGame(1);
    const r = webRequest(s);
    expect(quote(s, r.id, 2.5).ok).toBe(true);
    expect(req(s, r.id).thread.at(-1)).toMatchObject({ from: "you", key: "sales.you.quote" });
    const done = replied(s, r.id);
    expect(done.status).toBe("won");
    const c = s.customers.find((x) => x.id === done.customerId)!;
    expect(c.name).toBe("Albers Florist");
    const v = s.services.find((x) => x.id === done.serviceId)!;
    expect(v).toMatchObject({ product: "webHosting", plan: "web-s", zone: "fra1" });
    expect(v.price * 730).toBeCloseTo(2.5);
    expect(s.workloads.some((w) => w.serviceId === v.id)).toBe(true);
    expect(checkDone(s, "firstCustomer")).toBe(true);
  });

  it("counters or refuses a quote above budget; meeting the counter wins", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = startGame(seed);
      const r = webRequest(s, { budget: 1 });
      quote(s, r.id, 3.25);
      const back = replied(s, r.id);
      expect(["won", "countered", "refused"]).toContain(back.status);
      if (back.status !== "countered") continue;
      expect(back.counter!).toBeLessThan(3.25);
      quote(s, r.id, back.counter!);
      expect(replied(s, r.id).status).toBe("won");
      return;
    }
    throw new Error("no seed countered");
  });

  it("says there is no budget well above the reference", () => {
    const s = startGame(1);
    const r = webRequest(s);
    quote(s, r.id, 9);
    const back = replied(s, r.id);
    expect(back.status).toBe("refused");
    expect(back.thread.at(-1)!.key).toBe("sales.reply.noBudget");
    run(s, 49);
    expect(req(s, r.id).status).toBe("lost");
    expect(s.sales.lost.at(-1)!.reason).toBe("lost.price");
  });
});

describe("lost sales", () => {
  it("greys out requests you cannot serve and records why they got away", () => {
    const s = startGame(1);
    const r = webRequest(s, { city: "London" });
    expect(missingFor(s, r)).toEqual([{ key: "sales.need.location", params: { city: "London" }, ok: false }]);
    expect(quote(s, r.id, 3)).toEqual({ ok: false, error: "error.requestMissing" });
    expect(missingFor(s, webRequest(s, { sla: "business" }))[0].key).toBe("sales.need.datacenter");
    run(s, 73);
    expect(s.sales.lost.find((l) => l.name === "Albers Florist")).toMatchObject({ reason: "sales.need.location", params: { city: "London" } });
  });

  it("loses an accepted deal without capacity", () => {
    const s = startGame(1);
    const friend = s.customers[0].id;
    while (provisionService(s, friend, "vps", { label: "filler", plan: "vps-s" }).ok);
    const r = webRequest(s, { product: "vps", plan: "vps-s", reference: 8 });
    quote(s, r.id, 5);
    const back = replied(s, r.id);
    expect(back.status).toBe("lost");
    expect(back.thread.at(-1)!.key).toBe("sales.reply.gone");
    expect(s.sales.lost.at(-1)).toMatchObject({ reason: "lost.noCapacity", params: { city: "Frankfurt" } });
    expect(s.customers.some((c) => c.name === "Albers Florist")).toBe(false);
  });

  it("records a declined request", () => {
    const s = startGame(1);
    const r = webRequest(s);
    expect(decline(s, r.id).ok).toBe(true);
    expect(req(s, r.id).status).toBe("declined");
    expect(s.sales.lost.at(-1)!.reason).toBe("lost.declined");
  });
});

describe("expansion", () => {
  it("turns an upgrade ticket into a request for the next plan and replaces the service", () => {
    const s = startGame(1);
    const c = s.customers[0], old = s.services.find((v) => v.customerId === c.id)!;
    const t = createTicket(s, c, "upgrade", old.id);
    tick(s);
    const r = s.sales.requests.find((x) => x.ticketId === t.id)!;
    expect(r).toMatchObject({ kind: "expansion", customerId: c.id, product: "webHosting", plan: "web-l", serviceId: old.id });
    quote(s, r.id, r.reference);
    expect(replied(s, r.id).status).toBe("won");
    expect(s.services.find((v) => v.id === old.id)!.endedAt).not.toBeNull();
    expect(s.services.filter((v) => v.customerId === c.id && v.endedAt === null).map((v) => v.plan)).toEqual(["web-l"]);
    expect(s.tickets.find((x) => x.id === t.id)!.status).toBe("closed");
  });
});

describe("price changes", () => {
  it("costs happiness for a raise and makes a far-above-market customer cancel", () => {
    const s = startGame(1);
    const v = s.services[0], c = s.customers.find((x) => x.id === v.customerId)!;
    const before = c.happiness, old = v.price * 730;
    expect(changePrice(s, v.id, old * 1.2).ok).toBe(true);
    expect(s.services[0].price * 730).toBeCloseTo(old * 1.2);
    expect(s.customers.find((x) => x.id === c.id)!.happiness).toBeCloseTo(before - 10);
    expect(changePrice(s, v.id, old * 3).ok).toBe(true);
    expect(s.tickets.some((t) => t.customerId === c.id && t.kind === "cancellation")).toBe(true);
    expect(changePrice(s, v.id, 0)).toEqual({ ok: false, error: "error.quotePrice" });
  });

  it("lets happiness drift back toward the market over the months", () => {
    const s = startGame(1);
    const v = s.services[0];
    changePrice(s, v.id, v.price * 730 * 1.1);
    const c = s.customers.find((x) => x.id === v.customerId)!;
    c.happiness = 40;
    const hit = c.happiness;
    while (!isMonthStart(s.hour + 1)) tick(s);
    tick(s);
    expect(s.customers.find((x) => x.id === v.customerId)!.happiness).toBeGreaterThan(hit);
  });
});

describe("shady requests", () => {
  it("pays well and flags the customer", () => {
    const s = startGame(1);
    const r = shadyLead(s, "Frankfurt", []);
    expect(r.thread[0].key).toBe("sales.msg.shady");
    expect(acceptChance(s, r, r.reference * 1.6)).toBeGreaterThan(0.8);
    s.workloads = [];
    quote(s, r.id, r.reference * 1.5);
    const done = replied(s, r.id);
    if (done.status === "won") expect(s.customers.find((c) => c.id === done.customerId)!.shady).toBe(true);
    else expect(s.sales.lost.at(-1)!.reason).toBe("lost.noCapacity");
  });
});

describe("saves", () => {
  it("keeps requests and fills them for old saves", () => {
    const s = startGame(1);
    newLead(s, "private", "Frankfurt", []);
    expect(deserialize(serialize(s)).sales).toEqual(s.sales);
    const old = JSON.parse(serialize(s));
    delete old.sales;
    expect(deserialize(JSON.stringify(old)).sales).toEqual({ requests: [], lost: [] });
  });
});
