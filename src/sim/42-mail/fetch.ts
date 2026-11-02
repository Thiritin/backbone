// Fetch rules: a mailbox collects the new Inbox mail of another own mailbox (docs/design/plans/mail-core.md, Fetch rules).
import { nowMinutes } from "../00-core/time";
import type { GameState } from "../50-state";
import { serverStatus } from "./accounts";
import { deliver, drop } from "./deliver";
import type { FetchRule } from "./types";

export const FETCH_BATCH = 50;
const num = (id: string): number => Number(id.replace(/\D/g, "")) || 0;

// The error a rule meets at its source now, null when the source answers.
export function fetchError(s: GameState, r: Pick<FetchRule, "source" | "proto" | "password">): string | null {
  const st = serverStatus(s, r.source, r.proto, r.password);
  return st === "ok" ? null : st === "auth" ? "error.mailLogin" : st === "external" ? "error.mailExternal" : st === "locked" ? "error.mailLocked" : "error.mailClosed";
}

const patchRule = (s: GameState, id: string, p: Partial<FetchRule>): void => {
  s.mail = { ...s.mail, fetch: s.mail.fetch.map((r) => (r.id === id ? { ...r, ...p } : r)) };
};

// One run: up to FETCH_BATCH Inbox messages the rule has not seen go through the target's delivery, junk already checked.
// Message ids only grow, so upTo marks what a run has looked at even when mail arrives later in the same minute.
export function runFetch(s: GameState, rule: FetchRule): number {
  const err = fetchError(s, rule), target = s.mail.accounts.find((a) => a.id === rule.accountId && a.closedAt === null);
  if (err || !target) { patchRule(s, rule.id, { err: err ?? "error.mailClosed" }); return 0; }
  const fresh = (s.mail.msgs[rule.source] ?? []).filter((m) => m.folder === "inbox" && !m.draft && num(m.id) >= rule.upTo)
    .sort((a, b) => num(a.id) - num(b.id)).slice(0, FETCH_BATCH);
  const upTo = fresh.length === FETCH_BATCH ? num(fresh.at(-1)!.id) + 1 : s.nextId;
  const to = `${target.local}@${target.domain}`, landed = new Set<string>();
  for (const m of fresh) {
    const d = deliver(s, { to, from: m.from, kind: m.kind, topic: m.topic, p: m.p, own: m.own, ticket: m.ticket, att: m.att, cc: m.cc, thread: m.thread, kb: m.kb, foot: m.foot }, { junkChecked: true });
    if (d.id && d.result !== "queued") landed.add(d.id);
  }
  if (rule.folder) {
    const into = rule.folder;
    s.mail = { ...s.mail, msgs: { ...s.mail.msgs, [target.id]: (s.mail.msgs[target.id] ?? []).map((m) => (landed.has(m.id) && m.folder === "inbox" ? { ...m, folder: into } : m)) } };
  }
  if (!rule.leave) drop(s, rule.source, new Set(fresh.map((m) => m.id)));
  patchRule(s, rule.id, { upTo, lastAt: nowMinutes(s), err: null });
  return fresh.length;
}

// Hourly: the rules whose interval has passed and that have not stopped.
export function fetchTick(s: GameState): void {
  if (s.mail.fetch.some((r) => r.until !== undefined && r.until <= s.hour)) s.mail = { ...s.mail, fetch: s.mail.fetch.filter((r) => r.until === undefined || r.until > s.hour) };
  for (const r of s.mail.fetch) if (!r.err && nowMinutes(s) - r.lastAt >= r.every * 60) runFetch(s, r);
}
