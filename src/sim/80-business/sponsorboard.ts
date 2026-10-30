// Values from docs/design/economy.md, "Marketing and reviews" (the Sponsor-Bored board).
import { hashRng, rand } from "../00-core/rng";
import type { Product, Profile } from "../30-customers/customers";
import { SIZES } from "../10-catalog/products";
import { isFinal, type Ticket } from "../40-support/tickets";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { MONTH, OFFER_HOURS, patchSponsorship, type BoardInfo } from "./community";
import { addAwareness } from "./marketing";

export const BOARD_HOST = "sponsorbored.net";
export const BOARD_PRODUCTS: Product[] = ["gameServer", "vps", "storage", "webHosting"];
export const BOARD_MONTHS = [1, 3, 6, 12] as const;
export const BOARD_SLOTS = [1, 2, 3, 4] as const;
export const BOARD = {
  // Applications arrive 2 to 10 days after the offer, two more than there are slots.
  applyDays: [2, 10] as const, extra: 2, maxOpen: 3,
  abuse: 0.1, drop: 0.15,
  // Awareness a running sponsorship adds each month, and the most the board adds in total.
  awareness: 0.005, cap: 0.03,
};

export type Ad = BoardInfo["ad"];
interface Applicant { id: string; profile: Profile; audience: [number, number]; ad: Ad; names: string[] }
export const APPLICANTS: Applicant[] = [
  { id: "clan", profile: "gamer", audience: [80, 400], ad: "banner", names: ["Clan Lag-Spike", "Team Rage-Quitters", "The Noob Herders", "Respawn Rangers"] },
  { id: "lanParty", profile: "gamer", audience: [30, 120], ad: "stage", names: ["LAN of the Free", "Byte-Night Fever", "Ctrl-Alt-Defeat LAN"] },
  { id: "fanSite", profile: "private", audience: [300, 3000], ad: "banner", names: ["Fellowship of the Ping", "Star Treck Fans United", "Harry Pottery Forum"] },
  { id: "student", profile: "hobbyDev", audience: [20, 150], ad: "signature", names: ["Capstone Crashers", "Group 7 Segfaults", "Thesis and Prayers"] },
  { id: "mirror", profile: "hobbyDev", audience: [200, 2000], ad: "signature", names: ["Open Sauce Mirror", "Ubuntwo Mirror Club", "FreeBSDeal Mirror"] },
];

// A monthly batch of leads grows with the audience.
export const boardLeads = (audience: number): number => Math.min(4, Math.max(1, Math.round(audience / 250)));

export interface SponsorOffer {
  id: string; postedAt: number; product: Product; size: number; months: number; slots: number; free: boolean;
  // Hours the applications arrive at, how many arrived and how many were accepted.
  applyAt: number[]; sent: number; taken: number;
}

export const pendingOf = (s: GameState, o: Pick<SponsorOffer, "id">) => s.sponsorships.filter((x) => x.board?.offerId === o.id && x.status === "offered");
export const offerOpen = (s: GameState, o: SponsorOffer): boolean => o.taken < o.slots && (o.sent < o.applyAt.length || pendingOf(s, o).length > 0);
export const boardGranted = (s: GameState): number => s.sponsorships.reduce((n, x) => n + (x.board?.granted ?? 0), 0);

const patchOffer = (s: GameState, id: string, f: (o: SponsorOffer) => Partial<SponsorOffer>) => {
  s.sponsorOffers = s.sponsorOffers.map((o) => (o.id === id ? { ...o, ...f(o) } : o));
};

export const validOffer = (o: Pick<SponsorOffer, "product" | "size" | "months" | "slots">): boolean =>
  BOARD_PRODUCTS.includes(o.product) && Number.isInteger(o.size) && o.size >= 0 && o.size < SIZES[o.product].length
  && (BOARD_MONTHS as readonly number[]).includes(o.months) && (BOARD_SLOTS as readonly number[]).includes(o.slots);

// Draws when each application arrives.
export function newOffer(s: GameState, o: Pick<SponsorOffer, "product" | "size" | "months" | "slots" | "free">): SponsorOffer {
  const id = `ofr${s.nextId++}`, r = hashRng(s.seed, Number(id.slice(3)), 23), [lo, hi] = BOARD.applyDays;
  const applyAt = Array.from({ length: o.slots + BOARD.extra }, () => s.hour + Math.round((lo + rand(r) * (hi - lo)) * 24)).sort((a, b) => a - b);
  return { ...o, id, postedAt: s.hour, applyAt, sent: 0, taken: 0 };
}

// One applicant: who, how big, how it advertises, and the two risks, all fixed by the seed.
function apply(s: GameState, o: SponsorOffer, events: SimEvent[]): void {
  // Each name is one person, so nobody applies twice while an application or sponsorship of theirs is live.
  const busy = new Set(s.sponsorships.filter((x) => x.board && (x.status === "offered" || x.status === "running")).map((x) => x.board!.name));
  const free = APPLICANTS.flatMap((a) => a.names.filter((n) => !busy.has(n)).map((name) => ({ a, name })));
  if (!free.length) return void patchOffer(s, o.id, (x) => ({ sent: x.sent + 1 }));
  const r = hashRng(s.seed, Number(o.id.slice(3)), 24, o.sent), { a, name } = free[Math.floor(rand(r) * free.length)];
  const audience = Math.round((a.audience[0] + rand(r) * (a.audience[1] - a.audience[0])) / 10) * 10 || 10;
  const board: BoardInfo = {
    offerId: o.id, kind: a.id, name, audience, profile: a.profile, ad: a.ad, product: o.product, size: o.size, hours: o.months * MONTH, free: o.free,
    leads: boardLeads(audience), abuser: rand(r) < BOARD.abuse, drops: rand(r) < BOARD.drop, dropped: false, granted: 0,
  };
  const ticket: Ticket = {
    id: `tkt${s.nextId++}`, customerId: "", serviceId: null, kind: "sponsor", topic: `board.${a.id}`, status: "open",
    createdAt: s.hour, dueAt: s.hour + OFFER_HOURS, updatedAt: s.hour, unread: true, replies: [], outcome: null, work: null, assignee: null,
  };
  s.tickets = [...s.tickets, ticket];
  s.sponsorships = [...s.sponsorships, {
    id: `spn${s.nextId++}`, event: `board.${a.id}`, ticketId: ticket.id, offeredAt: s.hour, status: "offered", customerId: null, serviceIds: [],
    startedAt: 0, endsAt: 0, endedAt: null, down: {}, seen: {}, reward: null, board,
  }];
  patchOffer(s, o.id, (x) => ({ sent: x.sent + 1 }));
  events.push({ app: "Support", key: "event.boardApplication", params: { event: name } });
}

// An accepted application takes a slot; the rest of the applications for a full offer are closed.
export function takeSlot(s: GameState, offerId: string): void {
  patchOffer(s, offerId, (o) => ({ taken: o.taken + 1 }));
  const o = s.sponsorOffers.find((x) => x.id === offerId)!;
  if (o.taken >= o.slots) closeApplications(s, o);
}

export function closeApplications(s: GameState, o: Pick<SponsorOffer, "id">): void {
  const rest = pendingOf(s, o);
  for (const sp of rest) patchSponsorship(s, sp.id, () => ({ status: "declined" }));
  const ids = new Set(rest.map((x) => x.ticketId));
  s.tickets = s.tickets.map((t) => (ids.has(t.id) && !isFinal(t) ? { ...t, status: "closed", outcome: "ignored", updatedAt: s.hour, unread: false, work: null } : t));
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

// Every month a sponsorship has run adds awareness within the cap; a dropper takes the banner down after the first one.
function monthly(s: GameState, events: SimEvent[]): void {
  for (const sp of s.sponsorships.filter((x) => x.board && x.status === "running")) {
    const b = sp.board!, age = s.hour - sp.startedAt;
    if (age <= 0 || age % MONTH !== 0 || s.hour > sp.endsAt || b.dropped) continue;
    const gain = round6(Math.max(0, Math.min(BOARD.awareness, BOARD.cap - boardGranted(s))));
    if (gain > 0) addAwareness(s, b.profile, gain);
    const dropped = b.drops && age === MONTH;
    patchSponsorship(s, sp.id, () => ({ board: { ...b, granted: round6(b.granted + gain), dropped } }));
    if (dropped) events.push({ app: "Marketing", key: "event.boardDropped", params: { event: b.name } });
  }
}

// Hourly: applications arrive for each open offer, then the month's awareness is paid.
export function boardTick(s: GameState, events: SimEvent[]): void {
  for (const { id } of s.sponsorOffers) {
    const get = () => s.sponsorOffers.find((x) => x.id === id)!;
    while (get().sent < get().applyAt.length && get().taken < get().slots && s.hour >= get().applyAt[get().sent]) apply(s, get(), events);
  }
  monthly(s, events);
}
