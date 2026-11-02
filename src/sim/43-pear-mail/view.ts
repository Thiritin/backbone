// Pure reads of what Pear Mail shows (docs/design/plans/mail-client.md, IMAP, POP and On My Pear).
import { foldersOf, isRead, listFolder, SYS_FOLDERS, view } from "../42-mail/model";
import type { Folder, Message, SysFolder } from "../42-mail/types";
import type { GameState } from "../50-state";
import { clientAccount, localFolder, MY_PEAR, PEAR, type ClientAccount } from "./state";

// Server mail reaches the client at its next check; the account's own drafts and sent copies are there at once.
export const visibleTo = (c: ClientAccount, m: Message): boolean => m.at <= c.syncedAt || m.from === `acct:${c.accountId}`;

// Newest first: the server folder for IMAP, the downloaded copies for POP.
export function clientFolder(s: GameState, c: ClientAccount, folder: string): Message[] {
  if (c.protocol === "pop") {
    const id = localFolder(c.id, folder);
    return s.pearMail.local.messages.filter((m) => m.folder === id).reverse();
  }
  return listFolder(s, c.accountId, folder).filter((m) => visibleTo(c, m));
}

export const unreadBadge = (s: GameState): number =>
  s.pearMail.accounts.filter((c) => c.enabled).reduce((n, c) => n + clientFolder(s, c, "inbox").filter((m) => !isRead(s, m)).length, 0);

export interface Row { c: ClientAccount; m: Message }
export const UNIFIED = ["inbox", "drafts", "sent", "junk", "trash"] as const;

// On My Pear reads like a POP account whose local folders are the ones the player made; its Trash joins the unified one.
export const ON_MY_PEAR: ClientAccount = clientAccount(MY_PEAR, { accountId: PEAR, address: "", description: "", fullName: "", password: "", protocol: "pop" }, 0);
export const myFolders = (s: GameState): Folder[] => s.pearMail.local.folders;

// clientId null is the unified mailbox over every enabled account.
export const mailboxRows = (s: GameState, clientId: string | null, folder: string): Row[] =>
  (clientId === MY_PEAR ? [ON_MY_PEAR] : [...s.pearMail.accounts.filter((c) => (clientId ? c.id === clientId : c.enabled)), ...(clientId ? [] : [ON_MY_PEAR])])
    .flatMap((c) => clientFolder(s, c, folder).map((m) => ({ c, m })));

export const clientUnread = (s: GameState, c: ClientAccount, folder: string): number => clientFolder(s, c, folder).filter((m) => !isRead(s, m)).length;

// The folders an account shows: the server's for IMAP, the system folders for POP. Archive only once it holds mail.
export const clientFolders = (s: GameState, c: ClientAccount): Folder[] =>
  foldersOf(s, c.accountId).filter((f) => (c.protocol === "imap" || SYS_FOLDERS.includes(f.id as SysFolder)) && (f.id !== "archive" || clientFolder(s, c, "archive").length > 0));

export type SortKey = "date" | "from" | "subject";
// Stable; text keys compare the shown sender and subject in the active language.
export function sortMessages<T>(s: GameState, xs: T[], get: (x: T) => Message, key: SortKey, asc: boolean): T[] {
  const val = (x: T): string | number => { const m = get(x); return key === "date" ? m.at : key === "from" ? view(s, m).fromName.toLowerCase() : view(s, m).subject.toLowerCase(); };
  const dir = asc ? 1 : -1;
  return xs.map((x) => [x, val(x)] as const).sort(([, a], [, b]) => (a < b ? -dir : a > b ? dir : 0)).map(([x]) => x);
}

// Groups in the order of their first row, so a sorted list stays sorted by its newest thread member.
export function threadsOf<T>(xs: T[], get: (x: T) => Message): T[][] {
  const by = new Map<string, T[]>();
  for (const x of xs) { const k = get(x).thread; by.set(k, [...(by.get(k) ?? []), x]); }
  return [...by.values()];
}
