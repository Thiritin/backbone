// Used hardware: buy a fixed ask, bid on an auction, list a stored device for sale, take a listing down.
import { hashRng, rand } from "../00-core/rng";
import { REFUND_HOURS, REFUND_SHARE } from "../10-catalog/burnin";
import { isOfficeRouter, modelById } from "../10-catalog/hardware";
import {
  currentBid, onMarket, rivalNow, SELL_ASK, SELL_CAP, SELL_DAYS, SELL_FINAL, SELL_LISTED_DAYS, SELL_START, shipHours, type BidStep, type Listing,
} from "../10-catalog/used";
import type { GameState } from "../50-state";
import { deviceValue, HOURS_PER_YEAR } from "../60-infra/status";
import { serverTaken } from "../60-infra/cluster";
import { stock, type ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const cents = (v: number) => Math.round(v * 100) / 100;
const pay = (s: GameState, l: Listing, amount: number) => {
  s.cash = cents(s.cash - amount);
  s.ledger = [...s.ledger, { hour: s.hour, category: "hardware", key: "ledger.usedBuy", params: { model: modelById(l.model).name, qty: l.qty, channel: l.channel }, amount: -amount }];
};

function placeError(s: GameState, l: Listing, locationId: string): string | null {
  const loc = s.locations.find((x) => x.id === locationId), m = modelById(l.model);
  if (!loc) return "error.unknownLocation";
  return isOfficeRouter(m) && loc.dc ? "error.basementOnly" : null;
}

// Pays for a listing and ships its units: the parts carry their hidden age, a missing second power supply stays missing,
// and used gear is never insured.
export function deliverListing(s: GameState, l: Listing, locationId: string, price: number): string[] {
  const city = s.locations.find((x) => x.id === locationId)!.city;
  pay(s, l, price);
  const ids = stock(s, { model: l.model, brand: l.brand, qty: l.qty, ...(l.vendor ? { vendor: l.vendor } : {}) }, null, locationId, shipHours(l, city));
  let psus = 0;
  s.devices = s.devices.map((d) => {
    // A chassis lot's nodes are as old as the lot; the chassis carries the price.
    if (d.chassisId && ids.includes(d.chassisId)) {
      return { ...d, boughtAt: s.hour, used: true as const, components: d.components.map((c) => ({ ...c, installedAt: Math.round(s.hour - l.age * HOURS_PER_YEAR), wear: "hidden" as const })) };
    }
    if (!ids.includes(d.id)) return d;
    const components = d.components.map((c, i) => ({ ...c, installedAt: Math.round(s.hour - (l.wear[i] ?? l.age) * HOURS_PER_YEAR), wear: "hidden" as const }))
      .filter((c) => !(l.defect === "psu" && c.kind === "psu" && psus++ === 1));
    psus = 0;
    const refund = l.channel === "chat" ? null : { until: (d.arriveAt ?? s.hour) + REFUND_HOURS, amount: cents((price / l.qty) * REFUND_SHARE) };
    return { ...d, price: cents(price / l.qty), boughtAt: s.hour, used: true as const, components, refund };
  });
  return ids;
}

// A fixed ask on the board or in a chat. A chat scam takes the money and never ships.
export function buyListing(s: GameState, listingId: string, locationId: string): ActionResult {
  const l = s.used.find((x) => x.id === listingId);
  if (!l || !onMarket(s, l)) return fail("error.listingGone");
  if (l.channel === "ebuy") return fail("error.auctionOnly");
  const error = placeError(s, l, locationId);
  if (error) return fail(error);
  if (s.cash < l.price) return fail("error.noCash");
  if (l.scam) {
    pay(s, l, l.price);
    s.used = s.used.map((x) => (x.id === l.id ? { ...x, dueAt: s.hour + shipHours(l, s.locations.find((y) => y.id === locationId)!.city) } : x));
    return { ok: true };
  }
  const ids = deliverListing(s, l, locationId, l.price);
  s.used = s.used.filter((x) => x.id !== l.id);
  if (l.channel === "board") s.usedRep += 1;
  return { ok: true, id: ids[0] };
}

// A maximum bid on an auction; the player needs the cash for it, and a won auction ships to locationId.
export function bidListing(s: GameState, listingId: string, max: number, locationId: string): ActionResult {
  const l = s.used.find((x) => x.id === listingId);
  if (!l || !onMarket(s, l)) return fail("error.listingGone");
  if (l.channel !== "ebuy") return fail("error.notAuction");
  const error = placeError(s, l, locationId);
  if (error) return fail(error);
  if (!Number.isFinite(max) || max < l.price || max <= (l.bid ?? 0) || (l.bid !== undefined && max <= currentBid(l, s.hour)) || max <= rivalNow(l, s.hour)) return fail("error.bidTooLow");
  if (s.cash < max) return fail("error.noCash");
  // The history keeps what the player stands at when they bid; the other bidder answers later (rivalBids).
  const next = { ...l, bid: Math.round(max), to: locationId }, step: BidStep = { hour: s.hour, amount: currentBid(next, s.hour), max: next.bid, by: "you" };
  s.used = s.used.map((x) => (x.id === l.id ? { ...next, bids: [...(l.bids ?? []).filter((b) => b.by === "you"), step] } : x));
  return { ok: true };
}

// Puts a stored device on the board at an ask (default 1.3 times its value) or on eBuy from half its value. A buyer comes
// within 7 to 30 days unless the ask is 1.5 times the value or more; eBuy bidders end between the value and 1.4 times it.
export function listForSale(s: GameState, deviceId: string, channel: "board" | "ebuy", ask?: number): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  if (!d.store || d.transitTo) return fail("error.notInStorage");
  if (modelById(d.model).kind === "gateway" && !modelById(d.model).price) return fail("error.cannotSell");
  if (d.lease) return fail("error.leased");
  if (serverTaken(s, d.id)) return fail("error.serverInUse");
  const value = deviceValue(s, d);
  const price = Math.round(channel === "ebuy" ? value * SELL_START : ask ?? value * SELL_ASK);
  if (!Number.isFinite(price) || price < 1) return fail("error.badPrice");
  const r = hashRng(s.seed, s.hour, s.nextId, 1017), days = SELL_DAYS[0] + rand(r) * (SELL_DAYS[1] - SELL_DAYS[0]);
  const sells = channel === "ebuy" || price < value * SELL_CAP;
  const soldFor = channel === "ebuy" ? Math.max(price, Math.round(value * (SELL_FINAL[0] + rand(r) * (SELL_FINAL[1] - SELL_FINAL[0])))) : price;
  const listing: Listing = {
    id: `used${s.nextId++}`, channel, model: d.model, brand: d.brand, qty: 1, age: Math.round(((s.hour - d.boughtAt) / HOURS_PER_YEAR) * 10) / 10,
    wear: [], defect: null, price, city: s.locations.find((x) => x.id === d.store)!.city, shipDays: 0,
    postedAt: s.hour, expiresAt: s.hour + SELL_LISTED_DAYS * 24, device: d, soldAt: sells ? s.hour + Math.round(days * 24) : null, soldFor,
  };
  s.devices = s.devices.filter((x) => x.id !== d.id);
  s.used = [...s.used, listing];
  return { ok: true, id: listing.id };
}

// Takes the player's own listing down; the device goes back to its storage.
export function cancelListing(s: GameState, listingId: string): ActionResult {
  const l = s.used.find((x) => x.id === listingId);
  if (!l?.device) return fail("error.listingGone");
  s.used = s.used.filter((x) => x.id !== l.id);
  s.devices = [...s.devices, returned(s, l)];
  return { ok: true };
}

// The device of a listing that ends unsold, back in its storage or the first one if that location is gone.
export const returned = (s: GameState, l: Listing) =>
  ({ ...l.device!, store: s.locations.some((x) => x.id === l.device!.store) ? l.device!.store : s.locations[0].id });
