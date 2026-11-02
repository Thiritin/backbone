import { deskById, deskHas, type DeskFeature, type DeskId } from "../10-catalog/desks";
import { deskStatus, newChannel, type Department, type DeskRule, type Priority } from "../40-support/desk";
import { channelError, fetchChannel } from "../40-support/desk-channels";
import { serverStatus } from "../42-mail/accounts";
import { deliver } from "../42-mail/deliver";
import type { DeskChannel } from "../42-mail/types";
import { autoAssignee, deskNote, importTicket, inDesk, PRIORITIES, validAssignee, WEB_KINDS } from "../40-support/desk-work";
import { createTicket, isFinal, pickHowTo, TOPICS, type TicketKind } from "../40-support/tickets";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";
import { closeTicket, find } from "./support";

const fail = (error: string): ActionResult => ({ ok: false, error });
const gate = (s: GameState, f?: DeskFeature): ActionResult | null => (!s.desk ? fail("error.noDesk") : f && !deskHas(s, f) ? fail("error.deskFeature") : null);
const deskTicket = (s: GameState, id: string) => s.tickets.find((t) => t.id === id && inDesk(t));

// Moves each duplicate's thread into one ticket of the same customer and kind and closes it as merged.
export function mergeTickets(s: GameState, intoId: string, ids: string[]): ActionResult {
  const g = gate(s, "merge");
  if (g) return g;
  const into = deskTicket(s, intoId);
  if (!into) return fail("error.unknownTicket");
  if (isFinal(into)) return fail("error.ticketDone");
  const dups = [];
  for (const id of new Set(ids)) {
    const f = find(s, id);
    if ("error" in f) return f.error;
    if (id === intoId || f.t.customerId !== into.customerId || f.t.kind !== into.kind) return fail("error.mergeMismatch");
    dups.push(f.t);
  }
  for (const d of dups) {
    into.replies = [...into.replies, ...d.replies].sort((a, b) => a.hour - b.hour);
    into.notes = [...(into.notes ?? []), ...(d.notes ?? [])].sort((a, b) => a.hour - b.hour);
    Object.assign(d, { replies: [], notes: [], status: "closed", outcome: "merged", mergedInto: into.id, updatedAt: s.hour, unread: false });
    deskNote(s, into, "desk.note.merged", { ref: d.ref ?? "" });
    deskNote(s, d, "desk.note.mergedInto", { ref: into.ref ?? "" });
  }
  into.updatedAt = s.hour;
  return { ok: true, id: into.id };
}

// Closes a ticket as spam with the consequences of closing it; junk closes with no happiness change.
export function markSpam(s: GameState, id: string): ActionResult {
  const g = gate(s);
  if (g) return g;
  if (!deskTicket(s, id)) return fail("error.unknownTicket");
  const r = closeTicket(s, id);
  if (!r.ok) return r;
  const t = s.tickets.find((x) => x.id === id)!;
  if (isFinal(t)) t.outcome ??= "spam";
  deskNote(s, t, "desk.note.spam");
  return { ok: true, id };
}

export function addNote(s: GameState, id: string, text: string): ActionResult {
  const g = gate(s);
  if (g) return g;
  const t = deskTicket(s, id);
  if (!t) return fail("error.unknownTicket");
  if (!text.trim()) return fail("error.emptyNote");
  t.notes = [...(t.notes ?? []), { hour: s.hour, by: "owner", text: text.trim() }];
  return { ok: true, id };
}

// null goes back to the priority the desk derives.
export function setPriority(s: GameState, id: string, priority: Priority | null): ActionResult {
  const g = gate(s);
  if (g) return g;
  const t = deskTicket(s, id);
  if (!t) return fail("error.unknownTicket");
  if (priority !== null && !PRIORITIES.includes(priority)) return fail("error.unknownPriority");
  if (priority) t.priority = priority;
  else delete t.priority;
  deskNote(s, t, priority ? `desk.note.priority.${priority}` : "desk.note.priorityReset");
  return { ok: true, id };
}

export function setDepartment(s: GameState, id: string, deptId: string): ActionResult {
  const g = gate(s, "departments");
  if (g) return g;
  const t = deskTicket(s, id), d = s.desk!.departments.find((x) => x.id === deptId);
  if (!t) return fail("error.unknownTicket");
  if (!d) return fail("error.unknownDepartment");
  t.deptId = d.id;
  if (d.autoAssign && !t.assignee && !isFinal(t)) t.assignee = autoAssignee(s, d);
  deskNote(s, t, "desk.note.department", { name: d.name });
  return { ok: true, id };
}

export function addDepartment(s: GameState, name: string): ActionResult {
  const g = gate(s, "departments");
  if (g) return g;
  if (!name.trim()) return fail("error.emptyName");
  const d: Department = { id: `dept${s.nextId++}`, name: name.trim(), members: [], autoAssign: false, channelId: null };
  s.desk = { ...s.desk!, departments: [...s.desk!.departments, d] };
  return { ok: true, id: d.id };
}

export function updateDepartment(s: GameState, id: string, patch: Partial<Pick<Department, "name" | "members" | "autoAssign">>): ActionResult {
  const g = gate(s, "departments");
  if (g) return g;
  const d = s.desk!.departments.find((x) => x.id === id);
  if (!d) return fail("error.unknownDepartment");
  if (patch.name !== undefined && !patch.name.trim()) return fail("error.emptyName");
  if (patch.members?.some((m) => m === "owner" || !validAssignee(s, m))) return fail("error.unknownEmployee");
  const next = { ...d, ...patch, ...(patch.name !== undefined && { name: patch.name.trim() }) };
  s.desk = { ...s.desk!, departments: s.desk!.departments.map((x) => (x.id === id ? next : x)) };
  return { ok: true, id };
}

// Its tickets move to the first department left; the last one stays.
export function removeDepartment(s: GameState, id: string): ActionResult {
  const g = gate(s, "departments");
  if (g) return g;
  const rest = s.desk!.departments.filter((x) => x.id !== id);
  if (rest.length === s.desk!.departments.length) return fail("error.unknownDepartment");
  if (!rest.length) return fail("error.lastDepartment");
  s.desk = { ...s.desk!, departments: rest, rules: s.desk!.rules.filter((r) => r.set.deptId !== id) };
  for (const t of s.tickets) if (t.deptId === id) t.deptId = rest[0].id;
  return { ok: true, id: rest[0].id };
}

export function addRule(s: GameState, rule: DeskRule): ActionResult {
  const g = gate(s, "rules");
  if (g) return g;
  const { deptId, assignee, priority } = rule.set;
  if (rule.when !== "*" && !(rule.when in TOPICS)) return fail("error.unknownKind");
  if (deptId && !s.desk!.departments.some((d) => d.id === deptId)) return fail("error.unknownDepartment");
  if (assignee && !validAssignee(s, assignee)) return fail("error.unknownEmployee");
  if (priority && !PRIORITIES.includes(priority)) return fail("error.unknownPriority");
  if (!deptId && !assignee && !priority) return fail("error.emptyRule");
  s.desk = { ...s.desk!, rules: [...s.desk!.rules, { when: rule.when, set: { ...(deptId && { deptId }), ...(assignee && { assignee }), ...(priority && { priority }) } }] };
  return { ok: true };
}

export function removeRule(s: GameState, index: number): ActionResult {
  const g = gate(s, "rules");
  if (g) return g;
  if (!s.desk!.rules[index]) return fail("error.unknownRule");
  s.desk = { ...s.desk!, rules: s.desk!.rules.filter((_, i) => i !== index) };
  return { ok: true };
}

const portalGate = (s: GameState): ActionResult | null => gate(s, "portal") ?? (deskStatus(s) === "down" ? fail("error.deskDown") : null);
const byEmail = (s: GameState, email: string) => s.customers.find((c) => c.churnedAt === null && c.address.email.toLowerCase() === email.trim().toLowerCase());

// The portal's new ticket form: a customer's request under a help topic, which needs no mailbox.
// ponytail: one open ticket per customer and topic bounds tickets typed in on a customer's behalf.
export function submitWebTicket(s: GameState, email: string, kind: TicketKind): ActionResult {
  const g = portalGate(s);
  if (g) return g;
  if (!WEB_KINDS.includes(kind)) return fail("error.unknownKind");
  const c = byEmail(s, email);
  if (!c) return fail("error.unknownEmail");
  if (s.tickets.some((t) => t.customerId === c.id && t.kind === kind && !isFinal(t))) return fail("error.ticketExists");
  const ask = kind === "howTo" ? pickHowTo(s, c) : null;
  if (kind === "howTo" && !ask) return fail("error.unknownKind");
  const t = createTicket(s, c, kind, ask?.serviceId, ask?.topic);
  importTicket(s, t, true);
  return { ok: true, id: t.id };
}

// The portal's status check: the ticket with this number, if the email is its customer's.
export function lookupTicket(s: GameState, email: string, ref: string): ActionResult {
  const g = portalGate(s);
  if (g) return g;
  const c = byEmail(s, email), n = ref.trim().replace(/^#/, "");
  const t = c && n ? s.tickets.find((x) => x.customerId === c.id && x.ref === n && inDesk(x)) : undefined;
  return t ? { ok: true, id: t.id } : fail("error.ticketLookup");
}

type ChannelSettings = Partial<Pick<DeskChannel, "mode" | "every" | "after" | "folder" | "deptId" | "autoReply" | "unknown">>;
// IMAP and POP3 for a self-hosted desk, forwarding for a hosted one; Freshdusk also fetches by IMAP.
const MODES: Record<DeskId, DeskChannel["mode"][]> = { ostickit: ["imap", "pop"], freescoot: ["imap", "pop"], zendusk: ["forward"], freshdusk: ["forward", "imap"] };

function checkChannel(s: GameState, ch: DeskChannel): string | null {
  const modes = s.desk!.hosting.kind === "legacy" ? ["imap", "pop"] : MODES[s.desk!.id];
  if (!modes.includes(ch.mode) || !Number.isInteger(ch.every) || ch.every < 1 || ch.every > 24) return "error.deskChannel";
  if (ch.mode === "pop" && ch.after !== "keep" && ch.after !== "delete") return "error.deskChannel";
  if (ch.after === "move" && !s.mail.folders.some((f) => f.id === ch.folder && f.accountId === ch.accountId && !f.label)) return "error.mailNoFolder";
  if (ch.deptId && !s.desk!.departments.some((d) => d.id === ch.deptId)) return "error.unknownDepartment";
  if (ch.mode !== "forward" && s.desk!.hosting.kind !== "legacy" && serverStatus(s, ch.accountId, ch.mode) === "external") return "error.mailExternal";
  return null;
}

// Adds one of the company's mailboxes as a channel and imports the mail already in it.
export function addDeskChannel(s: GameState, accountId: string, settings: ChannelSettings = {}): ActionResult {
  const g = gate(s);
  if (g) return g;
  const a = s.mail.accounts.find((x) => x.id === accountId && x.closedAt === null);
  if (!a) return fail("error.mailUnknown");
  if (s.mail.channels.some((c) => c.accountId === accountId)) return fail("error.deskChannelTaken");
  const ch = { ...newChannel(s, accountId, s.desk!.id, s.desk!.hosting.kind === "hosted"), ...settings };
  const error = checkChannel(s, ch);
  if (error) return fail(error);
  s.mail = { ...s.mail, channels: [...s.mail.channels, ch] };
  if (ch.mode !== "forward" && deskStatus(s) !== "down") fetchChannel(s, ch);
  return { ok: true, id: ch.id };
}

const channelOf = (s: GameState, id: string) => s.mail.channels.find((c) => c.id === id && c.desk === s.desk?.id);

export function setDeskChannel(s: GameState, id: string, settings: ChannelSettings): ActionResult {
  const g = gate(s);
  if (g) return g;
  const old = channelOf(s, id);
  if (!old) return fail("error.deskChannelUnknown");
  const ch = { ...old, ...settings };
  const error = checkChannel(s, ch);
  if (error) return fail(error);
  s.mail = { ...s.mail, channels: s.mail.channels.map((c) => (c.id === id ? ch : c)) };
  return { ok: true };
}

// Tickets the channel imported stay in the desk; the mailbox keeps its mail.
export function removeDeskChannel(s: GameState, id: string): ActionResult {
  const g = gate(s);
  if (g) return g;
  if (!channelOf(s, id)) return fail("error.deskChannelUnknown");
  s.mail = { ...s.mail, channels: s.mail.channels.filter((c) => c.id !== id) };
  s.desk = { ...s.desk!, departments: s.desk!.departments.map((d) => (d.channelId === id ? { ...d, channelId: null } : d)) };
  return { ok: true };
}

// Send test email: the owner writes to the channel's mailbox and the desk fetches it at once; it opens no ticket.
export function testDeskChannel(s: GameState, id: string): ActionResult {
  const g = gate(s);
  if (g) return g;
  const ch = channelOf(s, id), a = ch && s.mail.accounts.find((x) => x.id === ch.accountId);
  if (!ch || !a) return fail("error.deskChannelUnknown");
  if (deskStatus(s) === "down") return fail("error.deskDown");
  const error = channelError(s, ch);
  if (error) return fail(error);
  deliver(s, { to: `${a.local}@${a.domain}`, from: `acct:${s.mail.primary}`, kind: "system", topic: "deskTest", p: { desk: deskById(ch.desk)?.name ?? "" } });
  return { ok: true, id: String(ch.mode === "forward" ? 1 : fetchChannel(s, channelOf(s, id)!)) };
}
