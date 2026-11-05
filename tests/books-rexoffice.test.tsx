// @vitest-environment jsdom
import { act as reactAct, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { payerOf, type Transfer } from "../src/sim/45-billing/billing";
import { openAccount, send } from "../src/sim/46-finance/bank";
import { invoice, supplierAccount, supplierCode } from "../src/sim/46-finance/payables";
import type { GameState } from "../src/sim/50-state";
import { fillSetup } from "../src/sim/80-business/books-guide";
import { tick } from "../src/sim/88-tick/tick";
import { buyBooks } from "../src/sim/90-actions/bookkeeping";
import { sendInvoice } from "../src/sim/90-actions/billing";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { BooksProgram } from "../src/ui/apps/books/BooksApp";
import { useStore } from "../src/ui/store";
import { newGame, withServer } from "./fixtures";

const base = (year: number, edition = "l", done = true): GameState => {
  const s = withServer(newGame(31));
  s.hour = hourOf(new Date(Date.UTC(year, 2, 10, 10)));
  s.cash = 50_000;
  s.bank = { ...openAccount(s, "sparklasse"), welcomed: true };
  const c = addCustomer(s, "Müller Webdesign", "agency", "prompt");
  addService(s, c, "domain", "mueller.de", 12, "year");
  tick(s);
  expect(buyBooks(s, "lexoffize", edition)).toEqual({ ok: true });
  s.books.setupDone = done;
  fillSetup(s);
  if (!done) s.books.setup = { ...s.books.setup!, company: true };
  return s;
};
const put = (s: GameState) => reactAct(() => useStore.setState({ game: { ...s } }));
const open = (s: GameState, nav?: string) => {
  sessionStorage.clear();
  put(s);
  const r = render(<BooksProgram />);
  if (nav) fireEvent.click(r.container.querySelector(`[data-nav="${nav}"]`)!);
  return r;
};
afterEach(cleanup);
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

describe("Rexoffice web app", () => {
  it("draws a variant per era with its own sidebar", () => {
    const seen = [2015, 2018, 2024].map((y) => {
      const r = open(base(y));
      const root = r.container.querySelector(".sx")!;
      const out = { cls: [...root.classList].find((c) => /^rx-(early|dash|modern)$/.test(c)), nav: r.container.querySelectorAll(".sx-navitem").length, gear: !!r.container.querySelector(".sx-gear") };
      cleanup();
      return out;
    });
    expect(seen.map((x) => x.cls)).toEqual(["rx-early", "rx-dash", "rx-modern"]);
    expect(seen[2].gear).toBe(true);
    expect(seen[0].nav).toBe(seen[2].nav + 1);
  });

  it("shows the dashboard cards and the checklist until the setup is done", () => {
    let r = open(base(2018, "l", false));
    expect(r.container.querySelector(".sx-stat")).not.toBeNull();
    expect(r.container.querySelectorAll(".bg-step").length).toBeGreaterThan(0);
    cleanup();
    r = open(base(2018));
    expect(r.container.querySelector(".rx-checklist")).toBeNull();
  });

  it("sends a draft invoice from the document editor", () => {
    const s = base(2018);
    expect(s.invoices[0].status).toBe("draft");
    const r = open(s, "rechnungen");
    expect(r.container.querySelector(".sx-doc")).not.toBeNull();
    fireEvent.click(screen.getByText("Send by email"));
    expect(useStore.getState().game.invoices[0].status).not.toBe("draft");
  });

  it("assigns an uploaded document to the booking that paid it", () => {
    const s = base(2018);
    const p = invoice(s, "upstream", "Deutsche Telekomm", [{ hour: 0, category: "upstream", key: "ledger.homeLine", params: {}, amount: -59 }]);
    send(s, { name: "Deutsche Telekomm", account: supplierAccount("upstream"), code: supplierCode, amount: 59, reference: "Internet" });
    s.bank!.outgoing = s.bank!.outgoing.map((o) => ({ ...o, matched: null }));
    s.payables = s.payables.map((x) => ({ ...x, booked: 0 }));
    const r = open(s, "belege");
    fireEvent.change(r.container.querySelector(".sx-drop select")!, { target: { value: p.id } });
    fireEvent.click(screen.getByText("Upload document", { selector: "button.primary" }));
    expect(r.container.querySelector(".sx-chip.accent")).not.toBeNull();
    fireEvent.click(screen.getAllByText("Assign")[0]);
    expect(useStore.getState().game.payables.find((x) => x.id === p.id)!.booked).toBeGreaterThan(0);
  });

  it("assigns an incoming transfer to its invoice on the bank page", () => {
    const s = base(2018);
    sendInvoice(s, s.invoices[0].id);
    const inv = s.invoices[0];
    const tr: Transfer = { id: "trf31", hour: s.hour, from: payerOf(s.customers[0]), reference: "books.ref.hosting", params: {}, amount: 12, invoiceId: null, matchedAt: null, forInvoice: inv.id };
    s.transfers = [tr];
    open(s, "bank");
    const row = document.querySelector('[data-booking="trf31"]')!;
    const select = row.querySelector("select")!;
    fireEvent.change(select, { target: { value: inv.id } });
    fireEvent.click(row.querySelector("button.primary")!);
    expect(useStore.getState().game.transfers[0].matchedAt).not.toBeNull();
  });

  it("gates dunning and reports by edition", () => {
    const small = base(2015, "s");
    sendInvoice(small, small.invoices[0].id);
    small.invoices[0].status = "overdue";
    let r = open(small, "rechnungen");
    expect(r.container.querySelector(".sx-doc .books-locked")).not.toBeNull();
    expect(r.container.querySelector('[data-nav="auswertungen"]')?.classList.contains("locked")).toBe(true);
    cleanup();
    const large = base(2016, "l");
    sendInvoice(large, large.invoices[0].id);
    large.invoices[0].status = "overdue";
    r = open(large, "rechnungen");
    expect(r.container.querySelector(".sx-doc .books-locked")).toBeNull();
    expect(screen.getByText("Send reminder")).toBeTruthy();
  });

  it("lists the advance returns with their tax split", () => {
    const s = base(2018);
    s.tax.returns = [{ id: "tx1", kind: "vat", year: 2018, from: s.hour - 720, to: s.hour, dueAt: s.hour + 240, filedAt: null, booked: 0, late: false, estimate: null }];
    const r = open(s, "steuern");
    fireEvent.click(r.container.querySelector("tbody tr")!);
    expect(screen.getByText("Difference")).toBeTruthy();
  });

  it("renders every page without raw keys", () => {
    for (const nav of ["dashboard", "rechnungen", "angebote", "kontakte", "belege", "bank", "auswertungen", "steuern"]) {
      const r = open(base(2024), nav);
      expect(r.container.textContent).not.toMatch(/\b(rx|books|bank|ui-tax|orderSteps)\.[a-zA-Z]+/);
      cleanup();
    }
  });
});
