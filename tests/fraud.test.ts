import { describe, expect, it } from "vitest";
import { orderLead } from "../src/sim/30-market/orders";
import { issueInvoice, stepMinutes } from "../src/sim/30-market/manual";
import type { SalesRequest } from "../src/sim/30-market/market";
import { CHARGEBACK_DAYS, CHARGEBACK_FEE, failsReview, failsScreen, fraudShare, PROVIDER, REVIEW_MINUTES, screenFee, SCREENING_SKILL, WATCHED_FEE } from "../src/sim/45-billing/fraud";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer } from "../src/sim/90-actions/customers";
import { createAccount, quoteOrder, setReviewOrders, setScreenOrders } from "../src/sim/90-actions/orders";
import { cents } from "../src/sim/45-billing/billing";
import { hourOf, yearOf } from "../src/sim/00-core/time";
import { PREFERENCE } from "../src/sim/10-catalog/payments";
import { resolveTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { mailed, openShop, readyGame } from "./fixtures";

const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
const web = { product: "webHosting" as const, size: 0, sla: "basic" as const };
const vps = { product: "vps" as const, size: 0, sla: "basic" as const };
const MONTH = 730;
const req = (s: GameState, id: string) => s.sales.requests.find((x) => x.id === id)!;
const setFraud = (s: GameState, id: string, fraud: boolean) => {
  s.sales.requests = s.sales.requests.map((r) => (r.id === id ? { ...r, fraud, budget: 100 } : r));
};

// A fraudster with a paid invoice whose chargeback is due in an hour.
function fraudster(s: GameState, amount = 40) {
  const id = addCustomer(s, "Stolen Card", "hobbyDev");
  s.customers = s.customers.map((c) => (c.id === id ? { ...c, shady: true, chargebackAt: s.hour + 1 } : c));
  const inv = issueInvoice(s, id, [{ serviceId: null, key: "invoice.line.firstMonth", params: { label: "x" }, amount }]);
  s.invoices = s.invoices.map((i) => (i.id === inv.id ? { ...i, status: "paid", payAt: null, paidAt: s.hour } : i));
  return id;
}

describe("signup fraud", () => {
  it("hits server products hardest, shop payments more than transfers and the crypto years most", () => {
    expect(fraudShare("vps", 2005)).toBeGreaterThan(fraudShare("webHosting", 2005));
    expect(fraudShare("dedicated", 2005)).toBeGreaterThan(fraudShare("dns", 2005));
    expect(fraudShare("vps", 2005, true)).toBeCloseTo(fraudShare("vps", 2005) * 0.2, 9);
    expect(fraudShare("vps", 2017)).toBeGreaterThan(fraudShare("vps", 2012));
    expect(fraudShare("vps", 2020)).toBeLessThan(fraudShare("vps", 2017));
  });

  it("marks about the drawn share of card-paid shop VPS orders and no sales leads", () => {
    const s = openShop(readyGame(3));
    s.hour = hourOf(new Date(Date.UTC(2007, 0, 1)));
    s.modules = [...s.modules, "card"];
    const saved = PREFERENCE.hobbyDev;
    PREFERENCE.hobbyDev = { card: 1 };
    let orders: SalesRequest[];
    try {
      orders = Array.from({ length: 600 }, () => orderLead(s, "hobbyDev", "Frankfurt", [], vps, false));
    } finally {
      PREFERENCE.hobbyDev = saved;
    }
    const share = orders.filter((r) => r.fraud).length / orders.length;
    expect(share).toBeGreaterThan(0.02);
    expect(share).toBeLessThan(0.09);
    const leads = Array.from({ length: 300 }, () => orderLead(s, "hobbyDev", "Frankfurt", [], vps, true, undefined, { budget: 1 }));
    expect(leads.some((r) => r.fraud)).toBe(false);
  });

  it("turns an accepted fraudulent order into a prompt, shady customer with a chargeback 30 to 60 days out", () => {
    const s = readyGame(1);
    const r = orderLead(s, "private", "Frankfurt", [], web);
    setFraud(s, r.id, true);
    expect(resolveTicket(s, r.ticketId!, "accept").ok).toBe(true);
    const start = s.hour;
    run(s, 1);
    const c = s.customers.find((x) => x.id === req(s, r.id).customerId)!;
    expect(c).toMatchObject({ habit: "prompt", shady: true });
    expect(c.chargebackAt! - start).toBeGreaterThanOrEqual(CHARGEBACK_DAYS[0] * 24);
    expect(c.chargebackAt! - start).toBeLessThanOrEqual(CHARGEBACK_DAYS[1] * 24 + 1);
  });
});

describe("chargebacks", () => {
  it("takes back the payments with a fee, writes the invoices off and ends the customer", () => {
    const s = readyGame(2);
    const id = fraudster(s, 40);
    const cash = s.cash;
    run(s, 2);
    const c = s.customers.find((x) => x.id === id)!;
    expect(c.chargebackAt).toBeUndefined();
    expect(c.churnedAt).not.toBeNull();
    expect(s.invoices.filter((i) => i.customerId === id).every((i) => i.status === "writtenOff")).toBe(true);
    const mine = s.ledger.filter((e) => e.params.customer === "Stolen Card");
    expect(mine.map((e) => [e.key, e.amount])).toEqual([["ledger.chargeback", -40], ["ledger.chargebackFee", -CHARGEBACK_FEE]]);
    expect(s.cash).toBeLessThanOrEqual(cash - 40 - CHARGEBACK_FEE);
  });

  it("warns at the first month over the share, then charges a monthly fee and more per chargeback, and forgives when it drops", () => {
    const s = readyGame(2);
    const backs = () => s.ledger.push(...Array.from({ length: PROVIDER.min }, () => ({ hour: s.hour, category: "payments", key: "ledger.chargeback", params: {}, amount: -1 })));
    const until = (strikes: number) => {
      for (let i = 0; i < 2 * MONTH && s.chargebackStrikes !== strikes; i++) tick(s);
      return s.chargebackStrikes;
    };
    backs();
    expect(until(1)).toBe(1);
    backs();
    expect(until(2)).toBe(2);
    expect(s.ledger.filter((e) => e.key === "ledger.chargebackProgram").map((e) => e.amount)).toEqual([-PROVIDER.monthlyFee]);
    fraudster(s, 10);
    run(s, 2);
    expect(s.ledger.find((e) => e.key === "ledger.chargebackFee" && e.params.customer === "Stolen Card")!.amount).toBe(-WATCHED_FEE);
    s.ledger = s.ledger.filter((e) => e.key !== "ledger.chargeback");
    expect(until(0)).toBe(0);
  });
});

describe("order review", () => {
  it("adds review minutes to the account step of server orders only", () => {
    const s = readyGame(1);
    const v = orderLead(s, "private", "Frankfurt", [], vps, true), w = orderLead(s, "private", "Frankfurt", [], web, true);
    const base = stepMinutes("account");
    expect(stepMinutes("account", s, v)).toBe(base);
    expect(setReviewOrders(s, true).ok).toBe(true);
    expect(stepMinutes("account", s, v)).toBe(base + REVIEW_MINUTES);
    expect(stepMinutes("account", s, w)).toBe(base);
  });

  it("catches most fraud and a few honest orders", () => {
    const s = readyGame(1);
    s.reviewOrders = true;
    const reqs = Array.from({ length: 1000 }, (_, i) => ({ id: `req${i}`, product: "vps" }) as SalesRequest);
    const caught = reqs.filter((r) => failsReview(s, { ...r, fraud: true })).length / reqs.length;
    const honest = reqs.filter((r) => failsReview(s, r)).length / reqs.length;
    expect(caught).toBeGreaterThan(0.6);
    expect(caught).toBeLessThan(0.8);
    expect(honest).toBeGreaterThan(0.01);
    expect(honest).toBeLessThan(0.06);
    s.reviewOrders = false;
    expect(reqs.some((r) => failsReview(s, { ...r, fraud: true }))).toBe(false);
  });

  it("declines a caught order at the account step without a customer", () => {
    const s = readyGame(4);
    setReviewOrders(s, true);
    let r: SalesRequest | undefined;
    for (let i = 0; i < 40 && !r; i++) {
      const x = orderLead(s, "private", "Frankfurt", [], vps, true);
      setFraud(s, x.id, true);
      if (failsReview(s, req(s, x.id))) r = x;
    }
    expect(quoteOrder(s, r!.ticketId!, 20).ok).toBe(true);
    for (let i = 0; i < 60 && req(s, r!.id).status !== "accepted"; i++) tick(s);
    const customers = s.customers.length;
    expect(createAccount(s, r!.ticketId!, mailed(s, r!.ticketId!)).ok).toBe(true);
    run(s, 2);
    expect(req(s, r!.id).status).toBe("declined");
    expect(s.tickets.find((t) => t.id === r!.ticketId)).toMatchObject({ status: "closed", outcome: "declined" });
    expect(s.customers.length).toBe(customers);
  });

  it("keeps the setting and the chargeback hour in a save", () => {
    const s = readyGame(1);
    setReviewOrders(s, true);
    fraudster(s);
    s.chargebackStrikes = 1;
    const back = deserialize(serialize(s));
    expect(back.reviewOrders).toBe(true);
    expect(back.chargebackStrikes).toBe(1);
    expect(back.customers.at(-1)!.chargebackAt).toBe(s.hour + 1);
    const old = JSON.parse(serialize(s));
    delete old.reviewOrders;
    delete old.chargebackStrikes;
    delete old.screenOrders;
    delete old.screenChecks;
    expect(deserialize(JSON.stringify(old))).toMatchObject({ reviewOrders: false, screenOrders: false, screenChecks: 0, chargebackStrikes: 0 });
  });
});

describe("order screening", () => {
  it("needs the skill before it can be switched on", () => {
    const s = readyGame(1);
    expect(setScreenOrders(s, true)).toEqual({ ok: false, error: "error.needsResearch" });
    s.unlocks = [...s.unlocks, SCREENING_SKILL];
    expect(setScreenOrders(s, true).ok).toBe(true);
    expect(s.screenOrders).toBe(true);
  });

  it("declines most fraud and very few honest orders", () => {
    const s = readyGame(1);
    const keys = Array.from({ length: 2000 }, (_, i) => i);
    const caught = keys.filter((k) => failsScreen(s, k, true)).length / keys.length;
    const honest = keys.filter((k) => failsScreen(s, k, false)).length / keys.length;
    expect(caught).toBeGreaterThan(0.75);
    expect(caught).toBeLessThan(0.85);
    expect(honest).toBeGreaterThan(0.002);
    expect(honest).toBeLessThan(0.02);
  });

  it("counts every standard order and declines a failed one before it reaches Support", () => {
    const s = readyGame(2);
    s.unlocks = [...s.unlocks, SCREENING_SKILL];
    setScreenOrders(s, true);
    setReviewOrders(s, true);
    let declined = 0, passed = 0;
    for (let i = 0; i < 300; i++) {
      const r = orderLead(s, "private", "Frankfurt", [], vps, true);
      const fails = failsScreen(s, Number(r.id.slice(3)), !!r.fraud);
      expect(req(s, r.id).status === "declined").toBe(fails);
      expect(r.ticketId === null).toBe(fails);
      if (fails) declined++;
      else passed++;
    }
    expect(declined).toBeGreaterThan(0);
    expect(passed).toBeGreaterThan(0);
    expect(s.screenChecks).toBe(300);
    expect(stepMinutes("account", s, orderLead(s, "private", "Frankfurt", [], web, true))).toBe(stepMinutes("account"));
  });

  it("bills the checks on the first of the month", () => {
    const s = readyGame(3);
    s.screenChecks = 120;
    for (let i = 0; i < 800 && s.screenChecks; i++) tick(s);
    const e = s.ledger.find((x) => x.key === "ledger.screening")!;
    expect(e.params).toEqual({ count: 120 });
    expect(e.amount).toBe(-cents(120 * screenFee(yearOf(e.hour))));
    expect(screenFee(2026)).toBe(0.08);
    expect(screenFee(2008)).toBeCloseTo(0.145, 3);
  });
});
