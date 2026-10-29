import { yearOf } from "../00-core/time";
import { isAvailable, skillById } from "../10-catalog/research";
import { DESKS, deskReady } from "../10-catalog/desks";
import { monthlyCharge, storeItem, subscriptionEntry } from "../10-catalog/store";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Starts a training: know-how is paid up front and the skill is learned when the training ends.
export function research(s: GameState, id: string): ActionResult {
  const skill = skillById(id);
  if (!skill) return fail("error.unknownSkill");
  if (s.unlocks.includes(id)) return fail("error.researched");
  if (skill.from && yearOf(s.hour) < skill.from) return fail("error.notYet");
  if (s.training) return fail("error.trainingBusy");
  if (!skill.needs.every((n) => s.unlocks.includes(n))) return fail("error.missingSkill");
  if (s.knowHow < skill.knowHow) return fail("error.noKnowHow");
  s.knowHow -= skill.knowHow;
  s.training = { id, doneAt: s.hour + skill.days * 24 };
  return { ok: true };
}

// Why an item cannot be installed yet, or null: its skill is missing, or the Virtual machines app has no hypervisor to manage.
export function storeBlocker(s: GameState, id: string): string | null {
  if (!isAvailable(id, s.unlocks)) return "error.needsResearch";
  return id === "Virtual machines" && !s.clusters.some((c) => c.kind === "cloud" && (c.platform || c.switching)) ? "error.needsHypervisor" : null;
}

// Installing pays the first month right away; the tick bills every later month start.
export function install(s: GameState, id: string): ActionResult {
  const item = storeItem(id);
  if (!item) return fail("error.unknownStoreItem");
  const blocked = storeBlocker(s, id);
  if (blocked) return fail(blocked);
  if (s.installed.includes(id)) return fail("error.installed");
  if (item.kind === "desk" && !deskReady(s, id)) return fail("error.deskNotYet");
  const price = monthlyCharge(s, item);
  if (s.cash < price) return fail("error.noCash");
  s.cash = Math.round((s.cash - price) * 100) / 100;
  if (price > 0) s.ledger = [...s.ledger, subscriptionEntry(s, item)];
  // One desk at a time: the new desk replaces the one in use.
  const rest = item.kind === "desk" ? s.installed.filter((x) => !DESKS.some((d) => d.id === x)) : s.installed;
  s.installed = [...rest, id];
  return { ok: true };
}

export function cancel(s: GameState, id: string): ActionResult {
  if (!storeItem(id) || !s.installed.includes(id)) return fail("error.notInstalled");
  s.installed = s.installed.filter((x) => x !== id);
  return { ok: true };
}
