// GDD, Support, Migration offers: the player asks a customer to agree to a move; the customer answers, the move runs in the
// customer's window.
import { MOVE_WINDOW, moveWindowStart, segmentOf } from "../10-catalog/attention";
import { dateOf } from "../00-core/time";
import type { Customer, Service } from "../30-customers/customers";
import { bump, createTicket, type Move, type Ticket } from "../40-support/tickets";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { clusterOf } from "../60-infra/cluster";
import type { ActionResult } from "./hardware";
import { migrateWebspace, migrateWorkload, migrationTargets, webspaceTargets } from "./vms";

const fail = (error: string): ActionResult => ({ ok: false, error });

// A customer below this happiness turns an offer down.
export const DECLINE_BELOW = 40;
// Happiness a customer gains from a move out of the basement into a datacenter.
export const BASEMENT_BONUS = 5;
// Happiness a customer loses when the accepted move did not run within this many hours of its window.
export const MISSED_PENALTY = 10;
export const MISSED_AFTER_HOURS = 48;

// The workload a service runs on and the hosts it can move to.
const workloadOf = (s: GameState, serviceId: string) => s.workloads.find((w) => w.serviceId === serviceId && w.clusterId);
export interface MoveTarget { to: string; name: string; clusterId: string }
export function moveTargets(s: GameState, workloadId: string): MoveTarget[] {
  const w = s.workloads.find((x) => x.id === workloadId), c = w && s.clusters.find((x) => x.id === w.clusterId);
  if (!w || !c) return [];
  return c.kind === "panel"
    ? webspaceTargets(s, w.id).map((t) => ({ to: t.clusterId, name: t.name, clusterId: t.clusterId }))
    : migrationTargets(s, w.id).map((t) => ({ to: t.to, name: t.name, clusterId: t.clusterId }));
}

// The customer agrees to the move: it runs from its window on (movesTick).
function accept(s: GameState, t: Ticket, c: Customer, v: Service): void {
  const m = t.move!, segment = segmentOf(c.profile, v.product), d = dateOf((m.windowAt = moveWindowStart(segment, s.hour)));
  m.log = [...m.log, { hour: s.hour, key: segment === "private" ? "ticket.migration.acceptAny.text" : "ticket.migration.accept.text", params: { day: d.getUTCDay(), from: d.getUTCHours(), to: MOVE_WINDOW[segment]?.to ?? 0 } }];
}

// Sends the customer a ticket asking to move a service to a host (a migration target's id, or the panel host's id for a web space).
// An agreed move (a retention offer the customer took) needs no answer.
export function offerMigration(s: GameState, serviceId: string, to: string, agreed = false): ActionResult {
  const v = s.services.find((x) => x.id === serviceId && x.endedAt === null), c = v && s.customers.find((x) => x.id === v.customerId && x.churnedAt === null);
  const w = v && workloadOf(s, v.id);
  if (!v || !c || !w) return fail("error.unknownService");
  const target = moveTargets(s, w.id).find((x) => x.to === to);
  if (!target) return fail("error.moveTarget");
  if (s.tickets.some((t) => t.kind === "migration" && t.serviceId === v.id && t.status === "waiting")) return fail("error.moveOffered");
  const t = createTicket(s, c, "migration", v.id, "offer");
  t.status = "waiting";
  t.unread = false;
  t.move = { workloadId: w.id, to, name: target.name, windowAt: null, log: [], from: w.clusterId ?? undefined };
  if (agreed) accept(s, t, c, v);
  return { ok: true, id: t.id };
}

// Offers every service on a host the move to the host `to`; hostId is a node's device id or a panel host's cluster id.
export function announceMigration(s: GameState, hostId: string, to: string): ActionResult {
  const services = s.workloads.filter((w) => w.serviceId && (w.deviceId === hostId || w.clusterId === hostId)).map((w) => w.serviceId!);
  let sent = 0, error = "error.moveTarget";
  for (const id of services) {
    const r = offerMigration(s, id, to);
    if (r.ok) sent++;
    else if (r.error !== "error.moveTarget" && r.error !== "error.moveOffered") error = r.error!;
  }
  return sent ? { ok: true, id: String(sent) } : fail(error);
}

// A move from the basement into a datacenter is a better place for the service.
const toDatacenter = (s: GameState, m: Move): boolean => {
  const w = s.workloads.find((x) => x.id === m.workloadId), from = s.clusters.find((c) => c.id === (m.from ?? w?.clusterId));
  const target = s.clusters.find((c) => c.id === m.to) ?? clusterOf(s, m.to);
  const loc = (az?: string) => s.locations.find((l) => l.az === az);
  return !!from && !!target && !loc(from.az)?.dc && !!loc(target.az)?.dc;
};

// The player moved the service to the target, or started the move to it.
const movedByPlayer = (s: GameState, m: Move): boolean => {
  const w = s.workloads.find((x) => x.id === m.workloadId);
  return !!w && (w.deviceId === m.to || w.clusterId === m.to || w.migrating?.clusterId === m.to);
};

const run = (s: GameState, m: Move): ActionResult => {
  const w = s.workloads.find((x) => x.id === m.workloadId), c = w && s.clusters.find((x) => x.id === w.clusterId);
  if (!w || !c) return fail("error.unknownWorkload");
  return c.kind === "panel" ? migrateWebspace(s, w.id, m.to, true) : migrateWorkload(s, w.id, m.to, true);
};

// The move did not happen: the customer loses happiness and the ticket reopens.
function missed(s: GameState, t: Ticket, c: Customer, v: Service, note: (key: string) => void, events: SimEvent[]): void {
  bump(c, -MISSED_PENALTY);
  note("ticket.migration.missed.text");
  Object.assign(t, { status: "open", updatedAt: s.hour, unread: true });
  events.push({ app: "Support", key: "event.moveMissed", params: { name: c.name, service: v.label } });
}

// Hourly, before customers react to downtime: customers answer offers once their reply time is up. A customer who accepted
// with no particular time (private) has the move run at once; one with a window (players, businesses) waits for the player to
// move the service inside it. Tickets and customers are the tick's copies.
export function movesTick(s: GameState, customer: (id: string) => Customer): SimEvent[] {
  const events: SimEvent[] = [];
  for (const t of s.tickets) {
    const m = t.move;
    if (t.kind !== "migration" || !m || t.status !== "waiting") continue;
    const c = customer(t.customerId), v = s.services.find((x) => x.id === t.serviceId);
    if (c.churnedAt !== null || !v || v.endedAt !== null) {
      Object.assign(t, { status: "closed", updatedAt: s.hour });
      continue;
    }
    const note = (key: string, params: Record<string, number> = {}) => { m.log = [...m.log, { hour: s.hour, key, params }]; };
    if (m.windowAt === null) {
      if (s.hour < t.dueAt) continue;
      if (c.happiness < DECLINE_BELOW) {
        note("ticket.migration.decline.text");
        Object.assign(t, { status: "resolved", outcome: "moveDeclined", updatedAt: s.hour, unread: true });
        events.push({ app: "Support", key: "event.moveDeclined", params: { name: c.name, service: v.label } });
        continue;
      }
      accept(s, t, c, v);
      Object.assign(t, { updatedAt: s.hour, unread: true });
      events.push({ app: "Support", key: "event.moveAccepted", params: { name: c.name, service: v.label } });
    }
    if (m.windowAt === null || s.hour < m.windowAt) continue;
    const window = MOVE_WINDOW[segmentOf(c.profile, v.product)];
    if (window) {
      // The customer wants it done in their window: the player moves the service, in time or not.
      if (s.hour === m.windowAt) events.push({ app: "Support", key: "event.moveWindow", params: { name: c.name, service: v.label, to: window.to } });
      if (movedByPlayer(s, m)) {
        if (toDatacenter(s, m)) bump(c, BASEMENT_BONUS);
        Object.assign(t, { status: "resolved", outcome: "moved", updatedAt: s.hour, unread: true });
        events.push({ app: "Support", key: "event.moveDone", params: { name: c.name, service: v.label, target: m.name } });
      } else if (s.hour >= m.windowAt + window.to - window.from) missed(s, t, c, v, note, events);
      continue;
    }
    const bonus = toDatacenter(s, m);
    if (run(s, m).ok) {
      if (bonus) bump(c, BASEMENT_BONUS);
      Object.assign(t, { status: "resolved", outcome: "moved", updatedAt: s.hour, unread: true });
      events.push({ app: "Support", key: "event.moveDone", params: { name: c.name, service: v.label, target: m.name } });
    } else if (s.hour >= m.windowAt + MISSED_AFTER_HOURS) missed(s, t, c, v, note, events);
  }
  return events;
}
