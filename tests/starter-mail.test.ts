import { describe, expect, it } from "vitest";
import { clientFolder } from "../src/sim/43-pear-mail/view";
import { checkDone } from "../src/sim/checklist";
import { newGame } from "../src/sim/50-state";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { tick } from "../src/sim/88-tick/tick";
import { openBankAccount } from "../src/sim/90-actions/bank";
import { registerCompany } from "../src/sim/90-actions/company";
import { serverStatus } from "../src/sim/42-mail/accounts";

const addr = { street: "Kellerweg 1", zip: "60311", city: "Frankfurt" };
const fresh = () => { const s = newGame(1); s.hour = 56; expect(openBankAccount(s, "sparklasse").ok).toBe(true); return s; };
const box = (s: ReturnType<typeof newGame>) => s.mail.accounts.find((a) => a.id === s.mail.primary)!;

describe("starter mail", () => {
  it("registering opens the box, stores its login and sets up Pear Mail", () => {
    const s = fresh();
    expect(s.pearMail.accounts).toHaveLength(0);
    expect(registerCompany(s, "Basement Hosting", "Becker, Tin", "sole", addr).ok).toBe(true);
    const a = box(s), address = `${a.local}@${a.domain}`;
    expect(a.external).toBe(true);
    expect(s.logins[`mail:${address}`]).toEqual([address, a.password]);
    expect(s.pearMail.accounts).toHaveLength(1);
    expect(s.pearMail.accounts[0]).toMatchObject({ address, checkEvery: 15, enabled: true });
    expect(s.pearMail.accounts[0].server?.host).toMatch(/\.gmix\.net$/);
    expect(serverStatus(s, a.id, s.pearMail.accounts[0].protocol, a.password)).toBe("ok");
    expect(checkDone(s, "mail")).toBe(true);
  });

  it("downloads the welcome mail within the first check interval", () => {
    const s = fresh();
    registerCompany(s, "Basement Hosting", "Becker, Tin", "sole", addr);
    for (let i = 0; i < 40; i++) { s.minute += 1; tick(s); }
    const c = s.pearMail.accounts[0];
    expect(s.pearMail.activity.at(-1)?.error).toBeUndefined();
    expect(clientFolder(s, c, "inbox").length).toBeGreaterThan(0);
  });

  it("gives a registered save without them the same setup on load and keeps it once set", () => {
    const s = fresh();
    registerCompany(s, "Basement Hosting", "Becker, Tin", "sole", addr);
    const raw = JSON.parse(serialize(s));
    delete raw.pearMail;
    raw.logins = {};
    raw.mail.accounts[0].external = false;
    const old = deserialize(JSON.stringify(raw));
    expect(box(old).external).toBe(true);
    expect(Object.keys(old.logins)).toHaveLength(1);
    expect(old.pearMail.accounts).toHaveLength(1);
    const again = deserialize(serialize(old));
    expect(again.pearMail.accounts).toHaveLength(1);
  });

  it("leaves an unregistered save alone", () => {
    const s = deserialize(serialize(newGame(1)));
    expect(s.pearMail.accounts).toHaveLength(0);
    expect(s.logins).toEqual({});
  });
});
