import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { marketPrice, sizeSpec } from "../src/sim/10-catalog/products";
import { opsTick } from "../src/sim/40-support/notices";
import { type GameState } from "../src/sim/50-state";
import { HELD_TOPIC, MONTH, type Sponsorship } from "../src/sim/80-business/community";
import { leadsThisMonth } from "../src/sim/80-business/marketing";
import { APPLICANTS, BOARD, boardGranted, boardTick, offerOpen, type SponsorOffer } from "../src/sim/80-business/sponsorboard";
import { resolve } from "../src/sim/80-business/browser";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { acceptSponsorship, answerSponsor, blockSponsor, cancelSponsor, postOffer, withdrawOffer } from "../src/sim/90-actions/community";
import { closeTicket } from "../src/sim/90-actions/support";
import { setLine } from "../src/sim/90-actions/website";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame, newGame } from "./fixtures";

const runTo = (s: GameState, hour: number, events: SimEvent[] = []) => { while (s.hour < hour) events.push(...tick(s)); };
const offer = { product: "gameServer", size: 0, months: 1, slots: 2, free: true } as const;
const board = (s: GameState) => s.sponsorships.filter((x) => x.board);

function roomy(seed: number): GameState {
  const s = readyGame(seed);
  for (const c of s.devices.find((d) => d.id === "dev3")!.components) if (c.kind === "ram") c.size = 16;
  return s;
}

// A game with the first application of a posted offer waiting.
function applied(seed: number, o: Partial<SponsorOffer> = {}): GameState {
  const s = roomy(seed);
  expect(postOffer(s, { ...offer, ...o })).toMatchObject({ ok: true });
  while (!board(s).length) tick(s);
  return s;
}

// The home line drops now and then, so the accept waits a few hours.
function accept(s: GameState, sp: Sponsorship): void {
  for (let i = 0; i < 12; i++) {
    const r = acceptSponsorship(s, sp.ticketId);
    if (r.ok) return;
    if (r.error !== "error.needsInternet") throw new Error(r.error);
    tick(s);
  }
  throw new Error("no internet");
}

describe("the Sponsor-Bored board", () => {
  it("draws slots plus two applications 2 to 10 days after the offer, by seed", () => {
    const run = (seed: number) => {
      const s = roomy(seed), at = s.hour;
      postOffer(s, offer);
      runTo(s, at + 24 * 10 + 1);
      return { at, apps: board(s).map((x) => ({ in: x.offeredAt - at, name: x.board!.name, audience: x.board!.audience, kind: x.board!.kind })) };
    };
    const a = run(3);
    expect(a.apps).toHaveLength(offer.slots + BOARD.extra);
    for (const x of a.apps) {
      expect(x.in).toBeGreaterThanOrEqual(48);
      expect(x.in).toBeLessThanOrEqual(240);
    }
    expect(run(3)).toEqual(a);
    expect(run(4).apps).not.toEqual(a.apps);
  }, 60_000);

  it("sends each application as a sponsor ticket and rejects bad or too many offers", () => {
    const s = applied(5);
    const sp = board(s)[0], t = s.tickets.find((x) => x.id === sp.ticketId)!;
    expect(t).toMatchObject({ kind: "sponsor", status: "open", topic: `board.${sp.board!.kind}` });
    expect(postOffer(s, { ...offer, size: 9 })).toEqual({ ok: false, error: "error.badOffer" });
    expect(postOffer(s, { ...offer, months: 2 })).toEqual({ ok: false, error: "error.badOffer" });
    postOffer(s, offer);
    postOffer(s, offer);
    expect(postOffer(s, offer)).toEqual({ ok: false, error: "error.offersOpen" });
  }, 60_000);

  it("runs an accepted application as a free sponsorship and fills the offer", () => {
    const s = applied(6);
    runTo(s, s.hour + 24 * 10);
    const [first, second, third] = board(s);
    accept(s, first);
    const sp = board(s)[0];
    expect(sp).toMatchObject({ status: "running", endsAt: sp.startedAt + MONTH });
    const v = s.services.find((x) => x.id === sp.serviceIds[0])!;
    expect(v).toMatchObject({ price: 0, product: "gameServer", endedAt: null });
    expect(s.customers.find((c) => c.id === sp.customerId)).toMatchObject({ sponsor: true });
    accept(s, second);
    // The offer has two slots, so the rest is closed.
    expect(board(s).find((x) => x.id === third.id)!.status).toBe("declined");
    expect(s.tickets.find((t) => t.id === third.ticketId)).toMatchObject({ status: "closed", outcome: "ignored" });
    expect(s.sponsorOffers[0]).toMatchObject({ taken: 2 });
  }, 90_000);

  it("charges half the list price to a normal customer when the offer is not free", () => {
    const s = applied(7, { free: false });
    accept(s, board(s)[0]);
    const sp = board(s)[0], v = s.services.find((x) => x.id === sp.serviceIds[0])!;
    expect(v.price).toBeCloseTo(marketPrice("gameServer", sizeSpec("gameServer", 0, yearOf(s.hour)), yearOf(s.hour)) / 730 / 2, 10);
    expect(s.customers.find((c) => c.id === sp.customerId)).toMatchObject({ churnedAt: null });
    expect(s.customers.find((c) => c.id === sp.customerId)!.sponsor).toBeUndefined();
  }, 60_000);

  it("withdraws an open offer and closes its waiting applications", () => {
    const s = applied(7);
    accept(s, board(s)[0]);
    while (board(s).length < 2) tick(s);
    const o = s.sponsorOffers[0], [running, waiting] = board(s);
    expect(withdrawOffer(s, o.id)).toEqual({ ok: true, id: o.id });
    expect(board(s).find((x) => x.id === waiting.id)!.status).toBe("declined");
    expect(s.tickets.find((t) => t.id === waiting.ticketId)).toMatchObject({ status: "closed", outcome: "ignored" });
    expect(board(s).find((x) => x.id === running.id)!.status).toBe("running");
    expect(offerOpen(s, s.sponsorOffers[0])).toBe(false);
    runTo(s, s.hour + 24 * 11);
    expect(board(s)).toHaveLength(2);
    expect(withdrawOffer(s, o.id)).toEqual({ ok: false, error: "error.unknownOffer" });
    expect(withdrawOffer(s, "ofr0")).toEqual({ ok: false, error: "error.unknownOffer" });
  }, 90_000);

  it("adds awareness and a lead batch each month while it runs", () => {
    const s = applied(8);
    accept(s, board(s)[0]);
    const sp = board(s)[0], b = sp.board!;
    b.drops = false;
    const leads = () => leadsThisMonth(s).filter((x) => x.source === "community" && x.profile === b.profile).reduce((n, x) => n + x.count, 0);
    expect(leads()).toBeCloseTo(b.leads, 10);
    const a = s.marketing.awareness[b.profile];
    s.hour = sp.startedAt + MONTH - 1;
    boardTick(s, []);
    expect(s.marketing.awareness[b.profile]).toBe(a);
    s.hour = sp.startedAt + MONTH;
    boardTick(s, []);
    expect(s.marketing.awareness[b.profile]).toBeCloseTo(a + (1 - a) * BOARD.awareness, 10);
    expect(board(s)[0].board!.granted).toBe(BOARD.awareness);
  }, 60_000);

  it("stops adding awareness at the cap", () => {
    const s = applied(9);
    accept(s, board(s)[0]);
    const sp = board(s)[0];
    sp.board!.drops = false;
    sp.endsAt = sp.startedAt + 20 * MONTH;
    for (let k = 1; k <= 9; k++) {
      s.hour = sp.startedAt + k * MONTH;
      boardTick(s, []);
    }
    expect(boardGranted(s)).toBeCloseTo(BOARD.cap, 10);
    const after = s.marketing.awareness[sp.board!.profile];
    s.hour = sp.startedAt + 10 * MONTH;
    boardTick(s, []);
    expect(s.marketing.awareness[sp.board!.profile]).toBe(after);
  }, 60_000);

  it("draws about 10 percent abusers and 15 percent droppers", () => {
    const s = roomy(10);
    const h = s.hour, big: SponsorOffer = { id: "ofr9999", postedAt: h, ...offer, slots: 4, applyAt: Array.from({ length: 2000 }, (_, i) => h + i), sent: 0, taken: 0 };
    s.sponsorOffers = [big];
    // One application an hour, each closed before the next so every name is free again.
    for (let i = 0; i < 2000; i++) {
      s.hour = h + i;
      boardTick(s, []);
      s.sponsorships = s.sponsorships.map((x) => ({ ...x, status: "declined" }));
    }
    const all = board(s).map((x) => x.board!);
    expect(all).toHaveLength(2000);
    const share = (f: (b: (typeof all)[number]) => boolean) => all.filter(f).length / all.length;
    expect(share((b) => b.abuser)).toBeGreaterThan(0.08);
    expect(share((b) => b.abuser)).toBeLessThan(0.12);
    expect(share((b) => b.drops)).toBeGreaterThan(0.13);
    expect(share((b) => b.drops)).toBeLessThan(0.17);
    expect(new Set(all.map((b) => b.kind))).toEqual(new Set(["clan", "lanParty", "fanSite", "student", "mirror"]));
  });

  it("never shows the same applicant twice and runs out of people", () => {
    const s = roomy(11);
    const names = APPLICANTS.flatMap((a) => a.names);
    s.sponsorOffers = [{ id: "ofr9999", postedAt: s.hour, ...offer, slots: 4, applyAt: Array(names.length + 5).fill(s.hour), sent: 0, taken: 0 }];
    boardTick(s, []);
    const got = board(s).map((x) => x.board!.name);
    expect(got).toHaveLength(names.length);
    expect(new Set(got).size).toBe(names.length);
    expect(offerOpen(s, s.sponsorOffers[0])).toBe(true);
  });

  it("drops the banner after the first month and stops the rewards", () => {
    const s = applied(11);
    accept(s, board(s)[0]);
    const sp = board(s)[0], b = sp.board!;
    b.drops = true;
    sp.endsAt = sp.startedAt + 6 * MONTH;
    const events: SimEvent[] = [];
    s.hour = sp.startedAt + MONTH;
    events.push(...(() => { const e: SimEvent[] = []; boardTick(s, e); return e; })());
    expect(events.find((e) => e.key === "event.boardDropped")).toMatchObject({ app: "Marketing", params: { event: b.name } });
    expect(board(s)[0].board).toMatchObject({ dropped: true, granted: BOARD.awareness });
    const leads = leadsThisMonth(s).filter((x) => x.source === "community").reduce((n, x) => n + x.count, 0);
    expect(leads).toBe(0);
    const a = s.marketing.awareness[b.profile];
    s.hour = sp.startedAt + 2 * MONTH;
    boardTick(s, []);
    expect(s.marketing.awareness[b.profile]).toBe(a);
  }, 60_000);

  it("sends abuse notices for an abuser and none for a clean sponsor", () => {
    const run = (abuser: boolean) => {
      const s = applied(12);
      accept(s, board(s)[0]);
      const sp = board(s)[0];
      sp.board!.abuser = abuser;
      s.customers = s.customers.map((c) => (c.id === sp.customerId ? { ...c, shady: abuser || undefined } : c));
      sp.endsAt = s.hour + 20 * MONTH;
      for (let i = 0; i < 12 * MONTH; i++) { s.hour++; opsTick(s); }
      return s.tickets.filter((t) => (t.kind === "notice" || t.kind === "legal") && t.customerId === sp.customerId).length;
    };
    expect(run(true)).toBeGreaterThan(0);
    expect(run(false)).toBe(0);
  }, 90_000);

  it("turns an outage into bad press as in a community event", () => {
    const s = applied(13);
    accept(s, board(s)[0]);
    const sp = board(s)[0];
    sp.endsAt = s.hour + 24;
    sp.down = { [sp.serviceIds[0]]: 3 };
    const events: SimEvent[] = [];
    runTo(s, sp.endsAt + 1, events);
    expect(board(s)[0]).toMatchObject({ status: "done", reward: null });
    expect(events.find((e) => e.key === "event.sponsorFailed")).toBeTruthy();
  }, 60_000);

  it("ends the sponsorship with the term and lets a half-price customer leave", () => {
    const s = applied(14, { free: false });
    accept(s, board(s)[0]);
    const sp = board(s)[0];
    sp.board!.drops = false;
    sp.endsAt = s.hour + 24;
    const events: SimEvent[] = [];
    runTo(s, sp.endsAt + 1, events);
    expect(board(s)[0]).toMatchObject({ status: "done" });
    expect(board(s)[0].reward).not.toBeNull();
    expect(events.find((e) => e.key === "event.boardDone")).toBeTruthy();
    expect(s.customers.find((c) => c.id === sp.customerId)!.churnedAt).not.toBeNull();
  }, 60_000);

  it("does not change the cadence of the community requests", () => {
    const withBoard = roomy(15), without = roomy(15);
    postOffer(withBoard, offer);
    runTo(withBoard, 24 * 120);
    runTo(without, 24 * 120);
    const mine = (s: GameState) => s.sponsorships.filter((x) => !x.board).map((x) => x.offeredAt);
    expect(mine(withBoard)).toEqual(mine(without));
  }, 90_000);

  it("is a site in the Browser from the start", () => {
    const s = newGame(1);
    expect(resolve(s, "sponsorbored.net").page).toEqual({ kind: "sponsorboard" });
    expect(resolve(s, "https://www.sponsorbored.net/").page).toEqual({ kind: "sponsorboard" });
  });

  it("loads old saves without offers", () => {
    const s = roomy(16);
    const old = JSON.parse(serialize(s));
    delete old.sponsorOffers;
    expect(deserialize(JSON.stringify(old)).sponsorOffers).toEqual([]);
    postOffer(s, offer);
    runTo(s, 24 * 11);
    const back = deserialize(serialize(s));
    expect(back.sponsorOffers).toEqual(s.sponsorOffers);
    expect(back.sponsorships.filter((x) => x.board)).toEqual(s.sponsorships.filter((x) => x.board));
  }, 60_000);
});

describe("an unlisted line", () => {
  it("gets no board applications and no news about it", () => {
    const s = roomy(3), at = s.hour;
    postOffer(s, offer);
    expect(setLine(s, "gameServer", false)).toMatchObject({ ok: true });
    runTo(s, at + 24 * 40);
    expect(board(s)).toEqual([]);
    expect(offerOpen(s, s.sponsorOffers[0])).toBe(false);
    expect(s.news.some((e) => e.startsWith("line."))).toBe(false);
  });
  describe("a dropped banner", () => {
    // A running sponsorship one month in, its banner just taken down.
    function cut(seed: number) {
      const s = applied(seed);
      accept(s, board(s)[0]);
      const sp = board(s)[0];
      sp.board!.drops = true;
      sp.endsAt = sp.startedAt + 6 * MONTH;
      s.hour = sp.startedAt + MONTH;
      boardTick(s, []);
      return { s, id: sp.id };
    }
    const held = (s: GameState) => s.tickets.find((t) => t.topic === HELD_TOPIC)!;

    it("refuses to block or cancel a sponsor that still shows the banner", () => {
      const s = applied(11);
      accept(s, board(s)[0]);
      const id = board(s)[0].id;
      expect(blockSponsor(s, id)).toMatchObject({ ok: false, error: "error.sponsorNotDropped" });
      expect(cancelSponsor(s, id)).toMatchObject({ ok: false, error: "error.sponsorNotDropped" });
    }, 60_000);

    it("blocks the services, brings the sponsor's ticket and ends the sponsorship on tough luck", () => {
      const { s, id } = cut(11);
      expect(blockSponsor(s, id)).toMatchObject({ ok: true });
      const sp = board(s)[0];
      expect(sp.serviceIds.every((v) => s.heldServices[v] === "manual")).toBe(true);
      expect(held(s)).toMatchObject({ kind: "sponsor", status: "open", customerId: sp.customerId });
      expect(sp.board!.heldTicket).toBe(held(s).id);
      expect(closeTicket(s, held(s).id)).toMatchObject({ ok: true });
      runTo(s, s.hour + 2);
      expect(board(s)[0]).toMatchObject({ status: "done" });
      expect(board(s)[0].reward).not.toBeNull();
      expect(s.services.filter((v) => sp.serviceIds.includes(v.id)).every((v) => v.endedAt !== null)).toBe(true);
      expect(sp.serviceIds.some((v) => s.heldServices[v])).toBe(false);
    }, 60_000);

    it("lifts the block and pays again once the banner is back up", () => {
      const { s, id } = cut(11);
      blockSponsor(s, id);
      expect(answerSponsor(s, held(s).id, true)).toMatchObject({ ok: true });
      const sp = board(s)[0];
      expect(sp).toMatchObject({ status: "running", board: { dropped: false, drops: false } });
      expect(sp.serviceIds.some((v) => s.heldServices[v])).toBe(false);
      expect(held(s).status).toBe("closed");
      const a = s.marketing.awareness[sp.board!.profile];
      s.hour = sp.startedAt + 2 * MONTH;
      boardTick(s, []);
      expect(s.marketing.awareness[sp.board!.profile]).toBeGreaterThan(a);
      expect(blockSponsor(s, id)).toMatchObject({ ok: false });
    }, 60_000);

    it("cancels at once without a ticket", () => {
      const { s, id } = cut(11);
      expect(cancelSponsor(s, id)).toMatchObject({ ok: true });
      runTo(s, s.hour + 2);
      expect(board(s)[0]).toMatchObject({ status: "done" });
      expect(s.tickets.some((t) => t.topic === HELD_TOPIC)).toBe(false);
    }, 60_000);

    it("keeps a block across a save", () => {
      const { s, id } = cut(11);
      blockSponsor(s, id);
      expect(board(deserialize(serialize(s)))[0].board!.heldTicket).toBe(held(s).id);
    }, 60_000);
  });
});
