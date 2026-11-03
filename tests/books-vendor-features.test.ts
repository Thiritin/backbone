import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { booksVendor, type Feature } from "../src/sim/10-catalog/bookkeeping";
import { hbci, openAccount } from "../src/sim/46-finance/bank";
import { newGame, type GameState } from "../src/sim/50-state";
import { hasFeature, HBCI_KEY } from "../src/sim/80-business/bookkeeping";
import { taxView } from "../src/sim/80-business/tax";
import { payAllDue } from "../src/sim/90-actions/bank";
import { buyAddon, buyBooks, installBooks } from "../src/sim/90-actions/bookkeeping";
import { deserialize, serialize } from "../src/sim/91-save/save";

function game(year = 2014): GameState {
  const s = newGame(17);
  s.hour = hourOf(new Date(Date.UTC(year, 2, 10, 10)));
  s.cash = 5_000;
  s.bank = { ...openAccount(s, "sparklasse"), welcomed: true };
  return s;
}

// The vendor's smallest edition, as installed.
function run(s: GameState, vendor: string): GameState {
  s.books = { vendor: vendor as never, installedAt: s.hour, edition: booksVendor(vendor)!.editions[0].id, seats: 0, download: null, addons: [] };
  return s;
}

function own(s: GameState, id: string): void {
  expect(buyBooks(s, id)).toEqual({ ok: true });
  s.books.download!.readyAt = s.hour;
  expect(installBooks(s, id)).toEqual({ ok: true });
}

const has = (vendor: string, f: Feature) => hasFeature(run(game(), vendor), f);

describe("vendor features", () => {
  it("gives GnuCache reports without HBCI, tax, matching or the monthly run", () => {
    const s = run(game(2005), "gnucache");
    expect(hasFeature(s, "reports")).toBe(true);
    for (const f of ["hbci", "tax", "match-by-reference", "monthly-run", "dunning"] as Feature[]) expect(hasFeature(s, f)).toBe(false);
    expect(hbci(s)).toBe(false);
    expect(taxView(s)).toBe(false);
  });

  it("gives Kontomix HBCI without matching or the monthly run", () => {
    expect(has("collmix", "hbci")).toBe(true);
    expect(booksVendor("collmix")!.editions.some((e) => e.features.includes("match-by-reference") || e.features.includes("monthly-run"))).toBe(false);
  });

  it("matches by reference at EightDesk in every edition and never sells dunning", () => {
    expect(booksVendor("sevdeck")!.editions.every((e) => e.features.includes("match-by-reference") && !e.features.includes("dunning"))).toBe(true);
  });

  it("runs HBCI, matching and tax in the smallest Rexoffice edition", () => {
    const s = run(game(), "lexoffize");
    expect(["hbci", "match-by-reference", "tax"].every((f) => hasFeature(s, f as Feature))).toBe(true);
    expect(hbci(s)).toBe(true);
  });

  it("sells HBCI to Taxware only as an add-on, kept until the program changes", () => {
    const s = game(2005);
    expect(booksVendor("lexwear")!.editions.some((e) => e.features.includes("hbci"))).toBe(false);
    own(s, "lexwear");
    expect(hbci(s)).toBe(false);
    const cash = s.cash;
    expect(buyAddon(s, "hbci")).toEqual({ ok: true });
    expect(s.cash).toBe(cash - 99);
    expect(s.ledger.at(-1)).toMatchObject({ key: HBCI_KEY, amount: -99 });
    expect(hbci(s)).toBe(true);
    expect(buyAddon(s, "hbci")).toEqual({ ok: false, error: "error.installed" });
    expect(deserialize(serialize(s)).books.addons).toEqual(["hbci"]);
    own(s, "wizo");
    expect(s.books.addons).toEqual([]);
    expect(buyAddon(s, "hbci")).toEqual({ ok: false, error: "error.unknownEdition" });
  });

  it("pays all open supplier invoices only with HBCI", () => {
    expect(payAllDue(run(game(2005), "gnucache"))).toEqual({ ok: false, error: "error.noHbci" });
    expect(payAllDue(run(game(2005), "collmix"))).toEqual({ ok: true });
  });

  it("loads a save without add-ons", () => {
    const raw = JSON.parse(serialize(run(game(), "lexoffize")));
    delete raw.books.addons;
    expect(deserialize(JSON.stringify(raw)).books.addons).toEqual([]);
  });
});
