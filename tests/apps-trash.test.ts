import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { openAccount } from "../src/sim/46-finance/bank";
import { newGame, type GameState } from "../src/sim/50-state";
import { buyBooks, installBooks, upgradeBooks } from "../src/sim/90-actions/bookkeeping";
import { addAppLink } from "../src/sim/90-actions/docs";
import { downloadProgram, installProgram, uninstallApp } from "../src/sim/90-actions/programs";

function game(): GameState {
  const s = newGame(31);
  s.hour = hourOf(new Date(Date.UTC(2005, 2, 10, 10)));
  s.cash = 5_000;
  s.bank = openAccount(s, "sparklasse");
  return s;
}

function books(s: GameState, id: string) {
  buyBooks(s, id);
  s.hour = s.books.download!.readyAt;
  return installBooks(s, id);
}

describe("installing from Downloads and the Trash", () => {
  it("a program goes to the Trash and installs again from Downloads", () => {
    const s = game();
    downloadProgram(s, "FileGorilla");
    s.hour = s.installers.FileGorilla.readyAt;
    expect(installProgram(s, "FileGorilla")).toEqual({ ok: true });
    addAppLink(s, "FileGorilla");
    expect(uninstallApp(s, "FileGorilla")).toEqual({ ok: true });
    expect(s.installed).not.toContain("FileGorilla");
    expect(s.docs.some((d) => d.kind === "app" && d.title === "FileGorilla")).toBe(false);
    expect(uninstallApp(s, "FileGorilla")).toEqual({ ok: false, error: "error.notInstalled" });
    expect(installProgram(s, "FileGorilla")).toEqual({ ok: true });
  });

  it("core apps stay", () => {
    const s = game();
    for (const app of ["Browser", "Applications", "Chat"]) expect(uninstallApp(s, app)).toEqual({ ok: false, error: "error.unknownProgram" });
  });

  it("removing the bookkeeping program keeps its data and its installer", () => {
    const s = game();
    expect(books(s, "wizo")).toEqual({ ok: true });
    expect(upgradeBooks(s, "m")).toEqual({ ok: true });
    const ledger = s.ledger, cash = s.cash;
    expect(uninstallApp(s, "Books")).toEqual({ ok: true });
    expect(s.installed).not.toContain("Books");
    expect(s.books).toMatchObject({ vendor: null, edition: null, download: { vendor: "wizo", edition: "m" } });
    expect(s.ledger).toBe(ledger);
    expect(installBooks(s, "wizo")).toEqual({ ok: true });
    expect(s.books).toMatchObject({ vendor: "wizo", edition: "m" });
    expect(s.cash).toBe(cash);
    expect(s.installed).toContain("Books");
  });

  it("installing another program replaces the running one", () => {
    const s = game();
    books(s, "gnucache");
    expect(books(s, "lexwear")).toEqual({ ok: true });
    expect(installBooks(s, "lexwear")).toEqual({ ok: false, error: "error.installed" });
    expect(s.books).toMatchObject({ vendor: "lexwear", download: { vendor: "lexwear" } });
    expect(s.installed.filter((a) => a === "Books")).toHaveLength(1);
  });
});
