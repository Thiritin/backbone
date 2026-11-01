import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { COMPETITORS } from "../src/sim/10-catalog/economy";
import { newGame, type GameState } from "../src/sim/50-state";
import { share } from "../src/sim/30-market/market";
import { rivalsTick } from "../src/sim/30-market/rivals-tick";
import { GEN_PENALTY, monthOf, type Rival } from "../src/sim/30-market/rivals";
import { feed } from "../src/sim/80-business/news";
import { deserialize, serialize } from "../src/sim/91-save/save";

const month = (y: number, m: number) => hourOf(new Date(Date.UTC(y, m, 1)));
const byId = (s: GameState, id: string): Rival => s.competitors.find((r) => r.id === id)!;
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
    expect(s.competitors.map((r) => r.name)).toEqual(COMPETITORS.map((c) => c.name));
    expect(s.competitors.every((r) => r.founded === -1 && r.closed === null && r.lag >= 0 && r.lag <= 18)).toBe(true);
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
    expect(COMPETITORS.map((c) => c.name)).toContain(news[0].params.name);
    // Every outage ends with the reliability it took back.
    const base = Object.fromEntries(COMPETITORS.map((c) => [c.name, c.R]));
    for (const r of s.competitors) expect(r.R).toBe(base[r.name] - (r.outage?.hit ?? 0));
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
});
