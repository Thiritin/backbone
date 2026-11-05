// The mail of the panel mailboxes (cPanel-like Mailboxes page): the messages by address and the webmail sign-in.
import { t } from "../../i18n/en";
import { nowMinutes } from "../00-core/time";
import { serviceHeld } from "../45-billing/billing";
import type { GameState } from "../50-state";
import { webspaceOf, type Mailbox } from "./webspace";

export interface PanelMessage { id: string; folder: "inbox" | "sent"; from: string; to: string; subject: string; body: string; at: number; read: boolean; tkey?: "welcome" }

const lower = (a: string): string => a.trim().toLowerCase();

// The mailbox at an address with the web space that holds it.
export function panelMailbox(s: GameState, address: string): { workloadId: string; mailbox: Mailbox } | null {
  const a = lower(address);
  for (const w of s.workloads) {
    const mailbox = webspaceOf(s, w.id)?.mailboxes[a];
    if (mailbox) return { workloadId: w.id, mailbox };
  }
  return null;
}

// The address a webmail sign-in means: a bare local part belongs to the page's domain.
export const panelAddress = (name: string, domain: string | null): string => (name.includes("@") || !domain ? lower(name) : `${lower(name)}@${domain}`);

// Whether the web space of a mailbox is suspended or ended, which locks its mailboxes.
export function panelLocked(s: GameState, workloadId: string): boolean {
  const w = s.workloads.find((x) => x.id === workloadId), v = w && s.services.find((x) => x.id === w.serviceId);
  return !!v && (v.endedAt !== null || serviceHeld(s, v));
}

// The mailbox a webmail sign-in opens, null for a wrong address or password; "locked" for a suspended web space.
export function panelLogin(s: GameState, address: string, password: string): Mailbox | null {
  const hit = panelMailbox(s, address);
  return hit && hit.mailbox.password === password && !panelLocked(s, hit.workloadId) ? hit.mailbox : null;
}
export function panelLoginError(s: GameState, address: string, password: string): string | null {
  const hit = panelMailbox(s, address);
  if (!hit || hit.mailbox.password !== password) return "panelmail.error.login";
  return panelLocked(s, hit.workloadId) ? "panelmail.error.locked" : null;
}

export const panelMessages = (s: GameState, address: string): PanelMessage[] => s.panelMail[lower(address)] ?? [];

// Stores a message in a panel mailbox; false when no panel mailbox is at the address.
export function panelStore(s: GameState, box: string, m: { from: string; to: string; subject: string; body: string; tkey?: "welcome" }, folder: PanelMessage["folder"]): boolean {
  const a = lower(box);
  if (!panelMailbox(s, a)) return false;
  s.panelMail = { ...s.panelMail, [a]: capped([...panelMessages(s, a), { ...m, id: `pm${s.nextId++}`, folder, at: nowMinutes(s), read: folder === "sent" }]) };
  return true;
}

export const BOX_CAP = 200;
// A full box drops its oldest read messages first, then its oldest.
function capped(list: PanelMessage[]): PanelMessage[] {
  let extra = list.length - BOX_CAP;
  if (extra <= 0) return list;
  const drop = new Set<string>();
  for (const m of list) if (extra > 0 && m.read) { drop.add(m.id); extra--; }
  for (const m of list) if (extra > 0 && !drop.has(m.id)) { drop.add(m.id); extra--; }
  return list.filter((m) => !drop.has(m.id));
}

// The mail of mailboxes that no longer exist is dropped once a day.
export function panelMailTick(s: GameState): void {
  if (s.hour % 24 !== 0 || !Object.keys(s.panelMail).length) return;
  const live = new Set<string>();
  for (const w of s.workloads) for (const a of Object.keys(webspaceOf(s, w.id)?.mailboxes ?? {})) live.add(a);
  const gone = Object.keys(s.panelMail).filter((a) => !live.has(a));
  if (!gone.length) return;
  s.panelMail = Object.fromEntries(Object.entries(s.panelMail).filter(([a]) => live.has(a)));
}

// What a message shows: the welcome mail renders in the language active at display time.
export const panelSubject = (m: PanelMessage): string => (m.tkey ? t(`panelmail.${m.tkey}.subject`) : m.subject);
export const panelBody = (m: PanelMessage): string => (m.tkey ? t(`panelmail.${m.tkey}.body`, { address: m.to }) : m.body);

// Mail to an address reaches its panel mailbox, also when it comes through the mail pipeline.
export const panelDeliver = (s: GameState, m: { from: string; to: string; subject: string; body: string; tkey?: "welcome" }): boolean => panelStore(s, m.to, m, "inbox");

// Whether a panel mailbox is at the domain, which makes webmail.<domain> the panel's webmail.
export const panelMailDomain = (s: GameState, domain: string): boolean =>
  s.workloads.some((w) => Object.keys(webspaceOf(s, w.id)?.mailboxes ?? {}).some((a) => a.endsWith(`@${domain}`)));
