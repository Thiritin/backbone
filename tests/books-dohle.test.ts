import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import type { Invoice, Transfer } from "../src/sim/45-billing/billing";
import { newGame, type GameState, type LedgerEntry } from "../src/sim/50-state";
import { booksLinked, registerDohle, taxNumberOf } from "../src/sim/80-business/tax";
import { tick } from "../src/sim/88-tick/tick";
import { openBankAccount } from "../src/sim/90-actions/bank";
import { registerCompany } from "../src/sim/90-actions/company";
import { connectDohle, submitTaxReturn } from "../src/sim/90-actions/tax";
import { BooksTax } from "../src/ui/apps/books/TaxTab";

const at = (y: number, m: number, d = 1, h = 0) => hourOf(new Date(Date.UTC(y, m - 1, d, h)));
const jump = (s: GameState, hour: number, hours = 1) => { s.hour = hour - 1; for (let i = 0; i < hours; i++) tick(s); };
const entry = (hour: number, category: string, amount: number): LedgerEntry => ({ hour, category, key: "ledger.test", params: {}, amount });
// A registered company with its certificate on the desktop and the Lexwear edition with the tax view.
function company(small = false): GameState {
  const s = newGame(7);
  s.hour = at(2005, 1, 3, 8);
  expect(openBankAccount(s, "sparklasse").ok).toBe(true);
  expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole").ok).toBe(true);
  tick(s);
  s.docs = [...s.docs, { id: "cert1", kind: "cert", title: "dohle-zertifikat.pfx", body: "", x: 0, y: 0 }];
  s.tax = { ...s.tax, answered: s.hour, small, number: taxNumberOf(7), numberAt: s.hour, cert: "cert1" };
  s.books = { vendor: "lexwear", installedAt: s.hour, edition: "financial-office", seats: 0, download: null };
  s.cash = 100_000;
  return s;
}
const vat = (s: GameState) => s.tax.returns.filter((r) => r.kind === "vat");
const year = (s: GameState, y: number) => s.tax.returns.find((r) => r.kind === "year" && r.year === y)!;
const transfer = (hour: number, matchedAt: number | null): Transfer => ({ id: `trf${hour}`, hour, from: "Customer", reference: "books.ref.invoice", params: {}, amount: 10, invoiceId: null, matchedAt, forInvoice: "" });

describe("DOHLE in Books", () => {
  it("connects with the valid certificate once the edition has the tax view", () => {
    const s = company();
    s.books = { ...s.books, edition: "buchhalter" };
    expect(connectDohle(s, "cert1")).toEqual({ ok: false, error: "error.booksTaxView" });
    s.books = { ...s.books, edition: "financial-office" };
    expect(connectDohle(s, "doc0")).toEqual({ ok: false, error: "error.dohleCert" });
    expect(connectDohle(s, "cert1").ok).toBe(true);
    expect(booksLinked(s)).toBe(true);
  });

  it("files the advance VAT return in the monthly run on the first at nine", () => {
    const s = company();
    s.ledger = [...s.ledger, entry(at(2005, 1, 20), "payments", 1_160)];
    jump(s, at(2005, 2, 1), 12);
    expect(vat(s)[0].filedAt).toBeNull();
    expect(connectDohle(s, "cert1").ok).toBe(true);
    jump(s, at(2005, 3, 1), 12);
    expect(vat(s).map((r) => r.filedAt)).toEqual([at(2005, 3, 1, 9), at(2005, 3, 1, 9)]);
    expect(vat(s)[0].booked).toBe(160);
  });

  it("loses the connection when a new registration revokes the certificate", () => {
    const s = company();
    expect(connectDohle(s, "cert1").ok).toBe(true);
    registerDohle(s);
    expect(booksLinked(s)).toBe(false);
    jump(s, at(2005, 2, 1), 12);
    expect(vat(s)[0].filedAt).toBeNull();
  });

  it("submits the yearly return once every invoice is in Books and the statement is matched", () => {
    const s = company(true);
    s.ledger = [...s.ledger, entry(at(2005, 6, 1), "payments", 20_000)];
    jump(s, at(2006, 1, 1));
    const id = year(s, 2005).id;
    expect(submitTaxReturn(s, id)).toEqual({ ok: false, error: "error.booksNotLinked" });
    expect(connectDohle(s, "cert1").ok).toBe(true);
    s.invoices = [...s.invoices, { id: "inv-x", issuedAt: at(2005, 5, 1), synced: false } as Invoice];
    expect(submitTaxReturn(s, id)).toEqual({ ok: false, error: "error.booksInvoices" });
    s.invoices = s.invoices.filter((i) => i.id !== "inv-x");
    s.transfers = [...s.transfers, transfer(at(2005, 7, 1), null)];
    expect(submitTaxReturn(s, id)).toEqual({ ok: false, error: "error.booksUnmatched" });
    s.transfers = s.transfers.map((x) => ({ ...x, matchedAt: x.matchedAt ?? s.hour }));
    expect(submitTaxReturn(s, id).ok).toBe(true);
    expect(year(s, 2005).filedAt).toBe(s.hour);
  });

  it("shows Connect before and Submit tax return after connecting", () => {
    const s = company(true);
    jump(s, at(2006, 1, 1));
    const view = () => renderToString(createElement(BooksTax, { game: s, connect: () => {}, submit: () => {} }));
    expect(view()).toContain("Connect DOHLE");
    expect(view()).not.toContain("Submit tax return");
    expect(connectDohle(s, "cert1").ok).toBe(true);
    expect(view()).toContain("Submit tax return");
  });
});
