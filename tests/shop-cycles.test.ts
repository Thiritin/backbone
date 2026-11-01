import { describe, expect, it } from "vitest";
import { CYCLE_MONTHS } from "../src/sim/10-catalog/cycles";
import { SHOPS } from "../src/sim/10-catalog/shops";
import { isMonthStart } from "../src/sim/00-core/time";
import { cycleWeights, shopPriceLevel } from "../src/sim/30-market/cycles";
import { orderLead } from "../src/sim/30-market/orders";
import { share } from "../src/sim/30-market/market";
import { refundUnused, termRoll } from "../src/sim/40-support/terms";
import { tick } from "../src/sim/88-tick/tick";
import type { GameState } from "../src/sim/50-state";
import { automate, readyGame, openShop } from "./fixtures";

const web = { product: "webHosting" as const, size: 1, sla: "basic" as const };

// A shop that almost always draws the annual cycle.
const annualGame = (seed = 3): GameState => {
  const s = automate(readyGame(seed));
  s.cash = 1e6;
  openShop(s);
  s.shop.optionDiscount = { annual: 0.9 };
  return s;
};
const place = (s: GameState) => {
  const r = orderLead(s, "private", "Frankfurt", [], web, false);
  const req = s.sales.requests.find((x) => x.id === r.id)!;
  return { req, svc: s.services.find((v) => v.id === req.serviceId)! };
};
const toMonthStart = (s: GameState) => { do tick(s); while (!isMonthStart(s.hour)); };

describe("billing cycles", () => {
  it("are supported per shop variant", () => {
    const of = (id: string) => SHOPS.find((v) => v.id === id)!.cycles;
    expect(of("modemBill")).toEqual(["monthly", "quarterly", "annual"]);
    expect(of("orderBocks")).toEqual(["monthly", "annual", "biennial"]);
    expect(of("whmCache")).toHaveLength(4);
  });

  it("weigh cycles at the base shares at the market discount and shift with exp(8 * gap)", () => {
    const s = annualGame();
    s.shop.optionDiscount = {};
    const ratio = () => { const w = new Map(cycleWeights(s, "private", ["monthly", "annual"])); return w.get("annual")! / w.get("monthly")!; };
    expect(ratio()).toBeCloseTo(0.11 / 0.78, 9);
    s.shop.optionDiscount = { annual: 0.2 };
    expect(ratio()).toBeCloseTo((0.11 / 0.78) * Math.exp(0.8), 9);
    s.shop.optionDiscount = { annual: 0 };
    expect(ratio()).toBeCloseTo((0.11 / 0.78) * Math.exp(-0.8), 9);
  });

  it("bill an annual order as one prepaid invoice with no arrears in the term", () => {
    const s = annualGame();
    const { req, svc } = place(s);
    expect(req.cycle).toBe("annual");
    expect(svc).toMatchObject({ cycle: "annual", commitMonths: 12, termEnd: s.hour + 8760, prepaidUntil: s.hour + 8760 });
    const inv = s.invoices.find((i) => i.customerId === req.customerId)!;
    const line = inv.lines.find((l) => l.key === "invoice.line.firstTerm")!;
    expect(line.amount).toBeCloseTo(req.quote! * 12, 1);
    expect(line.params.months).toBe(12);
    toMonthStart(s);
    expect(s.invoices.flatMap((i) => i.lines).some((l) => l.key === "invoice.line.hours" && l.serviceId === svc.id)).toBe(false);
  });

  it("send a renewal invoice before the term ends and extend the term when it is paid", () => {
    const s = annualGame();
    const { svc } = place(s);
    const end = s.hour + 100;
    s.services = s.services.map((v) => (v.id === svc.id ? { ...v, termEnd: end, prepaidUntil: end } : v));
    toMonthStart(s);
    const inv = s.invoices.find((i) => i.lines.some((l) => l.key === "invoice.line.renewal"))!;
    const line = inv.lines.find((l) => l.key === "invoice.line.renewal")!;
    expect(line.amount).toBeCloseTo(svc.price * 730 * 12, 1);
    inv.payAt = s.hour;
    tick(s);
    expect(s.services.find((v) => v.id === svc.id)).toMatchObject({ termEnd: end + 8760, prepaidUntil: end + 8760 });
  });

  it("skip the monthly churn roll inside a term and roll once, for all its months, as it ends", () => {
    const s = annualGame();
    const { req, svc } = place(s);
    const id = req.customerId!;
    expect(termRoll(s, id)).toEqual({ committed: true, months: 1 });
    s.services = s.services.map((v) => (v.id === svc.id ? { ...v, termEnd: s.hour + 300 } : v));
    expect(termRoll(s, id)).toEqual({ committed: false, months: CYCLE_MONTHS.annual });
    expect(termRoll(s, id)).toEqual({ committed: true, months: 1 });
    s.services = s.services.map((v) => (v.id === svc.id ? { ...v, termEnd: undefined, cycle: undefined } : v));
    expect(termRoll(s, id)).toEqual({ committed: false, months: 1 });
  });

  it("refund the unused whole months to a customer who leaves inside the term", () => {
    const s = annualGame();
    const { req, svc } = place(s);
    s.invoices = s.invoices.map((i) => ({ ...i, status: "paid" as const }));
    s.services = s.services.map((v) => (v.id === svc.id ? { ...v, termEnd: s.hour + 730 * 5 + 100 } : v));
    const cash = s.cash;
    refundUnused(s, s.customers.find((c) => c.id === req.customerId)!);
    expect(cash - s.cash).toBeCloseTo(5 * 730 * svc.price, 1);
    expect(s.ledger.at(-1)).toMatchObject({ category: "billing", key: "ledger.refundUnused", params: { months: 5 } });
  });

  it("move the advertised price level, and with it lead conversion, at once", () => {
    const s = annualGame();
    s.shop.optionDiscount = {};
    expect(shopPriceLevel(s, "private", "webHosting")).toBeCloseTo(1, 9);
    const at = (d: number) => { s.shop.optionDiscount = { annual: d }; const level = shopPriceLevel(s, "private", "webHosting"); return { level, share: share(s, "private", "webHosting", "Frankfurt", 0, level) }; };
    const cheap = at(0.3), dear = at(0.1);
    expect(cheap.level).toBeLessThan(dear.level);
    expect(cheap.share).toBeGreaterThan(dear.share);
  });
});
