// docs/design/plans/webmail-server.md, 4.3: what the Squarecube screens show, derived from mail-core and the account's
// entry at the front end.
import { capsOf } from "../42-mail/caps";
import { foldersOf, unread } from "../42-mail/model";
import type { Folder } from "../42-mail/types";
import type { GameState } from "../50-state";
import { subscribed, webmailUser } from "./webmail";

// The system folders Squarecube lists, in its order; Archive is a label host's folder and stays out.
const SYSTEM = ["inbox", "drafts", "sent", "junk", "trash"];
export interface TreeRow { folder: Folder; depth: number; unread: number }

// Inbox, Drafts, Sent, Junk and Trash, then the custom folders nested under their parents, unsubscribed ones left out.
export function folderTree(s: GameState, accountId: string): TreeRow[] {
  const all = foldersOf(s, accountId).filter((f) => !f.label), rows: TreeRow[] = [];
  const add = (f: Folder, depth: number) => {
    if (!subscribed(s, accountId, f.id)) return;
    rows.push({ folder: f, depth, unread: unread(s, accountId, f.id) });
    for (const c of all.filter((x) => x.parent === f.id).sort((a, b) => a.name.localeCompare(b.name))) add(c, depth + 1);
  };
  for (const id of SYSTEM) { const f = all.find((x) => x.id === id); if (f) add(f, 0); }
  for (const f of all.filter((x) => !x.parent && !(SYSTEM as string[]).includes(x.id) && x.id !== "archive").sort((a, b) => a.name.localeCompare(b.name))) add(f, 0);
  return rows;
}

// The share of the quota in use, in whole percent.
export function quotaPercent(s: GameState, accountId: string): number {
  const a = s.mail.accounts.find((x) => x.id === accountId);
  return a ? Math.min(100, Math.round((a.usedKb / (capsOf(s, a).quotaMb * 1024)) * 100)) : 0;
}

// Special Folders: where drafts, sent mail and deletions go; an empty Trash means "Do not use Trash".
export type SpecialFolder = "drafts" | "sent" | "trash";
export function specialFolder(s: GameState, clusterId: string, accountId: string, key: SpecialFolder): string {
  const v = webmailUser(s, clusterId, accountId).prefs[key];
  return typeof v === "string" && (v === "" ? key === "trash" : foldersOf(s, accountId).some((f) => f.id === v)) ? v : key;
}
