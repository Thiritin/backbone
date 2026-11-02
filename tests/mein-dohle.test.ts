import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { newGame, type GameState, type LedgerEntry } from "../src/sim/50-state";
import { registerDohle, taxNumberOf } from "../src/sim/80-business/tax";
import { tick } from "../src/sim/88-tick/tick";
import { openBankAccount } from "../src/sim/90-actions/bank";
import { registerCompany } from "../src/sim/90-actions/company";
import { fileReturn, loginMeinDohle } from "../src/sim/90-actions/tax";
import { DohleSite } from "../src/ui/apps/browser/sites/dohle/DohleSite";
import { DohleFormular } from "../src/ui/apps/dohle/DohleFormularApp";

const at = (y: number, m: number, d = 1, h = 0) => hourOf(new Date(Date.UTC(y, m - 1, d, h)));
const jump = (s: GameState, hour: number, hours = 1) => { s.hour = hour - 1; for (let i = 0; i < hours; i++) tick(s); };
const entry = (hour: number, category: string, amount: number): LedgerEntry => ({ hour, category, key: "ledger.test", params: {}, amount });
function company(): GameState {
  const s = newGame(7);
  s.hour = at(2012, 11, 5, 8);
  expect(openBankAccount(s, "sparklasse").ok).toBe(true);
  expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole", { street: "Kellerweg 1", zip: "60311", city: "Frankfurt" }).ok).toBe(true);
  tick(s);
  s.docs = [...s.docs, { id: "cert1", kind: "cert", title: "dohle-zertifikat.pfx", body: "", x: 0, y: 0 }];
  s.tax = { ...s.tax, answered: s.hour, number: taxNumberOf(7), numberAt: s.hour, cert: "cert1" };
  s.installed = [...s.installed, "DohleFormular"];
  s.cash = 100_000;
  return s;
}
const site = (s: GameState, path: string) => renderToString(createElement(DohleSite, { game: s, path, go: () => {} }));
const formular = (s: GameState) => renderToString(createElement(DohleFormular, { game: s, send: () => {}, portal: () => {} }));

describe("Mein DOHLE", () => {
  it("replaces the download page and DohleFormular in 2013", () => {
    const s = company();
    expect(site(s, "/download/")).toContain("DohleFormular");
    expect(site(s, "/mein/")).not.toContain("Log in");
    expect(formular(s)).not.toContain("discontinued");
    expect(loginMeinDohle(s, "cert1")).toEqual({ ok: false, error: "error.dohlePortal" });
    jump(s, at(2013, 1, 1));
    expect(site(s, "/download/")).not.toContain("<button");
    expect(site(s, "/")).toContain("Mein DOHLE");
    expect(site(s, "/mein/")).toContain("dohle-zertifikat.pfx");
    expect(formular(s)).toContain("discontinued");
    expect(formular(s)).not.toContain("Send");
  });

  it("logs in with the valid certificate and files the same returns", () => {
    const s = company();
    s.ledger = [...s.ledger, entry(at(2012, 12, 10), "payments", 1_190)];
    jump(s, at(2013, 1, 1));
    expect(loginMeinDohle(s, "doc0")).toEqual({ ok: false, error: "error.dohleCert" });
    expect(loginMeinDohle(s, "cert1").ok).toBe(true);
    const r = s.tax.returns.find((x) => x.kind === "vat" && x.from === at(2012, 12))!;
    expect(fileReturn(s, r.id).ok).toBe(true);
    expect(s.tax.returns.find((x) => x.id === r.id)!.booked).toBe(190);
    registerDohle(s);
    expect(loginMeinDohle(s, "cert1")).toEqual({ ok: false, error: "error.dohleCert" });
  });
});
