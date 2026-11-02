// Pear Mail rules and Smart Mailboxes (docs/design/plans/mail-client.md, Rules, Smart Mailboxes).
import { t } from "../../i18n/en";
import { matchesConditions } from "../42-mail/deliver";
import { view } from "../42-mail/model";
import type { Message } from "../42-mail/types";
import { ruleStep } from "../43-pear-mail/check";
import { MY_PEAR, type ClientAccount, type ClientRule, type SmartMailbox } from "../43-pear-mail/state";
import { ON_MY_PEAR } from "../43-pear-mail/view";
import { nowMinutes } from "../00-core/time";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";
import { labelMessages, markMessages, reportJunk, sendMessage } from "./mailmsg";
import { markPearMessages, transferMessages } from "./pear-mail";

const fail = (error: string): ActionResult => ({ ok: false, error });
const RULE_MAX = 30, PARTS = 5, SMART_MAX = 30, COLORS_KEEP = 500;

const clientOf = (s: GameState, id: string): ClientAccount | undefined => (id === MY_PEAR ? ON_MY_PEAR : s.pearMail.accounts.find((c) => c.id === id));
// The message where it sits now: a rule's move may have taken it from the server into On My Pear.
const find = (s: GameState, c: ClientAccount, id: string): Message | undefined =>
  s.pearMail.local.messages.find((m) => m.id === id) ?? (c.protocol === "imap" ? (s.mail.msgs[c.accountId] ?? []).find((m) => m.id === id) : undefined);
const isLocal = (s: GameState, id: string) => s.pearMail.local.messages.some((m) => m.id === id);

// A move target is a folder of the message's own account, or "my:<folder id>" for On My Pear.
const target = (c: ClientAccount, folder: string): [string, string] => (folder.startsWith(`${MY_PEAR}:`) ? [MY_PEAR, folder.slice(MY_PEAR.length + 1)] : [c.id, folder]);

// Runs the enabled rules for the account over the messages, top to bottom; Stop Evaluating Rules ends the list for a message.
export function runRules(s: GameState, clientId: string, ids: string[], only?: string[]): void {
  const c = clientOf(s, clientId);
  if (!c) return;
  const rules = s.pearMail.rules.filter((r) => r.on && (r.clientId === null || r.clientId === c.id) && (!only || only.includes(r.id)));
  for (const id of ids) {
    for (const r of rules) {
      const m = find(s, c, id);
      if (!m || !matchesConditions(s, m, r.match, r.conds)) continue;
      if (perform(s, c, r, id)) break;
    }
  }
}

ruleStep.run = runRules;

// Returns true when the rule says to stop evaluating.
function perform(s: GameState, c: ClientAccount, r: ClientRule, id: string): boolean {
  let stop = false;
  const mark = (f: { read?: boolean; star?: boolean }) => (isLocal(s, id) ? markPearMessages(s, [id], f) : markMessages(s, c.accountId, [id], f));
  // An IMAP message a rule moved into On My Pear goes on from there.
  const here = () => (isLocal(s, id) && c.protocol === "imap" ? MY_PEAR : c.id);
  for (const a of r.acts) {
    const m = find(s, c, id);
    if (!m) break;
    if (a.do === "move" || a.do === "copy") { const [to, f] = target(c, a.folder); transferMessages(s, here(), [id], to, f, a.do === "copy"); }
    else if (a.do === "read") mark({ read: true });
    else if (a.do === "star") mark({ star: true });
    else if (a.do === "label" && !isLocal(s, id)) labelMessages(s, c.accountId, [id], [a.label], []);
    else if (a.do === "trash") transferMessages(s, here(), [id], here(), "trash");
    else if (a.do === "junk" || a.do === "notJunk") {
      if (!isLocal(s, id)) reportJunk(s, c.accountId, [id], a.do === "junk");
      else if (a.do === "junk" || m.folder.endsWith(":junk")) transferMessages(s, here(), [id], here(), a.do === "junk" ? "junk" : "inbox");
    }
    else if (a.do === "forward") forward(s, c, m, a.to);
    else if (a.do === "color") s.pearMail = { ...s.pearMail, colors: Object.fromEntries([...Object.entries(s.pearMail.colors), [id, a.color]].slice(-COLORS_KEEP)) };
    else if (a.do === "sound") s.pearMail = { ...s.pearMail, chimes: s.pearMail.chimes + 1 };
    else if (a.do === "reply") autoReply(s, c, r, m, a);
    else if (a.do === "stop") stop = true;
  }
  return stop;
}

function forward(s: GameState, c: ClientAccount, m: Message, to: string): void {
  if (c.id === MY_PEAR) return;
  const v = view(s, m);
  sendMessage(s, c.accountId, { from: c.address, to: [to], subject: t("pearMail.fwdSubject", { subject: v.subject }), text: v.text, fwd: m.id, att: m.att });
}

// Answers a sender once per rule, and only the company's own mailboxes, so customers and vendors never get it.
function autoReply(s: GameState, c: ClientAccount, r: ClientRule, m: Message, a: { subject: string; text: string }): void {
  if (c.id === MY_PEAR || !m.from.startsWith("acct:") || m.from === `acct:${c.accountId}`) return;
  const to = view(s, m).fromAddress.toLowerCase(), key = `${r.id}:${to}`;
  if (!to || s.pearMail.replied[key] !== undefined) return;
  s.pearMail = { ...s.pearMail, replied: { ...s.pearMail.replied, [key]: nowMinutes(s) } };
  sendMessage(s, c.accountId, { from: c.address, to: [to], subject: a.subject, text: a.text, auto: true, re: isLocal(s, m.id) ? undefined : m.id });
}

type RuleInput = Omit<ClientRule, "id"> & { id?: string };
export function saveClientRule(s: GameState, r: RuleInput): ActionResult {
  if (!r.conds.length || !r.acts.length || r.conds.length > PARTS || r.acts.length > PARTS) return fail("error.mailFilterRule");
  if (r.clientId !== null && !s.pearMail.accounts.some((c) => c.id === r.clientId)) return fail("error.mailUnknown");
  const old = r.id ? s.pearMail.rules.find((x) => x.id === r.id) : undefined;
  if (!old && s.pearMail.rules.length >= RULE_MAX) return fail("error.mailFilterMax");
  const next: ClientRule = { ...r, id: old?.id ?? `cr${s.nextId++}`, name: r.name.trim().slice(0, 80) };
  s.pearMail = { ...s.pearMail, rules: old ? s.pearMail.rules.map((x) => (x.id === old.id ? next : x)) : [...s.pearMail.rules, next] };
  return { ok: true, id: next.id };
}

export function deleteClientRule(s: GameState, id: string): ActionResult {
  if (!s.pearMail.rules.some((x) => x.id === id)) return fail("error.mailUnknown");
  s.pearMail = { ...s.pearMail, rules: s.pearMail.rules.filter((x) => x.id !== id) };
  return { ok: true };
}

// Moves a rule to position `to` in the list, which is the order rules run in.
export function moveClientRule(s: GameState, id: string, to: number): ActionResult {
  const r = s.pearMail.rules.find((x) => x.id === id);
  if (!r) return fail("error.mailUnknown");
  const rest = s.pearMail.rules.filter((x) => x.id !== id);
  rest.splice(Math.max(0, Math.min(rest.length, to)), 0, r);
  s.pearMail = { ...s.pearMail, rules: rest };
  return { ok: true };
}

// Apply Rules on a selection of one account's (or On My Pear's) messages; ruleIds limits it to some rules.
export function applyClientRules(s: GameState, clientId: string, ids: string[], ruleIds?: string[]): ActionResult {
  if (!clientOf(s, clientId)) return fail("error.mailUnknown");
  runRules(s, clientId, ids, ruleIds);
  return { ok: true };
}

type SmartInput = Omit<SmartMailbox, "id"> & { id?: string };
export function saveSmartMailbox(s: GameState, sm: SmartInput): ActionResult {
  const name = sm.name.trim().slice(0, 40);
  if (!name) return fail("error.mailFolderName");
  if (!sm.conds.length || sm.conds.length > PARTS * 2) return fail("error.mailSmartRule");
  const old = sm.id ? s.pearMail.smart.find((x) => x.id === sm.id) : undefined;
  if (!old && s.pearMail.smart.length >= SMART_MAX) return fail("error.mailFilterMax");
  const next: SmartMailbox = { ...sm, id: old?.id ?? `sm${s.nextId++}`, name };
  s.pearMail = { ...s.pearMail, smart: old ? s.pearMail.smart.map((x) => (x.id === old.id ? next : x)) : [...s.pearMail.smart, next] };
  return { ok: true, id: next.id };
}

export function removeSmartMailbox(s: GameState, id: string): ActionResult {
  if (!s.pearMail.smart.some((x) => x.id === id)) return fail("error.mailUnknown");
  s.pearMail = { ...s.pearMail, smart: s.pearMail.smart.filter((x) => x.id !== id) };
  return { ok: true };
}
