import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { openDesk } from "../src/sim/40-support/desk";
import { importDeskTickets } from "../src/sim/40-support/desk-channels";
import { supportTick } from "../src/sim/40-support/tick";
import { createTicket, TEMPLATES, type Ticket, type TicketKind } from "../src/sim/40-support/tickets";
import { boxOf, isRead, view } from "../src/sim/42-mail/model";
import { syncTicketMail } from "../src/sim/42-mail/tickets";
import type { MailAccount } from "../src/sim/42-mail/types";
import type { GameState } from "../src/sim/50-state";
import { runAction } from "../src/sim/90-actions";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setDeskChannel } from "../src/sim/90-actions/desk";
import { createMailAccount, setAccountRoles } from "../src/sim/90-actions/mailbox";
import { markMessages } from "../src/sim/90-actions/mailmsg";
import { replyTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { idOf } from "./company-mail.helpers";
import { newGame, readyGame, registered } from "./fixtures";

const boxAt = (s: GameState, local: string) => s.mail.accounts.find((a) => a.local === local && a.domain === s.company.domain)!;
// Spam filtering off, so the hashed false-junk draw never moves a request to Junk.
const quiet = (s: GameState) => { s.mail = { ...s.mail, accounts: s.mail.accounts.map((a) => ({ ...a, prefs: { ...a.prefs, spam: "off" } })) }; };
const add = (s: GameState, local: string): MailAccount => {
  const r = createMailAccount(s, { tenant: boxAt(s, "sales").tenant, local, title: local, password: "secret1" });
  expect(r.ok).toBe(true);
  return s.mail.accounts.find((a) => a.id === idOf(r))!;
};
const envelopeOf = (s: GameState, t: Ticket) => Object.entries(s.mail.msgs).flatMap(([box, ms]) => ms.filter((m) => m.ticket === t.id && m.folder !== "sent").map((m) => ({ box, m })));
const request = (s: GameState, kind: TicketKind = "howTo", topic?: string) => {
  const id = addCustomer(s, "Ann Example", "private");
  return createTicket(s, s.customers.find((c) => c.id === id)!, kind, null, topic);
};

describe("ticket envelopes", () => {
  it("delivers every ticket kind to the mailbox of its role", () => {
    const s = readyGame(1);
    const sales = boxAt(s, "sales"), support = add(s, "support"), abuse = add(s, "abuse");
    setAccountRoles(s, sales.id, ["sales", "owner"]);
    quiet(s);
    const want: [TicketKind, string, string][] = [
      ["outage", "", support.id], ["howTo", "", support.id], ["billing", "", support.id], ["upgrade", "", support.id], ["cancellation", "", support.id],
      ["appeal", "", support.id], ["refund", "", support.id], ["migration", "offer", support.id], ["maintenance", "notice", support.id],
      ["abuse", "", abuse.id], ["notice", "movie", abuse.id], ["legal", "data", abuse.id],
      ["order", "vps", sales.id], ["sponsor", "lanTastic", sales.id], ["pear", "overdraft", s.mail.primary], ["extortion", "data", s.mail.primary],
    ];
    const tickets = want.map(([kind, topic]) => request(s, kind, topic || undefined));
    syncTicketMail(s);
    want.forEach(([kind, , box], i) => {
      const env = envelopeOf(s, tickets[i]);
      expect(env.map((e) => e.box), kind).toEqual([box]);
      expect(view(s, env[0].m).subject, kind).not.toMatch(/^ticket\.|^$/);
    });
    syncTicketMail(s);
    expect(envelopeOf(s, tickets[0]).length).toBe(1);
  });

  it("hands support traffic to a new support@ mailbox", () => {
    const s = readyGame(2), sales = boxAt(s, "sales");
    setAccountRoles(s, sales.id, ["sales", "owner"]);
    quiet(s);
    const before = request(s);
    syncTicketMail(s);
    const support = add(s, "support");
    quiet(s);
    const after = request(s);
    syncTicketMail(s);
    expect(envelopeOf(s, before)[0].box).toBe(sales.id);
    expect(envelopeOf(s, after)[0].box).toBe(support.id);
  });

  it("delivers waiting envelopes after any successful action", () => {
    const s = readyGame(3);
    quiet(s);
    request(s);
    const primary = s.mail.accounts.find((a) => a.id === s.mail.primary)!;
    expect(runAction(s, "setAccountRoles", [primary.id, primary.roles]).ok).toBe(true);
    expect(boxOf(s, s.mail.primary).filter((m) => m.ticket).length).toBe(1);
  });

  it("keeps the thread's unread state on the ticket", () => {
    const s = readyGame(4);
    quiet(s);
    const t = request(s);
    syncTicketMail(s);
    const { box, m } = envelopeOf(s, t)[0];
    expect(isRead(s, m)).toBe(false);
    expect(markMessages(s, box, [m.id], { read: true }).ok).toBe(true);
    expect(s.tickets.find((x) => x.id === t.id)!.unread).toBe(false);
    expect(isRead(s, boxOf(s, box).find((x) => x.id === m.id)!)).toBe(true);
  });

  it("files a Sent copy of each reply in the envelope's mailbox", () => {
    const s = readyGame(5);
    quiet(s);
    const t = request(s);
    syncTicketMail(s);
    const box = envelopeOf(s, t)[0].box;
    expect(replyTicket(s, t.id, TEMPLATES.howTo[0]).ok).toBe(true);
    for (let i = 0; i < 3; i++) { s.hour++; supportTick(s); }
    const sent = boxOf(s, box).filter((m) => m.folder === "sent" && m.ticket === t.id);
    expect(sent.map((m) => m.reply)).toEqual([0]);
    expect(view(s, sent[0]).subject).toContain(view(s, envelopeOf(s, t)[0].m).subject);
  });

  it("applies a desk channel's after rule to the envelopes it imports", () => {
    const s = registered({ ...newGame(6), hour: hourOf(new Date(Date.UTC(2012, 0, 1))) + 9, cash: 1e6 });
    openDesk(s, "ostickit");
    quiet(s);
    expect(setDeskChannel(s, s.mail.channels[0].id, { after: "delete" }).ok).toBe(true);
    const t = request(s);
    importDeskTickets(s);
    expect(t.ref).toBeTruthy();
    expect(envelopeOf(s, t)[0].m).toMatchObject({ folder: "trash", prev: "inbox" });
  });

  it("gives an old save's open tickets their envelopes and leaves the closed ones out", () => {
    const s = readyGame(7);
    quiet(s);
    const open = request(s), closed = request(s);
    Object.assign(closed, { status: "closed" });
    const raw = JSON.parse(serialize(s));
    delete raw.mail.seen;
    const back = deserialize(JSON.stringify(raw));
    expect(back.tickets.map((x) => x.id)).toEqual(s.tickets.map((x) => x.id));
    syncTicketMail(back);
    expect(envelopeOf(back, open).length).toBe(1);
    expect(envelopeOf(back, closed).length).toBe(0);
  });
});
