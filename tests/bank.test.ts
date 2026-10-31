import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { iban, openAccount, type Draft } from "../src/sim/46-finance/bank";
import { buyCart, deliveryWait, PREPAY_HOURS, type CartLine } from "../src/sim/90-actions/hardware";
import { applyCard, applyOverdraft, deleteStandingOrder, startStandingOrder } from "../src/sim/90-actions/bank";
import { withServer } from "./fixtures";
import { resolve } from "../src/sim/80-business/browser";
import { tickMinute } from "../src/sim/88-tick/tick";
import { cancelTransfer, confirmTransfer, setTanMethod, startTransfer } from "../src/sim/90-actions/bank";
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

const payee: Draft = { name: "Hans Wurst", account: "1234567", code: "37040044", amount: 49.9, reference: "Rechnung 17" };

describe("bank site and TANs", () => {
  it("serves the bank's site in the Browser", () => {
    const s = opened();
    expect(resolve(s, "www.sparklasse.de/banking/transfer").page).toEqual({ kind: "bank", id: "sparklasse" });
    expect(resolve(s, "quonto.eu").page.kind).toBe("notfound");
  });

  it("asks for a numbered iTAN, refuses a wrong one and sends with the right one", () => {
    const s = opened();
    expect(startTransfer(s, payee).ok).toBe(true);
    const index = s.bank!.pending!.index!;
    expect(confirmTransfer(s, "000000")).toEqual({ ok: false, error: "error.wrongTan" });
    const cash = s.cash;
    expect(confirmTransfer(s, s.bank!.tans.codes[index]).ok).toBe(true);
    expect(s.cash).toBeCloseTo(cash - 49.9, 2);
    expect(s.bank!.tans.used).toEqual([index]);
    expect(s.bank!.outgoing[0]).toMatchObject({ name: "Hans Wurst", arriveAt: s.hour + 24 });
    expect(s.docs.find((d) => d.id === "tans")!.body).toContain(`${String(index + 1).padStart(3, "0")}  ------`);
    // A used TAN is never asked for again.
    startTransfer(s, payee);
    expect(s.bank!.pending!.index).not.toBe(index);
  });

  it("locks online banking for a day after three wrong TANs", () => {
    const s = opened();
    startTransfer(s, payee);
    confirmTransfer(s, "1");
    confirmTransfer(s, "2");
    expect(confirmTransfer(s, "3")).toEqual({ ok: false, error: "error.bankLocked" });
    expect(s.bank!.pending).toBeNull();
    expect(startTransfer(s, payee)).toEqual({ ok: false, error: "error.bankLocked" });
    run(s, 24);
    expect(startTransfer(s, payee).ok).toBe(true);
  });

  it("texts the mTAN a minute later and takes a confirm click for pushTAN", () => {
    const s = opened(1, "sparklasse");
    s.hour = hourOf(new Date(Date.UTC(2010, 2, 1, 9)));
    expect(setTanMethod(s, "mtan").ok).toBe(true);
    expect(s.docs.some((d) => d.id === "tans")).toBe(false);
    const sepa = { ...payee, account: "DE89 3704 0044 0532 0130 00", code: undefined };
    expect(startTransfer(s, sepa).ok).toBe(true);
    expect(s.tickets.some((t) => t.topic === "bankMtan")).toBe(false);
    tickMinute(s);
    const mail = s.tickets.find((t) => t.topic === "bankMtan")!;
    expect(confirmTransfer(s, String(mail.mail!.params.code)).ok).toBe(true);
    expect(setTanMethod(s, "push")).toEqual({ ok: false, error: "error.tanMethod" });
    s.hour = hourOf(new Date(Date.UTC(2014, 2, 1, 9)));
    setTanMethod(s, "push");
    startTransfer(s, sepa);
    expect(confirmTransfer(s).ok).toBe(true);
    expect(cancelTransfer(s).ok).toBe(false);
  });

  it("refuses an account number after IBAN and a payee without a name", () => {
    const s = opened();
    expect(startTransfer(s, { ...payee, name: " " })).toEqual({ ok: false, error: "error.payeeName" });
    s.hour = hourOf(new Date(Date.UTC(2008, 2, 1)));
    expect(startTransfer(s, payee)).toEqual({ ok: false, error: "error.payeeAccount" });
  });
});

// A company with a server (so orders take shipping time), an account at Sparklasse and some income on it.
const banked = (): GameState => {
  const s = withServer(newGame(2));
  s.bank = { ...openAccount(s, "sparklasse"), welcomed: true };
  s.ledger = [{ hour: 0, category: "payments", key: "ledger.payment", params: {}, amount: 3000 }];
  s.cash = 20_000;
  return s;
};
const CART: CartLine[] = [{ model: "g1-compute", brand: "Dwell", qty: 1 }];

describe("card and overdraft", () => {
  it("approves a card after three days with a limit from the account's income", () => {
    const s = banked();
    expect(applyCard(s).ok).toBe(true);
    expect(buyCart(s, CART, { kind: "card" }, "loc1")).toEqual({ ok: false, error: "error.noCard" });
    run(s, 72);
    expect(s.bank!.card!.limit).toBe(4500);
    expect(s.tickets.some((t) => t.topic === "bankCard")).toBe(true);
    expect(s.ledger.some((e) => e.key === "ledger.cardFee" && e.amount === -30)).toBe(true);
  });

  it("ships a card order now and debits it with the card bill; prepay waits for the transfer", () => {
    const s = banked();
    applyCard(s);
    run(s, 72);
    const cash = s.cash, wait = deliveryWait(s, CART);
    expect(buyCart(s, CART, { kind: "card" }, "loc1").ok).toBe(true);
    expect(s.cash).toBe(cash);
    const byCard = s.devices.at(-1)!;
    expect(byCard.arriveAt).toBe(s.hour + wait);
    expect(buyCart(s, CART, { kind: "prepay" }, "loc1").ok).toBe(true);
    expect(s.devices.at(-1)!.arriveAt).toBe(s.hour + wait + PREPAY_HOURS + 24);
    expect(s.cash).toBeLessThan(cash);
    const afterPrepay = s.cash;
    run(s, hourOf(new Date(Date.UTC(2005, 1, 1))) - s.hour);
    expect(s.bank!.card!.spent).toEqual([]);
    expect(s.cash).toBeLessThan(afterPrepay - 1000);
  });

  it("takes only a card for SuperMacro", () => {
    const s = banked();
    expect(buyCart(s, [{ model: "g1-compute", brand: "SuperMacro", qty: 1 }], { kind: "prepay" }, "loc1")).toEqual({ ok: false, error: "error.cardOnly" });
  });

  it("keeps a company inside its overdraft solvent and charges interest", () => {
    const s = banked();
    expect(applyOverdraft(s).ok).toBe(true);
    run(s, 72);
    expect(s.bank!.overdraft).toBe(3000);
    s.cash = -1000;
    run(s, 24 * 20);
    expect(s.brokeSince).toBeNull();
    run(s, hourOf(new Date(Date.UTC(2005, 1, 1))) - s.hour);
    expect(s.ledger.find((e) => e.key === "ledger.overdraftInterest")!.amount).toBeLessThan(0);
  });
});

describe("standing orders", () => {
  it("needs a TAN and then pays on its day every month", () => {
    const s = opened();
    expect(startStandingOrder(s, payee, 29)).toEqual({ ok: false, error: "error.orderDay" });
    expect(startStandingOrder(s, { ...payee, amount: 100 }, 5).ok).toBe(true);
    const id = confirmTransfer(s, s.bank!.tans.codes[s.bank!.pending!.index!]);
    expect(s.bank!.standingOrders).toEqual([expect.objectContaining({ day: 5, amount: 100 })]);
    run(s, hourOf(new Date(Date.UTC(2005, 1, 5, 1))) - s.hour);
    expect(s.ledger.filter((e) => e.key === "ledger.standingOrder").map((e) => [new Date(Date.UTC(2005, 0, 1) + e.hour * 3600e3).getUTCDate(), e.amount])).toEqual([[5, -100], [5, -100]]);
    s.cash = 50;
    run(s, hourOf(new Date(Date.UTC(2005, 2, 5, 1))) - s.hour);
    expect(s.tickets.some((t) => t.topic === "bankOrderFailed")).toBe(true);
    expect(deleteStandingOrder(s, id.ok ? id.id! : "").ok).toBe(true);
  });
});
