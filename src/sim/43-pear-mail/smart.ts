// Smart Mailboxes: saved searches evaluated live over what the client can see (docs/design/plans/mail-client.md, Smart Mailboxes).
import { nowMinutes } from "../00-core/time";
import { matchesConditions } from "../42-mail/deliver";
import { isRead, view } from "../42-mail/model";
import type { MailCond, Message } from "../42-mail/types";
import type { GameState } from "../50-state";
import { type SmartCond, type SmartMailbox } from "./state";
import { clientFolder, clientFolders, myFolders, ON_MY_PEAR, type Row } from "./view";

const DAY = 24 * 60;
// The mailbox a row sits in: the server folder, or the last part of a local one.
export const folderOf = (m: Message): string => m.folder.split(":").pop()!;

function holds(s: GameState, r: Row, c: SmartCond): boolean {
  const { m } = r, v = String(c.value).toLowerCase();
  const text = (x: string) => (c.op === "is" ? x === v : c.op === "starts" ? x.startsWith(v) : c.op === "ends" ? x.endsWith(v) : x.includes(v));
  switch (c.field) {
    case "account": return r.c.id === c.value;
    case "mailbox": return folderOf(m) === c.value;
    case "days": return nowMinutes(s) - m.at <= Number(c.value) * DAY;
    case "unread": return !isRead(s, m);
    case "flagged": return !!m.star;
    case "junk": return folderOf(m) === "junk";
    case "content": return text(view(s, m).text.toLowerCase());
    default: return matchesConditions(s, m, "all", [c as MailCond]);
  }
}

// Every visible message of the enabled accounts and On My Pear; Trash and Sent only when the mailbox includes them.
export function smartRows(s: GameState, sm: SmartMailbox): Row[] {
  if (!sm.conds.length) return [];
  const skip = new Set([...(sm.trash ? [] : ["trash"]), ...(sm.sent ? [] : ["sent"])]);
  const all: Row[] = [
    ...s.pearMail.accounts.filter((c) => c.enabled).flatMap((c) => clientFolders(s, c).filter((f) => !skip.has(f.id)).flatMap((f) => clientFolder(s, c, f.id).map((m) => ({ c, m })))),
    ...[...myFolders(s).map((f) => f.id), "trash", "junk"].filter((f) => !skip.has(f)).flatMap((f) => clientFolder(s, ON_MY_PEAR, f).map((m) => ({ c: ON_MY_PEAR, m }))),
  ];
  const one = (r: Row) => (sm.match === "all" ? sm.conds.every((c) => holds(s, r, c)) : sm.conds.some((c) => holds(s, r, c)));
  // A message under a label shows once.
  const seen = new Set<string>();
  return all.filter((r) => !seen.has(r.m.id) && seen.add(r.m.id) && one(r));
}
