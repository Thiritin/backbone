// Pear Mail's own junk filter, after the provider's (docs/design/plans/mail-client.md, Junk).
import { hashRng, rand } from "../00-core/rng";
import type { Message } from "../42-mail/types";
import type { GameState } from "../50-state";

export const junkShare = (trained: number): number => Math.min(0.9, 0.3 + 0.02 * trained);
const num = (id: string): number => Number(id.replace(/\D/g, "")) || 0;

// The client's verdict: only spam the provider let through, and the same verdict for a message at the same training level.
export function clientJunk(s: GameState, m: Message): boolean {
  const j = s.pearMail.junk;
  return j.on && m.kind === "spam" && !j.clean.includes(m.id) && rand(hashRng(s.seed, num(m.id), 4127)) < junkShare(j.trained);
}

// What Pear Mail shows as junk: mail in a Junk mailbox, and elsewhere what the filter judges junk.
export const shownJunk = (s: GameState, m: Message): boolean =>
  s.pearMail.junk.on && !s.pearMail.junk.clean.includes(m.id) && (m.folder === "junk" || m.folder.endsWith(":junk") || clientJunk(s, m));
