// Things that become available are announced by the News app on the day they do (gdd.md, The desktop, News).
import { hourOf, isMonthStart, START_YEAR } from "../00-core/time";
import { IPV6_FROM } from "../10-catalog/addresses";
import { GENERATIONS } from "../10-catalog/economy";
import { MODELS } from "../10-catalog/hardware";
import { supportEnd } from "../10-catalog/lifecycle";
import { GPU_CARDS } from "../10-catalog/gpu";
import { CLEARANCE_SIZE, LOT_SIZE, USED_EVENTS } from "../10-catalog/used";
import { SOFTWARE } from "../10-catalog/platforms";
import { LINE_NAME } from "../30-market/spec";
import type { GameState } from "../50-state";
import { lineOffered } from "../60-infra/cluster";
import type { SimEvent } from "../88-tick/tick";
import { MAIL_PROVIDERS } from "./mail";
import { listed, SITE_LINES } from "./website";

type Params = Record<string, string | number>;
export interface NewsDef { id: string; key: string; at: number; params: Params }

const at = (year: number, month = 0): number => hourOf(new Date(Date.UTC(year, month, 1, 9)));

// Fixed announcements; a later lane adds its own by pushing a NewsDef with its date. What exists when a game starts is not news.
export const NEWS: NewsDef[] = [
  ...SOFTWARE.filter((x) => x.from > START_YEAR).map((x) => ({ id: `software.${x.id}`, key: "event.news.software", at: at(x.from), params: { name: x.name, kind: x.kind } })),
  ...GENERATIONS.flatMap((g, i) => (g.year > START_YEAR ? [{ id: `generation.${i + 1}`, key: "event.news.generation", at: at(g.year), params: { gen: i + 1, cores: g.cores, ramGb: g.ramGb, disk: g.disk } }] : [])),
  ...MAIL_PROVIDERS.filter((x) => x.from > START_YEAR).map((x) => ({ id: `mail.${x.id}`, key: "event.news.mail", at: at(x.from), params: { name: x.name, price: x.price(x.from) } })),
  // A model other than a server leaves the shop on the first of January after its last year on sale (servers have generation news).
  ...MODELS.filter((m) => !m.server && m.until !== null).map((m) => ({ id: `endOfSale.${m.id}`, key: "event.news.endOfSale", at: at(m.until! + 1), params: { name: m.name, supportEnd: supportEnd(m)! } })),
  ...GPU_CARDS.filter((c) => c.year > START_YEAR).map((c) => ({ id: `gpu.${c.year}`, key: "event.news.gpu", at: at(c.year), params: { name: c.name, watts: c.watts, price: c.price } })),
  // The two jumps in GPU demand (gpu.ts, gpuDemand).
  { id: "gpuDemand.2017", key: "event.news.gpuDemand", at: at(2017), params: { year: 2017 } },
  { id: "gpuDemand.2023", key: "event.news.gpuDemand", at: at(2023), params: { year: 2023 } },
  { id: "ipv6.dc", key: "event.news.ipv6Dc", at: at(IPV6_FROM.dc), params: {} },
  { id: "ipv6.home", key: "event.news.ipv6Home", at: at(IPV6_FROM.home), params: {} },
  { id: "ripe.last8", key: "event.news.ripeLast", at: at(2012, 8), params: {} },
  { id: "ripe.runOut", key: "event.news.ripeOut", at: at(2019, 10), params: {} },
  // Website designs come in generations four years apart from 2009 (website.ts, generationOf).
  ...Array.from({ length: 8 }, (_, i) => 2009 + 4 * i).map((year) => ({ id: `design.${year}`, key: "event.news.design", at: at(year), params: { year } })),
  // The used market's yearly lot and clearance weekend (80-business/used.ts).
  ...USED_EVENTS.map((e) => ({ id: e.id, key: `event.news.used.${e.kind}`, at: e.at, params: { count: e.kind === "lot" ? LOT_SIZE : CLEARANCE_SIZE } })),
];

const lineDef = (p: string): NewsDef => ({ id: `line.${p}`, key: "event.news.line", at: -1, params: { line: LINE_NAME[p as keyof typeof LINE_NAME] } });

// What GameState.news holds: each entry's hour of publication and the announcement it stands for, newest first.
export function feed(s: GameState): { hour: number; key: string; params: Params }[] {
  return s.news.flatMap((e) => {
    const [id, hour] = e.split("@"), d = id.startsWith("line.") ? lineDef(id.slice(5)) : NEWS.find((x) => x.id === id);
    return d ? [{ hour: Number(hour), key: d.key, params: d.params }] : [];
  }).sort((a, b) => b.hour - a.hour);
}

export function newsTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  const post = (d: NewsDef) => {
    if (s.news.some((e) => e.startsWith(`${d.id}@`))) return;
    s.news = [...s.news, `${d.id}@${s.hour}`];
    events.push({ app: "News", key: d.key, params: d.params });
  };
  for (const d of NEWS) if (d.at === s.hour) post(d);
  // A line the player could sell but has not put on the website is mentioned once.
  if (isMonthStart(s.hour)) for (const p of SITE_LINES) if (lineOffered(s, p) && !listed(s, p)) post(lineDef(p));
  return events;
}
