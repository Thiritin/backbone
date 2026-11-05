import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { booksVendor, type BooksVendorId } from "../src/sim/10-catalog/bookkeeping";
import { openAccount } from "../src/sim/46-finance/bank";
import { newGame, type GameState } from "../src/sim/50-state";
import { booksKey, BOOKS_GUIDE, guideOf, needsActivation, needsKey } from "../src/sim/80-business/books-guide";
import { ACTIONS } from "../src/sim/90-actions";
import { acceptBooksLicence, activateBooks, backupBooks, buyAddon, buyBooks, createBooksCompany, enterBooksKey, enterOpening, installBooks, linkBooksBank, setBooksTemplate } from "../src/sim/90-actions/bookkeeping";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { tick } from "../src/sim/88-tick/tick";
import { mailsAbout } from "./fixtures";

const IDS = Object.keys(BOOKS_GUIDE) as BooksVendorId[];

function game(year = 2015): GameState {
  const s = newGame(17);
  s.hour = hourOf(new Date(Date.UTC(year, 2, 10, 10)));
  s.cash = 50_000;
  s.bank = { ...openAccount(s, "sparklasse"), welcomed: true };
  return s;
}

function own(s: GameState, id: BooksVendorId): void {
  expect(buyBooks(s, id)).toEqual({ ok: true });
  if (s.books.download) s.books.download.readyAt = s.hour;
  if (booksVendor(id)!.deployment === "desktop") expect(installBooks(s, id)).toEqual({ ok: true });
}

// Every action of the install, as the installer and the program's assistants call them.
function walk(s: GameState, id: BooksVendorId): void {
  const v = booksVendor(id)!;
  if (v.deployment === "desktop") expect(acceptBooksLicence(s)).toEqual({ ok: true });
  if (needsKey(id)) expect(enterBooksKey(s, booksKey(s, id).toLowerCase())).toEqual({ ok: true });
  if (v.deployment === "browser" || needsActivation(id)) expect(activateBooks(s)).toEqual({ ok: true });
  expect(createBooksCompany(s, { chart: "skr03", fiscalStart: 1, method: "soll" })).toEqual({ ok: true });
  expect(enterOpening(s)).toEqual({ ok: true });
}

describe("books install guide", () => {
  it("registers every action", () => {
    for (const n of ["acceptBooksLicence", "enterBooksKey", "activateBooks", "createBooksCompany", "enterOpening", "linkBooksBank", "setBooksTemplate", "backupBooks"]) expect(ACTIONS[n]).toBeTypeOf("function");
  });

  it.each(IDS)("%s reaches done through the actions in order", (id) => {
    const s = game();
    own(s, id);
    expect(s.books.setupDone).toBe(false);
    walk(s, id);
    expect(s.books.setupDone).toBe(true);
    expect(guideOf(s).filter((x) => !x.optional).every((x) => s.books.setup!.ticked.includes(x.id))).toBe(true);
  });

  it("refuses the steps out of order and a wrong key", () => {
    const s = game();
    own(s, "lexwear");
    expect(enterBooksKey(s, booksKey(s, "lexwear"))).toEqual({ ok: false, error: "error.booksSetupOrder" });
    acceptBooksLicence(s);
    expect(enterBooksKey(s, "AAAA-AAAA-AAAA-AAAA")).toEqual({ ok: false, error: "error.booksKey" });
    expect(createBooksCompany(s, { chart: "skr03", fiscalStart: 1, method: "soll" })).toEqual({ ok: false, error: "error.booksSetupOrder" });
    enterBooksKey(s, booksKey(s, "lexwear"));
    activateBooks(s);
    expect(createBooksCompany(s, { chart: "skr03", fiscalStart: 13, method: "soll" })).toEqual({ ok: false, error: "error.booksCompany" });
    expect(enterOpening(s)).toEqual({ ok: false, error: "error.booksSetupOrder" });
  });

  it("ticks the optional steps from their predicates and keeps them ticked", () => {
    const s = game();
    own(s, "lexwear");
    walk(s, "lexwear");
    expect(linkBooksBank(s)).toEqual({ ok: false, error: "error.booksBank" });
    expect(buyAddon(s, "hbci")).toEqual({ ok: true });
    expect(linkBooksBank(s)).toEqual({ ok: true });
    expect(setBooksTemplate(s)).toEqual({ ok: true });
    s.hour += 5;
    expect(backupBooks(s)).toEqual({ ok: true });
    expect(s.books.setup!.backupAt).toBe(s.hour);
    s.tax.number = "12/345/67890";
    tick(s);
    const ticked = [...s.books.setup!.ticked];
    expect(ticked).toEqual(expect.arrayContaining(["bank", "template", "backup", "tax"]));
    s.tax.number = "";
    s.books.setup!.bank = false;
    tick(s);
    expect(s.books.setup!.ticked).toEqual(expect.arrayContaining(ticked));
  });

  it("gates steps by era", () => {
    const old = game(2008), now = game(2016);
    own(old, "wizo");
    own(now, "wizo");
    expect(guideOf(old).some((x) => x.id === "cert")).toBe(false);
    expect(guideOf(now).some((x) => x.id === "cert")).toBe(true);
  });

  it("mails the key with the order and the sign-up link for a browser program", () => {
    const s = game();
    expect(buyBooks(s, "orgamin")).toEqual({ ok: true });
    expect(mailsAbout(s, "booksKey")[0].p?.key).toBe(booksKey(s, "orgamin"));
    expect(booksKey(s, "saga")).not.toBe(booksKey(s, "orgamin"));
    expect(booksKey(game(), "orgamin")).toBe(booksKey(s, "orgamin"));
    const b = game();
    own(b, "sevdeck");
    expect(mailsAbout(b, "booksSignup")).toHaveLength(1);
  });

  it("fills the setup of an old save and leaves an unfinished one open", () => {
    const s = game();
    own(s, "lexwear");
    const raw = JSON.parse(serialize(s));
    delete raw.books.setup;
    raw.books.setupDone = true;
    const done = deserialize(JSON.stringify(raw));
    expect(done.books.setup).toMatchObject({ licence: true, company: true, activated: true, key: booksKey(done, "lexwear") });
    expect(guideOf(done).filter((x) => !x.optional).every((x) => x.check(done) || done.books.setup!.ticked.includes(x.id))).toBe(true);
    raw.books.setupDone = false;
    const open = deserialize(JSON.stringify(raw));
    expect(open.books.setup).toMatchObject({ licence: false, company: false, key: "" });
    expect(open.books.setupDone).toBe(false);
  });
});
