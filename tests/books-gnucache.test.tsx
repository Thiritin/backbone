// @vitest-environment jsdom
import { act as reactAct, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { payerOf, type Transfer } from "../src/sim/45-billing/billing";
import { openAccount } from "../src/sim/46-finance/bank";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { guideOf, guideTicked, setupOf } from "../src/sim/80-business/books-guide";
import { sendInvoice } from "../src/sim/90-actions/billing";
import { acceptBooksLicence, buyBooks, installBooks } from "../src/sim/90-actions/bookkeeping";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { LANGS, loadLang } from "../src/i18n/lang";
import { BooksApp } from "../src/ui/apps/books/BooksApp";
import { useStore } from "../src/ui/store";
import { newGame, withServer } from "./fixtures";

// A GnuCache owner in the given year with one customer transfer waiting to be booked.
function owner(year = 2012): GameState {
  const s = withServer(newGame(31));
  s.hour = hourOf(new Date(Date.UTC(year, 2, 10, 10)));
  s.cash = 50_000;
  s.bank = { ...openAccount(s, "sparklasse"), welcomed: true };
  const c = addCustomer(s, "Müller Webdesign", "agency", "prompt");
  addService(s, c, "domain", "mueller.de", 12, "year");
  tick(s);
  sendInvoice(s, s.invoices[0].id);
  const tr: Transfer = { id: "trf31", hour: s.hour, from: payerOf(s.customers[0]), reference: "books.ref.hosting", params: {}, amount: 12, invoiceId: null, matchedAt: null, forInvoice: s.invoices[0].id };
  s.transfers = [tr];
  expect(buyBooks(s, "gnucache")).toEqual({ ok: true });
  if (s.books.download) s.books.download.readyAt = s.hour;
  expect(installBooks(s, "gnucache")).toEqual({ ok: true });
  acceptBooksLicence(s);
  s.books = { ...s.books, setupDone: true };
  return s;
}
const put = (s: GameState) => reactAct(() => useStore.setState({ game: { ...s } }));
const menu = (name: string, item: string) => { fireEvent.click(screen.getByRole("menuitem", { name })); fireEvent.click(screen.getByRole("menuitem", { name: item })); };

beforeEach(() => vi.useRealTimers());
afterEach(async () => { cleanup(); sessionStorage.clear(); useStore.setState({ game: newGame(7) }); await loadLang("en"); });

describe("GnuCache program", () => {
  it.each([[2005, "gc-g1"], [2012, "gc-g2"], [2018, "gc-g3"]])("draws the %i toolkit look", (year, cls) => {
    put(owner(year));
    render(<BooksApp />);
    expect(document.querySelector(".gc")!.classList.contains(cls)).toBe(true);
    expect(document.querySelectorAll(".gc[class*='gc-g']").length).toBe(1);
    // GTK 1.2 notebook tabs carry no close button; later toolkits do once a second page is open.
    menu("Reports", "Balance Sheet");
    expect(document.querySelectorAll(".gc-tab-x").length).toBe(year === 2005 ? 0 : 1);
  });

  it("books a bank line from the blank register row with Enter", () => {
    put(owner());
    render(<BooksApp />);
    const row = screen.getAllByText("Bank")[0].closest("tr")!;
    fireEvent.doubleClick(row);
    const number = screen.getByLabelText("Num") as HTMLInputElement;
    const inv = useStore.getState().game.invoices[0];
    fireEvent.change(number, { target: { value: inv.number } });
    expect(useStore.getState().game.transfers[0].matchedAt).toBeNull();
    fireEvent.keyDown(number, { key: "Enter" });
    expect(useStore.getState().game.transfers[0].matchedAt).not.toBeNull();
    expect(screen.getByText("Posted")).toBeTruthy();
    // The booked line leaves the blank row: nothing is left to pick.
    expect((screen.getByLabelText("Num") as HTMLInputElement).value).toBe("");
    expect(document.querySelectorAll("#gc-lines option").length).toBe(0);
  });

  it("names an unknown document number instead of booking", () => {
    put(owner());
    render(<BooksApp />);
    fireEvent.doubleClick(screen.getAllByText("Bank")[0].closest("tr")!);
    const number = screen.getByLabelText("Num");
    fireEvent.change(number, { target: { value: "2005-0000" } });
    fireEvent.keyDown(number, { key: "Enter" });
    expect(useStore.getState().game.transfers[0].matchedAt).toBeNull();
  });

  it("creates the company through the new-file assistant and ticks the guide steps", () => {
    const s = owner();
    put(s);
    render(<BooksApp />);
    expect(screen.getByRole("dialog", { name: "Welcome to GnuCache!" })).toBeTruthy();
    fireEvent.click(screen.getByText("Create a new set of accounts"));
    const assistant = screen.getByRole("dialog", { name: "Create a New Chart of Accounts" });
    for (let i = 0; i < 4; i++) {
      if (i === 2) fireEvent.change(within(assistant).getByLabelText("Chart of accounts"), { target: { value: "skr04" } });
      fireEvent.click(within(assistant).getByText("Forward"));
    }
    fireEvent.click(within(assistant).getByText("Apply"));
    const game = useStore.getState().game;
    expect(setupOf(game)).toMatchObject({ company: true, chart: "skr04" });
    const steps = guideOf(game).filter((x) => ["company", "chart", "method"].includes(x.id.split(".")[0])).map((x) => guideTicked(game, x));
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every(Boolean)).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("runs the actions menus: backup, opening balances and the bank link", () => {
    const s = owner();
    s.books = { ...s.books, setup: { ...setupOf(s), company: true, chart: "skr03", fiscalStart: 1, method: "euer" } };
    put(s);
    render(<BooksApp />);
    menu("File", "Save Backup");
    expect(useStore.getState().game.books.setup!.backupAt).not.toBeNull();
    menu("Actions", "Enter Opening Balances");
    expect(useStore.getState().game.books.setup!.opening).toBe(true);
    menu("Tools", "Online Banking Setup Assistant");
    expect(useStore.getState().game.books.setup!.bank).toBe(true);
  });

  it("opens the business and report pages from their menus", () => {
    const s = owner();
    s.books = { ...s.books, setup: { ...setupOf(s), company: true } };
    put(s);
    render(<BooksApp />);
    for (const [m, i] of [["Business", "Customers"], ["Business", "Invoices"], ["Business", "Suppliers"], ["Reports", "Profit and Loss"], ["Reports", "Account Summary"]]) menu(m, i);
    expect(screen.getAllByRole("tab").length).toBe(6);
  });

  it.each(Object.keys(LANGS))("shows no raw keys in %s", async (lang) => {
    const s = owner();
    s.books = { ...s.books, setup: { ...setupOf(s), company: true } };
    put(s);
    await loadLang(lang as never);
    render(<BooksApp />);
    for (const m of screen.getAllByRole("menuitem")) fireEvent.click(m);
    expect(document.body.textContent).not.toMatch(/\bgc\.\w+\.\w+/);
    if (lang === "de") expect(screen.getAllByRole("menuitem").map((x) => x.textContent)).toEqual(expect.arrayContaining(["Datei", "Bearbeiten", "Ansicht", "Aktionen", "Geschäft", "Berichte", "Werkzeuge", "Fenster", "Hilfe"]));
  });
});
