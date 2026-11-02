// docs/design/plans/webmail-server.md, section 5: what the own mail server software offers and what the admin pages show
// before a mailbox or the server goes.
import { boxOf } from "../42-mail/model";
import { GMIX_DOMAIN } from "../42-mail/new";
import type { GameState } from "../50-state";
import { vmById, type Cluster } from "../60-infra/cluster";
import type { SelfMailSoftware } from "./mail";

export interface MailSoftwareRow { sieveFrom: number; spam: { name: string; bonus: number; always: boolean }; autoconfig: boolean }
export const MAIL_SOFTWARE: Record<SelfMailSoftware, MailSoftwareRow> = {
  postfixit: { sieveFrom: 2010, spam: { name: "Spamsassin", bonus: 0.25, always: false }, autoconfig: false },
  mailpig: { sieveFrom: 2005, spam: { name: "Rspamed", bonus: 0.4, always: true }, autoconfig: true },
};
export const MAIL_OPTIONS = ["spam"] as const;
export type MailOption = (typeof MAIL_OPTIONS)[number];

export const mailOption = (s: GameState, clusterId: string, key: MailOption): boolean => !!s.webmail.options[clusterId]?.[key];

export function spamOn(s: GameState, c: Cluster, software: SelfMailSoftware): boolean {
  return MAIL_SOFTWARE[software].spam.always || mailOption(s, c.id, "spam");
}

// The hour of the last usable backup of the mail server's machine; a server on bare metal has none.
export const mailBackupAt = (s: GameState, c: Cluster): number | null => vmById(s, c.vm)?.backupAt ?? null;

// The own-server tenants a mail server holds, with their open mailboxes and their messages.
export function serverMail(s: GameState, clusterId: string): { mailboxes: number; messages: number } {
  const tenants = new Set(s.mail.tenants.filter((t) => t.host === "self" && t.clusterId === clusterId).map((t) => t.id));
  const boxes = s.mail.accounts.filter((a) => tenants.has(a.tenant) && a.closedAt === null);
  return { mailboxes: boxes.length, messages: boxes.reduce((n, a) => n + boxOf(s, a.id).length + a.older.n, 0) };
}

// What deleting a mailbox takes with it; stale says its addresses keep receiving mail that bounces for a while.
export function mailboxLoss(s: GameState, id: string): { messages: number; stale: boolean } {
  const a = s.mail.accounts.find((x) => x.id === id);
  return { messages: a ? boxOf(s, a.id).length + a.older.n : 0, stale: !!a && a.domain !== GMIX_DOMAIN };
}

// The Dovecoat release that comes with Postfixit by year (unverified as to the month).
const DOVECOAT: [number, string][] = [[2005, "1.0"], [2008, "1.1"], [2010, "2.0"], [2013, "2.2"], [2018, "2.3"]];
export const dovecoatAt = (year: number): string => DOVECOAT.filter(([y]) => y <= year).at(-1)?.[1] ?? DOVECOAT[0][1];
