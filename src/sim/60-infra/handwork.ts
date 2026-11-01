// Who does the hand work at a datacenter: the provider's remote hands, the player, a friend, or a technician (docs/design/economy.md, Hardware, power and failures).
import { rand } from "../00-core/rng";
import { yearOf } from "../00-core/time";
import { COUNTRY, datacenterById } from "../20-world/datacenters";
import type { GameState, Location } from "../50-state";

export type How = "hands" | "self" | "friend" | "tech";

// Travel hours and fee of a drive: within a city, within a country, to another European country. Overseas is not offered.
export const TRAVEL = { city: { hours: 1, fee: 20 }, country: { hours: 4, fee: 90 }, europe: { hours: 9, fee: 250 } } as const;
export const BOOKED_HOURS = 24;
export const FRIEND_FEE = 35;
export const FAVOURS_PER_YEAR = 3;
export const MISHAP_CHANCE = 0.1;

// wait is the hours until the work starts, fee the euros paid up front.
export interface HandOption { wait: number; fee: number }
export interface HandWork {
  hands: HandOption & { perHour: number };
  // The player is on site and does the work at once.
  here: boolean;
  friend: (HandOption & { travel: number; left: number }) | null;
}

// The drive between two cities: same city, same country, another European country; null across the Atlantic.
export function trip(from: string, to: string): { hours: number; fee: number } | null {
  const a = COUNTRY[from], b = COUNTRY[to];
  if (from === to) return TRAVEL.city;
  if (a === b) return TRAVEL.country;
  return a === "US" || b === "US" ? null : TRAVEL.europe;
}

// The location the player is at; home when that location is gone.
export const playerAt = (s: GameState): Location => s.locations.find((l) => l.id === s.player.at) ?? s.locations[0];
// Whether the player stands in the location, not still on the way there.
export const present = (s: GameState, locationId: string): boolean =>
  playerAt(s).id === locationId && !(s.player.doing === "travel" && s.player.until > s.hour);
// Claims the player's time for hand work on site.
const workOnSite = (s: GameState, hours: number) => { s.player = { at: s.player.at, until: Math.max(s.player.until, s.hour) + hours, doing: "work" }; };

export const favoursLeft = (s: GameState): number =>
  FAVOURS_PER_YEAR - (s.friendFavours.year === yearOf(s.hour) ? s.friendFavours.used : 0);

// The three ways to get hand work done at a location, with the hours before the work starts and the fee; null in the basement.
export function handWork(s: GameState, locationId: string): HandWork | null {
  const loc = s.locations.find((l) => l.id === locationId);
  if (!loc?.dc) return null;
  // The friend lives in the home city.
  const dc = datacenterById(loc.dc), t = trip(s.locations[0].city, loc.city), book = dc.visitBooking ? BOOKED_HOURS : 0;
  return {
    hands: { wait: dc.remoteHands.responseHours, fee: dc.remoteHands.perHour, perHour: dc.remoteHands.perHour },
    here: present(s, loc.id),
    friend: t && { wait: book + t.hours, fee: FRIEND_FEE, travel: t.hours, left: favoursLeft(s) },
  };
}

// A priced piece of hand work. cost is what the caller checks the cash against;
// commit books the fee, claims the player's time or the favour, and returns the hours until the work is done.
export interface HandJob { cost: number; wait: number; commit: () => number }

// Prices work of the given hours at a location. Remote hands bill at least an hour; a technician and the basement are on site at once.
export function handJob(s: GameState, device: string, loc: Location | undefined, how: How | boolean, work: number, billHours = Math.max(1, work)): { error: string } | HandJob {
  const h: How = how === true ? "tech" : how === false ? "hands" : how;
  const w = h === "tech" || !loc ? null : handWork(s, loc.id);
  if (!w) return { cost: 0, wait: work, commit: () => work };
  const book = (key: string, amount: number, params: Record<string, string | number>) => {
    s.cash = Math.round((s.cash - amount) * 100) / 100;
    s.ledger.push({ hour: s.hour, category: "maintenance", key, params, amount: -amount });
  };
  if (h === "hands") {
    const bill = billHours * w.hands.perHour, wait = w.hands.wait + work;
    return { cost: bill, wait, commit: () => { book("ledger.remoteHands", bill, { device, hours: billHours }); return wait; } };
  }
  if (h === "self") {
    if (!w.here) return { error: "error.notThere" };
    return { cost: 0, wait: work, commit: () => { workOnSite(s, work); return work; } };
  }
  const o = w.friend;
  if (!o) return { error: "error.tooFar" };
  if (o.left < 1) return { error: "error.noFavours" };
  const wait = o.wait + work;
  return { cost: o.fee, wait, commit: () => {
    const year = yearOf(s.hour);
    s.friendFavours = { year, used: (s.friendFavours.year === year ? s.friendFavours.used : 0) + 1 };
    book("ledger.friend", o.fee, { device });
    return wait + (rand(s.rng) < MISHAP_CHANCE ? work : 0);
  } };
}
