import { describe, expect, it } from "vitest";
import { checkDone } from "../src/sim/checklist";
import { openAccount } from "../src/sim/46-finance/bank";
import { invoice, payablesTick } from "../src/sim/46-finance/payables";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame, type GameState } from "../src/sim/50-state";
import { confirmTransfer, startBatch } from "../src/sim/90-actions/bank";

const line = (amount: number) => [{ hour: 0, category: "power", key: "ledger.power", params: {}, amount: -amount }];
const banked = (): GameState => {
  const s = newGame(2);
  s.bank = { ...openAccount(s, "sparklasse"), welcomed: true };
  s.ledger = [{ hour: 0, category: "payments", key: "ledger.payment", params: {}, amount: 3000 }];
  s.cash = 20_000;
  return s;
};
const keysAt = (s: GameState, hour: number) => { s.hour = hour; return payablesTick(s).map((e) => e.key); };

describe("supplier bills", () => {
  it("warns once overdue and a week before the power is cut, then cuts", () => {
    const s = banked();
    const p = invoice(s, "power", "E.OFF", line(7));
    expect(keysAt(s, p.dueAt)).toEqual([]);
    expect(keysAt(s, p.dueAt + 1)).toEqual(["event.billThreat.dark"]);
    expect(keysAt(s, p.dueAt + 2)).toEqual([]);
    expect(keysAt(s, p.dueAt + 23 * 24)).toEqual(["event.billThreat.dark"]);
    expect(s.ops.dark.loc1 ?? 0).toBeLessThanOrEqual(s.hour);
    expect(keysAt(s, p.dueAt + 30 * 24)).toEqual(["event.billCut.dark"]);
    expect(s.ops.dark.loc1).toBeGreaterThan(s.hour);
  });

  it("still warns when the clock jumps over the warning hour, and across a save", () => {
    const s = banked();
    const p = invoice(s, "power", "E.OFF", line(7));
    expect(keysAt(s, p.dueAt + 100)).toEqual(["event.billThreat.dark"]);
    const back = deserialize(serialize(s));
    expect(keysAt(back, p.dueAt + 101)).toEqual([]);
    expect(keysAt(back, p.dueAt + 29 * 24)).toEqual(["event.billThreat.dark"]);
    expect(keysAt(back, p.dueAt + 29 * 24 + 1)).toEqual([]);
  });

  it("gives the first domain bill the same grace as power", () => {
    const s = banked();
    const p = invoice(s, "registrar", "NameCheep", line(2));
    s.domains = [{ name: "a.de", expiresAt: 99999 } as never];
    keysAt(s, p.dueAt + 29 * 24);
    expect(s.domains[0].expiresAt).toBe(99999);
    expect(keysAt(s, p.dueAt + 30 * 24)).toEqual(["event.billCut.domains"]);
  });

  it("keeps the pay bills step open while a supplier bill is open and ticks it once paid", () => {
    const s = banked();
    expect(checkDone(s, "payBills")).toBe(false);
    const p = invoice(s, "power", "E.OFF", line(7));
    expect(checkDone(s, "payBills")).toBe(false);
    expect(startBatch(s).ok).toBe(true);
    expect(confirmTransfer(s, s.bank!.tans.codes[s.bank!.pending!.index!]).ok).toBe(true);
    expect(s.payables.find((x) => x.id === p.id)!.sent).toBeGreaterThan(0);
    expect(checkDone(s, "payBills")).toBe(true);
  });

  it("pays every open bill in one batch with a single TAN", () => {
    const s = banked();
    const a = invoice(s, "power", "E.OFF", line(7)), b = invoice(s, "registrar", "NameCheep", line(2));
    expect(startBatch(s).ok).toBe(true);
    expect(s.bank!.pending!.batch).toHaveLength(2);
    expect(confirmTransfer(s, s.bank!.tans.codes[s.bank!.pending!.index!]).ok).toBe(true);
    expect(s.bank!.outgoing.map((o) => o.reference).sort()).toEqual([a.number, b.number].sort());
    expect(s.payables.every((p) => p.sent >= p.amount - 0.005)).toBe(true);
    expect(startBatch(s)).toEqual({ ok: false, error: "error.noOpenBills" });
  });

  it("refuses the whole batch when the money is short at start or at confirm", () => {
    const s = banked();
    invoice(s, "power", "E.OFF", line(7)); invoice(s, "registrar", "NameCheep", line(2));
    s.cash = 5;
    expect(startBatch(s)).toEqual({ ok: false, error: "error.noCash" });
    s.cash = 20_000;
    expect(startBatch(s).ok).toBe(true);
    s.cash = 5;
    expect(confirmTransfer(s, s.bank!.tans.codes[s.bank!.pending!.index!])).toEqual({ ok: false, error: "error.noCash" });
    expect(s.bank!.outgoing).toHaveLength(0);
    expect(s.payables.every((p) => p.sent === 0)).toBe(true);
  });
});
