import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { BOOK_MODULES, BOOKS_VENDORS, booksVendor, included } from "../src/sim/10-catalog/bookkeeping";
import { STARTER_APPS } from "../src/sim/10-catalog/store";
import { openAccount } from "../src/sim/46-finance/bank";
import { newGame, type GameState } from "../src/sim/50-state";
import { booksTick, YEAR_HOURS } from "../src/sim/80-business/bookkeeping";
import { resolve } from "../src/sim/80-business/browser";
import { siteIndex } from "../src/sim/80-business/index";
import { deliverLicences, licenceKey } from "../src/sim/80-business/lexwear";
import { checkDone, TUTORIAL } from "../src/sim/checklist";
import { installBooks } from "../src/sim/90-actions/bookkeeping";
import { buyLicence, registerLicence } from "../src/sim/90-actions/lexwear";
import { deserialize, serialize } from "../src/sim/91-save/save";

const at = (y: number, m: number, d: number, h = 10) => hourOf(new Date(Date.UTC(y, m - 1, d, h)));

function game(year = 2005, bank = true): GameState {
  const s = newGame(31);
  s.hour = at(year, 3, 10);
  s.cash = 5_000;
  if (bank) s.bank = openAccount(s, "sparklasse");
  return s;
}

describe("bookkeeping vendors", () => {
  it("each vendor installs from its year only and debits its licence", () => {
    for (const v of BOOKS_VENDORS) {
      const early = game(2005);
      if (v.from > 2005) expect(installBooks(early, v.id)).toEqual({ ok: false, error: "error.unknownStoreItem" });
      const s = game(Math.max(2005, v.from));
      expect(installBooks(s, v.id)).toEqual({ ok: true });
      expect(s.cash).toBe(5_000 - v.licence);
      expect(s.books.vendor).toBe(v.id);
      expect(s.installed).toContain("Books");
      expect([...s.modules].sort()).toEqual([...included(v)].sort());
      // The monthly fee starts as the vendor's invoice.
      expect(s.payables.filter((p) => p.name === v.name).map((p) => p.amount)).toEqual(v.monthly ? [v.monthly] : []);
    }
  });

  it("bills the monthly fee at each month start and drops it after a switch", () => {
    const s = game(2005);
    installBooks(s, "collmix");
    s.hour = at(2005, 4, 1, 0);
    booksTick(s);
    expect(s.payables.filter((p) => p.name === "Collmix").length).toBe(2);
    installBooks(s, "wizo");
    s.hour = at(2005, 5, 1, 0);
    booksTick(s);
    expect(s.payables.filter((p) => p.name === "Collmix").length).toBe(2);
  });

  it("debits the fee straight off the cash without a bank account", () => {
    const s = game(2005, false);
    installBooks(s, "collmix");
    expect(s.cash).toBe(5_000 - 15);
    expect(s.payables).toEqual([]);
  });

  it("never sells a module the vendor does not offer and refuses included ones", () => {
    const s = game(2005);
    installBooks(s, "collmix");
    expect(buyLicence(s, "helpdesk-link", "collmix")).toEqual({ ok: false, error: "error.unknownModule" });
    expect(buyLicence(s, "hbci", "collmix")).toEqual({ ok: false, error: "error.moduleRegistered" });
    // Collmix has no keys: the module turns on at purchase.
    expect(buyLicence(s, "monthly-run", "collmix")).toEqual({ ok: true });
    expect(s.modules).toContain("monthly-run");
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.bookModule.monthly-run", params: { vendor: "Collmix" }, amount: -49 });
  });

  it("sells a keyed vendor's module at its own price with its own key", () => {
    const s = game(2005);
    installBooks(s, "wizo");
    const cash = s.cash;
    expect(buyLicence(s, "match-by-reference", "wizo")).toEqual({ ok: true });
    expect(s.cash).toBe(cash - 129);
    expect(s.modules).not.toContain("match-by-reference");
    deliverLicences(s);
    const mail = s.tickets.at(-1)!;
    expect(mail).toMatchObject({ topic: "books.licence", mail: { from: "WIZO", params: { module: "match-by-reference", program: "WIZO Mein Büro" } } });
    const key = licenceKey(s, "match-by-reference", "wizo");
    expect(key).not.toBe(licenceKey(s, "match-by-reference"));
    expect(registerLicence(s, licenceKey(s, "match-by-reference")).ok).toBe(false);
    expect(registerLicence(s, key)).toEqual({ ok: true, id: "match-by-reference" });
  });

  it("switching keeps the data and drops the old program's modules", () => {
    const s = game(2005);
    installBooks(s, "saga");
    expect(s.modules).toContain("monthly-run");
    s.modules = [...s.modules, "shop-link"];
    s.invoices = [{ id: "inv1" } as never];
    s.transfers = [{ id: "tr1" } as never];
    const before = { customers: s.customers, invoices: s.invoices, quotes: s.quotes, transfers: s.transfers, payables: s.payables };
    expect(installBooks(s, "orgamin")).toEqual({ ok: true });
    expect({ customers: s.customers, invoices: s.invoices, quotes: s.quotes, transfers: s.transfers, payables: s.payables }).toEqual(before);
    expect(s.modules.filter((m) => BOOK_MODULES.includes(m))).toEqual(["monthly-run"]);
    expect(s.modules).toContain("shop-link");
    // A program bought once installs again for free.
    const cash = s.cash;
    installBooks(s, "saga");
    expect(s.cash).toBe(cash);
  });

  it("bills the Lexwear update each year and blocks new modules while it is unpaid", () => {
    const s = game(2005);
    installBooks(s, "lexwear");
    const start = s.hour;
    for (const year of [1, 2]) {
      s.hour = start + year * YEAR_HOURS - 1;
      booksTick(s);
      s.hour++;
      booksTick(s);
      expect(s.payables.filter((p) => p.name === "Lexwear").length).toBe(year);
      expect(s.payables.at(-1)).toMatchObject({ amount: 99, supplier: "books" });
      expect(buyLicence(s, "monthly-run")).toEqual({ ok: false, error: "error.updateOpen" });
      s.payables.at(-1)!.paidAt = s.hour;
    }
    expect(buyLicence(s, "monthly-run")).toEqual({ ok: true });
  });

  it("gives old saves with Books Lexwear and old saves without it no program", () => {
    const raw = JSON.parse(serialize(newGame(4)));
    delete raw.books;
    raw.installed = ["Browser", "Books"];
    expect(deserialize(JSON.stringify(raw)).books).toEqual({ vendor: "lexwear", installedAt: 0 });
    raw.installed = ["Browser"];
    expect(deserialize(JSON.stringify(raw)).books.vendor).toBeNull();
  });

  it("starts a new game without Books and ticks the Getting started step on install", () => {
    const s = game(2005);
    expect(STARTER_APPS).not.toContain("Books");
    expect(s.books).toEqual({ vendor: null, installedAt: 0 });
    expect(TUTORIAL.indexOf("books")).toBeGreaterThan(TUTORIAL.indexOf("register"));
    expect(TUTORIAL.indexOf("books")).toBeLessThan(TUTORIAL.indexOf("firstCustomer"));
    expect(checkDone(s, "books")).toBe(false);
    installBooks(s, "orgamin");
    expect(checkDone(s, "books")).toBe(true);
  });

  it("puts each vendor's site in the Browser and in the index from its year", () => {
    const s = game(2005);
    expect(resolve(s, "www.wizo.de/").page).toEqual({ kind: "books", id: "wizo" });
    expect(resolve(s, "www.lexwear.de/").page).toEqual({ kind: "lexwear" });
    expect(resolve(s, "www.sevdeck.de/").page.kind).not.toBe("books");
    const rows = (x: GameState) => siteIndex(x).find((c) => c.title === "Bookkeeping")!.rows.map((r) => r.title);
    expect(rows(s)).toEqual(BOOKS_VENDORS.filter((v) => v.from === 2005).map((v) => v.program));
    s.hour = at(2014, 6, 1);
    expect(rows(s)).toContain(booksVendor("lexoffize")!.program);
  });
});
