// Used hardware market (economy.md, Hardware, power and failures, Used hardware): channels, price bands and the yearly events.
import { hourOf } from "../00-core/time";
import type { Device, GameState } from "../50-state";
import type { Vendor } from "./cpus";

export type Channel = "ebuy" | "board" | "chat";
export const CHANNELS: { id: Channel; name: string }[] = [
  { id: "ebuy", name: "eBuy" },
  { id: "board", name: "WebHostingTalc" },
  { id: "chat", name: "Telegrump" },
];
export const channelName = (c: Channel): string => CHANNELS.find((x) => x.id === c)!.name;

export type Defect = "psu" | "drive" | "rails";
// Price factor of a listing with this visible defect.
export const DEFECTS: Record<Defect, number> = { psu: 0.85, drive: 0.8, rails: 0.95 };
export const DEFECT_CHANCE = 0.3;

// New listings per channel and month, and the youngest generation on offer, in years since its launch.
export const PER_MONTH: [number, number] = [2, 6];
export const MIN_YEARS_ON_SALE = 2;
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
export const SELL_ASK = 1.3;
export const SELL_CAP = 1.5;
export const SELL_START = 0.5;
export const SELL_FINAL: [number, number] = [1, 1.4];
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
// What an auction stands at: the rival bids up to the player's maximum, or to their own.
export const currentBid = (l: Listing): number => (l.bid ? Math.max(l.price, Math.min(l.bid, l.rival ?? 0)) : l.price);
export const leading = (l: Listing): boolean => !!l.bid && l.bid > (l.rival ?? 0);

// Hours from purchase to the stockroom: a day from a seller in the same city, except on eBuy.
export const shipHours = (l: Listing, city: string): number => (l.channel !== "ebuy" && l.city === city ? 24 : l.shipDays * 24);
