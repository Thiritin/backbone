import type { Profile } from "../30-customers/customers";
import { studied, studyCost } from "../30-market/research";
import type { GameState } from "../50-state";
import { PROFILE_IDS } from "../80-business/marketing";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Pays for a market study that reveals what one profile pays, weighs and demands.
export function buyStudy(s: GameState, profile: Profile): ActionResult {
  if (!PROFILE_IDS.includes(profile)) return fail("error.unknownProfile");
  if (studied(s, profile)) return fail("error.studyDone");
  const cost = studyCost(profile);
  if (s.cash < cost) return fail("error.noCash");
  s.cash = Math.round((s.cash - cost) * 100) / 100;
  s.ledger = [...s.ledger, { hour: s.hour, category: "marketing", key: "ledger.marketStudy", params: { profile }, amount: -cost }];
  s.marketing = { ...s.marketing, studies: [...s.marketing.studies, profile] };
  return { ok: true, id: profile };
}
