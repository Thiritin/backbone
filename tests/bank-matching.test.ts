import { describe, expect, it } from "vitest";
import { payerOf, type Transfer } from "../src/sim/45-billing/billing";
import { openAccount, send } from "../src/sim/46-finance/bank";
import { invoice, supplierAccount, supplierCode, supplierIban } from "../src/sim/46-finance/payables";
import type { GameState, LedgerEntry } from "../src/sim/50-state";
import { matchByReference, referenced, suggested } from "../src/sim/80-business/bookkeeping";
import { tick } from "../src/sim/88-tick/tick";
import { assignPayment, confirmTransfer, startTransfer, unassignPayment } from "../src/sim/90-actions/bank";
import { sendInvoice } from "../src/sim/90-actions/billing";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame, withServer } from "./fixtures";

const banked = (): GameState => {
  const s = withServer(newGame(2));
  s.bank = { ...openAccount(s, "sparklasse"), welcomed: true };
  s.cash = 20_000;
  return s;
};
const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
const line = (amount: number): LedgerEntry[] => [{ hour: 0, category: "upstream", key: "ledger.homeLine", params: {}, amount: -amount }];
const line59 = { name: "Deutsche Telekomm", account: supplierAccount("upstream"), code: supplierCode, amount: 59 };

describe("transfers to an account that does not exist", () => {
  it("come back within three banking days of arriving, with an email and a line in Books", () => {
    const s = banked(), cash = s.cash;
    expect(startTransfer(s, { name: "Hans Wurst", account: "1234567", code: "37040044", amount: 100, reference: "Rechnung 17" }).ok).toBe(true);
    expect(confirmTransfer(s, s.bank!.tans.codes[s.bank!.pending!.index!]).ok).toBe(true);
    const out = s.bank!.outgoing[0];
    expect(s.cash).toBe(cash - 100);
    expect(out.matched).toBeNull();
    expect(out.returnAt! - out.arriveAt).toBeGreaterThanOrEqual(24);
    expect(out.returnAt! - out.arriveAt).toBeLessThanOrEqual(72);
    run(s, out.returnAt! - s.hour + 1);
    expect(s.cash).toBeGreaterThanOrEqual(cash - 1);
    expect(s.bank!.outgoing[0].returned).toBe(true);
    expect(s.ledger.find((e) => e.key === "ledger.transferReturned")).toMatchObject({ amount: 100, params: { name: "Hans Wurst" } });
    expect(s.transfers.find((x) => x.reference === "bank.ref.returned")).toMatchObject({ amount: 100, matchedAt: expect.any(Number), invoiceId: null });
    expect(s.tickets.some((t) => t.topic === "bankReturned")).toBe(true);
  });

  it("include a supplier's account number at another bank code, while the right one stays", () => {
    const s = banked();
    const p = invoice(s, "upstream", "Deutsche Telekomm", line(59));
    expect(send(s, { ...line59, code: "37040044", reference: p.number }).returnAt).toBeDefined();
    expect(s.payables[0]).toMatchObject({ sent: 0, booked: 0 });
    const right = send(s, { ...line59, reference: p.number });
    expect(right.returnAt).toBeUndefined();
    expect(right).toMatchObject({ payableId: p.id, matched: p.id });
  });

  it("are refused at entry when the IBAN's check digits are wrong", () => {
    const s = banked();
    s.hour = 3 * 8760 + 24 * 2;
    const good = supplierIban("upstream"), bad = `DE${good[2] === "9" ? "0" : String(Number(good[2]) + 1)}${good.slice(3)}`;
    expect(startTransfer(s, { name: "Deutsche Telekomm", account: bad, amount: 59, reference: "x" })).toEqual({ ok: false, error: "error.payeeAccount" });
    expect(startTransfer(s, { name: "Deutsche Telekomm", account: good, amount: 59, reference: "x" }).ok).toBe(true);
  });
});

describe("a supplier booking a transfer", () => {
  it("takes the invoice the reference names, else its oldest open one", () => {
    const s = banked();
    const older = invoice(s, "upstream", "Deutsche Telekomm", line(59)), newer = invoice(s, "upstream", "Deutsche Telekomm", line(59));
    expect(send(s, { ...line59, reference: `Rechnung ${newer.number}` }).payableId).toBe(newer.id);
    expect(send(s, { ...line59, reference: "Internet Januar" }).payableId).toBe(older.id);
    expect(s.payables.map((p) => p.booked)).toEqual([59, 59]);
  });
});

describe("Books assigning payments out", () => {
  it("lets the player unassign and reassign one while the supplier keeps its booking", () => {
    const s = banked();
    const a = invoice(s, "upstream", "Deutsche Telekomm", line(59)), b = invoice(s, "upstream", "Deutsche Telekomm", line(59));
    const out = send(s, { ...line59, reference: a.number });
    expect(assignPayment(s, out.id, b.id)).toEqual({ ok: false, error: "error.transferMatched" });
    expect(unassignPayment(s, out.id).ok).toBe(true);
    expect(s.payables.find((p) => p.id === a.id)).toMatchObject({ booked: 0, sent: 59 });
    expect(assignPayment(s, out.id, b.id).ok).toBe(true);
    expect(s.payables.map((p) => p.booked)).toEqual([0, 59]);
    run(s, 25);
    expect(s.payables.find((p) => p.id === a.id)!.paidAt).not.toBeNull();
    expect(s.payables.find((p) => p.id === b.id)!.paidAt).toBeNull();
  });

  it("assigns a supplier's direct debit to its invoice at once", () => {
    const s = banked();
    s.bank!.mandates = ["Deutsche Telekomm"];
    const p = invoice(s, "upstream", "Deutsche Telekomm", line(59));
    expect(s.payables[0]).toMatchObject({ paidAt: s.hour, booked: 59 });
    expect(s.bank!.outgoing).toEqual([expect.objectContaining({ debit: true, matched: p.id, amount: 59 })]);
  });

  it("counts payments made before assignments for old saves", () => {
    const s = banked();
    const p = invoice(s, "upstream", "Deutsche Telekomm", line(59));
    send(s, { ...line59, reference: p.number });
    const raw = JSON.parse(serialize(s));
    delete raw.payables[0].booked;
    delete raw.bank.outgoing[0].matched;
    const back = deserialize(JSON.stringify(raw));
    expect(back.payables[0].booked).toBe(59);
    expect(back.bank!.outgoing[0].matched).toBe(p.id);
  });
});

describe("a customer's transfer without an invoice number", () => {
  const owing = () => {
    const s = withServer(newGame(9));
    const c = addCustomer(s, "Müller Webdesign", "agency", "prompt");
    addService(s, c, "domain", "mueller.de", 12, "year");
    tick(s);
    sendInvoice(s, s.invoices[0].id);
    const older = s.invoices[0];
    s.hour += 30 * 24;
    // The newer invoice first, so the match goes by issue date and not by list order.
    s.invoices = [{ ...older, id: "inv9001", number: "2005-9001", issuedAt: s.hour, dueAt: s.hour + 14 * 24 }, older];
    const tr: Transfer = { id: "trf9001", hour: s.hour, from: payerOf(s.customers[0]), reference: "books.ref.hosting", params: {}, amount: 12, invoiceId: null, matchedAt: null, forInvoice: "inv9001" };
    s.transfers = [tr];
    return { s, older, tr: () => s.transfers[0] };
  };

  it("pays the sender's oldest open invoice when the amount fits", () => {
    const { s, older, tr } = owing();
    expect(suggested(s, tr())?.id).toBe(older.id);
    matchByReference(s);
    expect(tr()).toMatchObject({ invoiceId: older.id });
    expect(s.invoices.find((i) => i.id === older.id)!.status).toBe("paid");
    expect(s.invoices.find((i) => i.id === "inv9001")!.status).toBe("open");
  });

  it("only suggests it when the amount differs, and nothing when two customers pay from that name", () => {
    const { s, older, tr } = owing();
    s.transfers = [{ ...tr(), amount: 11 }];
    expect(suggested(s, tr())?.id).toBe(older.id);
    expect(referenced(s, tr())).toBeUndefined();
    addCustomer(s, "Müller Webdesign", "agency", "prompt");
    expect(suggested(s, tr())).toBeUndefined();
  });
});
