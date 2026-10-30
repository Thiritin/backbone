import type { GameState } from "../50-state";

// One daily reading of the customer base for the Customers app's history charts: the day's first hour, the live customers and their mean happiness.
export interface TrendPoint { hour: number; customers: number; happiness: number }

// Adds a reading at the start of each game day; before the first customer arrives there is nothing to chart.
export function trendTick(s: GameState): void {
  if (s.hour % 24 !== 0) return;
  const live = s.customers.filter((c) => c.churnedAt === null && !c.sponsor);
  if (!live.length && !s.trend.length) return;
  const happiness = live.length ? Math.round((live.reduce((sum, c) => sum + c.happiness, 0) / live.length) * 10) / 10 : 0;
  s.trend = [...s.trend, { hour: s.hour, customers: live.length, happiness }];
}
