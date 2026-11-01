import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { iban, openAccount, type Draft } from "../src/sim/46-finance/bank";
import { buyCart, deliveryWait, PREPAY_HOURS, type CartLine } from "../src/sim/90-actions/hardware";
import { applyCard, applyOverdraft, deleteStandingOrder, startStandingOrder } from "../src/sim/90-actions/bank";
import { withServer, newGame } from "./fixtures";
import { lineCut, lineFactor, supplierAccount, supplierCode, supplierHost, type Payable } from "../src/sim/46-finance/payables";
import { resolve } from "../src/sim/80-business/browser";
import { tickMinute } from "../src/sim/88-tick/tick";
import { cancelTransfer, confirmTransfer, deletePayee, openBankAccount, payAllDue, savePayee, setAutoPay, setMandate, setTanMethod, startTransfer } from "../src/sim/90-actions/bank";
import { type GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { applyForRegistration, registerCompany } from "../src/sim/90-actions/company";
import { newGame as blankGame } from "../src/sim/50-state";
import { BANKS, type BankId } from "../src/sim/10-catalog/banks";
import { START_CASH } from "../src/sim/10-catalog/economy";
import { deserialize, serialize } from "../src/sim/91-save/save";

// Hour 0 is Saturday 1 January 2005, 00:00; Monday 08:00 is hour 56.
const MONDAY_8 = 56;
const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
const earned = (s: GameState, from = 0) => s.ledger.filter((e) => e.key === "ledger.depositInterest" && e.hour > from).reduce((n, e) => n + e.amount, 0);
export const opened = (seed = 1, bank: BankId = "sparklasse", form = "sole"): GameState => {
  const s = blankGame(seed);
  s.hour = MONDAY_8;
  expect(openBankAccount(s, bank).ok).toBe(true);
  expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole").ok).toBe(true);
  s.registration!.form = form;
  tick(s);
  return s;
};

describe("bank account", () => {
  it("opens at the bank whose site the player uses, with a welcome email and the TAN list on the desktop", () => {
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
    const s = blankGame(1);
    expect(openBankAccount(s, "quonto")).toEqual({ ok: false, error: "error.unknownBank" });
    expect(s.bank).toBeNull();
  });

  it("charges the account fee every month start", () => {
    const s = opened(1, "deutscheBunk");
    const cash = s.cash;
    run(s, hourOf(new Date(Date.UTC(2005, 1, 1))) - s.hour);
    expect(s.ledger.filter((e) => e.key === "ledger.bankFee")).toEqual([expect.objectContaining({ amount: -12, category: "fees" })]);
    expect(s.cash).toBeLessThanOrEqual(cash - 12 + earned(s));
  });

  it("charges a limited company the dearer fee and every booking of the month before", () => {
    const s = opened(1, "sparklasse", "limited"), feb = hourOf(new Date(Date.UTC(2005, 1, 1)));
    for (let i = 0; i < 3; i++) s.ledger = [...s.ledger, { hour: s.hour, category: "sales", key: "ledger.usedSale", params: {}, amount: 10 }];
    run(s, feb - s.hour);
    const bookings = s.ledger.filter((e) => e.hour < feb && e.amount !== 0 && e.category !== "fees").length;
    expect(bookings).toBeGreaterThanOrEqual(3);
    expect(s.ledger.filter((e) => e.hour === feb && e.category === "fees")).toEqual([
      expect.objectContaining({ key: "ledger.bankFee", amount: -16 }),
      expect.objectContaining({ key: "ledger.bookingFee", amount: -Math.round(bookings * 30) / 100, params: { bank: "Sparklasse", count: bookings } }),
    ]);
  });

  it("charges a sole trader no booking fees", () => {
    const s = opened(1, "sparklasse");
    s.ledger = [...s.ledger, { hour: s.hour, category: "sales", key: "ledger.usedSale", params: {}, amount: 10 }];
    run(s, hourOf(new Date(Date.UTC(2005, 1, 1))) - s.hour);
    expect(s.ledger.filter((e) => e.category === "fees").map((e) => [e.key, e.amount])).toEqual([["ledger.bankFee", -8]]);
  });

  it("charges a partnership at netbunk its flat fee", () => {
    const p = opened(1, "netbunk", "partnership");
    p.ledger = [...p.ledger, { hour: p.hour, category: "sales", key: "ledger.usedSale", params: {}, amount: 10 }];
    run(p, hourOf(new Date(Date.UTC(2005, 1, 1))) - p.hour);
    expect(p.ledger.filter((e) => e.category === "fees").map((e) => [e.key, e.amount])).toEqual([["ledger.bankFee", -5]]);
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
  it("gives every bank its own name, host and layout, redesigned after it opens", () => {
    for (const key of ["name", "host"] as const) expect(new Set(BANKS.map((b) => b[key])).size).toBe(BANKS.length);
    expect(new Set(BANKS.map((b) => b.skin.frame)).size).toBe(BANKS.length);
    for (const b of BANKS) expect(b.skin.redesign).toBeGreaterThanOrEqual(b.from);
  });
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
    expect(s.bank!.outgoing.at(-1)).toMatchObject({ name: "Hans Wurst", arriveAt: s.hour + 24 });
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

  it("saves payees, replaces one with the same account and keeps them in a save", () => {
    const s = opened();
    expect(savePayee(s, { name: "Hoster", account: "123", code: "12345678" })).toEqual({ ok: true });
    expect(savePayee(s, { name: "Hoster GmbH", account: "123", code: "12345678" })).toEqual({ ok: true });
    expect(savePayee(s, { name: "Nobody", account: "123" })).toEqual({ ok: false, error: "error.payeeAccount" });
    expect(s.bank!.payees!.map((p) => p.name)).toEqual(["Hoster GmbH"]);
    const loaded = deserialize(serialize(s));
    expect(loaded.bank!.payees).toEqual(s.bank!.payees);
    expect(deletePayee(loaded, loaded.bank!.payees![0].id)).toEqual({ ok: true });
    expect(deletePayee(loaded, "payee0")).toEqual({ ok: false, error: "error.noPayee" });
    expect(loaded.bank!.payees).toEqual([]);
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
    run(s, hourOf(new Date(Date.UTC(2005, 1, 1))) - s.hour);
    expect(s.bank!.card!.spent).toEqual([]);
    expect(s.payables.find((p) => p.supplier === "card")).toMatchObject({ amount: 2500, paidAt: null });
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

  it("books interest on the balance at the month start, and a custody fee in negative years", () => {
    const s = banked();
    run(s, hourOf(new Date(Date.UTC(2005, 1, 1))) - s.hour);
    const paid = s.ledger.find((e) => e.key === "ledger.depositInterest")!;
    expect(paid.category).toBe("interest");
    expect(paid.amount).toBeCloseTo((20_000 * 0.015 * 31) / 365, 0);
    s.hour = hourOf(new Date(Date.UTC(2020, 5, 1)));
    s.cash = 200_000;
    run(s, 24 * 30);
    expect(s.ledger.find((e) => e.key === "ledger.custodyFee")!.amount).toBeLessThan(0);
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

const FEB = hourOf(new Date(Date.UTC(2005, 1, 1)));
// Pays a payable on the bank's site the way the Pay button fills the form, with the asked iTAN.
const pay = (s: GameState, p: Payable) => {
  expect(startTransfer(s, { name: p.name, account: supplierAccount(p.supplier), code: supplierCode, amount: p.amount, reference: p.number }).ok).toBe(true);
  return confirmTransfer(s, s.bank!.tans.codes[s.bank!.pending!.index!]);
};

describe("payables", () => {
  it("turns the month's line and power bills into invoices by email and settles one paid on time", () => {
    const s = banked();
    run(s, FEB - s.hour);
    const line = s.payables.find((p) => p.supplier === "upstream")!;
    expect(line).toMatchObject({ name: "Deutsche Telekomm", amount: 59, paidAt: null, dueAt: FEB + 14 * 24 });
    expect(s.payables.some((p) => p.supplier === "power")).toBe(true);
    expect(s.ledger.some((e) => e.key === "ledger.homeLine")).toBe(false);
    expect(s.tickets.some((t) => t.topic === "invoice" && t.mail!.params.number === line.number)).toBe(true);
    const cash = s.cash;
    expect(pay(s, line).ok).toBe(true);
    expect(s.cash).toBe(cash - 59);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.homeLine", amount: -59 });
    run(s, 24);
    expect(s.payables.find((p) => p.id === line.id)!.paidAt).toBe(s.hour);
  });

  it("throttles and then cuts an unpaid line, and powers it back once paid", () => {
    const s = banked();
    run(s, FEB - s.hour);
    const line = s.payables.find((p) => p.supplier === "upstream")!;
    run(s, 14 * 24 + 7 * 24 + 1);
    expect(lineFactor(s)).toBeLessThan(1);
    expect(lineCut(s)).toBe(false);
    run(s, 7 * 24);
    expect(lineCut(s)).toBe(true);
    expect(s.tickets.some((t) => t.topic === "consequence.cut")).toBe(true);
    pay(s, s.payables.find((p) => p.id === line.id)!);
    run(s, 25);
    expect(lineCut(s)).toBe(false);
  });

  it("cuts the basement's power thirty days past due", () => {
    const s = banked();
    run(s, FEB - s.hour);
    const power = s.payables.find((p) => p.supplier === "power")!;
    run(s, power.dueAt + 30 * 24 - s.hour);
    expect(s.ops.dark.loc1).toBeGreaterThan(s.hour);
  });

  it("invoices hardware after three paid orders and ships nothing while that invoice is overdue", () => {
    const s = banked();
    expect(buyCart(s, CART, { kind: "invoice" }, "loc1")).toEqual({ ok: false, error: "error.noInvoice" });
    for (let i = 0; i < 3; i++) { buyCart(s, [{ model: "sw-8", brand: "Sysko", qty: 1 }], { kind: "prepay" }, "loc1"); run(s, 1); }
    expect(buyCart(s, CART, { kind: "invoice" }, "loc1").ok).toBe(true);
    const bill = s.payables.find((p) => p.supplier === "hardware")!;
    expect(bill.name).toBe("Alternatte");
    run(s, bill.dueAt + 1 - s.hour);
    expect(buyCart(s, CART, { kind: "prepay" }, "loc1")).toEqual({ ok: false, error: "error.shopUnpaid" });
  });
});

describe("mandates and HBCI", () => {
  it("lets a supplier with a mandate debit its next invoice, so nothing waits to be paid by hand", () => {
    const s = banked();
    run(s, FEB - s.hour);
    const line = s.payables.find((p) => p.supplier === "upstream")!;
    expect(resolve(s, `www.${supplierHost(line.name)}/account`).page).toEqual({ kind: "supplier", name: "Deutsche Telekomm" });
    expect(setMandate(s, line.name, true).ok).toBe(true);
    const cash = s.cash;
    run(s, hourOf(new Date(Date.UTC(2005, 2, 1))) - s.hour);
    const next = s.payables.filter((p) => p.supplier === "upstream").at(-1)!;
    expect(next.id).not.toBe(line.id);
    expect(next.paidAt).not.toBeNull();
    expect(s.tickets.some((t) => t.topic === "debit" && t.mail!.params.number === next.number)).toBe(true);
    expect(s.cash).toBeLessThan(cash - 58 + earned(s, FEB));
  });

  it("pays every open invoice in one go and later by itself once the account has HBCI", () => {
    const s = banked();
    run(s, FEB - s.hour);
    expect(payAllDue(s)).toEqual({ ok: false, error: "error.noHbci" });
    s.modules = ["hbci"];
    const due = s.payables.filter((p) => p.paidAt === null).length;
    expect(due).toBeGreaterThan(1);
    expect(payAllDue(s).ok).toBe(true);
    expect(s.bank!.outgoing.filter((o) => o.payableId)).toHaveLength(due);
    run(s, 25);
    expect(s.payables.every((p) => p.paidAt !== null)).toBe(true);
    expect(setAutoPay(s, true).ok).toBe(true);
    run(s, hourOf(new Date(Date.UTC(2005, 2, 1))) - s.hour);
    const march = s.payables.filter((p) => p.paidAt === null);
    expect(march.length).toBeGreaterThan(0);
    run(s, 14 * 24);
    expect(s.payables.every((p) => p.paidAt !== null)).toBe(true);
  });
});

describe("game start", () => {
  it("starts with no money and no account; the account opens with the savings as its first booking", () => {
    const s = blankGame(4);
    expect(s.cash).toBe(0);
    expect(s.bank).toBeNull();
    expect(openBankAccount(s, "volksbunk").ok).toBe(true);
    expect(s.cash).toBe(START_CASH);
    expect(s.ledger).toEqual([expect.objectContaining({ key: "ledger.savings", category: "capital", amount: START_CASH })]);
    expect(s.transfers).toEqual([expect.objectContaining({ reference: "bank.savings", amount: START_CASH, invoiceId: null, matchedAt: s.hour })]);
    expect(openBankAccount(s, "sparklasse")).toEqual({ ok: false, error: "error.hasBank" });
  });

  it("refuses to register without an account", () => {
    const s = blankGame(4);
    s.hour = MONDAY_8;
    expect(applyForRegistration(s, "Basement Hosting", "Becker, Tin", "sole")).toEqual({ ok: false, error: "error.noBank" });
    expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole")).toEqual({ ok: false, error: "error.noBank" });
    expect(s.registration).toBeNull();
  });

  it("registers once the 40 euro fee transfer is confirmed with a TAN", () => {
    const s = blankGame(4);
    s.hour = MONDAY_8;
    openBankAccount(s, "sparklasse");
    expect(applyForRegistration(s, "Basement Hosting", "Becker, Tin", "sole").ok).toBe(true);
    expect(s.bank!.pending!.draft).toMatchObject({ amount: 40, registration: { name: "Basement Hosting", owner: "Becker, Tin", form: "sole" } });
    expect(s.registration).toBeNull();
    expect(confirmTransfer(s, "wrong")).toEqual({ ok: false, error: "error.wrongTan" });
    expect(confirmTransfer(s, s.bank!.tans.codes[s.bank!.pending!.index!]).ok).toBe(true);
    expect(s.registration).toMatchObject({ owner: "Becker, Tin", form: "sole" });
    expect(s.company.name).toBe("Basement Hosting");
    expect(s.cash).toBe(START_CASH - 40);
    expect(s.ledger.at(-1)).toMatchObject({ category: "transfers", amount: -40 });
    expect(s.bank!.outgoing).toHaveLength(1);
  });

  it("leaves a registered old save's bank and cash as they are, and moves an unregistered one's cash into the savings", () => {
    const registered = opened(5);
    registered.cash = 1234.5;
    expect(deserialize(serialize(registered))).toMatchObject({ cash: 1234.5, bank: { id: "sparklasse", number: registered.bank!.number } });
    const old = JSON.parse(serialize(blankGame(5)));
    old.cash = START_CASH;
    old.version = 3;
    delete old.bank;
    const s = deserialize(JSON.stringify(old));
    expect(s.cash).toBe(0);
    expect(s.bank).toBeNull();
    openBankAccount(s, "sparklasse");
    expect(s.cash).toBe(START_CASH);
  });
});
