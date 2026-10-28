import { chargePremium, hardwarePremium } from "../46-finance/finance";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// Buying the hardware policy pays its first month's premium; it covers components that fail from now on.
export function buyInsurance(s: GameState): ActionResult {
  if (s.insurance.some((p) => p.id === "hardware")) return fail("error.insured");
  if (s.cash < hardwarePremium(s)) return fail("error.noCash");
  chargePremium(s);
  s.insurance = [...s.insurance, { id: "hardware", since: s.hour }];
  return { ok: true };
}

export function cancelInsurance(s: GameState): ActionResult {
  if (!s.insurance.some((p) => p.id === "hardware")) return fail("error.notInsured");
  s.insurance = s.insurance.filter((p) => p.id !== "hardware");
  return { ok: true };
}
