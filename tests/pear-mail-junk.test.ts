import { describe, expect, it } from "vitest";
import { nowMinutes } from "../src/sim/00-core/time";
import { deliver } from "../src/sim/42-mail/deliver";
import { boxOf } from "../src/sim/42-mail/model";
import type { Message } from "../src/sim/42-mail/types";
import { checkAccount } from "../src/sim/43-pear-mail/check";
import { clientJunk, junkShare, shownJunk } from "../src/sim/43-pear-mail/junk";
import { clientAccount } from "../src/sim/43-pear-mail/state";
import { clientFolder } from "../src/sim/43-pear-mail/view";
import type { GameState } from "../src/sim/50-state";
import { markPearJunk, resetPearJunk, setPearJunk } from "../src/sim/90-actions/pear-junk";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";

// Sales over IMAP as cl1, with the provider's spam filter off so every spam reaches the Inbox.
function setup() {
  const s = readyGame(3), a = s.mail.accounts.find((x) => x.local === "sales")!;
  a.prefs = { ...a.prefs, spam: "off" };
  s.pearMail.accounts.push(clientAccount("cl1", { accountId: a.id, address: `${a.local}@${a.domain}`, description: "Sales", fullName: "", password: a.password, protocol: "imap" }, nowMinutes(s)));
  return { s, a };
}
function arrive(s: GameState, to: string, n: number, kind: Message["kind"] = "spam"): void {
  s.minute += 1;
  for (let i = 0; i < n; i++) deliver(s, { to, from: "n:Cheap Pills", kind, topic: "x", own: { subject: `Offer ${i}`, text: "Buy now" } });
  s.minute += 1;
  checkAccount(s, "cl1", false);
}
const c1 = (s: GameState) => s.pearMail.accounts[0];
const to = (a: { local: string; domain: string }) => `${a.local}@${a.domain}`;

describe("Pear Mail junk filter", () => {
  it("gives a message the same verdict at the same training level", () => {
    const { s, a } = setup();
    arrive(s, to(a), 20);
    const inbox = clientFolder(s, c1(s), "inbox");
    expect(inbox.map((m) => clientJunk(s, m))).toEqual(inbox.map((m) => clientJunk(s, m)));
  });

  it("catches a larger share as it is trained", () => {
    expect(junkShare(0)).toBeCloseTo(0.3);
    expect(junkShare(10)).toBeCloseTo(0.5);
    expect(junkShare(100)).toBe(0.9);
    const { s, a } = setup();
    arrive(s, to(a), 200);
    const inbox = clientFolder(s, c1(s), "inbox"), caught = () => inbox.filter((m) => clientJunk(s, m)).length;
    const raw = caught();
    s.pearMail.junk.trained = 30;
    expect(caught()).toBeGreaterThan(raw);
  });

  it("leaves junk in the Inbox while training and marks it", () => {
    const { s, a } = setup();
    arrive(s, to(a), 30);
    const inbox = clientFolder(s, c1(s), "inbox");
    expect(inbox.filter((m) => m.kind === "spam")).toHaveLength(30);
    expect(inbox.some((m) => shownJunk(s, m))).toBe(true);
  });

  it("moves junk to the Junk mailbox in automatic mode and never moves other mail", () => {
    const { s, a } = setup();
    setPearJunk(s, { mode: "automatic" });
    arrive(s, to(a), 30);
    arrive(s, to(a), 30, "order");
    const junk = clientFolder(s, c1(s), "junk"), inbox = clientFolder(s, c1(s), "inbox");
    expect(junk.length).toBeGreaterThan(0);
    expect(junk.every((m) => m.kind === "spam")).toBe(true);
    expect(inbox.filter((m) => m.kind === "order")).toHaveLength(30);
    expect(inbox.some((m) => clientJunk(s, m))).toBe(false);
  });

  it("filters nothing when switched off", () => {
    const { s, a } = setup();
    setPearJunk(s, { on: false, mode: "automatic" });
    arrive(s, to(a), 30);
    expect(clientFolder(s, c1(s), "junk")).toHaveLength(0);
    expect(clientFolder(s, c1(s), "inbox").some((m) => shownJunk(s, m))).toBe(false);
  });

  it("trains the filter and the mailbox when mail is moved out of Junk", () => {
    const { s, a } = setup();
    setPearJunk(s, { mode: "automatic" });
    arrive(s, to(a), 30);
    const box = () => s.mail.accounts.find((x) => x.id === a.id)!;
    const m = clientFolder(s, c1(s), "junk")[0], mailbox = box().trained;
    expect(markPearJunk(s, "cl1", [m.id], false).ok).toBe(true);
    expect(boxOf(s, a.id).find((x) => x.id === m.id)!.folder).toBe("inbox");
    expect(s.pearMail.junk.trained).toBe(1);
    expect(box().trained).toBe(mailbox + 1);
    expect(shownJunk(s, boxOf(s, a.id).find((x) => x.id === m.id)!)).toBe(false);
    resetPearJunk(s);
    expect(s.pearMail.junk).toMatchObject({ trained: 0, clean: [] });
  });

  it("loads a save from before the junk filter with training on", () => {
    const { s } = setup();
    const { junk: _j, ...old } = s.pearMail;
    expect(deserialize(serialize({ ...s, pearMail: old as never })).pearMail.junk).toMatchObject({ on: true, mode: "training", trained: 0 });
  });
});
