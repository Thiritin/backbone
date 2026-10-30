// The used hardware market (gdd.md, Racks, hardware and cabling, Used hardware): listings each month by seed, auctions
// that close, chat deals that never arrive, buyers for the player's own listings, the yearly lot and clearance, the board lead.
import { hashRng, rand, type Rng } from "../00-core/rng";
import { isMonthStart, monthIndexOf, yearOf } from "../00-core/time";
import { CITIES } from "../10-catalog/economy";
import { brandFrom, brandsOf, COMPONENTS, componentParts, isDriveKind, MODELS, modelById, modelName, vendorsOf, type DeviceModel } from "../10-catalog/hardware";
import { presetPrice } from "../10-catalog/parts";
import {
  ASK, AUCTION_START, channelName, CLEARANCE_SIZE, DEFECT_CHANCE, DEFECTS, EARLY_HOURS, EBUY_FEE, leading, LOCAL_CHANCE, LOT_SHARE, LOT_SIZE, MAX_AGE,
  MIN_YEARS_ON_SALE, PER_MONTH, REP_LEAD, RIVAL, rivalNow, SCAM_CHANCE, SHIP_DAYS, USED_EVENTS, usedSince, WEAR, type Channel, type Defect, type Listing,
} from "../10-catalog/used";
import type { GameState } from "../50-state";
import { editRequest, newLead } from "../30-market/sales";
import type { SimEvent } from "../88-tick/tick";
import { deliverListing, returned } from "../90-actions/used";

const DAY = 24;
// Days a listing stays up: auctions run a week or so, board asks linger, chat deals go fast.
const LIFETIME: Record<Channel, [number, number]> = { ebuy: [5, 10], board: [10, 30], chat: [4, 10] };
const between = (r: Rng, [a, b]: [number, number]): number => a + (b - a) * rand(r);
const int = (r: Rng, [a, b]: [number, number]): number => a + Math.floor(rand(r) * (b - a + 1));
const pick = <T>(r: Rng, xs: T[]): T => xs[Math.floor(rand(r) * xs.length)];
const cents = (v: number) => Math.round(v * 100) / 100;

// Models a hoster could be getting rid of: sold for at least two years by now.
export const usedModels = (year: number): DeviceModel[] =>
  MODELS.filter((m) => m.price > 0 && m.kind !== "part" && m.kind !== "patch" && !m.chassis && usedSince(m) <= year - MIN_YEARS_ON_SALE);

const sellerCity = (s: GameState, r: Rng): string =>
  rand(r) < LOCAL_CHANCE ? pick(r, s.locations).city : pick(r, CITIES).name;

function defectFor(r: Rng, m: DeviceModel): Defect | null {
  const options: Defect[] = [...(m.psus === 2 ? ["psu" as const] : []), ...(m.server?.drives ? ["drive" as const] : []), ...(m.height > 0 ? ["rails" as const] : [])];
  return options.length && rand(r) < DEFECT_CHANCE ? pick(r, options) : null;
}

// Each part's hidden age in years; a drive that reports errors is past its life expectancy.
function wearFor(r: Rng, m: DeviceModel, age: number, defect: Defect | null): number[] {
  const parts = componentParts(m), wear = parts.map(() => Math.round(age * between(r, WEAR) * 10) / 10);
  const bad = defect === "drive" ? parts.findIndex((p) => isDriveKind(p.kind)) : -1;
  if (bad >= 0) wear[bad] = Math.max(wear[bad], COMPONENTS[parts[bad].kind].life + 1);
  return wear;
}

interface Draft { channel: Channel; model?: DeviceModel; postedAt: number; expiresAt?: number; qty?: number; share?: number; city?: string }

function listing(s: GameState, r: Rng, d: Draft): Listing {
  const year = yearOf(s.hour), m = d.model ?? pick(r, usedModels(year));
  // A brand that releases the model later never has one to sell yet; end of sale does not stop used units.
  const brand = pick(r, brandsOf(m).filter((b) => brandFrom(m, b) <= monthIndexOf(s.hour)));
  // The CPU maker comes from its own draw so the listing's other draws stay as they were.
  const makers = vendorsOf(m), vendor = makers.length ? pick(hashRng(s.seed, s.nextId, 1019), makers) : undefined;
  const age = Math.round(between(r, [1, Math.max(1, year - usedSince(m))]) * 10) / 10;
  const defect = d.qty ? null : defectFor(r, m), base = presetPrice(m, year, brand, vendor) * (d.qty ?? 1);
  const older = Math.min(1, (age - 1) / (MAX_AGE - 1));
  const share = d.share ?? (d.channel === "ebuy" ? AUCTION_START : ASK[d.channel][0] + (ASK[d.channel][1] - ASK[d.channel][0]) * older);
  const days = int(r, LIFETIME[d.channel]);
  const ends = d.channel === "ebuy" ? d.postedAt - (d.postedAt % DAY) + days * DAY + 20 : d.postedAt + (d.channel === "board" ? EARLY_HOURS : 0) + days * DAY;
  return {
    id: `used${s.nextId++}`, channel: d.channel, model: m.id, brand, ...(vendor ? { vendor } : {}), qty: d.qty ?? 1, age, wear: wearFor(r, m, age, defect), defect,
    price: Math.round(base * share * (defect ? DEFECTS[defect] : 1)), city: d.city ?? sellerCity(s, r), shipDays: int(r, SHIP_DAYS),
    postedAt: d.postedAt, expiresAt: d.expiresAt ?? ends,
    ...(d.channel === "chat" && rand(r) < SCAM_CHANCE ? { scam: true } : {}),
    ...(d.channel === "ebuy" ? { rival: Math.round(base * between(r, RIVAL)) } : {}),
  };
}

// A month's new listings: 2 to 6 per channel, posted over the month.
export function monthListings(s: GameState): Listing[] {
  if (!usedModels(yearOf(s.hour)).length) return [];
  const r = hashRng(s.seed, s.hour, 1011);
  return (["ebuy", "board", "chat"] as Channel[]).flatMap((channel) =>
    Array.from({ length: int(r, PER_MONTH) }, () => listing(s, r, { channel, postedAt: s.hour + Math.floor(rand(r) * 27) * DAY + int(r, [8, 20]) })));
}

function yearly(s: GameState, kind: "lot" | "clearance"): Listing[] {
  const r = hashRng(s.seed, s.hour, 1013), year = yearOf(s.hour);
  if (kind === "lot") {
    const servers = usedModels(year).filter((m) => m.server);
    if (!servers.length) return [];
    return [listing(s, r, { channel: "board", model: pick(r, servers), qty: LOT_SIZE, share: LOT_SHARE, city: s.locations[0].city, postedAt: s.hour - EARLY_HOURS, expiresAt: s.hour + 14 * DAY })];
  }
  // Ends on the second evening.
  const end = s.hour - (s.hour % DAY) + 2 * DAY + 20;
  return Array.from({ length: CLEARANCE_SIZE }, () => listing(s, r, { channel: "ebuy", postedAt: s.hour, expiresAt: end }));
}

function closeAuction(s: GameState, l: Listing, events: SimEvent[]): void {
  const name = modelName(modelById(l.model), l.brand), price = Math.max(l.price, l.rival ?? 0);
  if (!leading(l)) {
    events.push({ app: "Shop", key: "event.usedOutbid", params: { model: name } });
    return;
  }
  if (s.cash < price) {
    events.push({ app: "Shop", key: "event.usedUnpaid", params: { model: name, price } });
    return;
  }
  const to = s.locations.find((x) => x.id === l.to) ?? s.locations[0];
  deliverListing(s, l, to.id, price);
  events.push({ app: "Shop", key: "event.usedWon", params: { model: name, price, location: to.name } });
}

function closeSale(s: GameState, l: Listing, events: SimEvent[]): void {
  const d = l.device!;
  if (l.soldAt === null || l.soldAt === undefined) {
    s.devices = [...s.devices, returned(s, l)];
    events.push({ app: "Shop", key: "event.usedExpired", params: { device: d.name, channel: channelName(l.channel) } });
    return;
  }
  const fee = l.channel === "ebuy" ? cents(l.soldFor! * EBUY_FEE) : 0, paid = cents(l.soldFor! - fee);
  s.cash = cents(s.cash + paid);
  s.ledger = [...s.ledger, { hour: s.hour, category: "sales", key: "ledger.usedSale", params: { device: d.name, channel: channelName(l.channel), fee }, amount: paid }];
  if (l.channel === "board") s.usedRep += 1;
  events.push({ app: "Shop", key: "event.usedSold", params: { device: d.name, channel: channelName(l.channel), price: paid } });
}

// A board contact asks for hosting once a month.
function boardLead(s: GameState, events: SimEvent[]): void {
  const req = newLead(s, "hobbyDev", s.locations[0].city, events, { product: "vps", size: 1, sla: "basic" });
  editRequest(s, req.id, (x) => ({ thread: [{ ...x.thread[0], key: "sales.msg.usedBoard" }, ...x.thread.slice(1)] }));
}

export function usedTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  const done = s.used.filter((l) => (l.device ? l.soldAt != null && l.soldAt <= s.hour || l.expiresAt <= s.hour : l.dueAt !== undefined ? l.dueAt <= s.hour : l.expiresAt <= s.hour));
  if (done.length) {
    s.used = s.used.filter((l) => !done.includes(l));
    for (const l of done) {
      if (l.device) closeSale(s, l, events);
      else if (l.dueAt !== undefined) events.push({ app: "Shop", key: "event.usedScam", params: { model: modelName(modelById(l.model), l.brand), price: l.price, seller: channelName(l.channel) } });
      else if (l.channel === "ebuy" && l.bid) closeAuction(s, l, events);
    }
  }
  // The other bidder tops the player's maximum while the auction runs.
  for (const l of s.used) {
    if (l.channel === "ebuy" && l.bid && !l.device && leading(l, s.hour - 1) && !leading(l, s.hour)) events.push({ app: "Shop", key: "event.usedOutbidNow", params: { model: modelName(modelById(l.model), l.brand), price: rivalNow(l, s.hour) } });
  }
  if (isMonthStart(s.hour)) {
    s.used = [...s.used, ...monthListings(s)];
    if (s.usedRep >= REP_LEAD) boardLead(s, events);
  }
  for (const e of USED_EVENTS) if (e.at === s.hour) s.used = [...s.used, ...yearly(s, e.kind)];
  return events;
}
