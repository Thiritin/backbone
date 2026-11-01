// The rivals' month roll. It lives apart from rivals.ts because it needs market research, which game state cannot import.
import { CITIES } from "../10-catalog/economy";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { demand } from "./research";
import { CHURN, driftRival, monthOf, OUTAGE_CHURN, rivalNews, SHARE_MONTHS, type ShareEntry } from "./rivals";

// The month roll: scores drift, outages post news, and each city's new customers split between you and the rivals.
export function rivalsTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [], month = monthOf(s.hour);
  const flows = CITIES.map((c) => {
    const rows = demand(s, c.name), by = new Map<string, number>();
    for (const row of rows) for (const x of row.rivals) by.set(x.name, (by.get(x.name) ?? 0) + x.buyers);
    return { you: rows.reduce((n, row) => n + row.you, 0), by };
  });
  s.competitors = s.competitors.map((r, i) => {
    if (r.closed !== null) return r;
    const { rival, news } = driftRival(r, i, s.seed, s.hour);
    const churn = CHURN + (rival.outage ? OUTAGE_CHURN : 0);
    rival.customers = Object.fromEntries(Object.entries(r.customers).map(([city, n]) =>
      [city, Math.max(0, Math.round(n * (1 - churn) + (flows[CITIES.findIndex((c) => c.name === city)]?.by.get(r.name) ?? 0)))]));
    if (news) {
      const def = rivalNews(s, `rival.outage.${r.id}.${month}.${CITIES.findIndex((c) => c.name === news.city)}.${news.hours}`)!;
      s.news = [...s.news, `${def.id}@${s.hour}`];
      events.push({ app: "News", key: "event.news.rivalOutage", params: def.params });
    }
    return rival;
  });
  const tenth = (x: number) => Math.round(x * 10) / 10;
  const entry: ShareEntry = { month, you: flows.map((f) => tenth(f.you)), rivals: {} };
  for (const r of s.competitors) if (r.closed === null) entry.rivals[r.id] = flows.map((f) => tenth(f.by.get(r.name) ?? 0));
  s.shareLog = [...s.shareLog, entry].slice(-SHARE_MONTHS);
  return events;
}
