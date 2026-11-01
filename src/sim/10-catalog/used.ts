// Used hardware market (economy.md, Hardware, power and failures, Used hardware): channels, price bands and the yearly events.
import { hashRng, rand } from "../00-core/rng";
import { hourOf, START_YEAR } from "../00-core/time";
import type { Device, GameState } from "../50-state";
import type { Vendor } from "./cpus";

export type Channel = "ebuy" | "board" | "chat";
// Each channel is a website in the Browser.
export const CHANNELS: { id: Channel; name: string; host: string }[] = [
  { id: "ebuy", name: "eBuy", host: "ebuy.com" },
  { id: "board", name: "WebHostingTalc", host: "webhostingtalc.com" },
  { id: "chat", name: "Telegrump", host: "telegrump.org" },
];
export const channelName = (c: Channel): string => CHANNELS.find((x) => x.id === c)!.name;
export const marketUrl = (c: Channel): string => `www.${CHANNELS.find((x) => x.id === c)!.host}/`;

export type Defect = "psu" | "drive" | "rails";
// Price factor of a listing with this visible defect.
export const DEFECTS: Record<Defect, number> = { psu: 0.85, drive: 0.8, rails: 0.95 };
export const DEFECT_CHANCE = 0.3;

// New listings per channel and month, and the youngest generation on offer, in years since its launch.
export const PER_MONTH: [number, number] = [2, 6];
export const MIN_YEARS_ON_SALE = 2;
// Gear on sale at game start counts as launched this many years earlier, standing in for the servers sold before 2005.
export const PRE_GAME_YEARS = 3;
export const usedSince = (m: { from: number }): number => (m.from <= START_YEAR ? m.from - PRE_GAME_YEARS : m.from);
// Share of the current preset price: fixed asks fall from the first number to the second as a unit ages (MAX_AGE years).
export const ASK: Record<"board" | "chat", [number, number]> = { board: [0.6, 0.45], chat: [0.45, 0.3] };
export const MAX_AGE = 6;
export const SCAM_CHANCE = 0.15;
// eBuy: the start price and the range of the rival bidder's maximum, as shares of the current preset price.
export const AUCTION_START = 0.25;
export const RIVAL: [number, number] = [0.35, 0.7];
// Each part's hidden age is the unit's age times a draw from this range.
export const WEAR: [number, number] = [0.5, 1.5];
// The seller is in a city of one of the player's locations this often; board and chat deals then ship in a day.
export const LOCAL_CHANCE = 0.35;
export const SHIP_DAYS: [number, number] = [3, 5];

// Selling: the board's default ask and the share of the value above which nobody buys, eBuy's start and fee, and the days to a buyer.
export const SELL_ASK = 0.9;
export const SELL_CAP = 1;
export const SELL_START = 0.5;
export const SELL_FINAL: [number, number] = [0.8, 1];
export const EBUY_FEE = 0.08;
export const SELL_DAYS: [number, number] = [7, 30];
export const SELL_LISTED_DAYS = 30;

// Reputation on the board: early access to new board listings, then a monthly lead.
export const REP_EARLY = 5;
export const REP_LEAD = 15;
export const EARLY_HOURS = 24;

// Yearly events: a bust hoster's servers as one lot, and a datacenter clearance weekend on eBuy.
export const LOT_SIZE = 20;
export const LOT_SHARE = 0.35;
export const CLEARANCE_SIZE = 10;
export const EVENTS_FROM = 2007;
const at = (year: number, month: number): number => hourOf(new Date(Date.UTC(year, month, 1, 9)));
export const USED_EVENTS: { id: string; kind: "lot" | "clearance"; at: number }[] = Array.from({ length: 2040 - EVENTS_FROM }, (_, i) => EVENTS_FROM + i).flatMap((y) => [
  { id: `used.lot.${y}`, kind: "lot" as const, at: at(y, (y * 5) % 12) },
  { id: `used.clearance.${y}`, kind: "clearance" as const, at: at(y, (y * 5 + 6) % 12) },
]);

// A listing on a channel. Market listings carry the hidden part ages (wear, in years, in the order of the model's parts) and,
// on eBuy, the rival's maximum and the player's; the player's own listings carry the device they sell.
// One step of an auction's history after the opening bid; the rival bids only against the player's maximum.
export interface BidStep { hour: number; amount: number; max?: number; by: "you" | "rival" }
export interface Listing {
  id: string;
  channel: Channel;
  model: string;
  brand: string;
  // A server's CPU maker; listings from before CPU vendors carry the preset's.
  vendor?: Vendor;
  qty: number;
  // Years since the unit was first bought.
  age: number;
  wear: number[];
  defect: Defect | null;
  // The ask, or the start price on eBuy.
  price: number;
  city: string;
  shipDays: number;
  // Visible from postedAt (board listings a day later without early access); gone at expiresAt, when an auction ends.
  postedAt: number;
  expiresAt: number;
  scam?: boolean;
  rival?: number;
  bid?: number;
  // The bids since the opening one, oldest first; listings from older saves have none.
  bids?: BidStep[];
  // Where a won auction ships.
  to?: string;
  // A paid chat deal waiting to arrive, or never arriving.
  dueAt?: number;
  device?: Device;
  // The hour a buyer takes the player's listing and what they pay; null when nobody will.
  soldAt?: number | null;
  soldFor?: number;
}

// When the player sees a listing: board listings a day after posting, unless the board trusts them.
export const shownAt = (s: GameState, l: Listing): number => (l.channel === "board" && s.usedRep < REP_EARLY ? l.postedAt + EARLY_HOURS : l.postedAt);
export const onMarket = (s: GameState, l: Listing): boolean => !l.device && l.dueAt === undefined && s.hour >= shownAt(s, l) && s.hour < l.expiresAt;

// The rival raises over a bid by this share, at least 1.
export const RIVAL_STEP = 0.03;
const raise = (amount: number): number => Math.max(1, Math.round(amount * RIVAL_STEP));
const BIDDERS: [number, number] = [3, 5];
const REPLY_HOURS: [number, number] = [8, 36];
export interface RivalBid { hour: number; amount: number }

// The other bidder's bids, climbing from the start price to their maximum. Most come late in the auction and the last one in
// its final hours; after the player's latest bid the next one waits at least a reply time (8 to 36 hours), a bid in the final
// hours meeting the sniper at the end.
export function rivalBids(l: Listing): RivalBid[] {
  if (!l.rival || l.rival <= l.price) return [];
  const r = hashRng(l.rival, l.postedAt, l.expiresAt, l.price, 1021);
  const n = BIDDERS[0] + Math.floor(rand(r) * (BIDDERS[1] - BIDDERS[0] + 1)), span = Math.max(2, l.expiresAt - l.postedAt);
  const ups = Array.from({ length: n }, () => rand(r)).sort((x, y) => x - y);
  const reply = REPLY_HOURS[0] + Math.floor(rand(r) * (REPLY_HOURS[1] - REPLY_HOURS[0] + 1));
  const mine = (l.bids ?? []).filter((b) => b.by === "you").map((b) => b.hour), since = mine.length ? Math.max(...mine) : -1;
  const raw = ups.map((u, i): RivalBid => ({
    hour: i === n - 1 ? l.expiresAt - 1 - Math.floor(rand(r) * 5) : Math.min(l.expiresAt - 1, l.postedAt + Math.floor(span * (0.1 + 0.9 * u ** 0.4))),
    amount: Math.round(l.price + ((l.rival! - l.price) * (i + 1)) / n),
  })).map((b, i, all) => (i === n - 1 ? { ...b, amount: l.rival!, hour: Math.max(b.hour, all[i - 1]?.hour ?? 0) } : b));
  // A bid not yet made when the player bids waits for the reply time; bids that share an hour merge into the last.
  const waited = raw.map((b) => (b.hour > since && since >= 0 ? { ...b, hour: Math.min(l.expiresAt - 1, Math.max(b.hour, since + reply)) } : b));
  return waited.filter((b, i) => i === waited.length - 1 || waited[i + 1].hour !== b.hour);
}
// The other bidder's highest bid by this hour, 0 before the first.
export const rivalNow = (l: Listing, hour: number): number => rivalBids(l).filter((b) => b.hour <= hour).reduce((m, b) => Math.max(m, b.amount), 0);
// What an auction stands at. Without an hour it is the end: the other bidder's maximum against the player's.
export const leading = (l: Listing, hour?: number): boolean => !!l.bid && l.bid > (hour === undefined ? l.rival ?? 0 : rivalNow(l, hour));
export function currentBid(l: Listing, hour: number = l.expiresAt): number {
  const r = rivalNow(l, hour), top = Math.max(l.price, r);
  return l.bid && l.bid > r ? Math.min(l.bid, r ? r + raise(r) : l.price) : top;
}

export type BidRow = { hour: number; amount: number; by: "start" | "rival" | "you" | "auto" };
// The bids so far, oldest first: the opening bid, the other bidder's, the player's and the player's automatic answers
// (up to their maximum) to each of the other's bids made while they led.
export function bidHistory(l: Listing, hour: number): BidRow[] {
  const mine = (l.bids ?? []).filter((b) => b.by === "you" && b.hour <= hour);
  const theirs = rivalBids(l).filter((b) => b.hour <= hour);
  const auto = theirs.flatMap((b): BidRow[] => {
    const bid = [...mine].reverse().find((x) => x.hour <= b.hour);
    const max = bid ? bid.max ?? bid.amount : 0;
    return bid && b.amount < max ? [{ hour: b.hour, amount: Math.min(max, b.amount + raise(b.amount)), by: "auto" }] : [];
  });
  const rows: BidRow[] = [{ hour: l.postedAt, amount: l.price, by: "start" }, ...theirs.map((b): BidRow => ({ ...b, by: "rival" })), ...mine.map((b): BidRow => ({ hour: b.hour, amount: b.amount, by: "you" })), ...auto];
  const order = { start: 0, rival: 1, you: 2, auto: 3 };
  return rows.map((r, i) => ({ r, i })).sort((x, y) => x.r.hour - y.r.hour || order[x.r.by] - order[y.r.by] || x.i - y.i).map((x) => x.r);
}

// Hours from purchase to the stockroom: a day from a seller in the same city, except on eBuy.
export const shipHours = (l: Listing, city: string): number => (l.channel !== "ebuy" && l.city === city ? 24 : l.shipDays * 24);
