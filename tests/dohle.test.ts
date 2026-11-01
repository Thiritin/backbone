import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { euroCents } from "../src/sim/00-core/money";
import { hourOf } from "../src/sim/00-core/time";
import { inbox, postDay } from "../src/sim/40-support/letters";
import { newGame, type GameState } from "../src/sim/50-state";
import { salesAddress } from "../src/sim/80-business/mail";
import { CERT_FILE, CODE_DAYS, certOk, FORMULAR_APP, taxNumberOf } from "../src/sim/80-business/tax";
import { tick } from "../src/sim/88-tick/tick";
import { openBankAccount } from "../src/sim/90-actions/bank";
import { registerCompany } from "../src/sim/90-actions/company";
import { removeDoc } from "../src/sim/90-actions/docs";
import { activateDohle, fileVatReturn, installDohleFormular, leaveSmallRule, registerForDohle } from "../src/sim/90-actions/tax";
import { DohleSite } from "../src/ui/apps/browser/sites/dohle/DohleSite";
import { DohleFormular } from "../src/ui/apps/dohle/DohleFormularApp";

const at = (y: number, m: number, d = 1, h = 0) => hourOf(new Date(Date.UTC(y, m - 1, d, h)));
const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
function company(): GameState {
  const s = newGame(7);
  s.hour = at(2005, 1, 3, 8);
  expect(openBankAccount(s, "sparklasse").ok).toBe(true);
  expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole").ok).toBe(true);
  run(s, 1);
  s.tax = { ...s.tax, answered: s.hour, number: taxNumberOf(7), numberAt: s.hour };
  return s;
}
const mail = (s: GameState) => s.tickets.filter((t) => t.kind === "mail" && t.topic === "dohleId").at(-1)!;
// Registers, waits for the code's letter and activates.
function certified(s: GameState): string {
  expect(registerForDohle(s, taxNumberOf(7), salesAddress(s)).ok).toBe(true);
  run(s, s.tax.codeAt! - s.hour + 1);
  const code = inbox(s).filter((l) => l.topic === "dohleCode").at(-1)!.params.code as string;
  const r = activateDohle(s, String(mail(s).mail!.params.id), code);
  if (!r.ok) throw new Error(r.error);
  return r.id!;
}

describe("DOHLE", () => {
  it("registers with the tax number and the company's email address only", () => {
    const s = company();
    expect(registerForDohle(s, "045 000 00000", salesAddress(s))).toEqual({ ok: false, error: "error.dohleTaxNumber" });
    expect(registerForDohle(s, taxNumberOf(7), "someone@else.de")).toEqual({ ok: false, error: "error.dohleMail" });
    expect(registerForDohle(s, taxNumberOf(7).replace(/ /g, ""), salesAddress(s).toUpperCase()).ok).toBe(true);
  });

  it("emails the activation ID at once and posts the code after two or three working days", () => {
    const s = company();
    registerForDohle(s, taxNumberOf(7), salesAddress(s));
    expect(mail(s).mail!.params.id).toBe(s.tax.dohleId);
    expect([postDay(s.hour, CODE_DAYS), postDay(s.hour, CODE_DAYS + 1)]).toContain(s.tax.codeAt);
    expect(activateDohle(s, s.tax.dohleId, s.tax.dohleCode)).toEqual({ ok: false, error: "error.dohleNoCode" });
  });

  it("puts the certificate on the desktop and refuses a wrong code", () => {
    const s = company();
    registerForDohle(s, taxNumberOf(7), salesAddress(s));
    run(s, s.tax.codeAt! - s.hour + 1);
    expect(activateDohle(s, s.tax.dohleId, "AAAA-BBBB-CCCC")).toEqual({ ok: false, error: "error.dohleCode" });
    const id = certified(s);
    expect(s.docs.find((d) => d.id === id)).toMatchObject({ kind: "cert", title: CERT_FILE });
    expect(certOk(s)).toBe(true);
  });

  it("files the advance return with the certificate and refuses without it", () => {
    const s = company();
    s.cash = 10_000;
    run(s, at(2005, 2, 1) - s.hour + 1);
    const r = s.tax.returns[0];
    expect(fileVatReturn(s, r.id)).toEqual({ ok: false, error: "error.dohleCert" });
    const cert = certified(s);
    expect(removeDoc(s, cert).ok).toBe(true);
    expect(fileVatReturn(s, r.id)).toEqual({ ok: false, error: "error.dohleCert" });
    // A new registration revokes the old certificate and issues a new one.
    certified(s);
    expect(fileVatReturn(s, r.id).ok).toBe(true);
  });

  it("revokes the certificate on a new registration even while its file is on the desktop", () => {
    const s = company();
    certified(s);
    registerForDohle(s, taxNumberOf(7), salesAddress(s));
    expect(certOk(s)).toBe(false);
  });

  it("installs DohleFormular from the download page", () => {
    const s = company();
    expect(installDohleFormular(s).ok).toBe(true);
    expect(s.installed).toContain(FORMULAR_APP);
    expect(installDohleFormular(s)).toEqual({ ok: false, error: "error.installed" });
  });

  it("shows registration, activation, download and leaving the small business rule on the site", () => {
    const s = company();
    s.tax = { ...s.tax, small: true };
    const page = (path: string) => renderToString(createElement(DohleSite, { game: s, path, go: () => {} }));
    expect(page("/erfassung/")).toContain("Leave small business rule");
    expect(leaveSmallRule(s).ok).toBe(true);
    expect(page("/erfassung/")).not.toContain("Leave small business rule");
    expect(page("/registrieren/")).not.toContain("Activation code");
    registerForDohle(s, taxNumberOf(7), salesAddress(s));
    expect(page("/registrieren/")).toContain("Activation code");
    certified(s);
    expect(page("/registrieren/")).toContain("Lost certificate");
    expect(page("/registrieren/?neu")).toContain("Email address");
    expect(page("/download/")).toContain("Download");
  });

  it("lists the open returns with their VAT in DohleFormular", () => {
    const s = company();
    s.ledger = [...s.ledger, { hour: at(2005, 1, 20), category: "payments", key: "ledger.test", params: {}, amount: 1160 }];
    run(s, at(2005, 2, 1) - s.hour + 1);
    const view = () => renderToString(createElement(DohleFormular, { game: s, send: () => {} }));
    const html = view();
    expect(html).toContain("Advance VAT return");
    expect(html).toContain(euroCents(160));
    s.tax = { ...s.tax, returns: [] };
    expect(view()).toContain("No open returns");
  });
});
