// Things that become available are announced by the News app on the day they do (gdd.md, The desktop, News).
import { hourOf, isMonthStart, START_YEAR, yearOf } from "../00-core/time";
import { IPV6_FROM } from "../10-catalog/addresses";
import { DESKS } from "../10-catalog/desks";
import { GENERATIONS } from "../10-catalog/economy";
import { MODELS, SERVER_LINES } from "../10-catalog/hardware";
import { supportEnd } from "../10-catalog/lifecycle";
import { GPU_CARDS } from "../10-catalog/gpu";
import { CLEARANCE_SIZE, LOT_SIZE, USED_EVENTS } from "../10-catalog/used";
import { PORT_SPEEDS } from "../10-catalog/network";
import { phpAt, SOFTWARE, softwareById } from "../10-catalog/platforms";
import { SKILLS } from "../10-catalog/research";
import { HOME_LINES } from "../20-world/datacenters";
import { LINE_NAME } from "../30-market/spec";
import type { GameState } from "../50-state";
import { familyOf } from "../60-infra/vulns";
import type { SimEvent } from "../88-tick/tick";
import { MAIL_PROVIDERS } from "./mail";
import { lineBlocker, listed, SITE_LINES } from "./website";

type Params = Record<string, string | number>;
export interface NewsDef { id: string; key: string; at: number; params: Params }

const at = (year: number, month = 0): number => hourOf(new Date(Date.UTC(year, month, 1, 9)));

// What arrives in the same year shares one announcement, its names joined by "|".
function byYear<T>(xs: T[], year: (x: T) => number, name: (x: T) => string): [number, string][] {
  const m = new Map<number, string[]>();
  for (const x of xs) if (year(x) > START_YEAR) m.set(year(x), [...(m.get(year(x)) ?? []), name(x)]);
  return [...m].map(([y, names]) => [y, names.join("|")]);
}

// A software's feature that arrives in a later release than its first.
const FEATURES = (x: (typeof SOFTWARE)[number]) =>
  ([["cluster", x.cluster], ["balloon", x.balloon], ["importSame", x.migration.same], ["importOther", x.migration.other]] as [string, number | null][])
    .flatMap(([f, y]): [string, number][] => (y !== null && y > Math.max(START_YEAR, x.from) ? [[f, y]] : []));

// Fixed announcements; a later lane adds its own by pushing a NewsDef with its date. What exists when a game starts is not news.
export const NEWS: NewsDef[] = [
  ...SOFTWARE.filter((x) => x.from > START_YEAR).map((x) => ({ id: `software.${x.id}`, key: "event.news.software", at: at(x.from), params: { name: x.name, kind: x.kind } })),
  ...SOFTWARE.filter((x) => x.autoUpdate !== null && x.autoUpdate > START_YEAR).map((x) => ({ id: `autoUpdate.${x.id}`, key: "event.news.autoUpdate", at: at(x.autoUpdate!), params: { name: x.name } })),
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
  // Gear other than servers and Twin chassis entering the shop (servers have generation and shape news).
  ...byYear(MODELS.filter((m) => !m.server && m.kind !== "chassis"), (m) => m.from, (m) => m.name).map(([y, names]) => ({ id: `models.${y}`, key: "event.news.models", at: at(y), params: { names } })),
  ...SERVER_LINES.filter((v) => v.from > START_YEAR).map((v) => ({ id: `shape.${v.id}`, key: "event.news.shape", at: at(v.from), params: { name: v.name } })),
  ...SOFTWARE.flatMap((x) => FEATURES(x).map(([f, y]) => ({ id: `feature.${x.id}.${f}`, key: "event.news.feature", at: at(y), params: { name: x.name, feature: f } }))),
  ...DESKS.filter((d) => d.from > START_YEAR).map((d) => ({ id: `desk.${d.id}`, key: "event.news.desk", at: at(d.from), params: { name: d.name } })),
  ...SKILLS.filter((k) => (k.from ?? START_YEAR) > START_YEAR).map((k) => ({ id: `training.${k.id}`, key: "event.news.training", at: at(k.from!), params: { name: k.name } })),
  ...byYear(HOME_LINES, (l) => l.from, (l) => `${l.name} (${l.isp})`).map(([y, names]) => ({ id: `homeLines.${y}`, key: "event.news.homeLines", at: at(y), params: { names } })),
  ...PORT_SPEEDS.filter((p) => p.from > START_YEAR).map((p) => ({ id: `ports.${p.gbit}`, key: "event.news.ports", at: at(p.from), params: { gbit: p.gbit } })),
  // SSL certificates turn free (products.ts, marketRates).
  { id: "freeSsl", key: "event.news.freeSsl", at: at(2016), params: {} },
];

const lineDef = (p: string): NewsDef => ({ id: `line.${p}`, key: "event.news.line", at: -1, params: { line: LINE_NAME[p as keyof typeof LINE_NAME] } });

// The yearly releases of what the player runs on 1 January: each installed software older than the year, and PHP when a
// panel runs and a new version is out. The id carries the list, as release.<year>.<family>+<family>.
function releases(s: GameState, year: number): string[] {
  const families = [...new Set(s.clusters.map(familyOf))].filter((f): f is string => !!f && softwareById(f).from < year).sort();
  return [...families, ...(s.clusters.some((c) => c.kind === "panel") && phpAt(year) !== phpAt(year - 1) ? ["php"] : [])];
}
function releaseDef(id: string): NewsDef {
  const [, year, list] = id.split("."), y = Number(year);
  const names = list.split("+").map((f) => (f === "php" ? `PHP ${phpAt(y)}` : softwareById(f).name));
  return { id, key: "event.news.release", at: -1, params: { year: y, names: names.join("|") } };
}

// What GameState.news holds: each entry's hour of publication and the announcement it stands for, newest first.
export function feed(s: GameState): { hour: number; key: string; params: Params }[] {
  return s.news.flatMap((e) => {
    const [id, hour] = e.split("@"), d = id.startsWith("line.") ? lineDef(id.slice(5)) : id.startsWith("release.") ? releaseDef(id) : NEWS.find((x) => x.id === id);
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
  const year = yearOf(s.hour), out = year > START_YEAR && s.hour === at(year) ? releases(s, year) : [];
  if (out.length) post(releaseDef(`release.${year}.${out.join("+")}`));
  // A line the player could sell but has not put on the website is mentioned once.
  if (isMonthStart(s.hour)) for (const p of SITE_LINES) if (!lineBlocker(s, p) && !listed(s, p)) post(lineDef(p));
  return events;
}
