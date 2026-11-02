import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { TAX_RATE } from "../src/sim/10-catalog/economy";
import { inbox, postDay } from "../src/sim/40-support/letters";
import { taxFor } from "../src/sim/46-finance/finance";
import { newGame, type GameState, type LedgerEntry } from "../src/sim/50-state";
import { ASSESS_DAYS, LATE_FEE, monthsLate, taxNumberOf, YEAR_ESTIMATE, yearDue } from "../src/sim/80-business/tax";
import { tick } from "../src/sim/88-tick/tick";
import { openBankAccount } from "../src/sim/90-actions/bank";
import { registerCompany } from "../src/sim/90-actions/company";
import { fileReturn } from "../src/sim/90-actions/tax";
import { OpenReturns } from "../src/ui/apps/dohle/OpenReturns";

const at = (y: number, m: number, d = 1, h = 0) => hourOf(new Date(Date.UTC(y, m - 1, d, h)));
// Jumps to an hour and ticks through it.
const jump = (s: GameState, hour: number, hours = 1) => { s.hour = hour - 1; for (let i = 0; i < hours; i++) tick(s); };
const entry = (hour: number, category: string, amount: number): LedgerEntry => ({ hour, category, key: "ledger.test", params: {}, amount });
function company(small = false): GameState {
  const s = newGame(7);
  s.hour = at(2005, 1, 3, 8);
  expect(openBankAccount(s, "sparklasse").ok).toBe(true);
  expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole").ok).toBe(true);
  tick(s);
  s.docs = [...s.docs, { id: "cert1", kind: "cert", title: "dohle-zertifikat.pfx", body: "", x: 0, y: 0 }];
  s.tax = { ...s.tax, answered: s.hour, small, number: taxNumberOf(7), numberAt: s.hour, cert: "cert1" };
  s.cash = 100_000;
  return s;
}
const year = (s: GameState, y: number) => s.tax.returns.find((r) => r.kind === "year" && r.year === y)!;
const letter = (s: GameState, topic: string) => inbox(s).filter((l) => l.topic === topic).at(-1);
const taxBooked = (s: GameState) => s.ledger.filter((e) => e.category === "tax").reduce((n, e) => n + e.amount, 0);

describe("yearly return", () => {
  it("is due 31 May of the next year, 31 July from the year 2018", () => {
    expect(yearDue(2005)).toBe(at(2006, 6, 1));
    expect(yearDue(2018)).toBe(at(2019, 8, 1));
  });

  it("opens on 1 January and is reminded in March", () => {
    const s = company();
    jump(s, at(2006, 1, 1));
    expect(year(s, 2005)).toMatchObject({ from: at(2005, 1), to: at(2006, 1), dueAt: at(2006, 6, 1), filedAt: null });
    jump(s, at(2006, 3, 1), 48);
    expect(letter(s, "taxReminder")!.params.year).toBe(2005);
  });

  it("assesses the tax ten working days after filing with a bill due in 30 days", () => {
    const s = company(true);
    s.ledger = [...s.ledger, entry(at(2005, 6, 1), "payments", 20_000)];
    jump(s, at(2006, 1, 1));
    jump(s, at(2006, 4, 3, 9));
    const { tax, profit } = taxFor(s, 2005);
    expect(tax).toBeCloseTo(profit * TAX_RATE, 1);
    expect(fileReturn(s, year(s, 2005).id).ok).toBe(true);
    expect(fileReturn(s, year(s, 2005).id)).toEqual({ ok: false, error: "error.taxReturnFiled" });
    const l = s.letters.find((x) => x.topic === "taxAssessment")!;
    expect(l.at).toBe(postDay(s.hour, ASSESS_DAYS));
    expect(l.bill!.days).toBe(30);
    expect(-l.bill!.lines.reduce((n, e) => n + e.amount, 0)).toBeCloseTo(tax, 2);
  });

  it("carries a loss forward and offsets it against the next year's profit", () => {
    const s = company(true);
    s.ledger = [...s.ledger, entry(at(2005, 6, 1), "hardware", -3_000), entry(at(2006, 6, 1), "payments", 5_000)];
    jump(s, at(2006, 1, 1));
    jump(s, at(2006, 3, 7, 9));
    const loss = -taxFor(s, 2005).profit;
    expect(fileReturn(s, year(s, 2005).id).ok).toBe(true);
    expect(s.taxLoss).toBeCloseTo(loss, 2);
    expect(s.letters.find((x) => x.topic === "taxAssessment")!.bill).toBeUndefined();
    jump(s, at(2007, 1, 1));
    jump(s, at(2007, 2, 5, 9));
    const next = taxFor(s, 2006);
    expect(next.tax).toBeCloseTo((next.profit - loss) * TAX_RATE, 1);
    expect(fileReturn(s, year(s, 2006).id).ok).toBe(true);
    expect(s.taxLoss).toBe(0);
  });

  it("settles the year's open advance VAT returns with the yearly return", () => {
    const s = company();
    s.ledger = [...s.ledger, entry(at(2005, 11, 10), "payments", 1_160)];
    jump(s, at(2005, 12, 1));
    jump(s, at(2006, 1, 1));
    const open = s.tax.returns.filter((r) => r.kind === "vat" && r.year === 2005 && r.filedAt === null);
    expect(open.length).toBeGreaterThan(0);
    expect(fileReturn(s, year(s, 2005).id).ok).toBe(true);
    expect(s.tax.returns.filter((r) => r.kind === "vat" && r.year === 2005 && r.filedAt === null)).toEqual([]);
  });

  it("charges the late fee for each month started", () => {
    const s = company(true);
    s.ledger = [...s.ledger, entry(at(2005, 6, 1), "payments", 50_000)];
    jump(s, at(2006, 1, 1));
    jump(s, at(2006, 7, 20, 9));
    expect(monthsLate(yearDue(2005), s.hour)).toBe(2);
    const tax = taxFor(s, 2005).tax;
    expect(fileReturn(s, year(s, 2005).id).ok).toBe(true);
    const lines = s.letters.find((x) => x.topic === "taxAssessment")!.bill!.lines;
    expect(lines.find((e) => e.key === "ledger.taxLate")!.amount).toBeCloseTo(-2 * Math.max(LATE_FEE.min, LATE_FEE.share * tax), 2);
  });

  it("estimates 1.3 times the tax two months late, and a filing replaces a paid estimate", () => {
    const s = company(true);
    s.ledger = [...s.ledger, entry(at(2005, 6, 1), "payments", 20_000)];
    jump(s, at(2006, 1, 1));
    jump(s, at(2006, 8, 1), 72);
    const est = letter(s, "taxEstimate")!;
    const tax = taxFor(s, 2005).tax;
    expect(est.params.amount).toBeCloseTo(YEAR_ESTIMATE.factor * tax, 1);
    const p = s.payables.find((x) => x.id === est.payable)!;
    s.payables = s.payables.map((x) => (x.id === p.id ? { ...x, sent: p.amount, paidAt: s.hour } : x));
    s.ledger = [...s.ledger, ...p.lines];
    expect(fileReturn(s, year(s, 2005).id).ok).toBe(true);
    // The estimate overpaid the tax plus the fee, so the difference comes back at once.
    expect(s.letters.find((x) => x.topic === "taxAssessment")!.bill).toBeUndefined();
    const fee = 3 * Math.max(LATE_FEE.min, LATE_FEE.share * tax);
    expect(taxBooked(s)).toBeCloseTo(-(tax + fee), 1);
  });

  it("withdraws an unpaid estimate and refuses filing once the following year has ended", () => {
    const s = company(true);
    s.ledger = [...s.ledger, entry(at(2005, 6, 1), "payments", 20_000)];
    jump(s, at(2006, 1, 1));
    jump(s, at(2006, 8, 1), 72);
    const est = letter(s, "taxEstimate")!;
    expect(fileReturn(s, year(s, 2005).id).ok).toBe(true);
    expect(s.payables.some((x) => x.id === est.payable)).toBe(false);

    const t = company(true);
    jump(t, at(2006, 1, 1));
    jump(t, at(2007, 1, 1));
    expect(fileReturn(t, year(t, 2005).id)).toEqual({ ok: false, error: "error.taxYearClosed" });
    expect(t.letters.find((l) => l.topic === "taxEstimate")!.bill!.lines[0].amount).toBe(-YEAR_ESTIMATE.min);
  });

  it("lists the open yearly return with its tax in Books", () => {
    const s = company(true);
    s.ledger = [...s.ledger, entry(at(2005, 6, 1), "payments", 20_000)];
    jump(s, at(2006, 1, 1));
    const html = renderToString(createElement(OpenReturns, { game: s }));
    expect(html).toContain("Yearly return");
    expect(html).toContain("2005");
  });
});
