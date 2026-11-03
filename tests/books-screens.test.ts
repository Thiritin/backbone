import { describe, expect, it } from "vitest";
import { payerOf, type Transfer } from "../src/sim/45-billing/billing";
import { openAccount, send } from "../src/sim/46-finance/bank";
import { invoice, supplierAccount, supplierCode } from "../src/sim/46-finance/payables";
import { tick } from "../src/sim/88-tick/tick";
import { bookByNumber } from "../src/sim/90-actions/bookkeeping";
import { sendInvoice } from "../src/sim/90-actions/billing";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { accountsOf } from "../src/ui/apps/books/accounts";
import { newGame, withServer } from "./fixtures";

const owing = (amount: number) => {
  const s = withServer(newGame(31));
  s.bank = { ...openAccount(s, "sparklasse"), welcomed: true };
  const c = addCustomer(s, "Müller Webdesign", "agency", "prompt");
  addService(s, c, "domain", "mueller.de", 12, "year");
  tick(s);
  sendInvoice(s, s.invoices[0].id);
  const tr: Transfer = { id: "trf31", hour: s.hour, from: payerOf(s.customers[0]), reference: "books.ref.hosting", params: {}, amount, invoiceId: null, matchedAt: null, forInvoice: s.invoices[0].id };
  s.transfers = [tr];
  return s;
};

describe("Kontomix's booking form", () => {
  it("books a transfer against the invoice number typed in, and names a number it does not know", () => {
    const s = owing(12), inv = s.invoices[0];
    expect(bookByNumber(s, "trf31", "2005-0000")).toEqual({ ok: false, error: "books-screens.noDocument", params: { number: "2005-0000" } });
    expect(bookByNumber(s, "trf31", ` ${inv.number} `).ok).toBe(true);
    expect(s.transfers[0].invoiceId).toBe(inv.id);
    expect(s.invoices[0].status).toBe("paid");
  });

  it("writes off what a short payment leaves open when asked to", () => {
    const s = owing(10);
    expect(bookByNumber(s, "trf31", s.invoices[0].number, true).ok).toBe(true);
    expect(s.invoices[0].status).toBe("paid");
  });

  it("books a payment out against the supplier invoice number", () => {
    const s = owing(12);
    s.cash = 5_000;
    const p = invoice(s, "upstream", "Deutsche Telekomm", [{ hour: 0, category: "upstream", key: "ledger.homeLine", params: {}, amount: -59 }]);
    const out = send(s, { name: "Deutsche Telekomm", account: supplierAccount("upstream"), code: supplierCode, amount: 59, reference: "Internet" });
    // As a program without matching leaves it: unassigned in Books.
    s.bank!.outgoing = s.bank!.outgoing.map((o) => ({ ...o, matched: null }));
    s.payables = s.payables.map((x) => ({ ...x, booked: 0 }));
    expect(bookByNumber(s, out.id, p.number).ok).toBe(true);
    expect(s.bank!.outgoing[0].matched).toBe(p.id);
  });
});

describe("the account views", () => {
  it("hold the bank at the cash balance and every ledger entry in one category account", () => {
    const s = owing(12);
    const accounts = accountsOf(s);
    expect(accounts.find((a) => a.id === "bank")!.balance).toBe(s.cash);
    expect(accounts.filter((a) => !["bank", "receivables", "payables"].includes(a.id)).reduce((n, a) => n + a.entries.length, 0)).toBe(s.ledger.length);
    expect(accounts.find((a) => a.id === "receivables")!.balance).toBe(12);
  });
});
