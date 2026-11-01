// docs/design/plans/tax-office.md: what the player files with the tax office through DOHLE.
import { yearOf } from "../00-core/time";
import type { GameState } from "../50-state";
import { answer, smallLimit } from "../80-business/tax";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// The questionnaire for tax registration, answered on DOHLE once its letter has arrived.
export function answerQuestionnaire(s: GameState, expected: number, small: boolean): ActionResult {
  const asked = s.letters.some((l) => l.topic === "taxQuestionnaire" && l.arrived);
  if (!asked) return fail("error.taxNoQuestionnaire");
  if (s.tax.answered !== null) return fail("error.taxAnswered");
  if (!Number.isFinite(expected) || expected < 0) return fail("error.taxRevenue");
  if (small && expected > smallLimit(yearOf(s.hour))) return fail("error.taxSmallLimit");
  answer(s, Math.round(expected), small);
  return { ok: true };
}
