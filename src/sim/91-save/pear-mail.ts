import { nowMinutes } from "../00-core/time";
import { capsOf } from "../42-mail/caps";
import { clientAccount, newPearMail, type PearMailState } from "../43-pear-mail/state";
import type { GameState } from "../50-state";

// Runs after fillMail. A save from before Pear Mail gets its primary mailbox as an account, checked from the load minute on
// so nothing floods in, and skips the welcome. Its id stays clear of the cl<nextId> ids the assistant gives.
export function fillPearMail(s: GameState, saved: Partial<PearMailState> | undefined): void {
  if (saved) { s.pearMail = { ...newPearMail(), ...saved }; return; }
  const a = s.mail.accounts.find((x) => x.id === s.mail.primary), now = nowMinutes(s);
  s.pearMail = { ...newPearMail(), welcomed: true };
  if (!a) return;
  const address = `${a.local}@${a.domain}`;
  s.pearMail.accounts = [clientAccount("cl0", {
    accountId: a.id, address, description: address, fullName: a.title, password: a.password, protocol: capsOf(s, a).imap ? "imap" : "pop",
  }, now)];
}
