import { describe, expect, it } from "vitest";
import { createRng } from "../src/sim/00-core/rng";
import { hourOf } from "../src/sim/00-core/time";
import { annuity, baseRate, invoiceTotal, isSuspended, PAY_ODDS, rollPayStep, YEAR_HOURS } from "../src/sim/45-billing/billing";
import { newGame, type GameState } from "../src/sim/50-state";
import { metrics } from "../src/sim/metrics";
import { tick } from "../src/sim/88-tick/tick";
import { repayLoan, sendReminder, suspendServices, takeLoan, writeOff } from "../src/sim/90-actions/billing";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { deserialize, serialize } from "../src/sim/91-save/save";

const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
const at = (y: number, m: number, d: number) => hourOf(new Date(Date.UTC(y, m - 1, d)));

// One customer with a yearly domain, invoiced on the first tick.
function withInvoice(payStep: number) {
  const s = newGame(3);
  const c = addCustomer(s, "Ada", "private");
  addService(s, c, "domain", "ada.example", 12, "year");
  tick(s);
  s.invoices[0].payStep = payStep;
  s.invoices[0].payAt = null;
  return { s, inv: () => s.invoices[0], c };
}

describe("invoices", () => {
  it("bills hourly services in arrears for the hours they ran", () => {
    const s = newGame(1);
    runTo(s, at(2005, 1, 10) + 12);
    addService(s, addCustomer(s, "Bob", "gamer"), "gameServer", "Bob's server", 0.01, "hour");
    runTo(s, at(2005, 2, 1));
    expect(s.invoices).toHaveLength(1);
    expect(s.invoices[0].lines).toEqual([{ serviceId: expect.any(String), key: "invoice.line.hours", params: { label: "Bob's server", hours: 516 }, amount: 5.16 }]);
    expect(s.invoices[0].dueAt).toBe(at(2005, 2, 15));
    runTo(s, at(2005, 3, 1));
    expect(s.invoices[1].lines[0].params.hours).toBe(28 * 24);
  });

  it("bills an ended service only for its hours", () => {
    const s = newGame(1);
    const v = addService(s, addCustomer(s, "Cy", "hobbyDev"), "vps", "cy-vps", 0.1, "hour");
    runTo(s, 100);
    s.services.find((x) => x.id === v)!.endedAt = 100;
    runTo(s, at(2005, 3, 1));
    expect(s.invoices.map((i) => invoiceTotal(i))).toEqual([10]);
  });

  it("bills yearly services in advance at start and on each anniversary", () => {
    const s = newGame(2);
    runTo(s, 100);
    addService(s, addCustomer(s, "Dee", "soleProp"), "ssl", "dee.example SSL", 30, "year");
    tick(s);
    expect(s.invoices).toHaveLength(1);
    expect(s.invoices[0].issuedAt).toBe(101);
    expect(invoiceTotal(s.invoices[0])).toBe(30);
    runTo(s, 100 + YEAR_HOURS - 1);
    expect(s.invoices).toHaveLength(1);
    tick(s);
    expect(s.invoices).toHaveLength(2);
  });
});

describe("payment habits", () => {
  for (const habit of ["prompt", "late", "bad"] as const) {
    it(`rolls the ${habit} odds`, () => {
      const r = createRng(42), n = 40_000, counts = [0, 0, 0, 0, 0];
      for (let i = 0; i < n; i++) counts[rollPayStep(r, habit)]++;
      counts.forEach((k, i) => expect(Math.abs(k / n - PAY_ODDS[habit][i])).toBeLessThan(0.01));
    });
  }

  it("pays an on-time invoice before the due date and books it", () => {
    const s = newGame(5);
    addService(s, addCustomer(s, "Eve", "office", "prompt"), "domain", "eve.example", 12, "year");
    tick(s);
    const inv = s.invoices[0];
    inv.payStep = 0;
    inv.payAt = inv.dueAt - 24;
    const cash = s.cash;
    runTo(s, inv.dueAt);
    expect(s.invoices[0].status).toBe("paid");
    expect(s.cash).toBe(cash + 12);
    expect(s.ledger.at(-1)).toMatchObject({ category: "payments", key: "ledger.payment", params: { customer: "Eve" }, amount: 12 });
  });
});

describe("dunning", () => {
  it("sends each step when it is due, adds fees and gets paid after the final notice", () => {
    const { s, inv } = withInvoice(3);
    const due = inv().dueAt;
    runTo(s, due);
    expect(inv().status).toBe("overdue");
    expect(sendReminder(s, inv().id)).toEqual({ ok: false, error: "error.stepNotDue" });
    runTo(s, due + 7 * 24);
    expect(sendReminder(s, inv().id).ok).toBe(true);
    runTo(s, due + 14 * 24);
    expect(sendReminder(s, inv().id).ok).toBe(true);
    expect(invoiceTotal(inv())).toBe(17);
    expect(inv().payAt).toBeNull();
    expect(suspendServices(s, inv().id).ok).toBe(true);
    expect(isSuspended(s, inv().customerId)).toBe(true);
    runTo(s, due + 28 * 24);
    expect(sendReminder(s, inv().id).ok).toBe(true);
    expect(inv().reminders).toHaveLength(3);
    expect(invoiceTotal(inv())).toBe(27);
    const cash = s.cash;
    runTo(s, inv().payAt!);
    expect(inv().status).toBe("paid");
    expect(s.cash).toBe(cash + 27);
    expect(isSuspended(s, inv().customerId)).toBe(false);
  });

  it("hands a never-paying debt to collections, which returns 30% and loses the customer", () => {
    const { s, inv, c } = withInvoice(4);
    const due = inv().dueAt;
    for (const d of [7, 14, 28, 42]) {
      runTo(s, due + d * 24);
      expect(sendReminder(s, inv().id).ok).toBe(true);
    }
    expect(inv().status).toBe("writtenOff");
    expect(s.customers.find((x) => x.id === c)!.churnedAt).toBe(s.hour);
    expect(s.services.every((v) => v.endedAt === s.hour)).toBe(true);
    runTo(s, s.hour + 30 * 24);
    expect(s.ledger.filter((e) => e.category === "payments")).toMatchObject([{ key: "ledger.collections", amount: 8.1 }]);
  });

  it("writes an invoice off so it is never paid", () => {
    const { s, inv } = withInvoice(0);
    inv().payAt = s.hour + 24;
    expect(writeOff(s, inv().id).ok).toBe(true);
    const cash = s.cash;
    runTo(s, s.hour + 48);
    expect(inv().status).toBe("writtenOff");
    expect(s.cash).toBe(cash);
    expect(sendReminder(s, inv().id)).toEqual({ ok: false, error: "error.invoiceSettled" });
  });
});

describe("bank", () => {
  it("amortizes a loan in equal monthly instalments", () => {
    const s = newGame(7);
    const netWorth = metrics(s).netWorth;
    expect(takeLoan(s, 25_000, 1)).toEqual({ ok: false, error: "error.loanLimit" });
    expect(takeLoan(s, 10_000, 1).ok).toBe(true);
    expect(metrics(s).netWorth).toBe(netWorth);
    const loan = s.loans[0];
    expect(loan.rate).toBeCloseTo(baseRate(2005) + 0.06);
    expect(loan.payment).toBe(annuity(10_000, 0.1, 12));
    expect(loan.payment).toBe(879.16);
    runTo(s, at(2006, 1, 1));
    const paid = s.ledger.filter((e) => e.key === "ledger.loanRepayment");
    expect(paid).toHaveLength(12);
    expect(s.loans).toHaveLength(0);
    expect(-paid.reduce((sum, e) => sum + e.amount, 0)).toBeCloseTo(10_549.9, 0);
  });

  it("penalizes missed instalments and calls the loan in after three", () => {
    const s = newGame(8);
    takeLoan(s, 10_000, 2);
    const rate = s.loans[0].rate;
    s.cash = 0;
    runTo(s, at(2005, 2, 1));
    expect(s.loans[0]).toMatchObject({ missed: 1, rate: rate + 0.02 });
    expect(s.cash).toBeLessThan(-100);
    expect(takeLoan(s, 5_000, 1)).toEqual({ ok: false, error: "error.loanBlocked" });
    runTo(s, at(2005, 4, 1));
    expect(s.loans).toHaveLength(0);
    expect(s.ledger.at(-1)!.key).toBe("ledger.loanCalled");
  });

  it("repays a loan early", () => {
    const s = newGame(9);
    const { id } = takeLoan(s, 5_000, 3) as { ok: true; id: string };
    expect(repayLoan(s, id).ok).toBe(true);
    expect(s.loans).toHaveLength(0);
    expect(s.cash).toBe(5000);
  });
});

describe("billing saves", () => {
  it("round-trips invoices and loans", () => {
    const s = newGame(11);
    const c = addCustomer(s, "Fay", "agency", "late");
    addService(s, c, "webHosting", "fay.example", 0.02, "hour");
    addService(s, c, "domain", "fay.example", 12, "year");
    takeLoan(s, 5_000, 1);
    runTo(s, at(2005, 3, 1));
    expect(s.invoices.length).toBeGreaterThan(1);
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it("fills billing defaults into an old save", () => {
    const old = JSON.parse(serialize(newGame(12)));
    for (const k of ["customers", "services", "invoices", "yearlyBilledUntil", "loans", "loansBlockedUntil"]) delete old[k];
    const s = deserialize(JSON.stringify(old));
    expect(s).toMatchObject({ customers: [], services: [], invoices: [], yearlyBilledUntil: {}, loans: [], loansBlockedUntil: 0 });
    runTo(s, at(2005, 2, 1));
    expect(s.invoices).toEqual([]);
  });
});
