import { describe, expect, it } from "vitest";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import { type GameState } from "../src/sim/50-state";
import { eventById } from "../src/sim/80-business/community";
import { leadsThisMonth, PROFILE_IDS } from "../src/sim/80-business/marketing";
import { type SimEvent } from "../src/sim/88-tick/tick";
import { runTo, asked, through, done } from "./community.helpers";

// The same request in another seeded game: the reward draws follow the seed, without waiting weeks for each request.
const reseeded = (s: GameState, seed: number) => { s.seed = seed; return s; };

describe("rewards", () => {
  it("pay know-how for tech events", () => {
    for (const [id, knowHow] of [["chaosClub", 10], ["hackASorus", 25], ["mirror", 15], ["devOops", 40]] as const) {
      const s = asked(9, id), before = s.knowHow, events: SimEvent[] = [];
      done(s, events);
      expect(s.knowHow - before).toBeGreaterThanOrEqual(knowHow);
      expect(s.sponsorships[0].reward).toMatchObject({ knowHow });
      expect(events.find((e) => e.key === "event.sponsorDone")).toMatchObject({ app: "Marketing", params: { event: eventById(id)!.name, knowHow } });
    }
  });

  it("raise awareness once for the audience of public events", () => {
    const gain = (a: number, x: number) => a + (1 - a) * x;
    for (const id of ["lanTastic", "fragFest", "userGroup"]) {
      const s = asked(10, id), ev = eventById(id)!, before = { ...s.marketing.awareness };
      runTo(s, s.hour + 1);
      const quiet = { ...s.marketing.awareness };
      done(s);
      for (const p of PROFILE_IDS) {
        if (ev.audience.includes(p)) expect(s.marketing.awareness[p]).toBeGreaterThan(gain(quiet[p], ev.awareness) - 0.02);
        else expect(Math.abs(s.marketing.awareness[p] - before[p])).toBeLessThan(0.02);
      }
      expect(s.sponsorships[0].reward!.awareness).toBe(ev.awareness);
    }
    expect([0.02, 0.03, 0.01]).toEqual([eventById("lanTastic")!.awareness, eventById("fragFest")!.awareness, eventById("userGroup")!.awareness]);
    expect(eventById("lanTastic")!.audience).toEqual(["gamer", "private"]);
    expect(eventById("fragFest")!.audience).toEqual(["gamer"]);
    expect(eventById("userGroup")!.audience).toEqual(["smallBiz", "private"]);
  });

  it("bring 3 to 6 leads of the audience for a month after a public event, and none after a tech event", () => {
    const s = asked(11, "fragFest");
    expect(leadsThisMonth(s).some((b) => b.source === "community")).toBe(false);
    done(s);
    const batches = leadsThisMonth(s).filter((b) => b.source === "community");
    const total = batches.reduce((n, b) => n + b.count, 0);
    expect(batches.every((b) => b.profile === "gamer")).toBe(true);
    expect(Math.round(total)).toBe(s.sponsorships[0].reward!.leads);
    expect(total).toBeGreaterThanOrEqual(3);
    expect(total).toBeLessThanOrEqual(6);
    runTo(s, s.hour + 731);
    expect(leadsThisMonth(s).some((b) => b.source === "community")).toBe(false);
    const tech = done(asked(11, "hackASorus"));
    expect(leadsThisMonth(tech).some((b) => b.source === "community")).toBe(false);
  });

  it("add a 5-star review for about half of public events", () => {
    let fives = 0, skipped = 0;
    const n = 40;
    for (let seed = 200; seed < 200 + n; seed++) {
      const s = through(reseeded(asked(200, "lanTastic"), seed));
      if (!s) { skipped++; continue; }
      const sponsored = s.marketing.reviews.filter((r) => r.reason === "sponsor");
      expect(sponsored.every((r) => r.stars === 5)).toBe(true);
      fives += sponsored.length;
      expect(s.sponsorships[0].reward!.stars).toBe(sponsored.length ? 5 : null);
    }
    const ran = n - skipped;
    expect(ran).toBeGreaterThan(n * 0.7);
    expect(fives).toBeGreaterThan(ran * 0.25);
    expect(fives).toBeLessThan(ran * 0.75);
  });

  it("put a +20 skill candidate in the Staff market for a month in 20% of tech events", () => {
    let hits = 0, ran = 0;
    const n = 60;
    for (let seed = 300; seed < 300 + n; seed++) {
      const s = reseeded(asked(300, "chaosClub"), seed);
      const known = new Set(s.candidates.map((c) => c.id));
      if (!through(s)) continue;
      ran++;
      const fresh = s.candidates.filter((c) => !known.has(c.id) && c.id.startsWith("cand"));
      expect(fresh.length).toBe(s.sponsorships[0].reward!.recommendation ? 1 : 0);
      for (const c of fresh) {
        expect(c.skill).toBeGreaterThanOrEqual(30);
        expect(c.talent).toBeGreaterThanOrEqual(c.skill + 5);
        expect(c.leaveAt - c.arriveAt).toBe(30 * 24);
        expect(visibleCandidates(s).some((v) => v.id === c.id)).toBe(true);
        hits++;
      }
    }
    expect(ran).toBeGreaterThan(n * 0.7);
    expect(hits).toBeGreaterThan(ran * 0.08);
    expect(hits).toBeLessThan(ran * 0.35);
  });
});
