import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { iban } from "../src/sim/46-finance/bank";
import { newGame, type GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { registerCompany } from "../src/sim/90-actions/company";
import { deserialize, serialize } from "../src/sim/91-save/save";

// Hour 0 is Saturday 1 January 2005, 00:00; Monday 08:00 is hour 56.
const MONDAY_8 = 56;
const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
export const opened = (seed = 1, bank: Parameters<typeof registerCompany>[4] = "sparklasse"): GameState => {
  const s = newGame(seed);
  s.hour = MONDAY_8;
  expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole", bank).ok).toBe(true);
  tick(s);
  return s;
};

describe("bank account", () => {
  it("opens at the bank the registration names, with a welcome email and the TAN list on the desktop", () => {
    const s = opened(1, "postbunk");
    expect(s.bank).toMatchObject({ id: "postbunk", tan: "itan", card: null, overdraft: 0 });
    expect(s.bank!.number).toMatch(/^\d{10}$/);
    const mail = s.tickets.find((t) => t.kind === "mail" && t.topic === "bankWelcome")!;
    expect(mail.mail!.params).toMatchObject({ number: s.bank!.number, pin: s.bank!.pin });
    const list = s.docs.find((d) => d.id === "tans")!;
    expect(list.body).toContain(`001  ${s.bank!.tans.codes[0]}`);
    expect(new Set(s.bank!.tans.codes).size).toBeGreaterThan(90);
  });

  it("refuses a bank that does not exist yet", () => {
    const s = newGame(1);
    s.hour = MONDAY_8;
    expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole", "quonto")).toEqual({ ok: false, error: "error.unknownBank" });
    expect(s.registration).toBeNull();
  });

  it("charges the account fee every month start", () => {
    const s = opened(1, "deutscheBunk");
    const cash = s.cash;
    run(s, hourOf(new Date(Date.UTC(2005, 1, 1))) - s.hour);
    expect(s.ledger.filter((e) => e.key === "ledger.bankFee")).toEqual([expect.objectContaining({ amount: -12, category: "fees" })]);
    expect(s.cash).toBeLessThanOrEqual(cash - 12);
  });

  it("gives an old save an account at Sparklasse that keeps paying its fee", () => {
    const old = JSON.parse(serialize(newGame(3)));
    delete old.bank;
    delete old.registration;
    const s = deserialize(JSON.stringify(old));
    expect(s.bank).toMatchObject({ id: "sparklasse", welcomed: false });
    run(s, hourOf(new Date(Date.UTC(2005, 1, 1))));
    expect(s.tickets.some((t) => t.topic === "bankWelcome")).toBe(true);
    expect(s.ledger.filter((e) => e.key === "ledger.bankFee").map((e) => e.amount)).toEqual([-8]);
  });

  it("computes valid German IBANs", () => {
    expect(iban("37040044", "532013000")).toBe("DE89370400440532013000");
  });
});
