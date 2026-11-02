// Desk channels: the mailboxes a desk reads, when it fetches them and what it makes of their mail
// (docs/design/plans/support-desk.md, Channels).
import { hashRng, rand } from "../00-core/rng";
import { DESK_ROUTE, deskById, deskHas, refToken } from "../10-catalog/desks";
import { roleAccount, serverStatus, type ServerStatus } from "../42-mail/accounts";
import { applyAfter, deliver, hostedDeskAddress } from "../42-mail/deliver";
import { mailHooks } from "../42-mail/caps";
import { boxOf, ticketOf, view } from "../42-mail/model";
import type { DeskChannel, Message } from "../42-mail/types";
import type { GameState } from "../50-state";
import { deskStatus } from "./desk";
import { held, importTicket, inDesk, WEB_KINDS, WEB_SHARE } from "./desk-work";
import { isFinal, type Ticket } from "./tickets";

// Topics the desk counts as fetched without opening a ticket: its own test mail and the vendor's forwarding check.
const TEST_TOPICS = ["deskTest", "deskForwardTest"];
const FETCH_ERRORS: Record<ServerStatus, string | null> = {
  ok: null, listed: null, poll: null, down: "error.mailDown", installing: "error.mailDown", closed: "error.mailClosed", locked: "error.mailLocked",
  unresolved: "error.mailDns", auth: "error.mailAuth", external: "error.mailExternal",
};

const num = (id: string): number => Number(id.replace(/\D/g, "")) || 0;
const patch = (s: GameState, id: string, p: Partial<DeskChannel>): void => {
  s.mail = { ...s.mail, channels: s.mail.channels.map((c) => (c.id === id ? { ...c, ...p } : c)) };
};
export const channelsOf = (s: GameState): DeskChannel[] => (s.desk ? s.mail.channels.filter((c) => c.desk === s.desk!.id) : []);

// Why the desk cannot read the mailbox now, null when it can.
export function channelError(s: GameState, ch: DeskChannel): string | null {
  const a = s.mail.accounts.find((x) => x.id === ch.accountId);
  if (!a) return "error.mailClosed";
  if (ch.mode === "forward") return a.forward?.to === hostedDeskAddress(s) ? null : "error.deskNoForward";
  // A Pear Store desk reads the mailbox the way the old Support inbox did.
  if (s.desk?.hosting.kind === "legacy") return a.closedAt === null ? null : "error.mailClosed";
  return FETCH_ERRORS[serverStatus(s, a.id, ch.mode)];
}

// IMAP and POP3 fetch at the hour on their interval, forwarding takes mail as it arrives.
const due = (s: GameState, ch: DeskChannel): boolean => ch.mode === "forward" || s.hour % Math.max(1, ch.every) === 0;

function autoReply(s: GameState, ch: DeskChannel, to: string, ref = ""): void {
  const d = deskById(ch.desk);
  if (!ch.autoReply || !to || !d) return;
  deliver(s, { to, from: `acct:${ch.accountId}`, kind: "reply", topic: "deskAutoReply", p: { desk: d.name, token: refToken(d, ref) }, auto: true, hops: 1 });
}

function take(s: GameState, ch: DeskChannel, t: Ticket): void {
  importTicket(s, t, false, ch);
  autoReply(s, ch, s.customers.find((c) => c.id === t.customerId)?.address.email ?? "", t.ref);
}

// A message without a ticket becomes a ticket of kind mail that waits to be closed (adoptMessage in mail-core.md).
function adopt(s: GameState, ch: DeskChannel, m: Message, customerId: string): Ticket {
  const v = view(s, m);
  const t: Ticket = {
    id: `tkt${s.nextId++}`, customerId, serviceId: null, kind: "mail", topic: m.own ? "own" : m.topic, status: "open",
    createdAt: s.hour, dueAt: s.hour, updatedAt: s.hour, unread: true, replies: [], outcome: null, work: null, assignee: null,
    mail: { from: v.fromName, params: m.own ? { ...m.own } : { ...m.p }, msg: m.id },
  };
  s.tickets = [...s.tickets, t];
  s.mail = { ...s.mail, msgs: { ...s.mail.msgs, [ch.accountId]: boxOf(s, ch.accountId).map((x) => (x.id === m.id ? { ...x, thread: t.id } : x)) } };
  take(s, ch, t);
  return t;
}

// One message: its envelope's ticket, a ticket whose number token is in the subject, or a new ticket. A Zendusk ticket
// that is closed takes no more mail, so the reply opens a follow-up.
export function importMessage(s: GameState, ch: DeskChannel, m: Message): boolean {
  if (m.auto || m.draft) return false;
  const d = deskById(ch.desk)!, env = ticketOf(s, m), customerId = m.from.startsWith("cust:") ? m.from.slice(5) : "";
  if (TEST_TOPICS.includes(m.topic)) autoReply(s, ch, view(s, m).fromAddress);
  else if (env) { if (!held(env) && !isFinal(env) && inDesk(env)) take(s, ch, env); }
  else {
    const subject = view(s, m).subject;
    const joined = s.tickets.find((t) => t.ref && held(t) && refToken(d, t.ref) && subject.includes(refToken(d, t.ref)));
    if (joined && !(d.id === "zendusk" && joined.status === "closed")) {
      Object.assign(joined, { status: isFinal(joined) ? "open" : joined.status, unread: true, updatedAt: s.hour });
    } else if (customerId || ch.unknown) adopt(s, ch, m, customerId);
    else return false;
  }
  applyAfter(s, ch, m.id);
  return true;
}

// One fetch of a channel; returns how many messages it took in.
export function fetchChannel(s: GameState, ch: DeskChannel): number {
  const error = channelError(s, ch);
  patch(s, ch.id, { error });
  if (error) return 0;
  const upto = s.nextId;
  let n = 0;
  // ponytail: until mail-core gives every ticket its envelope message, a ticket counts as mail in the mailbox of its role.
  for (const t of [...s.tickets].sort((a, b) => a.createdAt - b.createdAt)) {
    if (held(t) || isFinal(t) || !inDesk(t) || num(t.id) >= upto || roleAccount(s, DESK_ROUTE[t.kind].role)?.id !== ch.accountId) continue;
    take(s, ch, t);
  }
  if (ch.mode !== "forward") {
    for (const m of boxOf(s, ch.accountId)) if (m.folder === "inbox" && num(m.id) > ch.seen && num(m.id) < upto && importMessage(s, ch, m)) n++;
    patch(s, ch.id, { seen: upto - 1 });
  }
  return n;
}

// Mail forwarded to a hosted desk's own address arrives at once and verifies the support address it came through.
mailHooks.deskInbound = (s, m) => {
  if (!s.desk || deskStatus(s) === "down") return;
  const ch = channelsOf(s).find((c) => c.mode === "forward" && s.mail.accounts.find((a) => a.id === c.accountId)?.forward?.to === m.to);
  if (!ch) return;
  patch(s, ch.id, { verified: true, error: null });
  importMessage(s, ch, m);
};

// The hourly import: a share of customers opens tickets on the portal, every channel fetches when it is due. The fetch
// pauses while the desk is down and the mailbox keeps the mail.
export function importDeskTickets(s: GameState): void {
  if (!s.desk || deskStatus(s) === "down") return;
  if (deskHas(s, "portal")) for (const t of s.tickets) {
    if (held(t) || isFinal(t) || !inDesk(t) || !t.customerId || !WEB_KINDS.includes(t.kind)) continue;
    if (rand(hashRng(s.seed, Number(t.id.slice(3)) || 0, 62)) < WEB_SHARE) importTicket(s, t, true);
  }
  for (const ch of channelsOf(s)) if (due(s, ch)) fetchChannel(s, ch);
}

// Whether a desk that is up reads this mailbox, so a mail client shows its tickets as handled there.
export const deskImports = (s: GameState, accountId: string): boolean => deskStatus(s) !== "down" && channelsOf(s).some((c) => c.accountId === accountId);
// Whether the desk handles the ticket now; a client answers it otherwise.
export const deskHandles = (s: GameState, t: Ticket): boolean => held(t) && deskStatus(s) !== "down";
