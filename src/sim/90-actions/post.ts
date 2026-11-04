// Paper post in the room: letters wait in the letterbox until fetched, and the scanner files one into DocuWhere.
import type { GameState } from "../50-state";
import { playerAt, present } from "../60-infra/handwork";
import { boxAt, postLocation } from "../40-support/letters";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Empties the letterbox where the player stands: the one the post goes to, or an old one still holding letters.
export function fetchPost(s: GameState): ActionResult {
  const here = playerAt(s).id, waiting = boxAt(s, here);
  if (!present(s, here) || (here !== postLocation(s) && !waiting.length)) return fail("error.notThere");
  if (!waiting.length) return fail("error.letterboxEmpty");
  s.letters = s.letters.map((l) => (l.arrived && l.box === here ? { ...l, box: null } : l));
  return { ok: true };
}

export function scanLetter(s: GameState, id: string): ActionResult {
  const l = s.letters.find((x) => x.id === id && x.arrived);
  if (!l) return fail("error.unknownLetter");
  if (l.box) return fail("error.inLetterbox");
  if (l.scanned) return fail("error.letterScanned");
  s.letters = s.letters.map((x) => (x.id === id ? { ...x, scanned: true } : x));
  return { ok: true };
}
