import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { postDay } from "../src/sim/40-support/letters";
import { checkMailLogin, MAIL_LOGIN } from "../src/sim/42-mail/accounts";
import type { GameState } from "../src/sim/50-state";
import { bookMail, setTenantLock } from "../src/sim/90-actions/mail";
import { changePassword, createMailAccount, requestPasswordReset, resetPassword, setAccountPassword } from "../src/sim/90-actions/mailbox";
import { rememberLogin } from "../src/sim/90-actions/store";
import { newGame, readyGame } from "./fixtures";
import { selfHosted } from "./company-mail.helpers";

const address = (s: GameState, id = s.mail.primary) => { const a = s.mail.accounts.find((x) => x.id === id)!; return `${a.local}@${a.domain}`; };
const pw = (s: GameState, id = s.mail.primary) => s.mail.accounts.find((x) => x.id === id)!.password;

describe("mail passwords", () => {
  it("sign in with the password only, and never to a shared or locked mailbox", () => {
    const s = newGame(1);
    expect(checkMailLogin(s, address(s), pw(s)).ok).toBe(true);
    expect(checkMailLogin(s, address(s), "wrong")).toEqual({ ok: false, error: "error.mailLogin" });
    expect(checkMailLogin(s, "nobody@gmix.com", "x")).toEqual({ ok: false, error: "error.mailLogin" });
    setTenantLock(s, s.mail.tenants[0].id, true);
    expect(checkMailLogin(s, address(s), pw(s))).toEqual({ ok: false, error: "error.mailLocked" });
    setTenantLock(s, s.mail.tenants[0].id, false);
    expect(checkMailLogin(s, address(s), pw(s)).ok).toBe(true);
  });

  it("post a reset code that arrives in two or three working days and sets the password once", () => {
    const s = newGame(2), at = s.hour;
    expect(requestPasswordReset(s, address(s)).ok).toBe(true);
    expect(requestPasswordReset(s, address(s))).toEqual({ ok: false, error: "error.mailResetOpen" });
    const letter = s.letters.at(-1)!, code = String(letter.params.code);
    expect(letter).toMatchObject({ topic: "mailReset", from: "GMix", link: "www.gmix.net/reset", params: { address: address(s) } });
    expect([postDay(at, 2), postDay(at, 3)]).toContain(letter.at);
    expect(resetPassword(s, address(s), code, "neues-pw")).toEqual({ ok: true, id: s.mail.primary });
    expect(checkMailLogin(s, address(s), "neues-pw").ok).toBe(true);
    expect(resetPassword(s, address(s), code, "again-pw")).toEqual({ ok: false, error: "error.mailCode" });
  });

  it("cancel the request after three wrong codes", () => {
    const s = newGame(3);
    requestPasswordReset(s, address(s));
    for (let i = 0; i < 3; i++) expect(resetPassword(s, address(s), "000000", "neues-pw")).toEqual({ ok: false, error: "error.mailCode" });
    expect(s.mail.accounts[0].reset).toBeNull();
    expect(requestPasswordReset(s, address(s)).ok).toBe(true);
  });

  it("reset on the own server with no letter", () => {
    const s = readyGame(4);
    selfHosted(s);
    expect(s.mail.tenants.find((t) => t.endsAt === null && t.host === "self")).toBeTruthy();
    const sales = s.mail.primary, letters = s.letters.length;
    expect(requestPasswordReset(s, address(s))).toEqual({ ok: false, error: "error.mailAdmin" });
    expect(setAccountPassword(s, null, sales, "server-pw").ok).toBe(true);
    expect(s.letters).toHaveLength(letters);
    expect(checkMailLogin(s, address(s), "server-pw").ok).toBe(true);
  });

  it("let a Goggle admin reset another user at once while the admin's own password needs the letter", () => {
    const s = readyGame(5);
    s.hour = hourOfMonth("2010-03");
    expect(bookMail(s, "goggleWorkspace").ok).toBe(true);
    const admin = s.mail.primary, tenant = s.mail.tenants.find((t) => t.host === "goggle" && t.endsAt === null)!;
    const user = (createMailAccount(s, { tenant: tenant.id, local: "info", title: "Info", password: "info-pw" }) as { id: string }).id;
    expect(setAccountPassword(s, admin, user, "reset-pw").ok).toBe(true);
    expect(checkMailLogin(s, address(s, user), "reset-pw").ok).toBe(true);
    expect(setAccountPassword(s, admin, admin, "own-pw")).toEqual({ ok: false, error: "error.mailAdmin" });
    expect(requestPasswordReset(s, address(s, user))).toEqual({ ok: false, error: "error.mailAdmin" });
    expect(requestPasswordReset(s, address(s, admin)).ok).toBe(true);
    expect(s.letters.at(-1)).toMatchObject({ from: "Goggle", link: "accounts.goggle.com/recovery" });
  });

  it("keep the KeePassive entry until the password changes", () => {
    const s = newGame(6), a = address(s), old = pw(s);
    expect(rememberLogin(s, MAIL_LOGIN(a), [a, old])).toEqual({ ok: false, error: "error.notInstalled" });
    s.installed = [...s.installed, "keepassive"];
    expect(rememberLogin(s, MAIL_LOGIN(a), [a, old]).ok).toBe(true);
    const [user, saved] = s.logins[MAIL_LOGIN(a)];
    expect(checkMailLogin(s, user, saved).ok).toBe(true);
    expect(changePassword(s, s.mail.primary, "wrong", "neues-pw")).toEqual({ ok: false, error: "error.mailLogin" });
    expect(changePassword(s, s.mail.primary, old, "neues-pw").ok).toBe(true);
    expect(checkMailLogin(s, user, saved)).toEqual({ ok: false, error: "error.mailLogin" });
  });
});
