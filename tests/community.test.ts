import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { marketPrice, sizeSpec } from "../src/sim/10-catalog/products";
import { EVENTS, eventById, HALF_HOURS, MAX_DOWN_HOURS, OFFER_HOURS } from "../src/sim/80-business/community";
import { leadsThisMonth, reviewScore } from "../src/sim/80-business/marketing";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { acceptSponsorship, declineSponsorship, offerHalf } from "../src/sim/90-actions/community";
import { closeTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { mrr, metrics } from "../src/sim/metrics";
import { readyGame, runTo, ticketOf, asked, accept, done } from "./community.helpers";

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
