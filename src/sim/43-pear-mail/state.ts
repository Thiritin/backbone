// Pear Mail, the desktop mail client: what the client keeps apart from the server mailboxes (docs/design/plans/mail-client.md, Client state).
import type { Folder, MailAct, MailRule, Message } from "../42-mail/types";

export type PopRemove = "now" | "day" | "week" | "month" | "never";

export interface ClientAccount {
  id: string;                  // "cl12"
  accountId: string;           // the MailAccount it reads
  address: string;             // as added, which may be an alias
  description: string; fullName: string;
  password: string;            // compared with the mailbox's at every check, as a keychain entry would be
  protocol: "imap" | "pop";
  server: { host: string; port: number; tls: boolean } | null;  // typed in the manual assistant, null when set up automatically
  smtp: string | null;
  enabled: boolean;
  checkEvery: number;          // game minutes between checks, 0 for manual
  checkedAt: number;           // game minute of the last check, failed or not, which the schedule and the poll gap count from
  syncedAt: number;            // game minute of the last good check: server mail that arrived later is not visible yet
  authFailed?: true;           // the password was refused; scheduled checks stop until a new one is entered
  popRemove: PopRemove;
  popDue: { id: string; at: number }[];  // server copies whose removal is scheduled
  signature: string | null;
  storeSent: boolean;
  addedAt: number;
}

export type ClientAct = MailAct | { do: "color"; color: string } | { do: "sound" } | { do: "copy"; folder: string } | { do: "reply"; subject: string; text: string };
// clientId null applies to every account.
export interface ClientRule extends Omit<MailRule, "acts"> { clientId: string | null; acts: ClientAct[] }

// error is an i18n key; a line without one is a good check.
export interface ActivityLine { at: number; clientId: string; count: number; error?: string }

export interface PearMailState {
  accounts: ClientAccount[];   // sidebar order
  rules: ClientRule[];
  local: { folders: Folder[]; messages: Message[] };  // On My Pear folders and POP downloads, Folder.accountId "pear"
  activity: ActivityLine[];    // newest last, at most ACTIVITY_KEEP
  welcomed: boolean;           // the first-launch welcome was dismissed
  seenBuild: string;           // version of the last build whose What's new sheet was shown
}

export const ACTIVITY_KEEP = 30;
export const PEAR = "pear";
export const localFolder = (clientId: string, folder: string): string => `${PEAR}:${clientId}:${folder}`;
// The client id of On My Pear mailboxes: their mail sits in localFolder(MY_PEAR, folder id).
export const MY_PEAR = "my";

export const newPearMail = (): PearMailState => ({ accounts: [], rules: [], local: { folders: [], messages: [] }, activity: [], welcomed: false, seenBuild: "" });

export const clientAccount = (id: string, o: { accountId: string; address: string; description: string; fullName: string; password: string; protocol: "imap" | "pop" }, at: number): ClientAccount => ({
  ...o, id, server: null, smtp: null, enabled: true, checkEvery: 5, checkedAt: at, syncedAt: at, popRemove: "now", popDue: [], signature: null, storeSent: true, addedAt: at,
});
