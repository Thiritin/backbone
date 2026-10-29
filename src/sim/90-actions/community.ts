// Answers to a sponsoring request in the inbox (80-business/sponsoring.ts raises them).
import { yearOf } from "../00-core/time";
import { sizeSpec } from "../10-catalog/products";
import { eventById, sponsorshipOf, type CommunityEvent, type Sponsorship } from "../80-business/community";
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
  return { sp, ev: eventById(sp.event)! };
}

const settle = (s: GameState, id: string, outcome: "sponsored" | "sponsorDeclined") => {
  s.tickets = s.tickets.map((t) => (t.id === id ? { ...t, status: "closed", outcome, updatedAt: s.hour, unread: false, work: null } : t));
};

// Provisions the event's services at EUR 0 through the normal placement; nothing is kept when one of them finds no room.
export function acceptSponsorship(s: GameState, ticketId: string): ActionResult {
  const o = open(s, ticketId);
  if ("ok" in o) return o;
  const { sp, ev } = o;
  const before = { customers: [...s.customers], services: [...s.services], workloads: [...s.workloads], nextId: s.nextId };
  const customerId = addCustomer(s, ev.name, ev.audience[0], "friend");
  const serviceIds: string[] = [];
  for (let i = 0; i < ev.count; i++) {
    const r = provisionService(s, customerId, ev.product, { label: ev.name, price: 0, spec: sizeSpec(ev.product, ev.size, yearOf(s.hour)) });
    if (!r.ok) {
      Object.assign(s, before);
      return r;
    }
    serviceIds.push(r.id!);
  }
  s.customers = s.customers.map((c) => (c.id === customerId ? { ...c, churnedAt: s.hour, sponsor: true } : c));
  s.sponsorships = s.sponsorships.map((x) => (x.id === sp.id ? { ...x, status: "running", customerId, serviceIds, startedAt: s.hour, endsAt: s.hour + ev.hours } : x));
  settle(s, ticketId, "sponsored");
  return { ok: true, id: sp.id };
}

// Closes the request without any penalty.
export function declineSponsorship(s: GameState, ticketId: string): ActionResult {
  const o = open(s, ticketId);
  if ("ok" in o) return o;
  s.sponsorships = s.sponsorships.map((x) => (x.id === o.sp.id ? { ...x, status: "declined" } : x));
  settle(s, ticketId, "sponsorDeclined");
  return { ok: true, id: o.sp.id };
}
