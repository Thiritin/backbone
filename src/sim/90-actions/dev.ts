// The dev menu (Terminal, sudo dev): raw state edits for testing. They skip the tick, so a date jump bills and ages nothing.
import { hourOf } from "../00-core/time";
import { SKILLS } from "../10-catalog/research";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// date is "YYYY-MM-DD"; the clock lands on the given hour of that day, midnight by default.
export function setDate(s: GameState, date: string, hour = 0): ActionResult {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m || !Number.isInteger(hour) || hour < 0 || hour > 23) return fail("error.devDate");
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const day = new Date(Date.UTC(y, mo - 1, d, hour));
  if (day.getUTCFullYear() !== y || day.getUTCMonth() !== mo - 1 || day.getUTCDate() !== d) return fail("error.devDate");
  const h = hourOf(day);
  if (h < 0) return fail("error.devDate");
  s.hour = h;
  s.minute = 0;
  return { ok: true };
}

export function setMoney(s: GameState, amount: number): ActionResult {
  if (!Number.isFinite(amount)) return fail("error.devMoney");
  s.cash = Math.round(amount * 100) / 100;
  return { ok: true };
}

// Learns every skill at once, whatever the year, and drops a training in progress.
export function unlockAllResearch(s: GameState): ActionResult {
  for (const k of SKILLS) if (!s.unlocks.includes(k.id)) s.unlocks.push(k.id);
  s.training = null;
  return { ok: true };
}

export function setKnowHow(s: GameState, amount: number): ActionResult {
  if (!Number.isFinite(amount) || amount < 0) return fail("error.devKnowHow");
  s.knowHow = Math.round(amount);
  return { ok: true };
}
