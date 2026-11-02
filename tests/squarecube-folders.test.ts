import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { listFolder } from "../src/sim/42-mail/model";
import { startMail } from "../src/sim/42-mail/new";
import { folderTree } from "../src/sim/80-business/webmail-view";
import { createMailFolder, moveMailFolder, moveMessages, renameMailFolder } from "../src/sim/90-actions/mailmsg";
import { setFolderSubscribed } from "../src/sim/90-actions/webmail";
import { deliver } from "../src/sim/42-mail/deliver";
import { err, idOf, selfHosted } from "./company-mail.helpers";
import { readyGame } from "./fixtures";

function box(seed = 6) {
  const s = readyGame(seed), mail = selfHosted(s);
  s.mail = startMail({ id: "tn9", host: "self", domain: s.company.domain!, plan: "self", since: s.hour, verified: true, endsAt: null, clusterId: mail, admin: null }, "sales", "Sales", "hunter22", "Postfixit", s.hour);
  s.hour = Math.max(s.hour, hourOfMonth("2009-03"));
  return { s, acc: s.mail.accounts.find((a) => a.local === "sales")!.id, address: `sales@${s.company.domain}` };
}

describe("Squarecube folders", () => {
  it("keeps sibling names unique and folders three deep", () => {
    const { s, acc } = box();
    const a = idOf(createMailFolder(s, acc, "Work")), b = idOf(createMailFolder(s, acc, "Home"));
    expect(err(createMailFolder(s, acc, "Work"))).toBe("error.mailFolderName");
    expect(err(renameMailFolder(s, acc, b, "Work"))).toBe("error.mailFolderName");
    const c = idOf(createMailFolder(s, acc, "Work", b)), d = idOf(createMailFolder(s, acc, "Deep", c));
    expect(err(createMailFolder(s, acc, "Deeper", d))).toBe("error.mailFolderDepth");
    expect(err(moveMailFolder(s, acc, b, a))).toBe("error.mailFolderDepth");
    expect(err(moveMailFolder(s, acc, a, c))).toBe("ok");
    expect(folderTree(s, acc).find((r) => r.folder.id === a)!.depth).toBe(2);
  });

  it("drops an unsubscribed folder from the pane and keeps its mail", () => {
    const { s, acc, address } = box();
    const f = idOf(createMailFolder(s, acc, "Archive 2008"));
    deliver(s, { to: address, from: "ext:a@example.com", kind: "reply", topic: "", own: { subject: "Old", text: "hi" } });
    const [m] = listFolder(s, acc, "inbox");
    expect(err(moveMessages(s, acc, [m.id], f))).toBe("ok");
    expect(err(setFolderSubscribed(s, acc, f, false))).toBe("ok");
    expect(folderTree(s, acc).some((r) => r.folder.id === f)).toBe(false);
    expect(listFolder(s, acc, f).map((x) => x.id)).toEqual([m.id]);
    expect(err(setFolderSubscribed(s, acc, f, true))).toBe("ok");
    expect(folderTree(s, acc).some((r) => r.folder.id === f)).toBe(true);
  });
});
