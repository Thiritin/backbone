import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { bankById, monthlyFee, PREVIOUS_HOURS } from "../src/sim/10-catalog/banks";
import { COMPANY_LAW_SKILL } from "../src/sim/10-catalog/research";
import { billingTick, loanRate, type Invoice } from "../src/sim/45-billing/billing";
import { applyCard } from "../src/sim/90-actions/bank";
import { newGame, type GameState } from "../src/sim/50-state";
import { applyError, SHARE_CAPITAL } from "../src/sim/80-business/paperwork";
import { tick } from "../src/sim/88-tick/tick";
import { openBankAccount, setPlan, switchBank } from "../src/sim/90-actions/bank";
import { registerCompany } from "../src/sim/90-actions/company";
import { deserialize, serialize } from "../src/sim/91-save/save";

// Hour 56 is Monday 3 January 2005, 08:00.
const MONDAY_8 = 56;
const FEB = hourOf(new Date(Date.UTC(2005, 1, 1)));
const run = (s: GameState, until: number) => { while (s.hour < until) tick(s); };
const account = (bank = "sparklasse", plan?: string, form = "sole"): GameState => {
  const s = newGame(3);
  s.hour = MONDAY_8;
  expect(openBankAccount(s, bank as never, plan).ok).toBe(true);
  expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole", { street: "Kellerweg 1", zip: "60311", city: "Frankfurt" }).ok).toBe(true);
  s.registration!.form = form;
  tick(s);
  return s;
};
const book = (s: GameState, n: number) => {
  for (let i = 0; i < n; i++) s.ledger = [...s.ledger, { hour: s.hour, category: "sales", key: "ledger.usedSale", params: {}, amount: 10 }];
};
const feesAt = (s: GameState, hour: number) => s.ledger.filter((e) => e.hour === hour && e.category === "fees").map((e) => [e.key, e.amount, e.params.bank]);

describe("bank plans", () => {
  it("derives every plan from the bank's old fees", () => {
    const b = bankById("sparklasse")!;
    expect(b.plans.map((p) => [p.id, p.monthly, p.booking])).toEqual([["giro", 8, 0], ["business", 12, 0.3], ["businessPlus", 24, 0.1], ["premium", 48, 0]]);
    expect(monthlyFee(b, "business", "limited")).toBe(16);
    expect(bankById("deutscheBunk")!.plans.map((p) => p.id)).toEqual(["business", "businessPlus", "premium"]);
    expect(bankById("netbunk")!.plans.find((p) => p.id === "business")!.forms).not.toContain("limited");
    expect(bankById("fidorr")!.plans.map((p) => p.id)).toEqual(["business", "businessPlus"]);
  });

  it("charges a month's bookings above the plan's free ones", () => {
    const s = account("sparklasse", "business", "partnership");
    book(s, 30);
    const n = s.ledger.filter((e) => e.hour < FEB && e.amount !== 0 && e.category !== "fees").length;
    run(s, FEB + 1);
    expect(feesAt(s, FEB)).toEqual([["ledger.bookingFee", -Math.round((n - 20) * 30) / 100, "Sparklasse"], ["ledger.bankFee", -12, "Sparklasse"]]);

    const plus = account("sparklasse", "businessPlus", "partnership");
    book(plus, 30);
    run(plus, FEB + 1);
    expect(feesAt(plus, FEB)).toEqual([["ledger.bankFee", -24, "Sparklasse"]]);
  });

  it("skips the card fee on a plan with the card and doubles the limit on Premium", () => {
    const s = account("sparklasse", "businessPlus");
    expect(applyCard(s).ok).toBe(true);
    run(s, s.bank!.card!.readyAt + 1);
    expect(s.ledger.some((e) => e.key === "ledger.cardFee")).toBe(false);
    const premium = account("sparklasse", "business", "partnership"), business = account("sparklasse", "business", "partnership");
    premium.bank!.plan = "premium";
    for (const x of [premium, business]) { book(x, 50); applyCard(x); }
    expect(premium.bank!.card!.limit).toBeGreaterThanOrEqual(2 * business.bank!.card!.limit);
  });

  it("changes the plan on the first of the next month", () => {
    const s = account("sparklasse", "business", "partnership");
    expect(setPlan(s, "premium")).toEqual({ ok: true });
    expect(s.bank).toMatchObject({ plan: "business", planNext: "premium" });
    book(s, 30);
    run(s, FEB + 1);
    expect(s.bank!.plan).toBe("premium");
    expect(s.bank!.planNext).toBeUndefined();
    // January's bookings still pay under Business, February's fee is Premium's.
    expect(feesAt(s, FEB).map(([k, a]) => [k, a])).toEqual([["ledger.bookingFee", expect.any(Number)], ["ledger.bankFee", -48]]);
  });

  it("refuses a plan the company's form cannot use", () => {
    const s = account();
    expect(setPlan(s, "premium")).toEqual({ ok: false, error: "error.bankPlan" });
    expect(setPlan(s, "gold")).toEqual({ ok: false, error: "error.unknownPlan" });
    expect(openBankAccount(newGame(3), "sparklasse", "premium")).toEqual({ ok: false, error: "error.bankPlan" });
  });

  it("needs a plan for the form applied for and the share capital in the account", () => {
    const s = account();
    expect(applyError(s, "partnership")).toBe("error.bankPlan");
    setPlan(s, "business");
    expect(applyError(s, "partnership")).toBe("error.bankPlan");
    run(s, FEB + 1);
    expect(applyError(s, "partnership")).toBeNull();

    s.registration!.form = "partnership";
    s.unlocks = [...s.unlocks, COMPANY_LAW_SKILL];
    s.cash = SHARE_CAPITAL - 1;
    s.bank!.overdraft = 10_000;
    expect(applyError(s, "limited")).toBe("error.shareCapital");
    s.cash = SHARE_CAPITAL;
    expect(applyError(s, "limited")).toBeNull();

    const diba = account("netbunk", "business", "partnership");
    diba.unlocks = [...diba.unlocks, COMPANY_LAW_SKILL];
    diba.cash = SHARE_CAPITAL;
    expect(applyError(diba, "limited")).toBe("error.bankPlan");
  });
});

describe("switching banks", () => {
  it("moves the balance, leaves orders and mandates behind and pays the old account's last fee", () => {
    const s = account("sparklasse", "giro"), cash = s.cash;
    s.bank!.standingOrders = [{ id: "so1", name: "Landlord", account: "DE00", amount: 300, reference: "Rent", day: 3 }];
    s.bank!.mandates = ["Strom AG"];
    s.bank!.payees = [{ id: "pe1", name: "Landlord", account: "DE00" }];
    s.bank!.credit = 1.5;
    expect(switchBank(s, "volksbunk", "giro")).toEqual({ ok: true });
    expect(s.cash).toBe(cash + 1.5);
    expect(s.bank).toMatchObject({ id: "volksbunk", plan: "giro", standingOrders: [], mandates: [] });
    expect(s.bank!.payees).toEqual([{ id: "pe1", name: "Landlord", account: "DE00" }]);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.depositInterest", amount: 1.5, params: { bank: "Sparklasse" } });
    expect(s.bank!.previous).toMatchObject({ id: "sparklasse", closed: false, standingOrders: [{ name: "Landlord" }], mandates: ["Strom AG"] });
    run(s, FEB + 1);
    expect(feesAt(s, FEB)).toEqual([["ledger.bankFee", -6, "Folksbank"], ["ledger.bankFee", -8, "Sparklasse"]]);
    expect(s.bank!.previous!.closed).toBe(true);
  });

  it("refuses while a loan or the overdraft is open", () => {
    const s = account();
    s.loans = [{ id: "loan1", amount: 5000, rate: 0.05, months: 12, left: 12, payment: 430, balance: 5000, takenAt: s.hour, missed: 0 }];
    expect(switchBank(s, "volksbunk", "giro")).toEqual({ ok: false, error: "error.switchLoan" });
    s.loans = [];
    s.cash = -10;
    expect(switchBank(s, "volksbunk", "giro")).toEqual({ ok: false, error: "error.switchOverdraft" });
    s.cash = 100;
    expect(switchBank(s, "sparklasse", "giro")).toEqual({ ok: false, error: "error.hasBank" });
    expect(s.bank!.id).toBe("sparklasse");
  });

  it("forwards payments to the old account for three months, then bounces them", () => {
    const s = account();
    const inv = (id: string, payAt: number): Invoice => ({
      id, number: id, customerId: "c0", lines: [{ serviceId: null, key: "x", params: {}, amount: 100 }], issuedAt: s.hour, dueAt: s.hour + 336,
      status: "open", reminders: [], suspended: false, suspendedAt: null, payStep: 0, payAt, paidAt: null, bank: true, extendedUntil: null,
    });
    s.invoices = [inv("inv1", 0), inv("inv2", 0)];
    s.hour += 1;
    switchBank(s, "volksbunk", "giro");
    const at = s.hour;
    s.invoices = [{ ...s.invoices[0], payAt: at + 2 * 730 }, { ...s.invoices[1], payAt: at + 4 * 730 }];
    s.hour = at + 2 * 730;
    let cash = s.cash;
    billingTick(s);
    expect(s.cash).toBe(cash + 100);
    expect(s.transfers.some((t) => t.forInvoice === "inv1")).toBe(true);
    s.hour = at + 4 * 730;
    expect(s.hour).toBeGreaterThan(at + PREVIOUS_HOURS);
    cash = s.cash;
    billingTick(s);
    expect(s.cash).toBe(cash);
    expect(s.transfers.some((t) => t.forInvoice === "inv2")).toBe(false);
    expect(s.invoices.find((i) => i.id === "inv2")).toMatchObject({ payAt: null, paidAt: null });
  });
});

describe("loan rates by bank", () => {
  it("adds the bank's margin", () => {
    const s = account();
    const base = loanRate(s, "deutscheBunk");
    expect(loanRate(s)).toBeCloseTo(base + 0.005, 10);
    expect(loanRate(s, "fidorr")).toBeCloseTo(base + 0.02, 10);
  });
});

describe("old saves", () => {
  const load = (s: GameState) => {
    const data = JSON.parse(serialize(s));
    delete data.bank.plan;
    return deserialize(JSON.stringify(data));
  };

  it("give an account without a plan its bank's cheapest plan for the form", () => {
    expect(load(account("sparklasse")).bank!.plan).toBe("giro");
    expect(load(account("sparklasse", "business", "partnership")).bank!.plan).toBe("business");
    expect(load(account("deutscheBunk")).bank!.plan).toBe("business");
    expect(load(account("netbunk", "business", "limited")).bank!.plan).toBe("business");
  });
});
