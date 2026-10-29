// economy.md, Noticing outages: who is looking at a service at each hour of the week, and how fast a customer notices it is
// down. An outage nobody notices costs nothing.
import { hashRng, rand } from "../00-core/rng";
import { dateOf } from "../00-core/time";
import type { Product, Profile } from "../30-customers/customers";
import { idNum } from "./usage";

type Keys = [number, number][];
export type Segment = "game" | "business" | "private";

// Straight lines between keyframes; the last keyframe holds until midnight.
const at = (keys: Keys, h: number): number => {
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1][0] <= h) i++;
  const [h0, v0] = keys[i], next = keys[i + 1];
  return next ? v0 + ((next[1] - v0) * (h - h0)) / (next[0] - h0) : v0;
};

// Players: evenings, longest before a free day; nobody from about 02:00 to 08:00 after a school or work night, and little
// during work hours.
export const GAME = {
  lateWork: [[0, 0.25], [1, 0.1], [2, 0.01], [9, 0.01]] as Keys,
  lateFree: [[0, 0.9], [2, 0.6], [4, 0.1], [5, 0.01], [9, 0.01]] as Keys,
  dayWork: 0.05, dayFree: 0.5,
  eveWork: [[17, 0.4], [19, 0.9], [22, 0.8], [23, 0.4]] as Keys,
  eveFree: [[17, 0.6], [19, 1], [23, 1]] as Keys,
};
// Offices and shops: business hours on workdays.
export const BUSINESS = { workday: [[0, 0.02], [6, 0.02], [7, 0.2], [8, 1], [18, 1], [19, 0.3], [21, 0.05]] as Keys, weekend: [[0, 0.02], [10, 0.1], [18, 0.1], [20, 0.02]] as Keys };
// Private sites and mailboxes: a glance in the evening.
export const PRIVATE: Keys = [[0, 0.05], [2, 0.01], [7, 0.3], [12, 0.5], [18, 1], [22, 0.6], [23, 0.2]];

// Hourly chance weight of noticing at full attention: players and offices see it almost at once, private customers slowly.
export const SENSITIVITY: Record<Segment, number> = { game: 3, business: 2, private: 0.015 };
// Private customers each notice at their own pace: a log-normal factor with this spread.
export const PRIVATE_SPREAD = 0.8;
const BUSINESS_PROFILES: Profile[] = ["smallBiz", "agency", "office", "onlineShop", "enterprise"];

export const segmentOf = (profile: Profile, product: Product): Segment =>
  product === "gameServer" ? "game" : BUSINESS_PROFILES.includes(profile) ? "business" : "private";

// Share of a segment's users looking at the hour: 0 to 1. Saturday and Sunday are free days.
export function attention(segment: Segment, hour: number): number {
  const d = dateOf(hour), day = d.getUTCDay(), h = d.getUTCHours(), free = day === 0 || day === 6;
  if (segment === "private") return at(PRIVATE, h);
  if (segment === "business") return at(free ? BUSINESS.weekend : BUSINESS.workday, h);
  if (h < 9) return at(free ? GAME.lateFree : GAME.lateWork, h);
  if (h < 17) return free ? GAME.dayFree : GAME.dayWork;
  return at(day === 5 || day === 6 ? GAME.eveFree : GAME.eveWork, h);
}

// Running sums of a segment's hourly rate over one week from Sunday 00:00, so a stretch of any length sums in one step.
const SUNDAY = ((7 - dateOf(0).getUTCDay()) % 7) * 24;
const sums = new Map<Segment, { prefix: number[]; week: number }>();
function weekly(segment: Segment) {
  let x = sums.get(segment);
  if (!x) {
    const prefix = [0];
    for (let i = 0; i < 168; i++) prefix.push(prefix[i] + SENSITIVITY[segment] * attention(segment, SUNDAY + i));
    x = { prefix, week: prefix[168] };
    sums.set(segment, x);
  }
  return x;
}
const cumulative = (segment: Segment, t: number): number => {
  const { prefix, week } = weekly(segment), k = t - SUNDAY, i = ((k % 168) + 168) % 168;
  return Math.floor(k / 168) * week + prefix[i];
};

// A private customer's pace: about one in twenty notices within hours, about one in ten takes ten days or more.
export function paceOf(seed: number, customerId: string, segment: Segment): number {
  if (segment !== "private") return 1;
  const r = hashRng(seed, idNum(customerId), 269), u = Math.max(1e-9, rand(r)), v = rand(r);
  return Math.exp(PRIVATE_SPREAD * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
}
// The hazard of noticing from hour from up to, not including, hour to.
export const hazard = (seed: number, customerId: string, segment: Segment, from: number, to: number): number =>
  to <= from ? 0 : paceOf(seed, customerId, segment) * (cumulative(segment, to) - cumulative(segment, from));
// Each outage gets its own threshold: noticed once the hazard since it began passes it.
export const threshold = (seed: number, serviceId: string, since: number): number =>
  -Math.log(Math.max(1e-9, 1 - rand(hashRng(seed, idNum(serviceId), since, 271))));

// Whether the customer has noticed an outage that began at since by the end of hour now, and whether they noticed in that hour.
export function noticed(seed: number, customerId: string, serviceId: string, segment: Segment, since: number, now: number): { seen: boolean; fresh: boolean } {
  const e = threshold(seed, serviceId, since);
  const seen = hazard(seed, customerId, segment, since, now + 1) >= e;
  return { seen, fresh: seen && hazard(seed, customerId, segment, since, now) < e };
}
// Expected hours of an outage of a length that come after the customer noticed it, at the segment's average rate.
export function noticedHours(segment: Segment, hours: number): number {
  const r = weekly(segment).week / 168, x = r * hours;
  return x > 0 ? hours * (1 - (1 - Math.exp(-x)) / x) : 0;
}
// The chance a short outage of minutes starting at an hour is noticed at all.
export const noticeChance = (seed: number, customerId: string, segment: Segment, hour: number, minutes: number): number =>
  1 - Math.exp(-hazard(seed, customerId, segment, hour, hour + 1) * Math.min(1, minutes / 60) - (minutes > 60 ? hazard(seed, customerId, segment, hour + 1, hour + Math.ceil(minutes / 60)) : 0));

// The window a customer accepts a move in, in hours of the day: players in the small hours when nobody is playing,
// offices on a weekday evening, private customers whenever.
export const MOVE_WINDOW: Record<Segment, { from: number; to: number; workday: boolean } | null> = {
  game: { from: 2, to: 6, workday: false },
  business: { from: 18, to: 22, workday: true },
  private: null,
};
// The hour a move accepted at an hour starts: the next opening of the window (businesses not before the next day), the answer hour for private customers.
export function moveWindowStart(segment: Segment, answered: number): number {
  const w = MOVE_WINDOW[segment];
  if (!w) return answered;
  let h = answered + 1;
  const wrong = () => dateOf(h).getUTCHours() !== w.from || (w.workday && (h < (Math.floor(answered / 24) + 1) * 24 || [0, 6].includes(dateOf(h).getUTCDay())));
  while (wrong()) h++;
  return h;
}
