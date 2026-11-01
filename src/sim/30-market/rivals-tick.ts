// The rivals' month roll. It lives apart from rivals.ts because it needs market research, which game state cannot import.
import { CITIES } from "../10-catalog/economy";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { demand } from "./research";
import { monthOf, rivalNews, rollRivals, SHARE_MONTHS, type RivalEvent, type ShareEntry } from "./rivals";

const EVENT: Record<RivalEvent["kind"], { app: string; key: string }> = {
  outage: { app: "News", key: "event.news.rivalOutage" }, bust: { app: "News", key: "event.news.rivalBust" },
  bought: { app: "News", key: "event.news.rivalBought" }, open: { app: "News", key: "event.news.rivalOpen" },
};

// Each city's buyers split between you and the rivals as Market research shows them, then the rivals' month (rivals.ts).
export function rivalsTick(s: GameState): SimEvent[] {
  const month = monthOf(s.hour);
  const flows = CITIES.map((c) => {
    const rows = demand(s, c.name), by = new Map<string, number>();
    for (const row of rows) for (const x of row.rivals) by.set(x.name, (by.get(x.name) ?? 0) + x.buyers);
    return { you: rows.reduce((n, row) => n + row.you, 0), by };
  });
  const tenth = (x: number) => Math.round(x * 10) / 10;
  const entry: ShareEntry = { month, you: flows.map((f) => tenth(f.you)), rivals: {} };
  for (const r of s.competitors) if (r.closed === null) entry.rivals[r.id] = flows.map((f) => tenth(f.by.get(r.name) ?? 0));
  s.shareLog = [...s.shareLog, entry].slice(-SHARE_MONTHS);
  const { list, events } = rollRivals(s.competitors, s.seed, s.hour, (r, city) => flows[CITIES.findIndex((c) => c.name === city)].by.get(r.name) ?? 0);
  s.competitors = list;
  return events.map((e) => {
    const def = rivalNews(s, ["rival", e.kind, e.id, month, ...e.params].join("."))!;
    s.news = [...s.news, `${def.id}@${s.hour}`];
    return { ...EVENT[e.kind], params: def.params };
  });
}
