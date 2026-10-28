import { yearOf } from "../00-core/time";
import { isAvailable, skillById } from "../10-catalog/research";
import { storeItem, subscriptionPrice } from "../10-catalog/store";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Starts a training: know-how is paid up front and the skill is learned when the training ends.
export function research(s: GameState, id: string): ActionResult {
  const skill = skillById(id);
  if (!skill) return fail("error.unknownSkill");
  if (s.unlocks.includes(id)) return fail("error.researched");
  if (s.training) return fail("error.trainingBusy");
  if (!skill.needs.every((n) => s.unlocks.includes(n))) return fail("error.missingSkill");
  if (s.knowHow < skill.knowHow) return fail("error.noKnowHow");
  s.knowHow -= skill.knowHow;
  s.training = { id, doneAt: s.hour + skill.days * 24 };
  return { ok: true };
}

// Installing pays the first month right away; the tick bills every later month start.
export function install(s: GameState, id: string): ActionResult {
  const item = storeItem(id);
  if (!item) return fail("error.unknownStoreItem");
  if (!isAvailable(id, s.unlocks)) return fail("error.needsResearch");
  if (s.installed.includes(id)) return fail("error.installed");
  const price = subscriptionPrice(item, yearOf(s.hour));
  if (s.cash < price) return fail("error.noCash");
  s.cash = Math.round((s.cash - price) * 100) / 100;
  s.ledger = [...s.ledger, { hour: s.hour, category: "subscriptions", key: "ledger.subscription", params: { name: item.name }, amount: -price }];
  s.installed = [...s.installed, id];
  return { ok: true };
}

export function cancel(s: GameState, id: string): ActionResult {
  if (!storeItem(id) || !s.installed.includes(id)) return fail("error.notInstalled");
  s.installed = s.installed.filter((x) => x !== id);
  return { ok: true };
}
