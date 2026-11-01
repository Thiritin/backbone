// docs/design/plans/tax-office.md: what the player files with the tax office through DOHLE.
import { yearOf } from "../00-core/time";
import type { GameState } from "../50-state";
import { answer, fileVat, smallLimit, taxNumber } from "../80-business/tax";
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

// An advance VAT return filed with the tax office.
export function fileVatReturn(s: GameState, id: string): ActionResult {
  if (!taxNumber(s)) return fail("error.taxNumber");
  const r = s.tax.returns.find((x) => x.id === id && x.kind === "vat");
  if (!r) return fail("error.taxReturn");
  if (r.filedAt !== null) return fail("error.taxReturnFiled");
  fileVat(s, r);
  return { ok: true };
}

// Leaving the small business rule early; the company charges VAT from now on.
export function leaveSmallRule(s: GameState): ActionResult {
  if (!s.tax.small) return fail("error.taxNotSmall");
  s.tax = { ...s.tax, small: false };
  return { ok: true };
}
