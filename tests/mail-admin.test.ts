import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { checkMailLogin, RETIRE_HOURS, roleAddress } from "../src/sim/42-mail/accounts";
import { boxOf, unread } from "../src/sim/42-mail/model";
import type { GameState } from "../src/sim/50-state";
import { vendorCli } from "../src/sim/60-infra/vendor-cli";
import { mailboxLoss, serverMail } from "../src/sim/80-business/mail-software";
import { selfHostCaps } from "../src/sim/80-business/webmail";
import { finishPanelSetup } from "../src/sim/90-actions/licence";
import { addDefaultAliases, assignMailRoles, createAdminMailbox, setMailSoftwareOption } from "../src/sim/90-actions/mail-server";
import { addAlias, deleteMailAccount, setAccountPassword, setAccountQuota, setCatchAll, setForward } from "../src/sim/90-actions/mailbox";
import { installSoftware, uninstallSoftware } from "../src/sim/90-actions/software";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { err, idOf, run, selfHosted } from "./company-mail.helpers";
import { readyGame } from "./fixtures";

const tenantOn = (s: GameState, mail: string) => s.mail.tenants.find((t) => t.host === "self" && t.clusterId === mail && t.endsAt === null)!.id;
const box = (s: GameState, local: string) => s.mail.accounts.find((a) => a.local === local && a.closedAt === null)!;

function own(software = "postfixit", seed = 7) {
  const s = readyGame(seed);
  if (software === "mailpig") s.hour = Math.max(s.hour, hourOfMonth("2016-01"));
  const mail = selfHosted(s, software), tenant = tenantOn(s, mail), vm = s.clusters.find((c) => c.id === mail)!.vm!;
  return { s, mail, tenant, vm };
}
// A terminal line on the mail server's machine, with its action run as the store would.
function cli(s: GameState, vm: string, bin: string, line: string) {
  const r = vendorCli(s, vm, bin, line.split(" "), true)!;
  if (!r.action) return r.failed ? "failed" : r.output.join("\n");
  const [fn, ...args] = r.action as [(...a: unknown[]) => { ok: boolean; error?: string }, ...unknown[]];
  return err(fn(s, ...args));
}

describe("own mail server administration", () => {
  it("routes the sales traffic to a new info@ and leaves support where it was", () => {
    const { s, tenant } = own();
    const d = s.company.domain!;
    expect(err(createAdminMailbox(s, { tenant, local: "support", title: "Support", password: "secret12", roles: ["support"] }))).toBe("ok");
    expect(err(createAdminMailbox(s, { tenant, local: "info", title: "Info", password: "secret12", roles: ["sales"] }))).toBe("ok");
    expect(roleAddress(s, "sales")).toBe(`info@${d}`);
    expect(roleAddress(s, "support")).toBe(`support@${d}`);
    expect(box(s, "sales").roles).toEqual(["owner", "abuse"]);
  });

  it("sends the welcome mail unless it is unticked", () => {
    const { s, tenant } = own();
    const a = idOf(createAdminMailbox(s, { tenant, local: "info", title: "Info", password: "secret12", quotaMb: 2048 }));
    const b = idOf(createAdminMailbox(s, { tenant, local: "jobs", title: "Jobs", password: "secret12", welcome: false }));
    expect(unread(s, a)).toBe(1);
    expect(boxOf(s, b)).toHaveLength(0);
    expect(box(s, "info").quotaMb).toBe(2048);
    expect(err(createAdminMailbox(s, { tenant, local: "x", title: "", password: "secret12", quotaMb: 0 }))).toBe("error.mailQuota");
  });

  it("takes the catch-all, forwarders and the default aliases", () => {
    const { s, tenant } = own();
    const info = idOf(createAdminMailbox(s, { tenant, local: "info", title: "Info", password: "secret12" }));
    expect(err(setCatchAll(s, info))).toBe("ok");
    expect(s.mail.catchAll).toBe(info);
    expect(err(setForward(s, info, "Owner@Example.org", true))).toBe("ok");
    expect(box(s, "info").forward).toEqual({ to: "owner@example.org", keep: true });
    expect(err(setForward(s, info, "nobody", false))).toBe("error.mailForward");
    expect(err(addDefaultAliases(s, box(s, "sales").id))).toBe("ok");
    expect(box(s, "sales").aliases).toEqual(["postmaster", "abuse", "hostmaster", "webmaster"]);
    expect(err(addAlias(s, info, "abuse"))).toBe("error.mailTaken");
  });

  it("resets a password at once and keeps the mail", () => {
    const { s } = own();
    const a = box(s, "sales"), before = boxOf(s, a.id).length;
    expect(err(setAccountPassword(s, null, a.id, "brandnew9"))).toBe("ok");
    expect(checkMailLogin(s, `sales@${a.domain}`, "brandnew9").ok).toBe(true);
    expect(checkMailLogin(s, `sales@${a.domain}`, a.password).ok).toBe(false);
    expect(boxOf(s, a.id)).toHaveLength(before);
  });

  it("deletes a mailbox with its messages and starts the stale window", () => {
    const { s, tenant } = own();
    const info = idOf(createAdminMailbox(s, { tenant, local: "info", title: "Info", password: "secret12" }));
    addAlias(s, info, "orders");
    expect(mailboxLoss(s, info)).toEqual({ messages: 1, stale: true });
    expect(err(deleteMailAccount(s, info))).toBe("ok");
    expect(s.mail.msgs[info]).toBeUndefined();
    const d = s.company.domain!;
    expect(s.mail.retired).toEqual(expect.arrayContaining([{ address: `info@${d}`, until: s.hour + RETIRE_HOURS }, { address: `orders@${d}`, until: s.hour + RETIRE_HOURS }]));
  });

  it("raises the junk catch rate with the spam filter", () => {
    const { s, mail } = own();
    expect(selfHostCaps(s).junkBonus).toBe(0);
    expect(err(setMailSoftwareOption(s, mail, "spam", true))).toBe("ok");
    expect(selfHostCaps(s).junkBonus).toBe(0.25);
    const p = own("mailpig");
    expect(selfHostCaps(p.s).junkBonus).toBe(0.4);
    expect(err(setMailSoftwareOption(p.s, p.mail, "spam", false))).toBe("error.mailOptionFixed");
  });

  it("refuses each capability where the host has none", () => {
    const s = readyGame(3), gmix = s.mail.accounts.find((a) => a.domain === "gmix.com")!, ionose = box(s, "sales");
    expect(err(addAlias(s, gmix.id, "shop"))).toBe("error.mailNoAlias");
    expect(err(setCatchAll(s, gmix.id))).toBe("error.mailNoCatchAll");
    expect(err(setAccountQuota(s, ionose.id, 500))).toBe("error.mailQuotaHost");
    for (let i = 0; i < 10; i++) expect(err(addAlias(s, ionose.id, `a${i}`))).toBe("ok");
    expect(err(addAlias(s, ionose.id, "one-more"))).toBe("error.mailAliasMax");
    expect(err(setCatchAll(s, ionose.id))).toBe("ok");
    const o = own();
    const sales = box(o.s, "sales").id;
    for (let i = 0; i < 50; i++) expect(err(addAlias(o.s, sales, `a${i}`))).toBe("ok");
    expect(err(addAlias(o.s, sales, "one-more"))).toBe("error.mailAliasMax");
  });

  it("manages a bare Postfixit from the terminal", () => {
    const { s, vm } = own();
    expect(cli(s, vm, "postfixit", "mailbox add info secret12 512")).toBe("ok");
    expect(box(s, "info").quotaMb).toBe(512);
    expect(cli(s, vm, "postfixit", "alias add orders info")).toBe("ok");
    expect(cli(s, vm, "postfixit", "alias list")).toContain(`orders@${s.company.domain}`);
    expect(cli(s, vm, "postfixit", "catchall info")).toBe("ok");
    expect(cli(s, vm, "postfixit", "mailbox passwd info another9")).toBe("ok");
    expect(box(s, "info").password).toBe("another9");
    expect(cli(s, vm, "postfixit", "mailbox quota info 1024")).toBe("ok");
    expect(cli(s, vm, "postfixit", "spam on")).toBe("ok");
    expect(cli(s, vm, "postfixit", "mailbox list")).toContain(`info@${s.company.domain}`);
    expect(cli(s, vm, "postfixit", "mailbox del info")).toBe("ok");
    expect(cli(s, vm, "postfixit", "mailbox del ghost")).toBe("failed");
  });

  it("waits for the Postfixit Admin setup page", () => {
    const { s, vm } = own();
    const pfa = idOf(installSoftware(s, vm, "postfixitadmin"));
    run(s, 2);
    expect(s.clusters.find((c) => c.id === pfa)!.setupPending).toBe(true);
    expect(err(finishPanelSetup(s, pfa))).toBe("ok");
    expect(s.clusters.find((c) => c.id === pfa)!.setupPending).toBe(false);
  });

  it("loses every mailbox when the mail server is uninstalled", () => {
    const { s, mail, vm, tenant } = own();
    createAdminMailbox(s, { tenant, local: "info", title: "Info", password: "secret12" });
    expect(serverMail(s, mail).mailboxes).toBe(2);
    expect(err(uninstallSoftware(s, vm, "postfixit"))).toBe("ok");
    expect(serverMail(s, mail)).toEqual({ mailboxes: 0, messages: 0 });
    expect(s.mail.accounts.some((a) => a.tenant === tenant)).toBe(false);
    expect(s.company.mail.kind).toBe("free");
  });

  it("loads a save without mail server options", () => {
    const { s, mail } = own();
    setMailSoftwareOption(s, mail, "spam", true);
    const raw = JSON.parse(serialize(s));
    delete raw.webmail.options;
    expect(deserialize(JSON.stringify(raw)).webmail.options).toEqual({});
    expect(deserialize(serialize(s)).webmail.options).toEqual({ [mail]: { spam: true } });
  });

  it("moves owner mail with the primary", () => {
    const { s, tenant } = own();
    const me = idOf(createAdminMailbox(s, { tenant, local: "martin", title: "Martin", password: "secret12" }));
    expect(err(assignMailRoles(s, me, ["owner"]))).toBe("ok");
    expect(s.mail.primary).toBe(me);
  });
});
