import { yearOf } from "../00-core/time";
import { needsResearch, storeItem, subscriptionPrice } from "../10-catalog/store";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

export function research(s: GameState, id: string): ActionResult {
  const item = storeItem(id);
  if (!item) return fail("error.unknownStoreItem");
  if (!needsResearch(item, s.unlocks)) return fail("error.researched");
  if (s.knowHow < item.knowHow) return fail("error.noKnowHow");
  s.knowHow -= item.knowHow;
  s.unlocks = [...s.unlocks, id];
  return { ok: true };
}

// Installing pays the first month right away; the tick bills every later month start.
export function install(s: GameState, id: string): ActionResult {
  const item = storeItem(id);
  if (!item) return fail("error.unknownStoreItem");
  if (needsResearch(item, s.unlocks)) return fail("error.needsResearch");
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
