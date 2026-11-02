import { DAYS_PER_MONTH } from "../00-core/time";
import { FLYER_CONVERSION, FLYER_DELIVERY_HOURS, FLYER_HAND_OUT_DAYS, FLYER_PROFILES, FLYER_RESPONSE } from "../10-catalog/flyers";
import { profileStats } from "../40-support/tickets";
import type { GameState } from "../50-state";
import type { LeadBatch } from "./marketing";

export interface FlyerRun { id: string; city: string; size: number; orderedAt: number; flyersLeft: number; leads: number }

const perHour = (r: FlyerRun): number => r.size / (FLYER_HAND_OUT_DAYS * 24);
// A run is on the street from its delivery until the last flyer is gone.
export const handingOut = (s: GameState, r: FlyerRun): boolean => r.flyersLeft > 0 && s.hour >= r.orderedAt + FLYER_DELIVERY_HOURS;

// Expected leads a month at the current hand-out rate, split by the mix of the profiles a flyer reaches.
export function flyerBatches(s: GameState): LeadBatch[] {
  const mix = FLYER_PROFILES.reduce((n, p) => n + profileStats(p).mix, 0);
  return s.marketing.flyers.filter((r) => handingOut(s, r)).flatMap((r) =>
    FLYER_PROFILES.map((profile) => ({
      profile, city: r.city, source: "flyer" as const, conversion: FLYER_CONVERSION,
      count: (perHour(r) * FLYER_RESPONSE * 24 * DAYS_PER_MONTH * profileStats(profile).mix) / mix,
    })));
}

// Hourly: hands out the next share of every delivered run and counts the leads it brings.
export function flyerTick(s: GameState): void {
  if (!s.marketing.flyers.some((r) => handingOut(s, r))) return;
  s.marketing = {
    ...s.marketing,
    flyers: s.marketing.flyers.map((r) => {
      if (!handingOut(s, r)) return r;
      const handed = Math.min(r.flyersLeft, perHour(r)), left = r.flyersLeft - handed;
      return { ...r, flyersLeft: left < 1e-6 ? 0 : left, leads: r.leads + handed * FLYER_RESPONSE };
    }),
  };
}
