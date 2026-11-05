// @vitest-environment jsdom
import { act as reactAct, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { payerOf, type Transfer } from "../src/sim/45-billing/billing";
import { openAccount } from "../src/sim/46-finance/bank";
import { type GameState, type LedgerEntry } from "../src/sim/50-state";
import { fillSetup } from "../src/sim/80-business/books-guide";
import { taxNumberOf } from "../src/sim/80-business/tax";
import { tick } from "../src/sim/88-tick/tick";
import { buyBooks, installBooks } from "../src/sim/90-actions/bookkeeping";
import { sendInvoice } from "../src/sim/90-actions/billing";
import { registerCompany } from "../src/sim/90-actions/company";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { BooksProgram } from "../src/ui/apps/books/BooksApp";
import { accountsOf, categoryLabel } from "../src/ui/apps/books/data";
import { loadLang } from "../src/i18n/lang";
import { genOf } from "../src/ui/apps/books/programs/taxware/TaxwareProgram";
import { useStore } from "../src/ui/store";
import { newGame, withServer } from "./fixtures";

const at = (y: number, m: number, d = 1, h = 10) => hourOf(new Date(Date.UTC(y, m - 1, d, h)));
// A finished Taxware install of the edition in the given year.
function taxware(year: number, edition = "financial-office", s: GameState = newGame(17), hour = at(year, 3, 10)): GameState {
  s.hour = hour;
  s.cash = 50_000;
  s.bank ??= { ...openAccount(s, "sparklasse"), welcomed: true };
  expect(buyBooks(s, "lexwear", edition)).toEqual({ ok: true });
  s.books.download!.readyAt = s.hour;
  expect(installBooks(s, "lexwear")).toEqual({ ok: true });
  s.books.setupDone = true;
  fillSetup(s);
  return s;
}
const put = (s: GameState) => reactAct(() => useStore.setState({ game: structuredClone(s) }));
const item = (name: string) => screen.getByText(name, { selector: "[role^=menuitem]" });
const menu = (name: string) => fireEvent.click(item(name));
const tool = (name: string) => within(screen.getByRole("toolbar")).getByRole("button", { name });
const menuNames = () => [...document.querySelectorAll(".txo-menubar > .txo-menu > button")].map((b) => b.textContent);
const game = () => useStore.getState().game;
const realOpen = useStore.getState().openApp;
const openFirma = () => fireEvent.click(within(screen.getByRole("dialog", { name: "Open company" })).getByRole("button", { name: "Open" }));

beforeEach(() => { (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });
afterEach(() => { cleanup(); sessionStorage.clear(); useStore.setState({ game: newGame(7) }); });

describe("Taxware Office", () => {
  it("switches its look with the version year", () => {
    expect([2005, 2008, 2009, 2014, 2015, 2020].map(genOf)).toEqual(["classic", "classic", "workflow", "workflow", "flat", "flat"]);
  });

  it("draws the classic MDI program until 2008", () => {
    put(taxware(2006));
    render(<BooksProgram />);
    expect(document.querySelector(".txo-classic .txo-tools")).not.toBeNull();
    expect(menuNames()).toEqual(["File", "Edit", "Master data", "Post", "Reports", "Invoicing", "Tools", "Window", "Help"]);
    expect(screen.getByRole("navigation", { name: "Navigator" })).not.toBeNull();
    openFirma();
    fireEvent.click(tool("Trial balance"));
    fireEvent.click(tool("Dialog posting"));
    expect([...document.querySelectorAll(".txo-mdi .txo-child")].map((x) => x.getAttribute("aria-label"))).toEqual(["Trial balance", "Dialog posting"]);
    expect(document.querySelector(".txo-child.active")!.getAttribute("aria-label")).toBe("Dialog posting");
    menu("Window"); menu("Tile");
    expect(document.querySelector(".txo-mdi.txo-arr-tile")).not.toBeNull();
  });

  it("starts the cascade over after five windows", () => {
    put(taxware(2006));
    render(<BooksProgram />);
    openFirma();
    for (const n of ["Trial balance", "Dialog posting", "Posting batch", "Open items", "Payments", "Advance VAT return"]) fireEvent.click(tool(n));
    const tops = [...document.querySelectorAll<HTMLElement>(".txo-mdi .txo-child")].map((x) => x.style.top);
    expect(tops).toEqual(["0px", "22px", "44px", "66px", "88px", "0px"]);
  });

  it("draws the workflow band, side navigation and tabs from 2009", () => {
    put(taxware(2011));
    render(<BooksProgram />);
    expect(document.querySelector(".txo-workflow .txo-band")).not.toBeNull();
    expect(document.querySelector(".txo-tools")).toBeNull();
    expect(menuNames()).toEqual(["File", "Edit", "Master data", "Post", "Reports", "Invoicing", "More", "Help"]);
    expect(screen.getByRole("tab", { name: /Start page/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Workflow")).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "journal" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(screen.getByRole("tab", { name: /Journal/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("draws the flat start page with tiles from 2015", () => {
    put(taxware(2016));
    render(<BooksProgram />);
    expect(document.querySelector(".txo-flat .txo-main")).not.toBeNull();
    expect(document.querySelector(".txo-band, .txo-tools, .txo-mdi")).toBeNull();
    expect(menuNames()).toEqual(["File", "Edit", "Tools", "Help"]);
    expect(document.querySelectorAll(".txo-tiles .txo-tile").length).toBe(6);
    fireEvent.click(within(document.querySelector(".txo-main")!).getByRole("button", { name: "Reports" }));
    // The menu bar follows the area: Reports joins it with that area's windows.
    expect(menuNames()).toEqual(["File", "Edit", "Reports", "Tools", "Help"]);
    expect(screen.getByRole("tab", { name: "Trial balance" }).getAttribute("aria-selected")).toBe("true");
  });

  it("opens the first steps from Help", () => {
    put(taxware(2006));
    render(<BooksProgram />);
    expect(document.querySelector(".bg")).toBeNull();
    menu("Help"); menu("First steps");
    expect(document.querySelector(".txo-guide .bg")).not.toBeNull();
  });

  it("opens an edition's missing screen on the vendor's editions page", () => {
    const openApp = vi.fn();
    useStore.setState({ openApp });
    onTestFinished(() => useStore.setState({ openApp: realOpen }));
    put(taxware(2006, "buchhalter"));
    render(<BooksProgram />);
    openFirma();
    const vat = tool("Advance VAT return");
    expect(vat.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(vat);
    expect(openApp).toHaveBeenCalledWith("Browser", { kind: "url", id: "www.taxware.de/" });
    // Dunning ships to every edition with the 2009 update.
    menu("Post");
    expect(item("Dunning").getAttribute("aria-disabled")).toBe("true");
    cleanup();
    put(taxware(2010, "buchhalter"));
    render(<BooksProgram />);
    menu("Post");
    expect(item("Dunning").getAttribute("aria-disabled")).toBeNull();
  });

  it("names the accounts in the language loaded after start", async () => {
    await loadLang("de");
    onTestFinished(() => loadLang("en"));
    expect([categoryLabel("power"), categoryLabel("hardware")]).not.toContain("Power");
    expect(categoryLabel("power")).toBe("Strom");
  });

  it("numbers the accounts by the chart the company chose", () => {
    const s = taxware(2006);
    expect(Object.fromEntries(accountsOf(s).map((a) => [a.id, a.no]))).toMatchObject({ bank: 1200, receivables: 1400, payables: 1600 });
    s.books.setup = { ...s.books.setup!, chart: "skr04" };
    expect(Object.fromEntries(accountsOf(s).map((a) => [a.id, a.no]))).toMatchObject({ bank: 1800, receivables: 1200, payables: 3300 });
    put(s);
    render(<BooksProgram />);
    openFirma();
    menu("Master data"); menu("Chart of accounts");
    const win = screen.getByRole("region", { name: "Chart of accounts" });
    expect(within(win).getByText("SKR04")).not.toBeNull();
    expect(within(win).getByRole("cell", { name: "1800" })).not.toBeNull();
  });
});

describe("Taxware booking", () => {
  // A sent invoice and the customer's transfer for it, not yet booked.
  function owing(): GameState {
    const s = taxware(2005, "financial-office", withServer(newGame(31)));
    const c = addCustomer(s, "Müller Webdesign", "agency", "prompt");
    addService(s, c, "domain", "mueller.de", 12, "year");
    tick(s);
    sendInvoice(s, s.invoices[0].id);
    const tr: Transfer = { id: "trf31", hour: s.hour, from: payerOf(s.customers[0]), reference: "books.ref.hosting", params: {}, amount: 12, invoiceId: null, matchedAt: null, forInvoice: s.invoices[0].id };
    s.transfers = [tr];
    return s;
  }

  it("books a bank line through the mask into the batch and posts it", () => {
    const s = owing(), inv = s.invoices[0];
    put(s);
    render(<BooksProgram />);
    openFirma();
    fireEvent.click(tool("Dialog posting"));
    const mask = screen.getByRole("region", { name: "Dialog posting" });
    const number = within(mask).getByLabelText("Document no."), counter = within(mask).getByLabelText("Contra account");
    fireEvent.change(counter, { target: { value: "4210" } });
    fireEvent.change(number, { target: { value: inv.number } });
    fireEvent.click(within(mask).getByRole("button", { name: "Post" }));
    expect(within(mask).getByRole("alert").textContent).toBe(`Contra account 4210 does not match document ${inv.number}.`);
    // The document number fills the contra account of an empty field: receivables for money in.
    fireEvent.change(counter, { target: { value: "" } });
    fireEvent.change(number, { target: { value: "" } });
    fireEvent.change(number, { target: { value: inv.number } });
    expect((counter as HTMLInputElement).value).toBe("1400");
    expect((within(mask).getByLabelText("Tax key") as HTMLSelectElement).value).toBe("3");
    fireEvent.click(within(mask).getByRole("button", { name: "Add to batch" }));
    expect(within(mask).getByRole("cell", { name: inv.number })).not.toBeNull();
    expect(game().transfers[0].matchedAt).toBeNull();
    // The batch window shows the same booking; posting it books the transfer against the invoice.
    fireEvent.click(tool("Posting batch"));
    const batch = screen.getByRole("region", { name: "Posting batch" });
    expect(within(batch).getByRole("cell", { name: inv.number })).not.toBeNull();
    fireEvent.click(within(batch).getByRole("button", { name: "Post batch" }));
    expect(game().transfers[0].invoiceId).toBe(inv.id);
    expect(game().invoices[0].status).toBe("paid");
    expect(within(batch).getByRole("status").textContent).toBe("Posted: 1");
    expect(within(screen.getByRole("region", { name: "Dialog posting" })).getByText("The batch is empty.")).not.toBeNull();
  });

  it("posts a bank line at once and leaves the mask empty", () => {
    const s = owing(), inv = s.invoices[0];
    put(s);
    render(<BooksProgram />);
    openFirma();
    fireEvent.click(tool("Dialog posting"));
    const mask = screen.getByRole("region", { name: "Dialog posting" });
    expect(within(mask).getByRole("heading", { name: "Assign a bank line to a document" })).not.toBeNull();
    fireEvent.change(within(mask).getByLabelText("Document no."), { target: { value: inv.number } });
    fireEvent.click(within(mask).getByRole("button", { name: "Post" }));
    expect(game().transfers[0].invoiceId).toBe(inv.id);
    expect(within(mask).getByRole("status").textContent).toBe(`Booked to ${inv.number}.`);
    expect(within(mask).getByText(/^No open bank lines\./)).not.toBeNull();
    // The receivable is gone from the chart of accounts.
    menu("Master data"); menu("Chart of accounts");
    const receivables = within(screen.getByRole("region", { name: "Chart of accounts" })).getByRole("cell", { name: "1400" }).closest("tr")!;
    expect(receivables.lastElementChild!.textContent).toMatch(/^0[.,]00/);
  });
});

describe("Taxware tax return", () => {
  const entry = (hour: number, category: string, amount: number): LedgerEntry => ({ hour, category, key: "ledger.test", params: {}, amount });
  it("links DOHLE and submits the yearly return from the advance VAT window", () => {
    const s = taxware(2005, "financial-office", newGame(7), at(2005, 1, 3, 8));
    expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole", { street: "Kellerweg 1", zip: "60311", city: "Frankfurt" }).ok).toBe(true);
    tick(s);
    s.docs = [...s.docs, { id: "cert1", kind: "cert", title: "dohle-zertifikat.pfx", body: "", x: 0, y: 0 }];
    s.tax = { ...s.tax, answered: s.hour, small: true, number: taxNumberOf(7), numberAt: s.hour, cert: "cert1" };
    s.ledger = [...s.ledger, entry(at(2005, 6, 1), "payments", 20_000)];
    s.hour = at(2006, 1, 1, 0) - 1;
    tick(s);
    s.transfers = s.transfers.map((x) => ({ ...x, matchedAt: x.matchedAt ?? s.hour }));
    const year = () => game().tax.returns.find((r) => r.kind === "year" && r.year === 2005)!;
    put(s);
    render(<BooksProgram />);
    openFirma();
    fireEvent.click(tool("Advance VAT return"));
    const win = screen.getByRole("region", { name: "Advance VAT return" });
    fireEvent.click(within(win).getByRole("button", { name: "Connect DOHLE" }));
    fireEvent.click(within(win).getByRole("button", { name: "Submit tax return" }));
    expect(year().filedAt).toBe(game().hour);
  });
});
