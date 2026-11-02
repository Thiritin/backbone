import { describe, expect, it } from "vitest";
import { mxTarget } from "../src/sim/42-mail/caps";
import { deliver } from "../src/sim/42-mail/deliver";
import { importTick } from "../src/sim/42-mail/imports";
import { endTenant } from "../src/sim/90-actions/mail";
import { signUpGmix } from "../src/sim/90-actions/mail-provider";
import { importMailPair, saveFilter, setAccountRoles } from "../src/sim/90-actions/mailbox";
import { createMailFolder, moveMessages } from "../src/sim/90-actions/mailmsg";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { err, idOf } from "./company-mail.helpers";
import { goggleBox } from "./gmial.helpers";

const msgs = (s: ReturnType<typeof goggleBox>["s"], id: string) => s.mail.msgs[id] ?? [];

describe("importMailPair", () => {
  it("copies mail, folders and filters after the run, takes the roles and leaves the source as it was", () => {
    const { s, a } = goggleBox(41);
    const old = idOf(signUpGmix(s, { local: "old.box", title: "Old", password: "old-pw", plan: "pro" }));
    for (let i = 0; i < 3; i++) deliver(s, { to: "old.box@gmix.com", from: "n:Bank", kind: "bank", topic: "x" });
    const kept = idOf(createMailFolder(s, old, "Invoices"));
    expect(err(moveMessages(s, old, [msgs(s, old).find((m) => m.from === "n:Bank")!.id], kept))).toBe("ok");
    expect(err(saveFilter(s, old, { name: "Bank", on: true, match: "all", conds: [{ field: "from", op: "contains", value: "Bank" }], acts: [{ do: "move", folder: kept }] }))).toBe("ok");
    expect(err(setAccountRoles(s, old, ["sales"]))).toBe("ok");
    const before = msgs(s, a).length;
    const id = idOf(importMailPair(s, old, a)), job = s.mail.imports.find((x) => x.id === id)!;
    expect(job.doneAt - s.hour).toBe(2);
    importTick(s);
    expect(msgs(s, a).length).toBe(before);
    s.hour = job.doneAt;
    importTick(s);
    const label = s.mail.folders.find((f) => f.accountId === a && f.name === "Invoices")!;
    expect(label.label).toBe(true);
    const copied = msgs(s, a).filter((m) => m.from === "n:Bank");
    expect(copied).toHaveLength(3);
    expect(copied.filter((m) => m.labels?.includes(label.id) && m.folder === "archive")).toHaveLength(1);
    expect(s.mail.filters.find((f) => f.accountId === a && f.name === "Bank")?.acts).toEqual([{ do: "move", folder: label.id }]);
    expect(s.mail.accounts.find((x) => x.id === a)!.roles).toContain("sales");
    expect(s.mail.accounts.find((x) => x.id === old)!.roles).toEqual([]);
    const sent = msgs(s, old).length;
    expect(sent).toBe(4);
    expect(s.mail.imports.find((x) => x.id === job.id)!.n).toBe(sent);
    // A second run of the pair takes only what came since.
    deliver(s, { to: "old.box@gmix.com", from: "n:Bank", kind: "bank", topic: "y" });
    const next = idOf(importMailPair(s, old, a)), again = s.mail.imports.find((x) => x.id === next)!;
    s.hour = again.doneAt;
    importTick(s);
    expect(msgs(s, a).filter((m) => m.from === "n:Bank")).toHaveLength(4);
  });

  it("keeps the cancelled provider receiving until the month ends and mail bounces after it", () => {
    const { s } = goggleBox(42);
    const t = mxTarget(s)!;
    expect(err(setAccountRoles(s, t.admin!, []))).toBe("ok");
    s.mail = { ...s.mail, primary: s.mail.accounts.find((x) => x.domain === "gmix.com")!.id };
    expect(err(endTenant(s, t.id))).toBe("ok");
    expect(mxTarget(s)?.id).toBe(t.id);
    s.hour = s.mail.tenants.find((x) => x.id === t.id)!.endsAt!;
    expect(mxTarget(s)).toBe(null);
    expect(deliver(s, { to: `admin@${s.company.domain}`, from: "n:Bank", kind: "bank", topic: "x" }).result).toBe("bounced");
  });

  it("loads a save from before imports", () => {
    const { s } = goggleBox(44);
    const data = JSON.parse(serialize(s));
    delete data.mail.imports;
    expect(deserialize(JSON.stringify(data)).mail.imports).toEqual([]);
  });
});
