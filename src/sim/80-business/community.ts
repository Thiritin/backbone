// Values from docs/design/economy.md, "Marketing and reviews" (community events).
import type { Product, Profile } from "../30-customers/customers";
import { sizeSpec } from "../10-catalog/products";
import { yearOf } from "../00-core/time";
import type { GameState } from "../50-state";
import type { Ticket } from "../40-support/tickets";

// size indexes the product's sizes (SIZES in 10-catalog/products). A tech event pays know-how, a public one awareness
// (applied to every audience profile), a review and leads.
export interface CommunityEvent {
  id: string; name: string; kind: "tech" | "public"; level: number; product: Product; size: number; count: number; hours: number;
  audience: Profile[]; knowHow: number; awareness: number;
  // People the event reaches, shown on the Sponsor-Bored requests list.
  people: number;
}

const DAY = 24;
export const EVENTS: CommunityEvent[] = [
  { id: "lanTastic", name: "LAN-tastic", kind: "public", level: 1, product: "gameServer", size: 0, count: 2, hours: 3 * DAY, audience: ["gamer", "private"], knowHow: 0, awareness: 0.02, people: 150 },
  { id: "chaosClub", name: "Chaos Computing Club", kind: "tech", level: 1, product: "vps", size: 1, count: 1, hours: 90 * DAY, audience: ["hobbyDev"], knowHow: 10, awareness: 0, people: 60 },
  { id: "hackASorus", name: "Hack-a-Sorus", kind: "tech", level: 1, product: "vps", size: 1, count: 2, hours: 7 * DAY, audience: ["hobbyDev"], knowHow: 25, awareness: 0, people: 80 },
  { id: "mirror", name: "Debonair Linux mirror", kind: "tech", level: 1, product: "storage", size: 1, count: 1, hours: 365 * DAY, audience: ["hobbyDev"], knowHow: 15, awareness: 0, people: 2000 },
  { id: "fragFest", name: "Frag-Fest", kind: "public", level: 1, product: "gameServer", size: 0, count: 4, hours: 3 * DAY, audience: ["gamer"], knowHow: 0, awareness: 0.03, people: 300 },
  { id: "userGroup", name: "Linux User Group", kind: "public", level: 1, product: "webHosting", size: 1, count: 1, hours: 365 * DAY, audience: ["smallBiz", "private"], knowHow: 0, awareness: 0.01, people: 120 },
  { id: "devOops", name: "DevOops Conference", kind: "tech", level: 3, product: "vps", size: 2, count: 8, hours: 7 * DAY, audience: ["agency", "enterprise"], knowHow: 40, awareness: 0, people: 1200 },
];
export const eventById = (id: string): CommunityEvent | undefined => EVENTS.find((e) => e.id === id);

// A request arrives every 4 to 8 weeks and waits two weeks for an answer.
export const REQUEST_DAYS = [28, 56] as const;
export const OFFER_HOURS = 14 * DAY;
// A request answered with 50% off is decided a day later and taken at this chance.
export const HALF_HOURS = DAY;
export const HALF_ACCEPT = 0.5;
// More hours down than this during the event turns the rewards into bad press.
export const MAX_DOWN_HOURS = 2;
export const RECOMMEND_CHANCE = 0.2;
export const RECOMMEND_SKILL = 20;
export const REVIEW_CHANCE = 0.5;
export const LEADS = [3, 6] as const;
export const FAIL_AWARENESS = 0.9;
export const FAIL_REVIEWS = 2;

// An application from the Sponsor-Bored board (sponsorboard.ts); the offer's product, size and term ride along so the sponsorship needs no event.
export interface BoardInfo {
  offerId: string; kind: string; name: string; audience: number; profile: Profile; ad: "banner" | "signature" | "stage";
  product: Product; size: number; hours: number; free: boolean; leads: number;
  // Fixed when the application arrives: the applicant misuses the server, or drops the banner after the first month.
  abuser: boolean; drops: boolean; dropped: boolean;
  // Awareness this sponsorship has added so far, counted against the board's cap.
  granted: number;
}

export interface SponsorReward { knowHow: number; awareness: number; stars: number | null; recommendation: boolean; leads: number }
// offered: the request waits in the inbox. running: the free services are up. done: the event ended; reward is null when downtime turned it into bad press.
export interface Sponsorship {
  id: string; event: string; ticketId: string; offeredAt: number; status: "offered" | "running" | "done" | "declined";
  customerId: string | null; serviceIds: string[]; startedAt: number; endsAt: number; endedAt: number | null;
  // Hours down per service while the event runs, and the month total last read from downHours.
  down: Record<string, number>; seen: Record<string, number>;
  reward: SponsorReward | null;
  board?: BoardInfo;
  // Hour the player answered a request with 50% off; the community decides HALF_HOURS later.
  halfAt?: number;
}

export const MONTH = 730;

export const patchSponsorship = (s: GameState, id: string, f: (x: Sponsorship) => Partial<Sponsorship>): void => {
  s.sponsorships = s.sponsorships.map((x) => (x.id === id ? { ...x, ...f(x) } : x));
};

// A board application as a public event: one service for the term, rewarding monthly instead of at the end.
export function eventOf(sp: Sponsorship): CommunityEvent {
  const b = sp.board;
  if (!b) return eventById(sp.event)!;
  return { id: sp.event, name: b.name, kind: "public", level: 1, product: b.product, size: b.size, count: 1, hours: b.hours, audience: [b.profile], knowHow: 0, awareness: 0, people: b.audience };
}

// Leads from a finished public event count in the month after it, split evenly over the location cities and the audience.
// A running board sponsorship brings its monthly batch until the banner is dropped.
export function communityBatches(s: GameState, cities: string[]) {
  const board = s.sponsorships.filter((x) => x.board && x.status === "running" && !x.board.dropped)
    .flatMap((x) => cities.map((city) => ({ profile: x.board!.profile, city, source: "community" as const, count: x.board!.leads / cities.length, conversion: 1 })));
  return [...board, ...finished(s, cities)];
}

function finished(s: GameState, cities: string[]) {
  return s.sponsorships.filter((x) => !x.board && x.reward && x.reward.leads > 0 && x.endedAt !== null && x.endedAt <= s.hour && s.hour - x.endedAt < MONTH)
    .flatMap((x) => {
      const ev = eventById(x.event)!;
      return cities.flatMap((city) => ev.audience.map((profile) => ({
        profile, city, source: "community" as const, count: x.reward!.leads / cities.length / ev.audience.length, conversion: 1,
      })));
    });
}

export const sponsorshipOf = (s: GameState, t: Pick<Ticket, "id">): Sponsorship | undefined => s.sponsorships.find((x) => x.ticketId === t.id);

// What the ticket text names: the event, how many services of what size and for how long.
export function sponsorParams(s: GameState, t: Ticket): Record<string, string | number> {
  const sp = sponsorshipOf(s, t), b = sp?.board;
  if (b) {
    const spec = sizeSpec(b.product, b.size, yearOf(t.createdAt));
    return { event: b.name, count: 1, product: b.product, vcpu: spec.vcpu, ramGb: spec.ramGb, diskGb: spec.diskGb, days: b.hours / DAY, months: b.hours / MONTH, audience: b.audience, profile: b.profile, free: b.free ? 1 : 0 };
  }
  const ev = eventById(t.topic);
  if (!ev) return {};
  const spec = sizeSpec(ev.product, ev.size, yearOf(t.createdAt));
  return { event: ev.name, count: ev.count, product: ev.product, vcpu: spec.vcpu, ramGb: spec.ramGb, diskGb: spec.diskGb, days: ev.hours / DAY };
}
