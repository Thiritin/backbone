import { afterEach, describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { MAIL_PROVIDERS } from "../src/sim/80-business/mail";
import { MAIL_HOSTS, mailPlan, mailServersOf, onSale, quotaMbAt } from "../src/sim/10-catalog/mail-providers";
import { catchOf, falseJunkOf, junkFloor, SENDERS, spamShare } from "../src/sim/10-catalog/mail-senders";
import { capsOf, mailHooks, mxTarget } from "../src/sim/42-mail/caps";
import { boxOf, view } from "../src/sim/42-mail/model";
import type { GameState } from "../src/sim/50-state";
import { newGame } from "./fixtures";

const at = (ym: string) => hourOfMonth(ym);
const box = (s: GameState) => s.mail.accounts[0];
const onHost = (s: GameState, host: string, plan: string, domain = "kellerhost.de") => {
  s.company = { ...s.company, domain };
  s.mail = { ...s.mail, tenants: [{ ...s.mail.tenants[0], host, plan, domain }], accounts: [{ ...box(s), domain }] };
  return s;
};
const saved = { ...mailHooks };
afterEach(() => Object.assign(mailHooks, saved));

describe("mail providers", () => {
  it("open IMAP by year: GMix FreeMix from 2012, paid tiers and the others from their start", () => {
    expect(mailPlan("gmix", "free")!.imapFrom).toBe(2012);
    expect(mailPlan("gmix", "pro")!.imapFrom).toBe(2005);
    expect(MAIL_HOSTS.map((h) => [h.id, h.from])).toEqual([["gmix", 2005], ["goggle", 2007], ["ionose", 2005], ["lookout", 2011], ["self", 2005]]);
    const s = newGame(1);
    expect(capsOf(s, box(s))).toMatchObject({ imap: false, pop: true, webmail: "gmix", footer: "mail.footer.gmix", pollGapMin: 15, folderMax: 5, filterMax: 5, collectors: 1, attachMb: 5 });
    s.hour = at("2012-03");
    expect(capsOf(s, box(s))).toMatchObject({ imap: true, pollGapMin: 0, attachMb: 20 });
  });

  it("grow the Goggle counter between its anchors and step the other quotas", () => {
    expect(quotaMbAt("goggle", "premier", at("2007-01"))).toBe(Math.round(2.8 * 1024));
    expect(quotaMbAt("goggle", "premier", at("2008-01"))).toBe(6 * 1024);
    const mid = quotaMbAt("goggle", "premier", at("2007-07"));
    expect(mid).toBeGreaterThan(2.8 * 1024);
    expect(mid).toBeLessThan(6 * 1024);
    expect(quotaMbAt("goggle", "premier", at("2010-01"))).toBe(Math.round(7.6 * 1024));
    expect(quotaMbAt("goggle", "premier", at("2013-06"))).toBe(10 * 1024);
    expect(quotaMbAt("goggle", "premier", at("2014-01"))).toBe(30 * 1024);
    expect(["2005-01", "2008-12", "2009-01", "2014-01"].map((m) => quotaMbAt("gmix", "free", at(m)))).toEqual([1024, 1024, 2048, 5120]);
    expect(["2005-01", "2009-01", "2013-01", "2016-01"].map((m) => quotaMbAt("ionose", "exchange", at(m)))).toEqual([500, 2048, 10240, 51200]);
    expect(["2011-01", "2013-01", "2016-01"].map((m) => quotaMbAt("lookout", "business", at(m)))).toEqual([25600, 51200, 102400]);
  });

  it("price a mailbox exactly as the old provider curves", () => {
    const plans: Record<string, [string, string]> = { hostedExchange: ["ionose", "exchange"], goggleWorkspace: ["goggle", "premier"], lookout365: ["lookout", "business"] };
    for (const p of MAIL_PROVIDERS) for (let y = 2005; y <= 2030; y++) expect(mailPlan(...plans[p.id])!.price(y)).toBe(p.price(y));
    expect([2014, 2015].map((y) => mailPlan("gmix", "pro")!.price(y))).toEqual([2.99, 3.99]);
    expect(onSale(mailPlan("goggle", "standard")!, 2012)).toBe(true);
    expect(onSale(mailPlan("goggle", "standard")!, 2013)).toBe(false);
    expect(onSale(mailPlan("gmix", "top")!, 2007)).toBe(false);
  });

  it("give each host its alias limit, catch-all, filters and labels", () => {
    expect(MAIL_HOSTS.map((h) => [h.id, h.aliasMax, h.catchAll, h.serverFilters, h.labels])).toEqual([
      ["gmix", 0, false, "rules", false], ["goggle", 30, true, "filters", true], ["ionose", 10, true, "rules", false],
      ["lookout", 50, true, "rules", false], ["self", 50, true, "none", false],
    ]);
    const s = onHost(newGame(1), "goggle", "premier");
    s.hour = at("2015-01");
    expect(capsOf(s, box(s))).toMatchObject({ imap: true, webmail: "gmial", labels: true, folderMax: 40, filterMax: 20, collectors: 5, footer: null, quotaMb: 30720 });
  });

  it("answer an own server through the hooks other lanes fill in", () => {
    const s = onHost(newGame(1), "self", "self");
    s.company = { ...s.company, mail: { kind: "self", software: "mailpig", clusterId: "cl1" } };
    expect(capsOf(s, box(s))).toMatchObject({ webmail: null, serverFilters: "none", autoconfig: true, quotaMb: 1024 });
    mailHooks.installedWebmail = () => "squarecube";
    mailHooks.selfHostCaps = () => ({ imap: false, pop: true, filters: "sieve", autoconfig: false, catchBoost: 0.2 });
    s.mail = { ...s.mail, accounts: [{ ...box(s), quotaMb: 4096 }] };
    expect(capsOf(s, box(s))).toMatchObject({ imap: false, webmail: "squarecube", serverFilters: "sieve", autoconfig: false, quotaMb: 4096 });
  });

  it("name the client servers a host offers in a year", () => {
    expect(mailServersOf("gmix", "gmix.com", 2005)).toEqual({
      imap: { host: "imap.gmix.net", port: 993, ssl: true }, pop: { host: "pop.gmix.net", port: 995, ssl: true }, smtp: { host: "smtp.gmix.net", port: 587, ssl: true },
    });
    expect(mailServersOf("goggle", "kellerhost.de", 2006)).toEqual({ imap: null, pop: null, smtp: null });
    expect(mailServersOf("self", "kellerhost.de", 2010).imap?.host).toBe("mail.kellerhost.de");
  });

  it("route the company domain to its one live tenant by default", () => {
    const s = newGame(1);
    expect(mxTarget(s)).toBeNull();
    onHost(s, "ionose", "exchange");
    expect(mxTarget(s)?.id).toBe("tn1");
  });

  it("follow the junk history and the hosts' filters", () => {
    expect([2005, 2008, 2012, 2026].map(spamShare)).toEqual([0.65, 0.9, 0.8, 0.45]);
    expect([2005, 2009, 2026].map(junkFloor)).toEqual([5, 12, 2]);
    expect([catchOf("gmix", "free"), catchOf("gmix", "pro"), catchOf("goggle", "premier"), catchOf("self", "self")]).toEqual([0.85, 0.93, 0.99, 0.5]);
    expect(falseJunkOf("ionose")).toBe(0.01);
  });

  it("send bank mail from the bank's own host", () => {
    const s = newGame(1), m = { ...boxOf(s, box(s).id)[0], from: "n:Sparklasse" };
    expect(SENDERS.Sparklasse).toBe("service@sparklasse.de");
    expect(view(s, m).fromAddress).toBe("service@sparklasse.de");
  });
});
