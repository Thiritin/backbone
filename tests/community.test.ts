import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { marketPrice, sizeSpec } from "../src/sim/10-catalog/products";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import { type GameState } from "../src/sim/50-state";
import { EVENTS, eventById, HALF_HOURS, MAX_DOWN_HOURS, OFFER_HOURS, REQUEST_DAYS } from "../src/sim/80-business/community";
import { leadsThisMonth, PROFILE_IDS, reviewScore } from "../src/sim/80-business/marketing";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { acceptSponsorship, declineSponsorship, offerHalf } from "../src/sim/90-actions/community";
import { closeTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { mrr, metrics } from "../src/sim/metrics";
import { panelVm, readyGame as fresh } from "./fixtures";

// Sponsoring requests need Marketing basics.
const readyGame = (seed: number) => { const s = fresh(seed); s.unlocks = [...s.unlocks, "marketingBasics"]; return s; };

const runTo = (s: GameState, hour: number, events: SimEvent[] = []) => { while (s.hour < hour) events.push(...tick(s)); };
const ticketOf = (s: GameState) => s.tickets.find((t) => t.kind === "sponsor" && t.status === "open")!;

// The first request of a new company, optionally swapped for another event.
function asked(seed: number, event?: string, roomy = true): GameState {
  const s = readyGame(seed);
  if (roomy) for (const c of s.devices.find((d) => d.id === "dev3")!.components) if (c.kind === "ram") c.size = 16;
  while (!s.sponsorships.length) tick(s);
  if (event) {
    // The mirror is a storage service, which needs storage server software.
    if (event === "mirror") panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, "vsftpeed", { vcpu: 1, ramGb: 2, diskGb: 600 });
    s.sponsorships[0].event = event;
    ticketOf(s).topic = event;
  }
  return s;
}

// The home line drops now and then and nothing can be placed meanwhile, so the accept waits a few hours; some seeds lose the
// basement server to a seizure first, which returns false.
function accept(s: GameState): boolean {
  for (let i = 0; i < 6; i++) {
    const r = acceptSponsorship(s, s.sponsorships[0].ticketId);
    if (r.ok) return true;
    if (r.error !== "error.needsInternet") throw new Error(r.error);
    tick(s);
  }
  return false;
}

// Accepts the request and runs the event to its end; a long event is cut to a day.
function through(s: GameState, events: SimEvent[] = []): GameState | null {
  if (!accept(s)) return null;
  s.sponsorships[0].endsAt = s.hour + 24;
  runTo(s, s.sponsorships[0].endsAt + 1, events);
  return s;
}
const done = (s: GameState, events?: SimEvent[]): GameState => through(s, events)!;

describe("community sponsoring requests", () => {
  it("never arrive before Marketing basics", () => {
    const s = fresh(1);
    runTo(s, 24 * 7 * 12);
    expect(s.sponsorships).toHaveLength(0);
  });

  it("arrive every 4 to 8 weeks from level 1, seeded", () => {
    for (const seed of [1, 2, 3]) {
      const s = readyGame(seed), at: number[] = [0];
      while (s.hour < 24 * 365 && at.length < 6) {
        const n = s.sponsorships.length;
        tick(s);
        if (s.sponsorships.length > n) at.push(s.hour);
      }
      const gaps = at.slice(1).map((h, i) => (h - at[i]) / 24);
      expect(gaps.length).toBeGreaterThanOrEqual(5);
      expect(gaps.every((g) => g >= REQUEST_DAYS[0] && g <= REQUEST_DAYS[1] + 1)).toBe(true);
    }
    const again = readyGame(1);
    while (!again.sponsorships.length) tick(again);
    const first = readyGame(1);
    while (!first.sponsorships.length) tick(first);
    expect(again.sponsorships[0]).toEqual(first.sponsorships[0]);
  }, 90_000);

  it("send a ticket of kind sponsor with the event, and only small events at level 1", () => {
    const s = asked(4);
    const t = ticketOf(s);
    expect(t).toMatchObject({ kind: "sponsor", customerId: "", status: "open", topic: s.sponsorships[0].event });
    for (let seed = 10; seed < 40; seed++) expect(eventById(asked(seed).sponsorships[0].event)!.level).toBe(1);
    const big = Array.from({ length: 40 }, (_, i) => {
      const g = readyGame(100 + i);
      g.hour = 9 * 8760;
      g.cash = 1e9;
      expect(metrics(g).level.level).toBeGreaterThanOrEqual(3);
      while (!g.sponsorships.length) tick(g);
      return g.sponsorships[0].event;
    });
    expect(big).toContain("devOops");
    expect(new Set(big).size).toBeGreaterThan(3);
  }, 60_000);

  it("lapse after two weeks without penalty", () => {
    const s = asked(5), cash = s.cash, score = reviewScore(s);
    const sp = s.sponsorships[0];
    runTo(s, sp.offeredAt + 14 * 24 + 1);
    expect(s.sponsorships[0].status).toBe("declined");
    expect(s.tickets.find((t) => t.id === sp.ticketId)).toMatchObject({ status: "closed", outcome: "ignored" });
    expect(s.cash).toBeGreaterThan(cash - 1000);
    expect(reviewScore(s)).toBe(score);
  });
});

describe("accepting and declining", () => {
  it("provisions every service at EUR 0 through the normal placement and ends on time", () => {
    const s = asked(6, "fragFest");
    const before = { mrr: mrr(s), customers: metrics(s).customers, services: s.services.length };
    expect(acceptSponsorship(s, s.sponsorships[0].ticketId)).toEqual({ ok: true, id: s.sponsorships[0].id });
    const sp = s.sponsorships[0];
    expect(sp).toMatchObject({ status: "running", endsAt: s.hour + 72 });
    expect(sp.serviceIds).toHaveLength(4);
    for (const id of sp.serviceIds) {
      const v = s.services.find((x) => x.id === id)!;
      expect(v).toMatchObject({ price: 0, product: "gameServer", endedAt: null, customerId: sp.customerId });
      expect(s.workloads.some((w) => w.serviceId === id && w.clusterId)).toBe(true);
    }
    expect(s.services.length).toBe(before.services + 4);
    expect(mrr(s)).toBe(before.mrr);
    expect(metrics(s).customers).toBe(before.customers);
    expect(s.tickets.find((t) => t.id === sp.ticketId)).toMatchObject({ status: "closed", outcome: "sponsored" });
    runTo(s, sp.endsAt - 1);
    expect(s.services.filter((v) => sp.serviceIds.includes(v.id)).every((v) => v.endedAt === null)).toBe(true);
    runTo(s, sp.endsAt + 2);
    expect(s.sponsorships[0]).toMatchObject({ status: "done", endedAt: sp.endsAt });
    expect(s.services.filter((v) => sp.serviceIds.includes(v.id)).every((v) => v.endedAt === sp.endsAt)).toBe(true);
    expect(s.workloads.some((w) => sp.serviceIds.includes(w.serviceId))).toBe(false);
    expect(s.invoices.some((i) => i.customerId === sp.customerId)).toBe(false);
  });

  it("fails with the usual error and keeps nothing without room", () => {
    const s = asked(7, "hackASorus");
    s.clusters = [];
    s.workloads = [];
    const kept = { customers: s.customers.length, services: s.services.length, nextId: s.nextId };
    const r = acceptSponsorship(s, s.sponsorships[0].ticketId);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/^error\./);
    expect({ customers: s.customers.length, services: s.services.length, nextId: s.nextId }).toEqual(kept);
    expect(s.sponsorships[0].status).toBe("offered");
    expect(ticketOf(s).status).toBe("open");
  });

  it("declines without a penalty, also by closing the ticket, and the next request still comes", () => {
    const s = asked(8);
    const cash = s.cash, awareness = { ...s.marketing.awareness }, score = reviewScore(s), happy = s.customers.map((c) => c.happiness);
    expect(declineSponsorship(s, s.sponsorships[0].ticketId)).toEqual({ ok: true, id: s.sponsorships[0].id });
    expect(s.sponsorships[0].status).toBe("declined");
    expect(s.tickets.find((t) => t.kind === "sponsor")).toMatchObject({ status: "closed", outcome: "sponsorDeclined" });
    expect([s.cash, s.marketing.awareness, reviewScore(s), s.customers.map((c) => c.happiness)]).toEqual([cash, awareness, score, happy]);
    expect(declineSponsorship(s, s.sponsorships[0].ticketId)).toEqual({ ok: false, error: "error.ticketDone" });
    while (s.sponsorships.length < 2) tick(s);
    expect(closeTicket(s, ticketOf(s).id).ok).toBe(true);
    expect(s.sponsorships[1].status).toBe("declined");
  });
});

describe("answering with 50% off", () => {
  it("lets the community take it at half the list price or turn it down a day later, by seed", () => {
    const outcomes = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = asked(seed), sp = s.sponsorships[0], ev = eventById(sp.event)!, events: SimEvent[] = [];
      expect(offerHalf(s, sp.ticketId)).toEqual({ ok: true, id: sp.id });
      expect(offerHalf(s, sp.ticketId)).toEqual({ ok: false, error: "error.ticketDone" });
      runTo(s, s.hour + HALF_HOURS - 1, events);
      expect(s.sponsorships[0].status).toBe("offered");
      runTo(s, s.hour + 1, events);
      const done = s.sponsorships[0], t = s.tickets.find((x) => x.id === sp.ticketId)!;
      outcomes.add(done.status);
      if (done.status === "running") {
        expect(events.map((e) => e.key)).toContain("event.halfAccepted");
        expect(t.outcome).toBe("sponsored");
        expect(done.serviceIds).toHaveLength(ev.count);
        const v = s.services.find((x) => x.id === done.serviceIds[0])!;
        const y = yearOf(s.hour);
        expect(v.price).toBeCloseTo(marketPrice(ev.product, sizeSpec(ev.product, ev.size, y), y) / 730 / 2, 10);
        expect(s.customers.find((c) => c.id === done.customerId)).toMatchObject({ churnedAt: null });
      } else {
        expect(done.status).toBe("declined");
        expect(events.map((e) => e.key)).toContain("event.halfDeclined");
        expect(t).toMatchObject({ status: "closed", outcome: "ignored" });
      }
    }
    expect([...outcomes].sort()).toEqual(["declined", "running"]);
  }, 120_000);

  it("waits for the answer past the request's two weeks", () => {
    const s = asked(2), sp = s.sponsorships[0];
    runTo(s, sp.offeredAt + OFFER_HOURS - 2);
    offerHalf(s, sp.ticketId);
    runTo(s, sp.offeredAt + OFFER_HOURS + 1);
    expect(s.sponsorships[0].status).toBe("offered");
    runTo(s, sp.offeredAt + OFFER_HOURS - 2 + HALF_HOURS);
    expect(s.sponsorships[0].status).not.toBe("offered");
  }, 60_000);

  it("keeps the answer across a save", () => {
    const s = asked(3), sp = s.sponsorships[0];
    offerHalf(s, sp.ticketId);
    expect(deserialize(serialize(s)).sponsorships[0].halfAt).toBe(s.hour);
  }, 60_000);
});

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
      const s = through(asked(seed, "lanTastic"));
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
  }, 90_000);

  it("put a +20 skill candidate in the Staff market for a month in 20% of tech events", () => {
    let hits = 0, ran = 0;
    const n = 60;
    for (let seed = 300; seed < 300 + n; seed++) {
      const s = asked(seed, "chaosClub");
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
  }, 90_000);
});

describe("downtime", () => {
  it("turns the rewards into two 1-star reviews and 10% less awareness for the audience", () => {
    const s = asked(12, "lanTastic");
    accept(s);
    const sp = s.sponsorships[0], before = { ...s.marketing.awareness }, events: SimEvent[] = [];
    runTo(s, s.hour + 5);
    s.downHours = { ...s.downHours, [sp.serviceIds[0]]: MAX_DOWN_HOURS + 1 };
    runTo(s, sp.endsAt + 2, events);
    const stars = s.marketing.reviews.filter((r) => r.reason === "sponsor").map((r) => r.stars);
    expect(stars).toEqual([1, 1]);
    expect(s.sponsorships[0]).toMatchObject({ status: "done", reward: null });
    expect(s.marketing.awareness.gamer).toBeLessThan(before.gamer * 0.95);
    expect(s.marketing.awareness.private).toBeLessThan(before.private * 0.95);
    expect(s.marketing.awareness.enterprise).toBeGreaterThanOrEqual(before.enterprise * 0.9);
    expect(events.map((e) => e.key)).toContain("event.sponsorFailed");
    expect(events.map((e) => e.key)).not.toContain("event.sponsorDone");
    expect(leadsThisMonth(s).some((b) => b.source === "community")).toBe(false);
  });

  it("does not flip at 2 hours and counts hours across a month change", () => {
    const ok = asked(13, "hackASorus");
    accept(ok);
    runTo(ok, ok.hour + 3);
    ok.downHours = { ...ok.downHours, [ok.sponsorships[0].serviceIds[0]]: MAX_DOWN_HOURS };
    runTo(ok, ok.sponsorships[0].endsAt + 2);
    expect(ok.sponsorships[0].reward).not.toBeNull();

    const s = asked(14, "hackASorus");
    accept(s);
    const id = s.sponsorships[0].serviceIds[0];
    s.sponsorships[0].endsAt = Math.ceil(s.hour / 730) * 730 + 40;
    s.downHours = { ...s.downHours, [id]: 1.5 };
    runTo(s, Math.ceil(s.hour / 730) * 730 + 5);
    expect(s.downHours[id] ?? 0).toBeLessThan(1.5);
    s.downHours = { ...s.downHours, [id]: (s.downHours[id] ?? 0) + 1 };
    runTo(s, s.sponsorships[0].endsAt + 2);
    expect(s.sponsorships[0].reward).toBeNull();
  });
});

describe("overbooked hardware", () => {
  it("flips the event by itself when the sponsored services crowd the node out", () => {
    const s = done(asked(17, "devOops", false));
    expect(s.sponsorships[0]).toMatchObject({ status: "done", reward: null });
    expect(s.marketing.reviews.filter((r) => r.reason === "sponsor").map((r) => r.stars)).toEqual([1, 1]);
  });
});

describe("old saves", () => {
  it("load with no sponsorships and get a first request", () => {
    const s = readyGame(15);
    runTo(s, 24 * 70);
    const old = JSON.parse(serialize(s)) as Record<string, unknown>;
    delete old.sponsorships;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.sponsorships).toEqual([]);
    while (!loaded.sponsorships.length) tick(loaded);
    expect(deserialize(serialize(loaded)).sponsorships).toEqual(loaded.sponsorships);
  });

  it("keeps a running sponsorship across a save", () => {
    const s = asked(6, "lanTastic");
    accept(s);
    const loaded = deserialize(serialize(s));
    expect(loaded.sponsorships).toEqual(s.sponsorships);
    expect(loaded.customers.find((c) => c.sponsor)).toBeTruthy();
    expect(EVENTS.length).toBe(11);
  });
});
