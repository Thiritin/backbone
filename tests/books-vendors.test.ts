import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { BOOKS_VENDORS, booksVendor } from "../src/sim/10-catalog/bookkeeping";
import { STARTER_APPS } from "../src/sim/10-catalog/store";
import { openAccount } from "../src/sim/46-finance/bank";
import { newGame, type GameState } from "../src/sim/50-state";
import { booksTick, YEAR_HOURS } from "../src/sim/80-business/bookkeeping";
import { resolve } from "../src/sim/80-business/browser";
import { siteIndex } from "../src/sim/80-business/index";
import { checkDone, TUTORIAL } from "../src/sim/checklist";
import { buyBooks, installBooks, upgradeBooks } from "../src/sim/90-actions/bookkeeping";
import { deserialize, serialize } from "../src/sim/91-save/save";

// Buys a program on its vendor's site and, for a desktop program, installs it once its download is done.
function own(s: GameState, id: string, edition?: string) {
  const r = buyBooks(s, id, edition);
  if (!r.ok || !s.books.download) return r;
  s.books.download.readyAt = s.hour;
  return installBooks(s, id);
}

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
      if (v.from > 2005) expect(own(early, v.id)).toEqual({ ok: false, error: "error.unknownStoreItem" });
      const s = game(Math.max(2005, v.from));
      expect(own(s, v.id)).toEqual({ ok: true });
      const e = v.editions[0], web = v.deployment === "browser";
      expect(s.cash).toBe(5_000 - (web ? 0 : e.price));
      expect(s.books.vendor).toBe(v.id);
      expect(s.installed).toContain("Books");
      expect(s.books.edition).toBe(e.id);
      // The monthly fee starts as the vendor's invoice.
      expect(s.payables.filter((p) => p.name === v.name).map((p) => p.amount)).toEqual(web ? [e.price] : []);
    }
  });

  it("bills the monthly fee at each month start and drops it after a switch", () => {
    const s = game(2005);
    own(s, "collmix");
    s.hour = at(2005, 4, 1, 0);
    booksTick(s);
    expect(s.payables.filter((p) => p.name === "Collmix").length).toBe(2);
    own(s, "wizo");
    s.hour = at(2005, 5, 1, 0);
    booksTick(s);
    expect(s.payables.filter((p) => p.name === "Collmix").length).toBe(2);
  });

  it("debits the fee straight off the cash without a bank account", () => {
    const s = game(2005, false);
    own(s, "collmix");
    expect(s.cash).toBe(5_000 - 15);
    expect(s.payables).toEqual([]);
  });

  it("switching keeps the data and the shop modules, and runs the new program's smallest edition", () => {
    const s = game(2005);
    own(s, "saga");
    s.modules = [...s.modules, "shop-link"];
    s.invoices = [{ id: "inv1" } as never];
    s.transfers = [{ id: "tr1" } as never];
    const before = { customers: s.customers, invoices: s.invoices, quotes: s.quotes, transfers: s.transfers, payables: s.payables };
    expect(own(s, "orgamin")).toEqual({ ok: true });
    expect({ customers: s.customers, invoices: s.invoices, quotes: s.quotes, transfers: s.transfers, payables: s.payables }).toEqual(before);
    expect(s.books.edition).toBe("standard");
    expect(s.modules).toContain("shop-link");
    // A program bought once installs again for free.
    const cash = s.cash;
    own(s, "saga");
    expect(s.cash).toBe(cash);
  });

  it("bills the Lexwear update each year and blocks upgrades while it is unpaid", () => {
    const s = game(2005);
    own(s, "lexwear");
    const start = s.hour;
    for (const year of [1, 2]) {
      s.hour = start + year * YEAR_HOURS - 1;
      booksTick(s);
      s.hour++;
      booksTick(s);
      expect(s.payables.filter((p) => p.name === "Lexwear").length).toBe(year);
      expect(s.payables.at(-1)).toMatchObject({ amount: 99, supplier: "books" });
      expect(upgradeBooks(s, "financial-office")).toEqual({ ok: false, error: "error.updateOpen" });
      s.payables.at(-1)!.paidAt = s.hour;
    }
    expect(upgradeBooks(s, "financial-office")).toEqual({ ok: true });
  });

  it("gives old saves with Books Lexwear and old saves without it no program", () => {
    const raw = JSON.parse(serialize(newGame(4)));
    delete raw.books;
    raw.installed = ["Browser", "Books"];
    expect(deserialize(JSON.stringify(raw)).books).toEqual({ vendor: "lexwear", installedAt: 0, edition: "buchhalter", seats: 0, download: null });
    raw.installed = ["Browser"];
    expect(deserialize(JSON.stringify(raw)).books.vendor).toBeNull();
  });

  it("starts a new game without Books and ticks the Getting started step on install", () => {
    const s = game(2005);
    expect(STARTER_APPS).not.toContain("Books");
    expect(s.books).toEqual({ vendor: null, installedAt: 0, edition: null, seats: 0, download: null });
    expect(TUTORIAL.indexOf("books")).toBeGreaterThan(TUTORIAL.indexOf("register"));
    expect(TUTORIAL.indexOf("books")).toBeLessThan(TUTORIAL.indexOf("firstCustomer"));
    expect(checkDone(s, "books")).toBe(false);
    own(s, "orgamin");
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
