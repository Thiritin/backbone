// Company email: the starting mailbox and the pure reads every mail screen renders from (docs/design/plans/mail-core.md).
import { t } from "../../i18n/en";
import type { GameState } from "../50-state";
import type { Ticket } from "../40-support/tickets";
import { subjectParams } from "../40-support/notices";
import { ascii } from "../30-customers/domains";
import type { Attachment, Folder, Message, SysFolder } from "./types";
import { GMIX_DOMAIN, gmixLocal } from "./new";
import { accountByAddress, addressesOf, ownsAddress, tenantOf } from "./address";
export { accountByAddress, addressesOf, ownsAddress, tenantOf };
import { SENDERS } from "../10-catalog/mail-senders";

export const SYS_FOLDERS: SysFolder[] = ["inbox", "sent", "drafts", "junk", "trash", "archive"];
// Live messages a mailbox keeps before the retention pass folds the oldest into `older`.
export const MAIL_KEEP = 300;

// Renaming the company before the starting box was renamed by hand carries the GMix address along.
export function renameStartBox(s: GameState, oldName: string): void {
  const a = s.mail.accounts.find((x) => x.id === s.mail.primary);
  if (!a || a.domain !== GMIX_DOMAIN || a.local !== gmixLocal(oldName)) return;
  const local = gmixLocal(s.company.name), address = `${local}@${a.domain}`;
  const box = (s.mail.msgs[a.id] ?? []).map((m) => (m.topic === "mailWelcome" ? { ...m, to: address, p: { ...m.p, address } } : m));
  s.mail = { ...s.mail, accounts: s.mail.accounts.map((x) => (x.id === a.id ? { ...x, local, title: s.company.name } : x)), msgs: { ...s.mail.msgs, [a.id]: box } };
}

export const boxOf = (s: GameState, accountId: string): Message[] => s.mail.msgs[accountId] ?? [];
export const ticketOf = (s: GameState, m: Message): Ticket | undefined => (m.ticket ? s.tickets.find((x) => x.id === m.ticket) : undefined);


// System folders first, then the custom folders and labels of the mailbox.
export const foldersOf = (s: GameState, accountId: string): Folder[] => [
  ...SYS_FOLDERS.map((id): Folder => ({ id, accountId, name: t(`mail.folder.${id}`), parent: null })),
  ...s.mail.folders.filter((f) => f.accountId === accountId),
];

// Newest first. A label lists every message that carries it; snoozed mail is out of the list until it returns.
export function listFolder(s: GameState, accountId: string, folderId: string): Message[] {
  const label = s.mail.folders.some((f) => f.id === folderId && f.label);
  return boxOf(s, accountId).filter((m) => !m.snooze && (label ? m.labels?.includes(folderId) : m.folder === folderId)).reverse();
}

// A ticket thread's read state is the ticket's, so a mailbox and a desk agree.
export const isRead = (s: GameState, m: Message): boolean => {
  const tk = ticketOf(s, m);
  return tk ? !tk.unread : !!m.read;
};

// Unread messages in a folder, the Inbox when none is given.
export const unread = (s: GameState, accountId: string, folderId = "inbox"): number => listFolder(s, accountId, folderId).filter((m) => !isRead(s, m)).length;

export interface MailView { subject: string; text: string; fromName: string; fromAddress: string; to: string; cc: string[]; att: Attachment[] }

// The sender behind a ref: a display name, a customer, one of the company's mailboxes, a written address or the mail daemon.
function sender(s: GameState, m: Message): [string, string] {
  const [kind, ...rest] = m.from.split(":"), ref = rest.join(":");
  if (kind === "n") return [ref, SENDERS[ref] ?? `no-reply@${ascii(ref).replace(/-/g, "") || "mail"}.com`];
  if (kind === "cust") {
    const c = s.customers.find((x) => x.id === ref);
    return [c?.name ?? ref, c?.address.email ?? ""];
  }
  if (kind === "acct") {
    const a = s.mail.accounts.find((x) => x.id === ref);
    return a ? [a.title, `${a.local}@${a.domain}`] : [ref, ""];
  }
  if (kind === "ext") return [ref, ref];
  return [t("mail.daemon"), `mailer-daemon@${m.to.split("@")[1] ?? GMIX_DOMAIN}`];
}

// The only place mail text is rendered, in the active language, so a filter, a search and a screen agree.
export function view(s: GameState, m: Message): MailView {
  const tk = ticketOf(s, m), [fromName, fromAddress] = sender(s, m);
  const [subject, text] = m.own ? [m.own.subject, m.own.text]
    : tk ? (["subject", "text"] as const).map((x) => t(`ticket.${tk.kind}.${tk.topic}.${x}`, subjectParams(s, tk)))
    : (["subject", "text"] as const).map((x) => t(`ticket.mail.${m.topic}.${x}`, m.p));
  return { subject, text: m.foot ? `${text}\n\n${t(m.foot)}` : text, fromName, fromAddress, to: m.to, cc: m.cc ?? [], att: m.att ?? [] };
}
