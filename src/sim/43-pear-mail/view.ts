// Pure reads of what Pear Mail shows (docs/design/plans/mail-client.md, IMAP, POP and On My Pear).
import { isRead, listFolder } from "../42-mail/model";
import type { Message } from "../42-mail/types";
import type { GameState } from "../50-state";
import { localFolder, type ClientAccount } from "./state";

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
