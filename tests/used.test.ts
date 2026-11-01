import { describe, expect, it } from "vitest";
import { hourOf, yearOf } from "../src/sim/00-core/time";
import { brandFrom, componentParts, modelById } from "../src/sim/10-catalog/hardware";
import { challengeFor } from "../src/sim/10-catalog/challenges";
import { presetPrice } from "../src/sim/10-catalog/parts";
import { bidHistory, CLEARANCE_SIZE, EBUY_FEE, leading, LOT_SIZE, onMarket, rivalBids, rivalNow, REP_EARLY, REP_LEAD, shipHours, USED_EVENTS, type Listing } from "../src/sim/10-catalog/used";
import type { GameState } from "../src/sim/50-state";
import { deviceValue, HOURS_PER_YEAR } from "../src/sim/60-infra/status";
import { hardwarePremium } from "../src/sim/46-finance/finance";
import { monthListings, usedTick } from "../src/sim/80-business/used";
import { newsTick } from "../src/sim/80-business/news";
import { tick } from "../src/sim/88-tick/tick";
import { bidListing, buyListing, cancelListing, listForSale } from "../src/sim/90-actions/used";
import { startChallenge, startGame } from "../src/sim/90-actions/start";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buyDevice, readyGame } from "./fixtures";

const idOf = (r: { ok: boolean; id?: string }): string => r.id!;
const MARCH_2008 = hourOf(new Date(Date.UTC(2008, 2, 1)));
const game = (seed = 1): GameState => ({ ...readyGame(seed), hour: MARCH_2008, cash: 100_000 });
// A month of listings, with the clock at the first one of the channel visible to everyone.
function market(s: GameState, channel: Listing["channel"], f: (l: Listing) => boolean = () => true): Listing {
  // Listings are drawn by seed; walk month starts until the channel has one that fits.
  let l: Listing | undefined;
  for (let m = 0; m < 24 && !l; m++) {
    usedTick(s);
    l = s.used.find((x) => x.channel === channel && f(x));
    if (!l) s.hour = hourOf(new Date(Date.UTC(2008 + Math.floor((m + 3) / 12), (m + 3) % 12, 1)));
  }
  s.hour = l!.postedAt + 24;
  return l!;
}
const until = (s: GameState, hour: number) => {
  const events = [];
  while (s.hour < hour) { s.hour++; events.push(...usedTick(s)); }
  return events;
};

describe("used listings", () => {
  it("posts 2 to 6 listings per channel at each month start, the same for a seed", () => {
    const a = game(1), listings = monthListings(a);
    for (const c of ["ebuy", "board", "chat"]) {
      const n = listings.filter((l) => l.channel === c).length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(6);
    }
    expect(listings.every((l) => modelById(l.model).from <= 2006 && l.postedAt >= MARCH_2008 && l.expiresAt > l.postedAt)).toBe(true);
    expect(monthListings(game(1))).toEqual(listings);
    expect(monthListings(game(2))).not.toEqual(listings);
    usedTick(a);
    expect(a.used.length).toBe(listings.length);
  });

  it("has listings on the market from the first hour of a new game", () => {
    const FEB_2005 = hourOf(new Date(Date.UTC(2005, 1, 1)));
    for (const seed of [1, 2, 3, 4]) {
      const s = startGame(seed);
      for (const c of ["ebuy", "board", "chat"]) {
        const n = s.used.filter((l) => l.channel === c).length;
        expect(n).toBeGreaterThanOrEqual(2);
        expect(n).toBeLessThanOrEqual(6);
      }
      for (const l of s.used) {
        const m = modelById(l.model);
        expect(onMarket(s, l)).toBe(true);
        expect(l.expiresAt).toBeLessThan(FEB_2005 + 31 * 24);
        expect(m.from).toBe(2005);
        expect(l.age).toBeGreaterThanOrEqual(1);
        expect(l.age).toBeLessThanOrEqual(3);
        expect(brandFrom(m, l.brand)).toBeLessThanOrEqual(2005 * 12);
      }
    }
    expect(startChallenge(challengeFor(2005, 1).id).used.length).toBeGreaterThan(0);
  });

  it("only lists models a maker already sells", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = startGame(seed);
      s.hour = hourOf(new Date(Date.UTC(2005, 1, 1)));
      for (const l of monthListings(s)) expect(l.brand, l.model).toBeTypeOf("string");
    }
  });

  it("prices fixed asks and auctions within their bands of the preset price", () => {
    const s = game(3);
    let scam = false;
    for (let m = 0; m < 48; m++) { s.hour = hourOf(new Date(Date.UTC(2008 + Math.floor(m / 12), m % 12, 1))); usedTick(s); scam ||= s.used.some((l) => l.scam); }
    for (const l of s.used) {
      const share = l.price / presetPrice(modelById(l.model), yearOf(l.postedAt), l.brand, l.vendor) / (l.defect ? { psu: 0.85, drive: 0.8, rails: 0.95 }[l.defect] : 1);
      const [lo, hi] = { board: [0.45, 0.6], chat: [0.3, 0.45], ebuy: [0.25, 0.25] }[l.channel];
      expect(share).toBeGreaterThan(lo - 0.01);
      expect(share).toBeLessThan(hi + 0.01);
      if (l.channel === "ebuy") expect(l.rival! / presetPrice(modelById(l.model), yearOf(l.postedAt), l.brand, l.vendor)).toBeGreaterThanOrEqual(0.349);
    }
    expect(scam).toBe(true);
  });

  it("delivers a bought listing through the transit path with its hidden wear", () => {
    const s = game(), l = market(s, "board", (x) => !!modelById(x.model).server);
    const cash = s.cash, at = s.hour;
    const r = buyListing(s, l.id, "loc1");
    expect(r.ok).toBe(true);
    expect(s.cash).toBe(cash - l.price);
    const d = s.devices.find((x) => x.id === idOf(r))!;
    expect(d.used).toBe(true);
    expect(d.price).toBe(l.price);
    expect(d.arriveAt).toBe(at + shipHours(l, "Frankfurt"));
    const parts = componentParts(modelById(l.model)).length - (l.defect === "psu" ? 1 : 0);
    expect(d.components.length).toBe(parts);
    if (l.defect !== "psu") expect(d.components.map((c) => Math.round((at - c.installedAt) / HOURS_PER_YEAR * 10) / 10)).toEqual(l.wear);
    while (s.hour < d.arriveAt!) tick(s);
    expect(s.devices.find((x) => x.id === d.id)!.store).toBe("loc1");
    expect(s.used.some((x) => x.id === l.id)).toBe(false);
  });

  it("leaves used gear out of the hardware insurance", () => {
    const s = game(), before = hardwarePremium(s), l = market(s, "board", (x) => !!modelById(x.model).server);
    buyListing(s, l.id, "loc1");
    expect(hardwarePremium(s)).toBe(before);
  });

  it("loses the money to a chat scam and says so", () => {
    const s = game(), l = market(s, "chat");
    s.used = s.used.map((x) => (x.id === l.id ? { ...x, scam: true } : x));
    const cash = s.cash, devices = s.devices.length;
    expect(buyListing(s, l.id, "loc1").ok).toBe(true);
    expect(s.cash).toBe(cash - l.price);
    const events = until(s, s.used.find((x) => x.id === l.id)!.dueAt!);
    expect(events.map((e) => e.key)).toContain("event.usedScam");
    expect(s.devices.length).toBe(devices);
    expect(s.cash).toBe(cash - l.price);
    expect(s.usedRep).toBe(0);
  });

  it("wins an auction at the second price or loses it to the rival", () => {
    const s = game(), l = market(s, "ebuy");
    expect(buyListing(s, l.id, "loc1")).toEqual({ ok: false, error: "error.auctionOnly" });
    expect(bidListing(s, l.id, l.rival! + 500, "loc1").ok).toBe(true);
    const cash = s.cash;
    const events = until(s, l.expiresAt);
    expect(events.map((e) => e.key)).toContain("event.usedWon");
    expect(s.cash).toBe(cash - l.rival!);
    expect(s.devices.some((d) => d.used && d.price === l.rival)).toBe(true);

    const t = game(), m = market(t, "ebuy");
    expect(bidListing(t, m.id, m.rival! - 1, "loc1").ok).toBe(true);
    const left = t.cash;
    expect(until(t, m.expiresAt).map((e) => e.key)).toContain("event.usedOutbid");
    expect(t.cash).toBe(left);
    expect(t.devices.some((d) => d.used)).toBe(false);
  });

  it("lets the other bidder climb to their maximum, mostly late in the auction", () => {
    let late = 0, total = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const l = market(game(seed), "ebuy"), steps = rivalBids(l);
      expect(steps.length).toBeGreaterThanOrEqual(2);
      expect(steps.map((b) => b.amount)).toEqual([...steps.map((b) => b.amount)].sort((x, y) => x - y));
      expect(steps[steps.length - 1].amount).toBe(l.rival);
      expect(l.expiresAt - steps[steps.length - 1].hour).toBeLessThanOrEqual(5);
      for (const b of steps) { total++; if (b.hour >= l.postedAt + 0.6 * (l.expiresAt - l.postedAt)) late++; }
    }
    expect(late / total).toBeGreaterThan(0.5);
  });

  it("answers the player's bid only after a reply time, and shows an automatic answer up to their maximum", () => {
    const s = game(), l = market(s, "ebuy"), at = s.hour;
    expect(rivalNow(l, at)).toBe(0);
    expect(bidListing(s, l.id, l.rival! + 500, "loc1").ok).toBe(true);
    const mine = s.used.find((x) => x.id === l.id)!;
    expect(mine.bids!.map((b) => b.by)).toEqual(["you"]);
    // Nothing from the other side in the 8 hours after the bid, unless it is the last-minute bid.
    for (const b of rivalBids(mine)) if (b.hour > at) expect(b.hour - at >= 8 || b.hour === mine.expiresAt - 1).toBe(true);
    expect(leading(mine, mine.expiresAt)).toBe(true);
    const rows = bidHistory(mine, mine.expiresAt);
    expect(rows.some((r) => r.by === "auto")).toBe(true);
    expect(rows.filter((r) => r.by === "you").length).toBe(1);
    expect(deserialize(serialize(s)).used.find((x) => x.id === l.id)!.bids).toEqual(mine.bids);
  });

  it("notifies when someone outbids the player during the auction", () => {
    const s = game(), l = market(s, "ebuy");
    expect(bidListing(s, l.id, l.rival! - 1, "loc1").ok).toBe(true);
    const keys = until(s, l.expiresAt).map((e) => e.key);
    expect(keys).toContain("event.usedOutbidNow");
    expect(keys.indexOf("event.usedOutbidNow")).toBeLessThan(keys.indexOf("event.usedOutbid"));
    const t = game(), m = market(t, "ebuy");
    expect(bidListing(t, m.id, m.rival! + 500, "loc1").ok).toBe(true);
    expect(until(t, m.expiresAt).map((e) => e.key)).not.toContain("event.usedOutbidNow");
  });

  it("sells on the board below the resale value, after a while", () => {
    const s = game(), id = idOf(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    const value = deviceValue(s, s.devices.find((d) => d.id === id)!), cash = s.cash, at = s.hour;
    const r = listForSale(s, id, "board");
    expect(r.ok).toBe(true);
    expect(s.devices.some((d) => d.id === id)).toBe(false);
    const events = until(s, at + 31 * 24);
    const sold = events.find((e) => e.key === "event.usedSold")!;
    expect(sold).toBeDefined();
    expect(s.cash - cash).toBe(Math.round(value * 0.9));
    expect(s.cash - cash).toBeLessThan(value);
    expect(s.ledger.at(-1)!.key).toBe("ledger.usedSale");
    expect(s.usedRep).toBe(1);
  });

  it("takes the eBuy fee, and lets an ask far above the value expire", () => {
    const s = game(), id = idOf(buyDevice(s, "g1-compute", "Dwell", 1, "loc1")), cash = s.cash;
    const lid = idOf(listForSale(s, id, "ebuy")), l = s.used.find((x) => x.id === lid)!;
    until(s, l.soldAt!);
    expect(s.cash - cash).toBeCloseTo(l.soldFor! * (1 - EBUY_FEE), 2);

    const t = game(), dev = idOf(buyDevice(t, "g1-compute", "Dwell", 1, "loc1"));
    const value = deviceValue(t, t.devices.find((d) => d.id === dev)!);
    const kid = idOf(listForSale(t, dev, "board", Math.round(value * 1.1))), k = t.used.find((x) => x.id === kid)!;
    expect(k.soldAt).toBeNull();
    expect(until(t, k.expiresAt).map((e) => e.key)).toContain("event.usedExpired");
    expect(t.devices.find((d) => d.id === dev)!.store).toBe("loc1");
  });

  it("cancels a listing back into storage", () => {
    const s = game(), id = idOf(buyDevice(s, "sw-8", "Sysko", 1, "loc1"));
    const l = idOf(listForSale(s, id, "board"));
    expect(cancelListing(s, l).ok).toBe(true);
    expect(s.devices.find((d) => d.id === id)!.store).toBe("loc1");
    expect(s.used.some((x) => x.id === l)).toBe(false);
  });

  it("shows board listings a day early from 5 reputation and brings a lead each month from 15", () => {
    const s = game();
    usedTick(s);
    const l = s.used.find((x) => x.channel === "board")!;
    s.hour = l.postedAt;
    s.usedRep = REP_EARLY - 1;
    expect(onMarket(s, l)).toBe(false);
    s.usedRep = REP_EARLY;
    expect(onMarket(s, l)).toBe(true);
    expect(buyListing(s, l.id, "loc1").ok).toBe(true);
    expect(s.usedRep).toBe(REP_EARLY + 1);

    const t = game(), requests = t.sales.requests.length;
    t.usedRep = REP_LEAD - 1;
    usedTick(t);
    expect(t.sales.requests.length).toBe(requests);
    t.hour = hourOf(new Date(Date.UTC(2008, 3, 1)));
    t.usedRep = REP_LEAD;
    usedTick(t);
    expect(t.sales.requests.at(-1)!.thread[0].key).toBe("sales.msg.usedBoard");
  });

  it("puts the yearly lot and clearance weekend on the market and in the news", () => {
    const s = game();
    const lot = USED_EVENTS.find((e) => e.kind === "lot" && e.at > s.hour)!, sale = USED_EVENTS.find((e) => e.kind === "clearance" && e.at > s.hour)!;
    s.hour = lot.at;
    usedTick(s);
    expect(newsTick(s).map((e) => e.key)).toContain("event.news.used.lot");
    const l = s.used.find((x) => x.qty === LOT_SIZE)!;
    expect(onMarket(s, l)).toBe(true);
    expect(l.price).toBe(Math.round(presetPrice(modelById(l.model), 2008, l.brand, l.vendor) * LOT_SIZE * 0.35));
    s.hour = sale.at;
    const before = s.used.length;
    usedTick(s);
    expect(s.used.length - before).toBe(CLEARANCE_SIZE);
    expect(newsTick(s).map((e) => e.key)).toContain("event.news.used.clearance");
  });

  it("loads saves from before the used market", () => {
    const s = game(), raw = JSON.parse(serialize(s));
    delete raw.used;
    delete raw.usedRep;
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.used).toEqual([]);
    expect(loaded.usedRep).toBe(0);
    usedTick(loaded);
    expect(deserialize(serialize(loaded)).used).toEqual(loaded.used);
  });
});
