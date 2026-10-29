// Answers to a sponsoring request in the inbox (80-business/sponsoring.ts raises them).
import { yearOf } from "../00-core/time";
import { sizeSpec } from "../10-catalog/products";
import { eventOf, sponsorshipOf, type CommunityEvent, type Sponsorship } from "../80-business/community";
import { BOARD, closeApplications, newOffer, offerOpen, takeSlot, validOffer, type SponsorOffer } from "../80-business/sponsorboard";
import { isFinal } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { addCustomer } from "./customers";
import { provisionService } from "./clusters";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

function open(s: GameState, ticketId: string): ActionResult | { sp: Sponsorship; ev: CommunityEvent } {
  const t = s.tickets.find((x) => x.id === ticketId && x.kind === "sponsor"), sp = t && sponsorshipOf(s, t);
  if (!t || !sp) return fail("error.unknownTicket");
  if (isFinal(t) || sp.status !== "offered") return fail("error.ticketDone");
  return { sp, ev: eventOf(sp) };
}

const settle = (s: GameState, id: string, outcome: "sponsored" | "sponsorDeclined") => {
  s.tickets = s.tickets.map((t) => (t.id === id ? { ...t, status: "closed", outcome, updatedAt: s.hour, unread: false, work: null } : t));
};

// Provisions the event's services through the normal placement, at EUR 0 or at half the list price for a board application;
// nothing is kept when one of them finds no room.
export function acceptSponsorship(s: GameState, ticketId: string): ActionResult {
  const o = open(s, ticketId);
  if ("ok" in o) return o;
  const { sp, ev } = o, b = sp.board, paid = !!b && !b.free;
  const offer = b && s.sponsorOffers.find((x) => x.id === b.offerId);
  if (offer && offer.taken >= offer.slots) return fail("error.offerFull");
  const before = { customers: [...s.customers], services: [...s.services], workloads: [...s.workloads], nextId: s.nextId };
  const customerId = addCustomer(s, ev.name, ev.audience[0], paid ? "prompt" : "friend");
  const serviceIds: string[] = [];
  for (let i = 0; i < ev.count; i++) {
    const r = provisionService(s, customerId, ev.product, { label: ev.name, price: paid ? undefined : 0, spec: sizeSpec(ev.product, ev.size, yearOf(s.hour)) });
    if (!r.ok) {
      Object.assign(s, before);
      return r;
    }
    serviceIds.push(r.id!);
  }
  if (paid) s.services = s.services.map((v) => (serviceIds.includes(v.id) ? { ...v, price: v.price / 2 } : v));
  s.customers = s.customers.map((c) => (c.id === customerId ? { ...c, ...(!paid && { churnedAt: s.hour, sponsor: true as const }), ...(b?.abuser && { shady: true }) } : c));
  s.sponsorships = s.sponsorships.map((x) => (x.id === sp.id ? { ...x, status: "running", customerId, serviceIds, startedAt: s.hour, endsAt: s.hour + ev.hours } : x));
  settle(s, ticketId, "sponsored");
  if (b) takeSlot(s, b.offerId);
  return { ok: true, id: sp.id };
}

// Posts an offer on the Sponsor-Bored board; applications arrive over the next days.
export function postOffer(s: GameState, offer: Pick<SponsorOffer, "product" | "size" | "months" | "slots" | "free">): ActionResult {
  if (!validOffer(offer)) return fail("error.badOffer");
  if (s.sponsorOffers.filter((o) => offerOpen(s, o)).length >= BOARD.maxOpen) return fail("error.offersOpen");
  const o = newOffer(s, offer);
  s.sponsorOffers = [...s.sponsorOffers, o];
  return { ok: true, id: o.id };
}

// Stops further applications and closes the pending ones; running sponsorships carry on.
export function withdrawOffer(s: GameState, offerId: string): ActionResult {
  const o = s.sponsorOffers.find((x) => x.id === offerId);
  if (!o || !offerOpen(s, o)) return fail("error.unknownOffer");
  s.sponsorOffers = s.sponsorOffers.map((x) => (x.id === offerId ? { ...x, applyAt: x.applyAt.slice(0, x.sent) } : x));
  closeApplications(s, o);
  return { ok: true, id: offerId };
}

// Closes the request without any penalty.
export function declineSponsorship(s: GameState, ticketId: string): ActionResult {
  const o = open(s, ticketId);
  if ("ok" in o) return o;
  s.sponsorships = s.sponsorships.map((x) => (x.id === o.sp.id ? { ...x, status: "declined" } : x));
  settle(s, ticketId, "sponsorDeclined");
  return { ok: true, id: o.sp.id };
}
