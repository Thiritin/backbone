import { dateOf, isMonthStart } from "../00-core/time";
import type { GameState } from "../50-state";

export interface SimEvent {
  app: string;
  key: string;
  params: Record<string, string | number>;
}

export function tick(state: GameState): SimEvent[] {
  state.hour++;
  const events: SimEvent[] = [];
  if (isMonthStart(state.hour)) {
    const d = dateOf(state.hour);
    events.push({ app: "Finance", key: "event.monthStart", params: { month: d.getUTCMonth(), year: d.getUTCFullYear() } });
  }
  return events;
}
