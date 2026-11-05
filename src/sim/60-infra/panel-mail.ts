// The mail of the panel mailboxes (cPanel-like Mailboxes page): the messages by address and the webmail sign-in.
import { nowMinutes } from "../00-core/time";
import type { GameState } from "../50-state";
import { webspaceOf, type Mailbox } from "./webspace";

export interface PanelMessage { id: string; folder: "inbox" | "sent"; from: string; to: string; subject: string; body: string; at: number; read: boolean }

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

// The mailbox a webmail sign-in opens, null for a wrong address or password.
export const panelLogin = (s: GameState, address: string, password: string): Mailbox | null => {
  const m = panelMailbox(s, address)?.mailbox;
  return m && m.password === password ? m : null;
};

export const panelMessages = (s: GameState, address: string): PanelMessage[] => s.panelMail[lower(address)] ?? [];

// Stores a message in a panel mailbox; false when no panel mailbox is at the address.
export function panelStore(s: GameState, box: string, m: { from: string; to: string; subject: string; body: string }, folder: PanelMessage["folder"]): boolean {
  const a = lower(box);
  if (!panelMailbox(s, a)) return false;
  s.panelMail = { ...s.panelMail, [a]: [...panelMessages(s, a), { ...m, id: `pm${s.nextId++}`, folder, at: nowMinutes(s), read: folder === "sent" }] };
  return true;
}

// Mail to an address reaches its panel mailbox, also when it comes through the mail pipeline.
export const panelDeliver = (s: GameState, m: { from: string; to: string; subject: string; body: string }): boolean => panelStore(s, m.to, m, "inbox");

// Whether a panel mailbox is at the domain, which makes webmail.<domain> the panel's webmail.
export const panelMailDomain = (s: GameState, domain: string): boolean =>
  s.workloads.some((w) => Object.keys(webspaceOf(s, w.id)?.mailboxes ?? {}).some((a) => a.endsWith(`@${domain}`)));
