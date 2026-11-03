// Paper post in the room: letters wait in the letterbox until fetched, and the scanner files one into DocuWhere.
import type { GameState } from "../50-state";
import { present } from "../60-infra/handwork";
import { inLetterbox, postLocation } from "../40-support/letters";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

export function fetchPost(s: GameState): ActionResult {
  if (!present(s, postLocation(s))) return fail("error.notThere");
  if (!inLetterbox(s).length) return fail("error.letterboxEmpty");
  s.letters = s.letters.map((l) => (l.arrived && l.box ? { ...l, box: null } : l));
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
