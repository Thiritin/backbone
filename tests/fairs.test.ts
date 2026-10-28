import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { atFair, marketSalary, visibleCandidates, type Role } from "../src/sim/47-staff/staff";
import { newGame, type GameState } from "../src/sim/50-state";
import { fairById, fairCost, fairStart, FAIRS, tradeFairBonus, upcomingFairs } from "../src/sim/80-business/fairs";
import { leadsThisMonth } from "../src/sim/80-business/marketing";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { bookFair } from "../src/sim/90-actions/marketing";
import { fire, hire } from "../src/sim/90-actions/staff";
import { deserialize, serialize } from "../src/sim/91-save/save";

const runTo = (s: GameState, hour: number, events: SimEvent[] = []) => { while (s.hour < hour) events.push(...tick(s)); };
const at = (y: number, m: number, d = 1) => hourOf(new Date(Date.UTC(y, m - 1, d)));

// A rich company in January 2009 with one employee of the given role.
function company(seed: number, role: Role = "support"): { s: GameState; id: string } {
  const s = newGame(seed);
  const r = hire(s, visibleCandidates(s).find((c) => c.role === role)!.id);
  if (!r.ok) throw new Error(r.error);
  s.hour = at(2009, 1);
  s.cash = 5_000_000;
  // Hired today at the market salary, so nobody quits before the fair.
  Object.assign(s.staff[0], { hiredAt: s.hour, nextRaiseAt: s.hour + 8760, salary: marketSalary(s.staff[0], s.hour) });
  return { s, id: r.id! };
}

describe("trade fairs", () => {
  it("lists the next run of every fair in date order and retires SeeBIT after 2018", () => {
    const s = newGame(1);
    const list = upcomingFairs(s);
    expect(list.map((d) => d.fair.id)).toEqual(["seebit", "cloudFeast", "ripeish", "deSix", "dcWhirled"]);
    expect(list.every((d, i) => i === 0 || d.start >= list[i - 1].start)).toBe(true);
    s.hour = at(2019, 1);
    expect(upcomingFairs(s).map((d) => d.fair.id)).not.toContain("seebit");
    s.hour = at(2019, 4);
    expect(upcomingFairs(s).find((d) => d.fair.id === "cloudFeast")!.year).toBe(2020);
    expect(FAIRS.every((f) => f.bonus > 0 && f.bonus <= 1)).toBe(true);
  });

  it("needs the company level, a free employee and the cost", () => {
    const fresh = newGame(2);
    const r = hire(fresh, visibleCandidates(fresh).find((c) => c.role === "support")!.id);
    expect(bookFair(fresh, "seebit", r.ok ? r.id! : "")).toEqual({ ok: false, error: "error.fairLevel" });
    const { s, id } = company(3);
    expect(bookFair(s, "nope", id)).toEqual({ ok: false, error: "error.unknownFair" });
    expect(bookFair(s, "seebit", "emp-gone")).toEqual({ ok: false, error: "error.unknownEmployee" });
    const cash = s.cash, cost = fairCost(fairById("seebit")!, 2009);
    expect(cost).toBeGreaterThan(4800);
    expect(cost).toBeLessThan(8000);
    expect(bookFair(s, "seebit", id)).toEqual({ ok: true });
    expect(s.cash).toBe(cash - cost);
    expect(s.ledger.at(-1)).toMatchObject({ category: "marketing", key: "ledger.tradeFair", amount: -cost });
    expect(bookFair(s, "seebit", id)).toEqual({ ok: false, error: "error.fairBooked" });
    s.hour = fairStart(fairById("cloudFeast")!, 2009) + 1;
    expect(bookFair(s, "cloudFeast", id)).toEqual({ ok: false, error: "error.fairStarted" });
  });

  it("keeps the attendee away, then brings leads, awareness and network contacts", () => {
    const { s, id } = company(4);
    bookFair(s, "seebit", id);
    const seebit = fairById("seebit")!, start = fairStart(seebit, 2009), end = start + seebit.days * 24;
    const events: SimEvent[] = [];
    runTo(s, start + 12, events);
    expect(atFair(s, s.staff[0])).toBe(true);
    expect(tradeFairBonus(s)).toBe(0);
    runTo(s, end + 1, events);
    expect(atFair(s, s.staff[0])).toBe(false);
    expect(events.find((e) => e.key === "event.fairDone")!.params).toMatchObject({ fair: "SeeBIT", leads: seebit.leads });
    const fair = leadsThisMonth(s).filter((b) => b.source === "fair");
    expect(fair.reduce((n, b) => n + b.count, 0)).toBeCloseTo(seebit.leads, 6);
    expect(new Set(fair.map((b) => b.profile))).toEqual(new Set(seebit.profiles));
    expect(tradeFairBonus(s)).toBeCloseTo(seebit.bonus, 2);
    expect(s.network.goodwill).toBeGreaterThan(0);
    const before = s.marketing.awareness.smallBiz, others = s.marketing.awareness.gamer;
    runTo(s, at(2009, 4) + 1);
    expect(s.marketing.awareness.smallBiz - before).toBeGreaterThan(s.marketing.awareness.gamer - others);
    runTo(s, end + 731);
    expect(leadsThisMonth(s).some((b) => b.source === "fair")).toBe(false);
    s.hour = end + 8760 / 2;
    expect(tradeFairBonus(s)).toBeCloseTo(seebit.bonus / 2, 2);
    s.hour = end + 8760;
    expect(tradeFairBonus(s)).toBe(0);
  });

  it("brings half again as many leads with a marketing manager trained on fairs", () => {
    const { s, id } = company(5, "marketing");
    s.staff[0].trained = ["fairs"];
    expect(bookFair(s, "seebit", id)).toEqual({ ok: true });
    const events: SimEvent[] = [];
    const seebit = fairById("seebit")!;
    runTo(s, fairStart(seebit, 2009) + seebit.days * 24 + 1, events);
    expect(events.find((e) => e.key === "event.fairDone")!.params.leads).toBe(Math.round(seebit.leads * 1.5));
  });

  it("leaves the stand empty when the attendee is gone", () => {
    const { s, id } = company(6);
    bookFair(s, "seebit", id);
    fire(s, id);
    const events: SimEvent[] = [];
    const seebit = fairById("seebit")!;
    runTo(s, fairStart(seebit, 2009) + seebit.days * 24 + 1, events);
    expect(events.some((e) => e.key === "event.fairMissed")).toBe(true);
    expect(tradeFairBonus(s)).toBe(0);
  });

  it("loads old saves without fairs", () => {
    const s = newGame(7);
    const data = JSON.parse(serialize(s));
    delete data.fairs;
    expect(deserialize(JSON.stringify(data)).fairs).toEqual([]);
  });
});
