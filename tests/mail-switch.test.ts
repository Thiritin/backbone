import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { mxSetAt } from "../src/sim/10-catalog/mail-providers";
import { mxTarget } from "../src/sim/42-mail/caps";
import { deliver } from "../src/sim/42-mail/deliver";
import { importTick, leftBehind } from "../src/sim/42-mail/imports";
import type { GameState } from "../src/sim/50-state";
import { createVm } from "../src/sim/90-actions/clusters";
import { removeCompanyRecord, setCompanyRecord } from "../src/sim/90-actions/domains";
import { endTenant, verifyTenant } from "../src/sim/90-actions/mail";
import { signUpGoggle } from "../src/sim/90-actions/mail-provider";
import { createMailAccount, importMail } from "../src/sim/90-actions/mailbox";
import { installSoftware } from "../src/sim/90-actions/software";
import { err, idOf, run } from "./company-mail.helpers";
import { bootedMachine, readyGame } from "./fixtures";

const live = (s: GameState, host: string) => s.mail.tenants.find((t) => t.host === host && t.endsAt === null)!;
const inbox = (s: GameState, id: string) => (s.mail.msgs[id] ?? []).filter((m) => m.from === "n:Customer");
const order = (s: GameState) => deliver(s, { to: `sales@${s.company.domain}`, from: "n:Customer", kind: "order", topic: "order" });

function moveMx(s: GameState, host: string): void {
  for (const r of s.company.zone.filter((x) => x.type === "MX" && !x.gone)) removeCompanyRecord(s, r.id);
  for (const [p, h] of mxSetAt(host, s.company.domain!, s.hour)) setCompanyRecord(s, { type: "MX", name: "@", ttl: 300, data: `${p} ${h}` });
  s.hour += 2;
}

describe("switching the company mail from Ionose to Goggle on the provider sites", () => {
  it("keeps Ionose receiving until the MX moves, imports the old box with its roles, then lets Ionose go", () => {
    const s = readyGame(71);
    s.hour = hourOfMonth("2012-03");
    const ionose = live(s, "ionose"), oldSales = s.mail.accounts.find((a) => a.tenant === ionose.id && a.local === "sales")!;
    expect(leftBehind(s, ionose.id)).toBeNull();

    expect(err(signUpGoggle(s, { domain: s.company.domain!, plan: "paid", local: "admin", title: "Admin", password: "admin-pw" }))).toBe("ok");
    const goggle = live(s, "goggle");
    expect(live(s, "ionose").id).toBe(ionose.id);
    expect(mxTarget(s)?.id).toBe(ionose.id);
    order(s);
    expect(inbox(s, oldSales.id)).toHaveLength(1);
    expect(leftBehind(s, ionose.id)).toEqual({ mail: expect.any(Number), roles: true, collectors: 0 });
    expect(leftBehind(s, goggle.id)).toBeNull();

    verifyTenant(s, goggle.id);
    const sales = idOf(createMailAccount(s, { tenant: goggle.id, local: "sales", title: "Sales", password: "sales-pw" }));
    moveMx(s, "goggle");
    expect(mxTarget(s)?.id).toBe(goggle.id);
    order(s);
    expect(inbox(s, sales)).toHaveLength(1);
    expect(inbox(s, oldSales.id)).toHaveLength(1);
    expect(err(endTenant(s, ionose.id))).toBe("error.mailRoleInUse");

    expect(err(importMail(s, sales, { source: `sales@${s.company.domain}x`, password: oldSales.password, proto: "imap" }))).toBe("error.mailLogin");
    expect(err(importMail(s, sales, { source: `sales@${s.company.domain}`, password: "wrong", proto: "imap" }))).toBe("error.mailLogin");
    const r = importMail(s, sales, { source: `sales@${s.company.domain}`, password: oldSales.password, proto: "imap" });
    expect(err(r)).toBe("ok");
    const job = s.mail.imports.find((x) => x.id === idOf(r))!;
    expect(job.to).toBe(sales);
    expect(job.from).toBe(oldSales.id);
    s.hour = job.doneAt;
    importTick(s);
    expect(inbox(s, sales)).toHaveLength(2);
    expect(s.mail.primary).toBe(sales);
    expect(s.mail.accounts.find((a) => a.id === sales)!.roles).toEqual(expect.arrayContaining(["sales", "support", "abuse"]));
    const rest = leftBehind(s, ionose.id)!;
    expect(rest.roles).toBe(false);

    // Every other Ionose box still has its welcome mail until it is imported too.
    for (const a of s.mail.accounts.filter((x) => x.tenant === ionose.id && x.closedAt === null && x.id !== oldSales.id)) {
      const to = idOf(createMailAccount(s, { tenant: goggle.id, local: `${a.local}.new`, title: a.title, password: "pw" }));
      expect(err(importMail(s, to, { source: `${a.local}@${a.domain}`, password: a.password, proto: "imap" }))).toBe("ok");
    }
    s.hour = Math.max(...s.mail.imports.map((x) => x.doneAt));
    importTick(s);
    expect(leftBehind(s, ionose.id)).toEqual({ mail: 0, roles: false, collectors: 0 });
    expect(leftBehind(s, goggle.id)).toBeNull();
    expect(err(endTenant(s, ionose.id))).toBe("ok");
    expect(live(s, "ionose")).toBeUndefined();
  });

  it("installs an own mail server beside a provider without closing the provider's mailboxes", () => {
    const s = readyGame(72);
    const ionose = live(s, "ionose"), open = s.mail.accounts.filter((a) => a.tenant === ionose.id && a.closedAt === null).length;
    const vm = idOf(createVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, { vcpu: 2, ramGb: 4, diskGb: 40 }));
    expect(err(installSoftware(s, bootedMachine(s, vm), "postfixit"))).toBe("ok");
    run(s, 6);
    expect(live(s, "ionose").id).toBe(ionose.id);
    expect(s.mail.accounts.filter((a) => a.tenant === ionose.id && a.closedAt === null)).toHaveLength(open);
    expect(mxTarget(s)?.id).toBe(ionose.id);
    const own = live(s, "self");
    expect(own.verified).toBe(true);
    expect(s.mail.accounts.find((a) => a.id === own.admin)?.roles).toEqual([]);
    moveMx(s, "self");
    expect(mxTarget(s)?.id).toBe(own.id);
  });
});
