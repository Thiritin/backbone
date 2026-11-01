import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { inbox } from "../src/sim/40-support/letters";
import { profitOf } from "../src/sim/46-finance/finance";
import { newGame, type GameState, type LedgerEntry } from "../src/sim/50-state";
import { ESTIMATE, smallLimit, taxNumberOf, vatBetween, vatPeriod, vatRate } from "../src/sim/80-business/tax";
import { tick } from "../src/sim/88-tick/tick";
import { openBankAccount } from "../src/sim/90-actions/bank";
import { registerCompany } from "../src/sim/90-actions/company";
import { fileReturn, leaveSmallRule } from "../src/sim/90-actions/tax";
import { deserialize, serialize } from "../src/sim/91-save/save";

const at = (y: number, m: number, d = 1, h = 0) => hourOf(new Date(Date.UTC(y, m - 1, d, h)));
const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
const runTo = (s: GameState, hour: number) => run(s, hour - s.hour);
const entry = (hour: number, category: string, amount: number): LedgerEntry => ({ hour, category, key: "ledger.test", params: {}, amount });
// Registered on Monday 3 January 2005 with the standard rule and the tax number in hand.
function company(small = false): GameState {
  const s = newGame(7);
  s.hour = at(2005, 1, 3, 8);
  expect(openBankAccount(s, "sparklasse").ok).toBe(true);
  expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole").ok).toBe(true);
  run(s, 1);
  // The DOHLE certificate on the desktop.
  s.docs = [...s.docs, { id: "cert1", kind: "cert", title: "dohle-zertifikat.pfx", body: "", x: 0, y: 0 }];
  s.tax = { ...s.tax, answered: s.hour, small, number: taxNumberOf(7), numberAt: s.hour, cert: "cert1" };
  s.cash = 50_000;
  return s;
}
const vatReturns = (s: GameState) => s.tax.returns.filter((r) => r.kind === "vat");
const letters = (s: GameState, topic: string) => inbox(s).filter((l) => l.topic === topic);
const vatBooked = (s: GameState) => s.ledger.filter((e) => e.category === "vat").reduce((n, e) => n + e.amount, 0);

describe("VAT", () => {
  it("uses 16% to 2006, 19% from 2007 and 16% in the second half of 2020", () => {
    expect(vatRate(at(2006, 12, 31))).toBe(0.16);
    expect(vatRate(at(2007, 1, 1))).toBe(0.19);
    expect(vatRate(at(2020, 6, 30))).toBe(0.19);
    expect(vatRate(at(2020, 7, 1))).toBe(0.16);
    expect(vatRate(at(2021, 1, 1))).toBe(0.19);
    expect([smallLimit(2019), smallLimit(2020), smallLimit(2024), smallLimit(2025)]).toEqual([17_500, 22_000, 22_000, 25_000]);
  });

  it("takes output VAT from gross sales and input VAT from purchases, never from salaries", () => {
    const s = company();
    const h = at(2005, 2, 10);
    s.ledger = [entry(h, "payments", 116), entry(h, "setup", 58), entry(h, "hardware", -232), entry(h, "salaries", -1000), entry(h, "insurance", -50)];
    expect(vatBetween(s, at(2005, 2), at(2005, 3))).toEqual({ output: 24, input: 32, payable: -8 });
  });

  it("opens a monthly return due on the 10th, files it and books the payable", () => {
    const s = company();
    runTo(s, at(2005, 2, 1) - 1);
    s.ledger = [...s.ledger, entry(at(2005, 1, 20), "payments", 1160)];
    run(s, 2);
    const r = vatReturns(s)[0];
    expect(r).toMatchObject({ from: at(2005, 1), to: at(2005, 2), dueAt: at(2005, 2, 11), filedAt: null });
    expect(fileReturn(s, r.id).ok).toBe(true);
    expect(fileReturn(s, r.id)).toEqual({ ok: false, error: "error.taxReturnFiled" });
    expect(vatBooked(s)).toBe(-160);
    expect(profitOf(s.ledger.at(-1)!)).toBe(-160);
  });

  it("refunds input VAT that is larger than output VAT", () => {
    const s = company();
    runTo(s, at(2005, 2, 1) - 1);
    s.ledger = [...s.ledger, entry(at(2005, 1, 20), "hardware", -2320)];
    run(s, 2);
    const cash = s.cash;
    expect(fileReturn(s, vatReturns(s)[0].id).ok).toBe(true);
    expect(s.cash).toBe(cash + 320);
  });

  it("refuses filing without a tax number", () => {
    const s = company();
    s.tax = { ...s.tax, numberAt: null };
    runTo(s, at(2005, 2, 1) + 1);
    expect(fileReturn(s, vatReturns(s)[0].id)).toEqual({ ok: false, error: "error.taxNumber" });
  });

  it("sends a surcharge after the due date and an estimate a month later, which a late filing replaces", () => {
    const s = company();
    runTo(s, at(2005, 2, 1) - 1);
    s.ledger = [...s.ledger, entry(at(2005, 1, 20), "payments", 11_600)];
    runTo(s, at(2005, 2, 16));
    const fee = letters(s, "taxSurcharge")[0];
    expect(fee.params.amount).toBe(80);
    expect(s.payables.find((p) => p.id === fee.payable)!.supplier).toBe("tax");
    runTo(s, at(2005, 3, 16));
    const est = letters(s, "vatEstimate")[0];
    expect(est.params.amount).toBe(1600 * ESTIMATE.factor);
    expect(fileReturn(s, vatReturns(s)[0].id).ok).toBe(true);
    // The unpaid estimate is withdrawn and the real payable booked.
    expect(s.payables.some((p) => p.id === est.payable)).toBe(false);
    expect(vatBooked(s)).toBe(-1600);
  });

  it("estimates at least the minimum and settles the difference after a paid estimate", () => {
    const s = company();
    runTo(s, at(2005, 3, 16));
    const est = letters(s, "vatEstimate")[0];
    expect(est.params.amount).toBe(ESTIMATE.min);
    const p = s.payables.find((x) => x.id === est.payable)!;
    s.payables = s.payables.map((x) => (x.id === p.id ? { ...x, sent: p.amount, paidAt: s.hour } : x));
    s.ledger = [...s.ledger, ...p.lines];
    expect(fileReturn(s, vatReturns(s)[0].id).ok).toBe(true);
    expect(vatBooked(s)).toBe(0);
  });

  it("files nothing for a small business and ends the rule above the limit", () => {
    const s = company(true);
    runTo(s, at(2005, 3, 1) + 1);
    expect(vatReturns(s)).toEqual([]);
    s.ledger = [...s.ledger, entry(at(2005, 6, 1), "payments", smallLimit(2006) + 1)];
    runTo(s, at(2006, 1, 3, 12));
    expect(s.tax.small).toBe(false);
    expect(letters(s, "taxSmallEnd")).toHaveLength(1);
    expect(vatPeriod(s, 2006)).toBe("month");
  });

  it("files quarterly or only yearly from the third year by last year's VAT", () => {
    const s = company();
    s.tax = { ...s.tax, since: 2003 };
    s.hour = at(2004, 6, 1);
    s.ledger = [entry(at(2004, 6, 1), "payments", 4000)];
    expect(vatPeriod(s, 2005)).toBe("quarter");
    s.ledger = [entry(at(2004, 6, 1), "payments", 1000)];
    expect(vatPeriod(s, 2005)).toBe("year");
    s.ledger = [entry(at(2004, 6, 1), "payments", 50_000)];
    expect(vatPeriod(s, 2005)).toBe("month");
  });

  it("opens one return per quarter on a quarterly period", () => {
    const s = company();
    s.tax = { ...s.tax, since: 2002 };
    s.ledger = [entry(at(2004, 6, 1), "payments", 4000)];
    runTo(s, at(2005, 4, 1) + 1);
    expect(vatReturns(s).map((r) => [r.from, r.to])).toEqual([[at(2005, 1), at(2005, 4)]]);
  });

  it("keeps the returns through a save", () => {
    const s = company();
    runTo(s, at(2005, 2, 1) + 1);
    expect(deserialize(serialize(s)).tax.returns).toEqual(s.tax.returns);
  });

  it("leaves the small business rule early and files from the next month", () => {
    const s = company(true);
    expect(leaveSmallRule(s).ok).toBe(true);
    expect(leaveSmallRule(s)).toEqual({ ok: false, error: "error.taxNotSmall" });
    runTo(s, at(2005, 2, 1) + 1);
    expect(vatReturns(s)).toHaveLength(1);
  });
});
