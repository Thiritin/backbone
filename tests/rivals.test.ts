import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { COMPETITORS } from "../src/sim/10-catalog/economy";
import { newGame, type GameState } from "../src/sim/50-state";
import { openRivals, share } from "../src/sim/30-market/market";
import { rivalsTick } from "../src/sim/30-market/rivals-tick";
import { GEN_PENALTY, isSmall, MAX_SMALL, monthOf, reviewCount, rivalScore, SMALL_GAP, TEMPLATES, type Rival } from "../src/sim/30-market/rivals";
import { feed } from "../src/sim/80-business/news";
import { deserialize, serialize } from "../src/sim/91-save/save";

const month = (y: number, m: number) => hourOf(new Date(Date.UTC(y, m, 1)));
const byId = (s: GameState, id: string): Rival => s.competitors.find((r) => r.id === id)!;
const openRivalIds = (s: GameState) => openRivals(s).map((r) => r.id);
// Rolls every month start after the game's current month up to and including the given one.
function rollTo(s: GameState, y: number, m: number) {
  for (let i = Math.max(1, monthOf(s.hour) + 1); i <= (y - 2005) * 12 + m; i++) {
    s.hour = month(2005, i);
    rivalsTick(s);
  }
}

describe("rivals", () => {
  it("seeds the six majors with customers in every city and fills old saves", () => {
    const s = newGame(3);
    const majors = s.competitors.slice(0, 6);
    expect(majors.map((r) => r.name)).toEqual(COMPETITORS.map((c) => c.name));
    expect(majors.every((r) => r.founded === -1 && r.closed === null && r.lag >= 0 && r.lag <= 18)).toBe(true);
    expect(byId(s, "ionose").customers.Frankfurt).toBeGreaterThan(byId(s, "wp-engyne").customers.Frankfurt);
    expect(newGame(3).competitors.map((r) => r.lag)).toEqual(s.competitors.map((r) => r.lag));
    const old = JSON.parse(serialize(s));
    delete old.competitors;
    delete old.shareLog;
    expect(deserialize(JSON.stringify(old)).competitors).toEqual(s.competitors);
  });

  it("drifts scores, prices and customers month by month from the seed", () => {
    const a = newGame(5), b = newGame(5), c = newGame(5);
    rollTo(a, 2009, 6);
    rollTo(b, 2009, 6);
    expect(a.competitors).toEqual(b.competitors);
    // A rival with no lag follows the market each January.
    c.competitors = c.competitors.map((r) => ({ ...r, lag: 0 }));
    rollTo(c, 2009, 6);
    // Four Januaries passed: the budget host cuts its price 2% a year and the rest hold theirs.
    const ionose = byId(c, "ionose"), rackspice = byId(c, "rackspice");
    expect(ionose.priceFactor).toBeCloseTo(0.8 * 0.98 ** 4, 3);
    expect(rackspice.priceFactor).toBe(1.3);
    // Control panels in 2006 and one-click installs in 2009.
    expect(ionose.C).toBe(70 + 8);
    expect(rackspice.C).toBe(75 + 6);
    expect(byId(c, "hetzna").C).toBe(40 + 4);
    // A slow rival adopts the 2009 feature only after its lag.
    const slow = newGame(5);
    slow.competitors = slow.competitors.map((r) => ({ ...r, lag: 9 }));
    rollTo(slow, 2009, 8);
    expect(byId(slow, "ionose").C).toBe(74);
    rollTo(slow, 2009, 9);
    expect(byId(slow, "ionose").C).toBe(78);
    expect(a.shareLog.length).toBe(54);
    expect(a.shareLog.at(-1)!.rivals.ionose[0]).toBeGreaterThan(0);
  });

  it("lags a new server generation by each rival's own months", () => {
    const s = newGame(7);
    s.competitors = s.competitors.map((r, i) => ({ ...r, lag: i === 2 ? 6 : 0 }));
    rollTo(s, 2008, 0);
    expect(byId(s, "hetzna").P).toBe(85 - GEN_PENALTY);
    expect(byId(s, "ovheat").P).toBe(70);
    rollTo(s, 2008, 6);
    expect(byId(s, "hetzna").P).toBe(85);
  });

  it("takes reliability and customers in an outage and posts it as news", () => {
    const s = newGame(11);
    rollTo(s, 2014, 0);
    const news = feed(s).filter((n) => n.key === "event.news.rivalOutage");
    expect(news.length).toBeGreaterThan(0);
    expect(s.competitors.map((c) => c.name)).toContain(news[0].params.name);
    // Every outage ends with the reliability it took back.
    const base = Object.fromEntries(COMPETITORS.map((c) => [c.template, c.R]));
    for (const r of s.competitors) expect(r.R).toBe(base[r.template] - (isSmall(r) ? SMALL_GAP : 0) - (r.outage?.hit ?? 0));
    // A rival in an outage loses leads to you.
    const t = newGame(11);
    const before = share(t, "private", "webHosting", "Frankfurt");
    t.competitors = t.competitors.map((r) => ({ ...r, R: r.R - 25, outage: { months: 2, hit: 25 } }));
    expect(share(t, "private", "webHosting", "Frankfurt")).toBeGreaterThan(before);
  });

  it("leaves closed rivals out of the market", () => {
    const s = newGame(2);
    const before = share(s, "office", "webHosting", "Frankfurt");
    s.competitors = s.competitors.map((r) => (r.id === "rackspice" ? { ...r, closed: 0 } : r));
    expect(share(s, "office", "webHosting", "Frankfurt")).toBeGreaterThan(before);
  });

  it("seeds three small rivals in one or two home cities", () => {
    const s = newGame(4), small = s.competitors.filter(isSmall);
    expect(small).toHaveLength(3);
    for (const r of small) {
      expect(["budget", "game", "managed"]).toContain(r.template);
      expect(r.P).toBe(TEMPLATES[r.template].P - SMALL_GAP);
      expect(r.priceFactor).toBeCloseTo(TEMPLATES[r.template].priceFactor - 0.1, 4);
      expect(Object.keys(r.customers).length).toBeGreaterThanOrEqual(1);
      expect(Object.keys(r.customers).length).toBeLessThanOrEqual(2);
      const home = Object.keys(r.customers)[0], away = ["Frankfurt", "Dallas", "Vienna"].find((c) => !(c in r.customers))!;
      expect(openRivals(s, home).map((x) => x.id)).toContain(r.id);
      expect(openRivals(s, away).map((x) => x.id)).not.toContain(r.id);
    }
    expect(new Set(s.competitors.map((r) => r.name)).size).toBe(s.competitors.length);
  });

  it("opens small rivals in waves and caps them", () => {
    const s = newGame(6);
    rollTo(s, 2012, 0);
    const open = s.competitors.filter((r) => isSmall(r) && r.closed === null);
    expect(s.competitors.filter(isSmall).length).toBeGreaterThan(3);
    expect(open.length).toBeLessThanOrEqual(MAX_SMALL);
    expect(new Set(s.competitors.map((r) => r.id)).size).toBe(s.competitors.length);
    const opened = feed(s).filter((n) => n.key === "event.news.rivalOpen");
    expect(opened.length).toBe(s.competitors.filter((r) => r.founded > 0).length);
  });

  it("closes a small rival that keeps under half a percent of its cities' customers", () => {
    const s = newGame(8);
    const weak = s.competitors.find(isSmall)!;
    s.competitors = s.competitors.map((r) => (r.id === weak.id ? { ...r, R: -300, C: -300, customers: Object.fromEntries(Object.keys(r.customers).map((c) => [c, 1])) } : r));
    rollTo(s, 2008, 0);
    const gone = byId(s, weak.id);
    expect(gone.closed).not.toBeNull();
    const news = feed(s).filter((n) => (n.key === "event.news.rivalBust" || n.key === "event.news.rivalBought") && n.params.name === weak.name);
    expect(news).toHaveLength(1);
    expect(openRivalIds(s)).not.toContain(weak.id);
  });

  it("collects reviews that follow reliability", () => {
    const s = newGame(9);
    rollTo(s, 2006, 0);
    const rackspice = byId(s, "rackspice"), ionose = byId(s, "ionose");
    expect(reviewCount(ionose)).toBeGreaterThan(20);
    expect(rivalScore(rackspice)).toBeGreaterThan(rivalScore(ionose));
    expect(rivalScore(ionose)).toBeGreaterThan(3.5);
    // An outage month adds angry reviews.
    const calm = newGame(9), down = newGame(9);
    down.competitors = down.competitors.map((r) => (r.id === "ionose" ? { ...r, R: r.R - 20, outage: { months: 3, hit: 20 } } : r));
    calm.hour = down.hour = month(2005, 1);
    rivalsTick(calm);
    rivalsTick(down);
    expect(rivalScore(byId(down, "ionose"))).toBeLessThan(rivalScore(byId(calm, "ionose")));
  });

  it("loads rivals saved before reviews", () => {
    const s = newGame(1), old = JSON.parse(serialize(s));
    for (const r of old.competitors) { delete r.reviews; delete r.weak; }
    const back = deserialize(JSON.stringify(old)).competitors;
    expect(back.every((r) => r.weak === 0 && r.reviews.length === 0)).toBe(true);
  });
});
