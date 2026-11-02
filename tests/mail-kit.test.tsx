import { describe, expect, it } from "vitest";
import { deliver } from "../src/sim/42-mail/deliver";
import { listFolder } from "../src/sim/42-mail/model";
import { dragPayload, folderRows, MAIL_DRAG, matches, readDrag, select, step } from "../src/ui/apps/mail-kit/mail-kit";
import { readyGame } from "./fixtures";

const order = ["a", "b", "c", "d"];

describe("mail kit", () => {
  it("selects one, toggles with Command, extends with Shift and steps with the arrows", () => {
    let sel = select({ ids: [], anchor: null }, "b", order);
    expect(sel).toEqual({ ids: ["b"], anchor: "b" });
    sel = select(sel, "d", order, { shift: true });
    expect(sel.ids).toEqual(["b", "c", "d"]);
    sel = select(sel, "c", order, { meta: true });
    expect(sel.ids).toEqual(["b", "d"]);
    expect(step({ ids: ["b"], anchor: "b" }, order, 1)).toEqual({ ids: ["c"], anchor: "c" });
    expect(step({ ids: ["a"], anchor: "a" }, order, -1).ids).toEqual(["a"]);
  });

  it("carries the mailbox and the messages in the drag payload", () => {
    const data = new Map<string, string>();
    const e = { dataTransfer: { getData: (k: string) => data.get(k) ?? "" } } as unknown as Parameters<typeof readDrag>[0];
    data.set(MAIL_DRAG, dragPayload("mb3", ["msg1", "msg2"]));
    expect(readDrag(e)).toEqual({ accountId: "mb3", ids: ["msg1", "msg2"] });
    data.set(MAIL_DRAG, "");
    expect(readDrag(e)).toBeNull();
  });

  it("lists a folder from the server list, searched by field", () => {
    const s = readyGame(1), a = s.mail.accounts.find((x) => x.local === "sales")!, to = `${a.local}@${a.domain}`;
    deliver(s, { to, from: "n:Dwell", kind: "order", topic: "x", own: { subject: "Your order", text: "Thanks" } });
    deliver(s, { to, from: "n:Sysko", kind: "order", topic: "x", own: { subject: "Invoice", text: "Your order is paid" } });
    expect(folderRows(s, a.id, "inbox").map((m) => m.id)).toEqual(listFolder(s, a.id, "inbox").map((m) => m.id));
    expect(folderRows(s, a.id, "inbox", { query: "your order" }).length).toBe(2);
    expect(folderRows(s, a.id, "inbox", { query: "your order", scope: "subject" }).map((m) => m.own?.subject)).toEqual(["Your order"]);
    expect(folderRows(s, a.id, "inbox", { query: "sysko", scope: "from" }).map((m) => m.own?.subject)).toEqual(["Invoice"]);
    expect(matches(s, listFolder(s, a.id, "inbox")[0], "", "to")).toBe(true);
  });
});
