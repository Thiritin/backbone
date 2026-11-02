import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { booksVendor } from "../src/sim/10-catalog/bookkeeping";
import { openAccount } from "../src/sim/46-finance/bank";
import { newGame, type GameState } from "../src/sim/50-state";
import { buyBooks, installBooks, setupHours } from "../src/sim/90-actions/bookkeeping";
import { deserialize, serialize } from "../src/sim/91-save/save";

const at = (y: number, m: number, d: number, h = 10) => hourOf(new Date(Date.UTC(y, m - 1, d, h)));

function game(year = 2005): GameState {
  const s = newGame(31);
  s.hour = at(year, 3, 10);
  s.cash = 5_000;
  s.bank = openAccount(s, "sparklasse");
  return s;
}

describe("bookkeeping programs from the vendor's site", () => {
  it("a desktop program is paid, downloads over the line and installs from the site", () => {
    const s = game(), cash = s.cash;
    expect(buyBooks(s, "wizo", "m")).toEqual({ ok: true });
    expect(s.cash).toBe(cash - 249);
    const d = s.books.download!;
    expect(d).toMatchObject({ vendor: "wizo", edition: "m", startedAt: s.hour });
    expect(d.readyAt - d.startedAt).toBe(setupHours(s, booksVendor("wizo")!));
    expect(d.readyAt).toBeGreaterThan(s.hour);
    expect(s.installed).not.toContain("Books");
    expect(buyBooks(s, "wizo", "m")).toEqual({ ok: false, error: "error.booksDownloading" });
    expect(installBooks(s, "wizo")).toEqual({ ok: false, error: "error.booksDownloading" });
    s.hour = d.readyAt;
    expect(installBooks(s, "wizo")).toEqual({ ok: true });
    expect(s.books).toMatchObject({ vendor: "wizo", edition: "m", download: null });
    expect(s.installed).toContain("Books");
    expect(s.cash).toBe(cash - 249);
  });

  it("a slower line takes longer and no line refuses the download", () => {
    const s = game(), v = booksVendor("saga")!;
    const fast = setupHours(s, v)!;
    expect(setupHours(s, booksVendor("gnucache")!)).toBeLessThanOrEqual(fast);
    s.player = { ...s.player, doing: "travel", until: s.hour + 5 };
    expect(setupHours(s, v)).toBeNull();
    const cash = s.cash;
    expect(buyBooks(s, "saga")).toEqual({ ok: false, error: "error.booksOffline" });
    expect(s.cash).toBe(cash);
  });

  it("installing needs that vendor's download", () => {
    const s = game();
    expect(installBooks(s, "lexwear")).toEqual({ ok: false, error: "error.booksNotDownloaded" });
    buyBooks(s, "orgamin");
    s.hour = s.books.download!.readyAt;
    expect(installBooks(s, "lexwear")).toEqual({ ok: false, error: "error.booksNotDownloaded" });
  });

  it("a browser program starts at sign-up without a download", () => {
    const s = game(2014);
    expect(buyBooks(s, "lexoffize")).toEqual({ ok: true });
    expect(s.books).toMatchObject({ vendor: "lexoffize", download: null });
    expect(s.installed).toContain("Books");
  });

  it("a running program stays until the new one is installed", () => {
    const s = game();
    buyBooks(s, "gnucache");
    s.hour = s.books.download!.readyAt;
    installBooks(s, "gnucache");
    buyBooks(s, "lexwear");
    expect(s.books.vendor).toBe("gnucache");
    s.hour = s.books.download!.readyAt;
    installBooks(s, "lexwear");
    expect(s.books).toMatchObject({ vendor: "lexwear", download: null });
  });

  it("a download survives a save and old saves load without one", () => {
    const s = game();
    buyBooks(s, "saga");
    expect(deserialize(serialize(s)).books.download).toEqual(s.books.download);
    const raw = JSON.parse(serialize(game()));
    delete raw.books.download;
    expect(deserialize(JSON.stringify(raw)).books.download).toBeNull();
  });
});
