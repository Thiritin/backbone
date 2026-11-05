import { describe, expect, it } from "vitest";
import { nowMinutes } from "../src/sim/00-core/time";
import { deliver } from "../src/sim/42-mail/deliver";
import { clientError } from "../src/sim/43-pear-mail/check";
import { clientAccount } from "../src/sim/43-pear-mail/state";
import { mailAddress } from "../src/sim/60-infra/addresses";
import { mailClusterAtHost, namesOf } from "../src/sim/60-infra/mail-host";
import { BOX_CAP, panelBody, panelLogin, panelMessages, panelSubject } from "../src/sim/60-infra/panel-mail";
import { panelMachine } from "../src/sim/60-infra/licence";
import { resolve } from "../src/sim/80-business/browser";
import { mailClusterAt } from "../src/sim/80-business/webmail";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { readPanelMail, sendPanelMail } from "../src/sim/90-actions/panel-mail";
import { createMailbox } from "../src/sim/90-actions/webspace";
import { tick } from "../src/sim/88-tick/tick";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { selfHosted } from "./company-mail.helpers";
import { BASEMENT_SERVER, newGame, panelServer, readyGame, skipTo, withServer } from "./fixtures";

function account() {
  const s = withServer(newGame(3));
  skipTo(s, 2010);
  const host = panelServer(s, BASEMENT_SERVER, "cpanic");
  const cus = addCustomer(s, "Socken Shop", "onlineShop");
  const r = provisionService(s, cus, "webHosting", { label: "sockenshop.de", spec: { ...sizeSpec("webHosting", 0, 2010), mailboxes: 12, app: "static" }, clusterId: host });
  expect(r.ok).toBe(true);
  s.company.domain ??= "testco.de";
  s.hour += 24;
  return { s, id: s.workloads.find((x) => x.serviceId === (r as { id: string }).id)!.id };
}

describe("panel mailboxes", () => {
  it("gets a welcome mail, signs in and fails on a wrong password", () => {
    const { s, id } = account();
    expect((createMailbox(s, id, "anna", "sockenshop.de", "secret1", 100) as { error?: string }).error).toBeUndefined();
    expect(panelLogin(s, "anna@sockenshop.de", "secret1")).not.toBeNull();
    expect(panelLogin(s, "anna@sockenshop.de", "wrong")).toBeNull();
    expect(panelLogin(s, "nobody@sockenshop.de", "secret1")).toBeNull();
    const [welcome] = panelMessages(s, "anna@sockenshop.de");
    expect(welcome).toMatchObject({ folder: "inbox", read: false, tkey: "welcome" });
    expect(panelSubject(welcome)).not.toBe("");
    expect(panelBody(welcome)).toContain("anna@sockenshop.de");
    expect(readPanelMail(s, "anna@sockenshop.de", "wrong", welcome.id).ok).toBe(false);
    expect(readPanelMail(s, "anna@sockenshop.de", "secret1", welcome.id).ok).toBe(true);
    expect(panelMessages(s, "anna@sockenshop.de")[0].read).toBe(true);
  });

  it("takes mail from the pipeline and between mailboxes", () => {
    const { s, id } = account();
    createMailbox(s, id, "anna", "sockenshop.de", "secret1", 100);
    createMailbox(s, id, "bob", "sockenshop.de", "secret2", 100);
    deliver(s, { to: "anna@sockenshop.de", from: "n:Dwell", kind: "order", own: { subject: "Order 7", text: "Two crates." } });
    expect(panelMessages(s, "anna@sockenshop.de").map((m) => m.subject)).toContain("Order 7");
    expect(sendPanelMail(s, "anna@sockenshop.de", "secret1", "bob@sockenshop.de", "Hi", "Hello Bob").ok).toBe(true);
    expect(panelMessages(s, "bob@sockenshop.de").some((m) => m.subject === "Hi" && m.from === "anna@sockenshop.de")).toBe(true);
    expect(panelMessages(s, "anna@sockenshop.de").some((m) => m.folder === "sent" && m.to === "bob@sockenshop.de")).toBe(true);
    expect(sendPanelMail(s, "anna@sockenshop.de", "secret1", "nonsense", "x", "y").ok).toBe(false);
    expect(sendPanelMail(s, "anna@sockenshop.de", "bad", "bob@sockenshop.de", "x", "y").ok).toBe(false);
  });

  it("bounces mail to a domain that does not exist", () => {
    const { s, id } = account();
    createMailbox(s, id, "anna", "sockenshop.de", "secret1", 100);
    expect(sendPanelMail(s, "anna@sockenshop.de", "secret1", "x@no-such-domain-zz.example", "Hi", "Yo")).toMatchObject({ ok: false, error: "panelmail.error.undeliverable" });
    expect(panelMessages(s, "anna@sockenshop.de").some((m) => m.folder === "sent")).toBe(false);
  });

  it("caps a box, dropping read mail first, and purges the mail of removed mailboxes", () => {
    const { s, id } = account();
    createMailbox(s, id, "anna", "sockenshop.de", "secret1", 100);
    for (let day = 0; day < 90; day++) {
      for (let n = 0; n < 4; n++) deliver(s, { to: "anna@sockenshop.de", from: "n:Dwell", kind: "order", own: { subject: `Day ${day} mail ${n}`, text: "x" } });
      for (const m of panelMessages(s, "anna@sockenshop.de").slice(0, 2)) readPanelMail(s, "anna@sockenshop.de", "secret1", m.id);
    }
    const box = panelMessages(s, "anna@sockenshop.de");
    expect(box.length).toBe(BOX_CAP);
    expect(box.at(-1)!.subject).toBe("Day 89 mail 3");
    s.panelMail["ghost@gone.de"] = [{ id: "pmx", folder: "inbox", from: "a", to: "ghost@gone.de", subject: "s", body: "b", at: 0, read: false }];
    do tick(s); while (s.hour % 24 !== 0);
    expect(s.panelMail["ghost@gone.de"]).toBeUndefined();
    expect(panelMessages(s, "anna@sockenshop.de").length).toBe(BOX_CAP);
  });

  it("answers webmail only for a reachable web space and leaves the company's own webmail host alone", () => {
    const { s, id } = account();
    createMailbox(s, id, "anna", "sockenshop.de", "secret1", 100);
    expect(resolve(s, "webmail.sockenshop.de/").page.kind).toBe("panelMail");
    const svc = s.services.find((v) => v.domain === "sockenshop.de")!;
    svc.endedAt = s.hour;
    expect(resolve(s, "webmail.sockenshop.de/").page.kind).toBe("notfound");
    svc.endedAt = null;
    const cl = s.clusters.find((c) => c.kind === "panel")!;
    s.company.domain = "sockenshop.de";
    s.clusters.push({ ...cl, id: "clu99", kind: "mailweb" } as never);
    expect(resolve(s, "webmail.sockenshop.de/").page.kind).not.toBe("panelMail");
  });

  it("opens the panel webmail at webmail.<domain> and the panel's port 2096, and loads old saves", () => {
    const { s, id } = account();
    createMailbox(s, id, "anna", "sockenshop.de", "secret1", 100);
    expect(resolve(s, "webmail.sockenshop.de/").page.kind).toBe("panelMail");
    const host = s.workloads.find((w) => w.id === id)!.clusterId;
    const hostname = s.devices.find((d) => d.id === panelMachine(s.clusters.find((c) => c.id === host)!))?.hostname;
    if (hostname) expect(resolve(s, `${hostname}.${s.company.domain}:2096/`).page.kind).toBe("panelMail");
    const old = JSON.parse(serialize(s));
    delete old.panelMail;
    const back = deserialize(JSON.stringify(old));
    expect(panelMessages(back, "anna@sockenshop.de")).toEqual([]);
    expect(panelLogin(back, "anna@sockenshop.de", "secret1")).not.toBeNull();
  });
});

describe("own mail server host", () => {
  it("resolves the IP, mail.<domain>, the FQDN and the hostname to the mail cluster", () => {
    const s = readyGame(1);
    selfHosted(s);
    const c = s.clusters.find((x) => x.kind === "mail")!, d = s.company.domain!;
    const ip = mailAddress(s, c.id)!.ip, names = namesOf(s, panelMachine(c)!);
    for (const h of [ip, `mail.${d}`, ...names, ` ${ip} `]) expect(mailClusterAtHost(s, h)?.id, h).toBe(c.id);
    expect(mailClusterAt(s, c, "localhost")?.id).toBe(c.id);
    expect(mailClusterAtHost(s, "nope.example")).toBeNull();
    expect(mailClusterAtHost(s, "10.9.9.9")).toBeNull();
  });

  it("checks a Pear Mail account against the typed host", () => {
    const s = readyGame(1);
    selfHosted(s);
    s.installed.push("Pear Mail");
    const c = s.clusters.find((x) => x.kind === "mail")!, a = s.mail.accounts.find((x) => s.mail.tenants.find((y) => y.id === x.tenant)?.clusterId === c.id)!;
    const errorAt = (host: string) => clientError(s, { ...clientAccount("cl900", { accountId: a.id, address: `${a.local}@${a.domain}`, description: "x", fullName: "x", password: a.password, protocol: "imap" }, nowMinutes(s)), server: { host, port: 993, tls: true } });
    const ip = mailAddress(s, c.id)!.ip;
    for (const h of [ip, `mail.${s.company.domain}`]) expect(String(errorAt(h)), h).not.toMatch(/mailServer|mailNoBox/);
    expect(errorAt("nope.example")).toBe("error.mailServer");
    expect(errorAt("10.9.9.9")).toBe("error.mailServer");
  });
});
