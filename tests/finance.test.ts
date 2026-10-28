import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { hardwarePremium, INSOLVENT_DAYS, nextTax, profitBetween, yearStart } from "../src/sim/46-finance/finance";
import { newGame, type GameState, type LedgerEntry } from "../src/sim/50-state";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { buyInsurance, cancelInsurance } from "../src/sim/90-actions/finance";
import { buyDevice, replaceComponent, type ActionResult } from "../src/sim/90-actions/hardware";
import { deserialize } from "../src/sim/91-save/save";

const at = (y: number, m: number, d: number) => hourOf(new Date(Date.UTC(y, m - 1, d)));
const entry = (hour: number, category: string, amount: number, key = "ledger.x", params: LedgerEntry["params"] = {}): LedgerEntry => ({ hour, category, key, params, amount });
const ok = (r: ActionResult) => { expect(r).toMatchObject({ ok: true }); return (r as { id?: string }).id!; };
// Ticks from the hour before `hour` up to it, collecting events.
const tickInto = (s: GameState, hour: number): SimEvent[] => { s.hour = hour - 1; return tick(s); };
const runFor = (s: GameState, hours: number): SimEvent[] => Array.from({ length: hours }, () => tick(s)).flat();

describe("corporate tax", () => {
  it("takes 30% of last year's profit on April 1, counting loan interest and leaving principal out", () => {
    const s = newGame(11);
    const h = at(2005, 6, 1);
    s.ledger = [
      entry(h, "payments", 10_000), entry(h, "hardware", -2_000), entry(h, "loans", 5_000, "ledger.loanTaken"),
      entry(h, "loans", -500, "ledger.loanRepayment", { amount: 5_000, interest: 50 }), entry(at(2006, 2, 1), "payments", 999),
    ];
    expect(profitBetween(s, yearStart(2005), yearStart(2006))).toBe(7_950);
    const cash = s.cash;
    const events = tickInto(s, at(2006, 4, 1));
    expect(s.ledger.find((e) => e.category === "tax")).toMatchObject({ key: "ledger.tax", params: { year: 2005 }, amount: -2_385 });
    expect(events).toContainEqual({ app: "Finance", key: "event.tax", params: { year: 2005, tax: 2_385, profit: 7_950 } });
    expect(s.cash).toBeLessThan(cash - 2_385 + 1);
  });

  it("carries a loss forward and offsets it against the next year's profit", () => {
    const s = newGame(12);
    s.ledger = [entry(at(2005, 6, 1), "hardware", -3_000), entry(at(2006, 6, 1), "payments", 5_000)];
    const loss = tickInto(s, at(2006, 4, 1));
    expect(loss).toContainEqual({ app: "Finance", key: "event.taxLoss", params: { year: 2005, carry: 3_000 } });
    expect(s.taxLoss).toBe(3_000);
    expect(s.ledger.some((e) => e.category === "tax")).toBe(false);
    s.hour = at(2007, 1, 15);
    // The power of the one hour ticked in April 2006 lowers that year's profit by a cent.
    const next = nextTax(s);
    expect(next).toMatchObject({ year: 2006, dueAt: at(2007, 4, 1) });
    expect(next.tax).toBeCloseTo(600, 1);
    tickInto(s, at(2007, 4, 1));
    expect(s.ledger.find((e) => e.category === "tax")?.amount).toBe(-next.tax);
    expect(s.taxLoss).toBe(0);
  });
});

describe("hardware insurance", () => {
  it("charges a premium on purchase and each month, and pays the part of a component that fails while insured", () => {
    const s = newGame(13);
    s.cash = 5_000;
    const premium = hardwarePremium(s);
    expect(premium).toBeGreaterThan(0);
    ok(buyInsurance(s));
    expect(s.ledger.at(-1)).toMatchObject({ category: "insurance", amount: -premium });
    expect(buyInsurance(s)).toEqual({ ok: false, error: "error.insured" });
    ok(buyDevice(s, "part-fan", "Generic", 1, "loc1"));
    runFor(s, 2);
    const fan = s.devices.find((d) => d.id === "dev3")!.components.find((c) => c.kind === "fan")!;
    fan.failedAt = s.hour;
    const before = s.cash;
    ok(replaceComponent(s, "dev3", fan.id));
    expect(s.ledger.at(-1)).toMatchObject({ category: "insurance", key: "ledger.insuranceClaim", params: { component: "fan" }, amount: 25 });
    expect(s.cash).toBe(before + 25);
    tickInto(s, at(2005, 2, 1));
    expect(s.ledger.filter((e) => e.key === "ledger.insurancePremium")).toHaveLength(2);
  });

  it("pays nothing for a failure from before the policy or after it is cancelled", () => {
    const s = newGame(14);
    s.cash = 5_000;
    ok(buyDevice(s, "part-fan", "Generic", 1, "loc1"));
    ok(buyDevice(s, "part-fan", "Generic", 1, "loc1"));
    runFor(s, 2);
    const fans = s.devices.find((d) => d.id === "dev3")!.components.filter((c) => c.kind === "fan");
    fans[0].failedAt = s.hour;
    s.hour++;
    ok(buyInsurance(s));
    ok(replaceComponent(s, "dev3", fans[0].id));
    expect(s.ledger.some((e) => e.key === "ledger.insuranceClaim")).toBe(false);
    ok(cancelInsurance(s));
    fans[1].failedAt = s.hour;
    runFor(s, 1);
    ok(replaceComponent(s, "dev3", fans[1].id));
    expect(s.ledger.some((e) => e.key === "ledger.insuranceClaim")).toBe(false);
    expect(cancelInsurance(s)).toEqual({ ok: false, error: "error.notInsured" });
  });
});

describe("bankruptcy", () => {
  it("ends the game after 30 days below zero when the bank lends nothing", () => {
    const s = newGame(15);
    s.cash = -50_000;
    s.loansBlockedUntil = at(2010, 1, 1);
    const events = runFor(s, INSOLVENT_DAYS * 24);
    expect(events.filter((e) => e.key === "event.cashNegative")).toHaveLength(1);
    expect(s.gameOver).toBe(null);
    expect(runFor(s, 1)).toContainEqual({ app: "Finance", key: "event.bankrupt", params: { days: INSOLVENT_DAYS } });
    expect(s.gameOver).toBe(s.hour);
  });

  it("keeps going while a loan could cover the deficit, and resets once cash is back above zero", () => {
    const s = newGame(16);
    s.cash = -100;
    runFor(s, (INSOLVENT_DAYS + 2) * 24);
    expect(s.gameOver).toBe(null);
    s.loansBlockedUntil = at(2010, 1, 1);
    s.cash = 100;
    runFor(s, 1);
    expect(s.brokeSince).toBe(null);
    s.cash = -100;
    runFor(s, (INSOLVENT_DAYS - 1) * 24);
    expect(s.gameOver).toBe(null);
  });

  it("loads an old save without finance fields", () => {
    const old = { ...newGame(17) } as Partial<GameState>;
    delete old.taxLoss; delete old.insurance; delete old.brokeSince; delete old.gameOver;
    expect(deserialize(JSON.stringify(old))).toMatchObject({ taxLoss: 0, insurance: [], brokeSince: null, gameOver: null });
  });
});
