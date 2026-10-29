import { hourOf } from "../00-core/time";
import type { GameState } from "../50-state";
import { metrics } from "../metrics";

// Leaderboard scores stop at the end of 2007, three game years in.
export const SCORE_END = hourOf(new Date(Date.UTC(2008, 0, 1)));

export interface Scores { netWorth: number | null; level3: number | null; happiness: number | null }

// Adds this hour's mean customer happiness; checks the level once a day and takes the net worth at the end of 2007.
export function scoreTick(s: GameState): void {
  if (s.hour > SCORE_END) return;
  let { netWorth, level3, happySum, happyHours } = s.score;
  const live = s.customers.filter((c) => c.churnedAt === null);
  if (live.length) {
    happySum += live.reduce((sum, c) => sum + c.happiness, 0) / live.length;
    happyHours++;
  }
  if ((level3 === null && s.hour % 24 === 0) || s.hour === SCORE_END) {
    const m = metrics(s);
    if (level3 === null && m.level.level >= 3) level3 = s.hour;
    if (s.hour === SCORE_END) netWorth = Math.round(m.netWorth);
  }
  s.score = { netWorth, level3, happySum, happyHours };
}

export const scores = (s: GameState): Scores => ({
  netWorth: s.score.netWorth,
  level3: s.score.level3,
  happiness: s.score.happyHours ? Math.round((s.score.happySum / s.score.happyHours) * 10) / 10 : null,
});
