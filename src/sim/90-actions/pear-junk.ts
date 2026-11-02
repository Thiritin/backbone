// Pear Mail's Junk Mail preferences, Junk and Not Junk, and the junk step of the check (docs/design/plans/mail-client.md, Junk).
import { junkStep } from "../43-pear-mail/check";
import { clientJunk } from "../43-pear-mail/junk";
import { MY_PEAR, type ClientAccount, type JunkPrefs } from "../43-pear-mail/state";
import { clientFolder, ON_MY_PEAR } from "../43-pear-mail/view";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";
import { reportJunk } from "./mailmsg";
import { movePearMessages, transferMessages } from "./pear-mail";

const CLEAN_KEEP = 500;
const clientOf = (s: GameState, id: string): ClientAccount | undefined => (id === MY_PEAR ? ON_MY_PEAR : s.pearMail.accounts.find((c) => c.id === id));
const setJunk = (s: GameState, p: Partial<JunkPrefs>): void => { s.pearMail = { ...s.pearMail, junk: { ...s.pearMail.junk, ...p } }; };

export function setPearJunk(s: GameState, p: Partial<Pick<JunkPrefs, "on" | "mode">>): ActionResult {
  setJunk(s, p);
  return { ok: true };
}

// Reset: the filter forgets what it learned.
export function resetPearJunk(s: GameState): ActionResult {
  setJunk(s, { trained: 0, clean: [] });
  return { ok: true };
}

// Junk moves the messages to Junk, Not Junk takes them out of it; both train the client's filter and, for IMAP, the mailbox.
export function markPearJunk(s: GameState, clientId: string, ids: string[], junk: boolean): ActionResult {
  const c = clientOf(s, clientId);
  if (!c) return { ok: false, error: "error.mailUnknown" };
  const r = c.protocol === "imap" ? reportJunk(s, c.accountId, ids, junk) : movePearMessages(s, ids, junk ? "junk" : "inbox");
  if (!r.ok) return r;
  const { clean, trained } = s.pearMail.junk, want = new Set(ids);
  setJunk(s, { trained: trained + ids.length, clean: junk ? clean.filter((id) => !want.has(id)) : [...clean.filter((id) => !want.has(id)), ...ids].slice(-CLEAN_KEEP) });
  return r;
}

// In Automatic mode the check moves the new Inbox messages the filter judges junk to Junk.
function runJunk(s: GameState, clientId: string, ids: string[]): void {
  const { on, mode } = s.pearMail.junk, c = clientOf(s, clientId);
  if (!on || mode !== "automatic" || !c) return;
  const want = new Set(ids), hit = clientFolder(s, c, "inbox").filter((m) => want.has(m.id) && clientJunk(s, m)).map((m) => m.id);
  if (hit.length) transferMessages(s, c.id, hit, c.id, "junk");
}
junkStep.run = runJunk;
