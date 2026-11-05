import { spend } from "./purchase";
import type { Method } from "../46-finance/payables";
import type { Profile } from "../30-customers/customers";
import { studied, studyCost } from "../30-market/research";
import type { GameState } from "../50-state";
import { PROFILE_IDS } from "../80-business/marketing";
import type { ActionResult } from "./hardware";

export const STUDY_VENDOR = "Marktscout";
const fail = (error: string): ActionResult => ({ ok: false, error });

// Pays for a market study that reveals what one profile pays, weighs and demands.
export function buyStudy(s: GameState, profile: Profile, method?: Method): ActionResult {
  if (!PROFILE_IDS.includes(profile)) return fail("error.unknownProfile");
  if (studied(s, profile)) return fail("error.studyDone");
  const cost = studyCost(profile);
  if (!s.bank && s.cash < cost) return fail("error.noCash");
  const paid = spend(s, { supplier: "services", name: STUDY_VENDOR, lines: [{ hour: s.hour, category: "marketing", key: "ledger.marketStudy", params: { profile }, amount: -cost }], method });
  if (!paid.ok) return paid;
  s.marketing = { ...s.marketing, studies: [...s.marketing.studies, profile] };
  return { ok: true, id: profile };
}
