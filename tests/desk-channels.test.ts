import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { openDesk } from "../src/sim/40-support/desk";
import { deskHandles, deskImports, importDeskTickets } from "../src/sim/40-support/desk-channels";
import { inDesk } from "../src/sim/40-support/desk-work";
import { supportTick } from "../src/sim/40-support/tick";
import { createTicket, rightTemplate, TEMPLATES, type Ticket } from "../src/sim/40-support/tickets";
import { deliver, hostedDeskAddress } from "../src/sim/42-mail/deliver";
import { boxOf, view } from "../src/sim/42-mail/model";
import type { DeskChannel } from "../src/sim/42-mail/types";
import type { GameState } from "../src/sim/50-state";
import { addCustomer } from "../src/sim/90-actions/customers";
import { addDeskChannel, removeDeskChannel, setDeskChannel, testDeskChannel } from "../src/sim/90-actions/desk";
import { replyTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame, registered } from "./fixtures";

const at = (y: number) => hourOf(new Date(Date.UTC(y, 0, 1))) + 9;
const channel = (s: GameState): DeskChannel => s.mail.channels[0];
const primary = (s: GameState) => s.mail.accounts.find((a) => a.id === s.mail.primary)!;
const address = (s: GameState) => `${primary(s).local}@${primary(s).domain}`;

// OsTickit bought in the Pear Store, reading the primary mailbox.
function withDesk(y = 2012, seed = 5): GameState {
  const s = registered({ ...newGame(seed), hour: at(y), cash: 1e6 });
  openDesk(s, "ostickit");
  return s;
}
function ticketFor(s: GameState, name = "Ann Example"): Ticket {
  const id = addCustomer(s, name, "private");
  return createTicket(s, s.customers.find((x) => x.id === id)!, "howTo");
}
const own = (s: GameState, subject: string, from = "ext:someone@example.org") =>
  deliver(s, { to: address(s), from, kind: "support", own: { subject, text: "Hello" } });

describe("desk channels", () => {
  it("import tickets in the order they came in and number them", () => {
    const s = withDesk();
    const ts = [ticketFor(s, "Ann"), ticketFor(s, "Bob"), ticketFor(s, "Cat")];
    importDeskTickets(s);
    expect(ts.map((t) => t.channelId)).toEqual(ts.map(() => channel(s).id));
    expect(new Set(ts.map((t) => t.ref)).size).toBe(3);
    expect(ts.every((t) => /^\d{6}$/.test(t.ref!))).toBe(true);
  });

  it("keep a follow-up after a wrong answer in its ticket and file every reply in Sent with the number", () => {
    const s = withDesk();
    const t = ticketFor(s);
    importDeskTickets(s);
    const ref = t.ref, wrong = TEMPLATES.howTo.find((x) => x !== rightTemplate(s, t))!;
    expect(replyTicket(s, t.id, wrong).ok).toBe(true);
    for (let i = 0; i < 3; i++) { s.hour++; supportTick(s); }
    const back = s.tickets.find((x) => x.id === t.id)!;
    expect(back.replies.length).toBe(1);
    expect(back).toMatchObject({ ref, channelId: channel(s).id });
    const sent = boxOf(s, s.mail.primary).filter((m) => m.folder === "sent" && m.ticket === t.id);
    expect(sent.length).toBe(1);
    expect(view(s, sent[0]).subject).toContain(`[#${ref}]`);
    expect(view(s, sent[0]).text.length).toBeGreaterThan(0);
  });

  it("adopt a message without a ticket and join one whose number is in the subject", () => {
    const s = withDesk();
    const t = ticketFor(s);
    importDeskTickets(s);
    own(s, "Need help with my site");
    own(s, `Re: [#${t.ref}] thanks`);
    importDeskTickets(s);
    const adopted = s.tickets.filter((x) => x.mail?.msg);
    expect(adopted.length).toBe(1);
    expect(adopted[0]).toMatchObject({ kind: "mail", status: "open", channelId: channel(s).id });
    expect(inDesk(adopted[0])).toBe(true);
    expect(boxOf(s, s.mail.primary).find((m) => m.id === adopted[0].mail!.msg)!.thread).toBe(adopted[0].id);
    expect(s.tickets.find((x) => x.id === t.id)!.unread).toBe(true);
  });

  it("leave mail from unknown senders in the mailbox when the channel refuses it", () => {
    const s = withDesk();
    expect(setDeskChannel(s, channel(s).id, { unknown: false }).ok).toBe(true);
    own(s, "Hello there");
    importDeskTickets(s);
    expect(s.tickets.some((x) => x.mail?.msg)).toBe(false);
  });

  it("delete fetched mail over POP3 and keep it over IMAP", () => {
    const s = withDesk();
    expect(setDeskChannel(s, channel(s).id, { mode: "pop", after: "read" })).toEqual({ ok: false, error: "error.deskChannel" });
    expect(setDeskChannel(s, channel(s).id, { mode: "pop", after: "delete" }).ok).toBe(true);
    const popped = own(s, "First").id!;
    importDeskTickets(s);
    expect(boxOf(s, s.mail.primary).find((m) => m.id === popped)!.folder).toBe("trash");
    expect(setDeskChannel(s, channel(s).id, { mode: "imap", after: "keep" }).ok).toBe(true);
    const kept = own(s, "Second").id!;
    importDeskTickets(s);
    expect(boxOf(s, s.mail.primary).find((m) => m.id === kept)!.folder).toBe("inbox");
    // A kept message is fetched once.
    importDeskTickets(s);
    expect(s.tickets.filter((x) => x.mail?.msg === kept).length).toBe(1);
  });

  it("fetch on the channel's interval", () => {
    const s = withDesk();
    setDeskChannel(s, channel(s).id, { every: 4 });
    s.hour = Math.ceil(s.hour / 4) * 4 + 1;
    const t = ticketFor(s);
    importDeskTickets(s);
    expect(t.channelId).toBeFalsy();
    s.hour = Math.ceil(s.hour / 4) * 4;
    importDeskTickets(s);
    expect(t.channelId).toBe(channel(s).id);
  });

  it("wait for a queued message", () => {
    const s = withDesk();
    const a = primary(s);
    s.mail = { ...s.mail, accounts: s.mail.accounts.map((x) => (x.id === a.id ? { ...x, usedKb: 1e9 } : x)) };
    expect(own(s, "Full").result).toBe("queued");
    importDeskTickets(s);
    expect(s.tickets.some((x) => x.mail?.msg)).toBe(false);
  });

  it("send a test email that imports one message, answers it and opens no ticket", () => {
    const s = withDesk();
    setDeskChannel(s, channel(s).id, { autoReply: true });
    const before = s.tickets.length;
    expect(testDeskChannel(s, channel(s).id)).toEqual({ ok: true, id: "1" });
    expect(s.tickets.length).toBe(before);
    expect(boxOf(s, s.mail.primary).some((m) => m.topic === "deskAutoReply" && m.auto)).toBe(true);
  });

  it("add a second mailbox once and remove it again", () => {
    const s = withDesk();
    expect(addDeskChannel(s, s.mail.primary)).toEqual({ ok: false, error: "error.deskChannelTaken" });
    expect(addDeskChannel(s, "nobox")).toEqual({ ok: false, error: "error.mailUnknown" });
    expect(removeDeskChannel(s, channel(s).id).ok).toBe(true);
    const r = addDeskChannel(s, s.mail.primary);
    expect(r.ok).toBe(true);
    // A new channel imports the mail already in the mailbox, the welcome message among it.
    expect(s.tickets.some((x) => x.mail?.msg)).toBe(true);
  });

  it("take forwarded mail at once on a hosted desk", () => {
    const s = registered({ ...newGame(5), hour: at(2012), cash: 1e6 });
    openDesk(s, "zendusk", { kind: "hosted" }, "pxl");
    const t = ticketFor(s);
    importDeskTickets(s);
    expect(t.channelId).toBeFalsy();
    expect(channel(s).error).toBe("error.deskNoForward");
    s.mail = { ...s.mail, accounts: s.mail.accounts.map((x) => (x.id === s.mail.primary ? { ...x, forward: { to: hostedDeskAddress(s)!, keep: false } } : x)) };
    importDeskTickets(s);
    expect(t.channelId).toBe(channel(s).id);
    own(s, "Forwarded question");
    expect(s.tickets.filter((x) => x.mail?.msg).length).toBe(1);
    expect(channel(s).verified).toBe(true);
  });

  it("pause while a self-hosted desk is down and hand its tickets back to the mailbox", () => {
    const s = withDesk();
    const t = ticketFor(s);
    importDeskTickets(s);
    expect(deskHandles(s, t)).toBe(true);
    expect(deskImports(s, s.mail.primary)).toBe(true);
    s.desk = { ...s.desk!, hosting: { kind: "self", clusterId: "gone", version: "1.6" } };
    const later = ticketFor(s, "Dan");
    importDeskTickets(s);
    expect(later.channelId).toBeFalsy();
    expect(deskHandles(s, t)).toBe(false);
    expect(deskImports(s, s.mail.primary)).toBe(false);
  });

  it("load a channel saved before fetching", () => {
    const s = withDesk();
    const raw = JSON.parse(serialize(s));
    for (const c of raw.mail.channels) for (const k of ["mode", "every", "deptId", "autoReply", "unknown", "seen", "error"]) delete c[k];
    const back = deserialize(JSON.stringify(raw));
    expect(back.mail.channels[0]).toMatchObject({ mode: "imap", every: 1, deptId: null, autoReply: false, unknown: true, error: null });
    expect(back.mail.channels[0].seen).toBeGreaterThan(0);
  });
});
