import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { booksVendor } from "../src/sim/10-catalog/bookkeeping";
import { hbci, openAccount } from "../src/sim/46-finance/bank";
import type { GameState } from "../src/sim/50-state";
import { booksTick, hasFeature, MONTHLY_RUN_HOUR, UPDATE_KEY, works, YEAR_HOURS } from "../src/sim/80-business/bookkeeping";
import { taxView } from "../src/sim/80-business/tax";
import { payAllDue } from "../src/sim/90-actions/bank";
import { buyBooks, installBooks } from "../src/sim/90-actions/bookkeeping";
import { mailsAbout, newGame } from "./fixtures";

const program = (id: string) => booksVendor(id)!.program;
const at = (y: number, m: number, d: number, h = 10) => hourOf(new Date(Date.UTC(y, m - 1, d, h)));

function own(year: number, id: string, edition?: string, m = 3): GameState {
  const s = newGame(41);
  s.hour = at(year, m, 10);
  s.cash = 50_000;
  s.bank = openAccount(s, "sparklasse");
  expect(buyBooks(s, id, edition)).toEqual({ ok: true });
  if (s.books.download) {
    s.books.download.readyAt = s.hour;
    expect(installBooks(s, id)).toEqual({ ok: true });
  }
  return s;
}

// Ticks the program hour by hour up to the given hour.
function until(s: GameState, hour: number): void {
  while (s.hour < hour) { s.hour++; booksTick(s); }
}

describe("bookkeeping features over the years", () => {
  it("a browser program gains a feature in its ship year and its users get one mail", () => {
    const s = own(2016, "lexoffize", "s");
    expect(hasFeature(s, "dunning")).toBe(false);
    until(s, at(2017, 1, 1, 0));
    expect(hasFeature(s, "dunning")).toBe(true);
    until(s, at(2017, 1, 3));
    expect(mailsAbout(s, "booksFeature").map((m) => m.p)).toEqual([{ program: program("lexoffize"), feature: "dunning", desktop: 0 }]);
  });

  it("a desktop program gains a feature only with its yearly update", () => {
    const s = own(2014, "wizo", "s", 6);
    until(s, at(2015, 1, 2));
    expect(hasFeature(s, "match-by-reference")).toBe(false);
    expect(mailsAbout(s, "booksFeature")).toHaveLength(1);
    until(s, s.books.installedAt + YEAR_HOURS - 1);
    expect(hasFeature(s, "match-by-reference")).toBe(false);
    until(s, s.books.installedAt + YEAR_HOURS);
    expect(hasFeature(s, "match-by-reference")).toBe(true);
    // Bought after the ship year, the program comes with it.
    expect(hasFeature(own(2015, "wizo", "s"), "match-by-reference")).toBe(true);
  });

  it("Kontomix never gains a feature", () => {
    const s = own(2005, "collmix", "basic");
    const before = ["monthly-run", "match-by-reference", "dunning", "tax"].map((f) => hasFeature(s, f as never));
    s.hour = at(2030, 6, 1);
    expect(["monthly-run", "match-by-reference", "dunning", "tax"].map((f) => hasFeature(s, f as never))).toEqual(before);
  });

  it("Orgamin stops updates in 2012 and loses HBCI and Pay all from 2014", () => {
    const s = own(2011, "orgamin", "professional");
    until(s, at(2012, 1, 2));
    expect(mailsAbout(s, "booksSupportEnd").map((m) => m.p)).toEqual([{ program: program("orgamin"), to: "" }]);
    s.hour = at(2013, 12, 31, 12);
    expect(hbci(s)).toBe(true);
    s.hour = at(2014, 1, 1, MONTHLY_RUN_HOUR);
    expect(hasFeature(s, "hbci")).toBe(true);
    expect(hbci(s)).toBe(false);
    expect(payAllDue(s)).toEqual({ ok: false, error: "error.noHbci" });
    // The program keeps running.
    expect(s.books.vendor).toBe("orgamin");
    expect(works(s, "match-by-reference")).toBe(true);
  });

  it("Taxware ends in 2020 with an offer to move and loses tax filing from 2021", () => {
    const s = own(2019, "lexwear", "financial-office");
    until(s, at(2020, 1, 2));
    const mails = mailsAbout(s, "booksSupportEnd");
    expect(mails).toHaveLength(1);
    expect(mails[0].p).toEqual({ program: program("lexwear"), to: program("lexoffize") });
    expect(taxView(s)).toBe(true);
    until(s, at(2021, 1, 1, 0));
    expect(taxView(s)).toBe(false);
    until(s, at(2021, 4, 1));
    // No update fee after support ends.
    expect(JSON.stringify([s.ledger, s.payables])).not.toContain(UPDATE_KEY);
  });
});
