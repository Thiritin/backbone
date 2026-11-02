// Gmial's search box (docs/design/plans/webmail-consumer.md, 4.5 Search): a pure parser and a matcher over one mailbox.
// The rail's views are searches too, so a view and the same typed query always list the same mail.
import { hourOf } from "../00-core/time";
import { boxOf, isRead, view } from "../42-mail/model";
import type { Folder, Message } from "../42-mail/types";
import type { GameState } from "../50-state";

export type SearchKey = "text" | "from" | "to" | "subject" | "label" | "in" | "is" | "has" | "before" | "after" | "larger" | "smaller";
export interface Term { key: SearchKey; value: string; not: boolean }
// Every group must match; a group matches when one of its terms does (terms joined by OR).
export type SearchQuery = Term[][];

const KEYS = new Set<string>(["from", "to", "subject", "label", "in", "is", "has", "before", "after", "larger", "smaller"]);
const TOKEN = /(-)?(?:([a-z]+):)?(?:"([^"]*)"?|(\S+))/gi;
const IN: Record<string, string> = { spam: "junk", inbox: "inbox", sent: "sent", drafts: "drafts", trash: "trash", archive: "archive" };
const WIDE = ["anywhere", "spam", "trash"];
export const IMPORTANT = "Important";

export function parseSearch(q: string): SearchQuery {
  const groups: Term[][] = [];
  let or = false;
  for (const [, neg, k, quoted, bare] of q.matchAll(TOKEN)) {
    if (!neg && !k && bare === "OR") { or = groups.length > 0; continue; }
    const key = k && KEYS.has(k.toLowerCase()) ? (k.toLowerCase() as SearchKey) : "text";
    const value = `${key === "text" && k ? `${k}:` : ""}${quoted ?? bare ?? ""}`.toLowerCase();
    if (!value) continue;
    const term: Term = { key, value, not: !!neg };
    if (or) groups[groups.length - 1].push(term); else groups.push([term]);
    or = false;
  }
  return groups;
}

// "10M", "500k" or bytes, in KB like Message.kb.
const sizeKb = (v: string): number => {
  const m = /^(\d+(?:\.\d+)?)([km]?)b?$/.exec(v);
  return m ? Number(m[1]) * (m[2] === "m" ? 1024 : m[2] === "k" ? 1 : 1 / 1024) : NaN;
};
// YYYY/MM/DD as the game minute the day starts.
const dayMin = (v: string): number => {
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(v);
  return m ? hourOf(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))) * 60 : NaN;
};
const slug = (x: string) => x.toLowerCase().replace(/\s+/g, "-");

interface Ctx { s: GameState; names: Map<string, string[]>; important: string | undefined }

function context(s: GameState, accountId: string): Ctx {
  const mine = s.mail.folders.filter((f) => f.accountId === accountId && f.label), byId = new Map(mine.map((f) => [f.id, f]));
  const path = (f: Folder): string => { const p = f.parent ? byId.get(f.parent) : undefined; return p ? `${path(p)}/${f.name}` : f.name; };
  const names = new Map(mine.map((f) => [f.id, [f.id, slug(f.name), slug(path(f))]]));
  return { s, names, important: importantLabel(s, accountId)?.id };
}

function hit(c: Ctx, m: Message, t: Term): boolean {
  const v = view(c.s, m), has = (x: string) => x.toLowerCase().includes(t.value);
  switch (t.key) {
    case "from": return has(`${v.fromName} ${v.fromAddress}`);
    case "to": return has([v.to, ...v.cc].join(" "));
    case "subject": return has(v.subject);
    case "label": return (m.labels ?? []).some((id) => c.names.get(id)?.includes(slug(t.value)));
    case "in": return t.value === "anywhere" || m.folder === IN[t.value];
    case "is": return t.value === "unread" ? !isRead(c.s, m) : t.value === "read" ? isRead(c.s, m) : t.value === "starred" ? !!m.star
      : t.value === "important" ? !!c.important && !!m.labels?.includes(c.important) : false;
    case "has": return t.value === "attachment" && !!m.att?.length;
    case "before": return m.at < dayMin(t.value);
    case "after": return m.at >= dayMin(t.value);
    case "larger": return m.kb > sizeKb(t.value);
    case "smaller": return m.kb < sizeKb(t.value);
    default: return has(`${v.fromName} ${v.fromAddress} ${v.to} ${v.cc.join(" ")} ${v.subject} ${v.text}`);
  }
}

// Newest first. Spam and Trash stay out unless the query asks for them, and snoozed mail is out until it returns.
export function searchMailbox(s: GameState, accountId: string, query: string | SearchQuery): Message[] {
  const q = typeof query === "string" ? parseSearch(query) : query, c = context(s, accountId);
  const wide = q.some((g) => g.some((t) => t.key === "in" && !t.not && WIDE.includes(t.value)));
  return boxOf(s, accountId).filter((m) => !m.snooze && (wide || (m.folder !== "trash" && m.folder !== "junk"))
    && q.every((g) => g.some((t) => hit(c, m, t) !== t.not))).reverse();
}

// The system label Important: a top-level label of that name, created the first time a message is marked.
export const importantLabel = (s: GameState, accountId: string): Folder | undefined =>
  s.mail.folders.find((f) => f.accountId === accountId && f.label && f.parent === null && f.name === IMPORTANT);
