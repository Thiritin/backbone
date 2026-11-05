import { describe, expect, it } from "vitest";
import { mailsAbout, newGame } from "./fixtures";
import { CONSEQUENCES, supplierAt, supplierIban, type SupplierId } from "../src/sim/46-finance/payables";
import { openAccount } from "../src/sim/46-finance/bank";
import { methodsFor, placeOrder } from "../src/sim/90-actions/purchase";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { ALL_DATACENTERS as DATACENTERS, COUNTRY } from "../src/sim/20-world/datacenters";
import type { GameState, LedgerEntry } from "../src/sim/50-state";

const ABROAD = DATACENTERS.find((d) => COUNTRY[d.city] !== "DE")!.name;
const line = (amount: number): LedgerEntry => ({ hour: 0, category: "equipment", key: "ledger.hardware", params: {}, amount });
const banked = (): GameState => {
  const s = newGame(2);
  s.bank = { ...openAccount(s, "sparklasse"), welcomed: true };
  s.cash = 20_000;
  return s;
};
const withCard = (s: GameState, limit = 1000) => { s.bank!.card = { limit, readyAt: 0, spent: [] } as unknown as NonNullable<GameState["bank"]>["card"]; };

describe("placeOrder", () => {
  it("pays cash at once while the company has no bank account and sends a receipt", () => {
    const s = newGame(1), cash = s.cash;
    const r = placeOrder(s, { supplier: "landlord", name: "Engel & Vogel", lines: [line(-100)], method: "cash" });
    expect(r.ok).toBe(true);
    expect(s.payables[0]).toMatchObject({ method: "cash", doc: "receipt", amount: 100, paidAt: s.hour });
    expect(s.cash).toBe(cash - 100);
    expect(mailsAbout(s, "receipt")).toHaveLength(1);
  });

  it("refuses cash once a bank exists and refuses cash the company lacks", () => {
    const s = banked();
    expect(placeOrder(s, { supplier: "landlord", name: "X", lines: [line(-100)], method: "cash" })).toMatchObject({ ok: false, error: "error.noCash" });
    const poor = newGame(1);
    poor.cash = 50;
    expect(placeOrder(poor, { supplier: "landlord", name: "X", lines: [line(-100)], method: "cash" })).toMatchObject({ ok: false, error: "error.noCash" });
    expect(placeOrder(newGame(1), { supplier: "landlord", name: "X", lines: [line(-100)], method: "transfer" })).toMatchObject({ ok: false, error: "error.noBank" });
  });

  it("leaves transfer and on-account orders open with an invoice", () => {
    const s = banked();
    for (const method of ["transfer", "onAccount"] as const) {
      const r = placeOrder(s, { supplier: "services", name: "Pear", lines: [line(-200)], method, order: "o1" });
      expect(r.ok).toBe(true);
      expect(s.payables.at(-1)).toMatchObject({ method, doc: "invoice", paidAt: null, order: "o1" });
    }
    expect(s.cash).toBe(20_000);
    expect(mailsAbout(s, "invoice")).toHaveLength(2);
  });

  it("charges a card order at once up to the limit and refuses above it", () => {
    const s = banked();
    expect(placeOrder(s, { supplier: "services", name: "Pear", lines: [line(-10)], method: "card" })).toMatchObject({ ok: false, error: "error.noCard" });
    withCard(s);
    expect(placeOrder(s, { supplier: "services", name: "Pear", lines: [line(-600)], method: "card" }).ok).toBe(true);
    expect(s.payables[0]).toMatchObject({ method: "card", paidAt: s.hour });
    expect(s.bank!.card!.spent).toHaveLength(1);
    expect(placeOrder(s, { supplier: "services", name: "Pear", lines: [line(-600)], method: "card" })).toMatchObject({ ok: false, error: "error.cardLimit" });
    expect(s.payables).toHaveLength(1);
  });

  it("debits a German supplier and refuses a foreign one", () => {
    const s = banked();
    expect(placeOrder(s, { supplier: "services", name: "Pear", lines: [line(-50)], method: "debit" }).ok).toBe(true);
    expect(s.payables[0]).toMatchObject({ method: "debit", paidAt: s.hour });
    expect(s.cash).toBe(19_950);
    expect(placeOrder(s, { supplier: "network", name: ABROAD, lines: [line(-50)], method: "debit" })).toMatchObject({ ok: false, error: "error.debitAbroad" });
  });

  it("raises cash with a credit note", () => {
    const s = banked();
    const r = placeOrder(s, { supplier: "landlord", name: "Engel & Vogel", lines: [line(300)], method: "transfer" });
    expect(r.ok).toBe(true);
    expect(s.payables[0]).toMatchObject({ doc: "credit", amount: -300, paidAt: s.hour });
    expect(s.cash).toBe(20_300);
    expect(mailsAbout(s, "credit")).toHaveLength(1);
  });

  it("confirms a contract without a charge", () => {
    const s = banked();
    placeOrder(s, { supplier: "datacenter", name: "Engel & Vogel", lines: [], method: "onAccount", doc: "contract" });
    expect(s.payables[0]).toMatchObject({ doc: "contract", amount: 0, paidAt: s.hour });
    expect(mailsAbout(s, "contract")).toHaveLength(1);
  });
});

describe("methodsFor", () => {
  it("offers cash alone before a bank and transfer, card and debit after", () => {
    expect(methodsFor(newGame(1), "services", [line(-10)])).toEqual(["cash"]);
    const s = banked();
    expect(methodsFor(s, "services", [line(-10)])).toEqual(["transfer", "onAccount"]);
    withCard(s);
    s.bank!.mandates = ["Pear"];
    expect(methodsFor(s, "services", [line(-10)], "Pear")).toEqual(["transfer", "onAccount", "card", "debit"]);
    expect(methodsFor(s, "hardware", [line(-10)])).toEqual(["transfer", "card"]);
  });
});

describe("payables from older saves", () => {
  it("loads without method and doc, keeps them undefined, and the new suppliers have no consequences", () => {
    const s = banked();
    placeOrder(s, { supplier: "services", name: "Pear", lines: [line(-10)], method: "transfer" });
    const raw = JSON.parse(serialize(s));
    delete raw.payables[0].method; delete raw.payables[0].doc;
    const back = deserialize(JSON.stringify(raw))!;
    expect(back.payables[0].method).toBeUndefined();
    expect(back.payables[0].doc).toBeUndefined();
    for (const id of ["landlord", "shopVendor", "network", "services"] as SupplierId[]) {
      expect(CONSEQUENCES[id]).toEqual([]);
      expect(supplierAt(supplierIban(id))).toBe(id);
    }
  });
});
