// System mail from the world's senders, routed to the address each source writes to (docs/design/plans/mail-core.md, Routing).
import type { GameState } from "../50-state";
import { addressesOf } from "./address";
import type { Attachment, MailKind, MailParams, Message } from "./types";

// source: who writes, "bank", "supplier:<name>", "registrar", "tax", "office", "hosttoast" or "vendor".
// to: the address chosen for this mail, such as a licence's mailTo or the mailbox a reply answers.
export interface MailFrom { source?: string; to?: string; att?: Attachment[] }

export const SOURCE_KIND: Record<string, MailKind> = { bank: "bank", supplier: "invoice", registrar: "registrar", tax: "authority", office: "authority", hosttoast: "host", vendor: "licence" };
// Sources that keep the address they were first given.
export const CONTACTS = ["bank", "supplier", "registrar", "tax", "office", "hosttoast"];

// The pipeline imports half the sim, so deliver.ts fills this in and the senders far below it stay light.
export const mailSend = {
  deliverMail: (_s: GameState, _from: string, _topic: string, _params: MailParams, _o: MailFrom): string | null => null,
  contactAddress: (_s: GameState, _source: string): string => "",
};

// The message id, or null when the mail bounced and the player never sees it.
export const deliverMail = (s: GameState, from: string, topic: string, params: MailParams = {}, o: MailFrom = {}): string | null =>
  mailSend.deliverMail(s, from, topic, params, o);
// The address a source writes to; its first mail fixes the owner mailbox as its contact.
export const contactAddress = (s: GameState, source: string): string => mailSend.contactAddress(s, source);

// The first stored or waiting message that matches, in any mailbox.
export function findMail(s: GameState, f: (m: Message) => boolean): Message | undefined {
  for (const box of Object.values(s.mail.msgs)) {
    const m = box.find(f);
    if (m) return m;
  }
  return s.mail.queue.find((q) => f(q.msg))?.msg;
}

// Every address of the company's open mailboxes, the choices for a vendor's order mail.
export const ownAddresses = (s: GameState): string[] => s.mail.accounts.filter((a) => a.closedAt === null).flatMap(addressesOf);

// The vendor checkout preselects the last address used, else the mailbox named info@, else the primary.
export function defaultMailTo(s: GameState): string {
  const own = ownAddresses(s), last = [...s.licenses].reverse().find((k) => k.mailTo && own.includes(k.mailTo))?.mailTo;
  if (last) return last;
  const info = own.find((x) => x.startsWith("info@")), primary = s.mail.accounts.find((a) => a.id === s.mail.primary);
  return info ?? (primary ? `${primary.local}@${primary.domain}` : own[0] ?? "");
}
