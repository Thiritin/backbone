// Work orders (docs/design/gdd/the-world.md, Work orders and figures): the player, technicians, NOC staff, the provider's remote hands and
// customers' remote hands all do timed work through one saved queue. An order runs its action at the minute it is done.
import { t } from "../../i18n/en";
import { workFactor } from "../10-catalog/lifecycle";
import { hashRng, rand } from "../00-core/rng";
import { cents } from "../45-billing/billing";
import { entryTile, officePlan, rackTiles, seatsAt, type Facing, type Pt, type Tile } from "../20-world/layout";
import { HALL, ORDERS, WALK } from "../20-world/properties";
import type { GameState, OrderKind, WorkOrder } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { present } from "../60-infra/handwork";
import type { ActionResult } from "./hardware";
import { JOB_HOURS, jobKind, runHands, type HandsAction } from "./presence";

const fail = (error: string): ActionResult => ({ ok: false, error });

export const nowMin = (s: GameState): number => s.hour * 60 + s.minute;
export const arriveAt = (o: WorkOrder): number => (o.startAt ?? 0) + o.walkMin;
export const doneAt = (o: WorkOrder): number => arriveAt(o) + o.workMin;

const STEP: Record<Facing, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const OPPOSITE: Record<Facing, Facing> = { n: "s", s: "n", e: "w", w: "e" };

// The floor tile in front of a rack, looking at it.
export function frontOf(tile: Tile): Tile {
  const [dx, dy] = STEP[tile.facing];
  return { x: tile.x + dx, y: tile.y + dy, facing: OPPOSITE[tile.facing], ...(tile.floor !== undefined && { floor: tile.floor }) };
}

// Where an order is worked: the front of its rack or tile.
export function targetFront(s: GameState, o: Pick<WorkOrder, "locationId" | "target">): Pt | null {
  const loc = s.locations.find((l) => l.id === o.locationId);
  if (!loc) return null;
  const tile = o.target.tile ?? (o.target.rackId ? rackTiles(loc, s.racks, officePlan(s, loc))[o.target.rackId] : undefined);
  return tile ? frontOf(tile) : null;
}

// The seat a worker leaves from: the player's is the first seat no hire claims, an employee's their desk's, else the first seat or the entry.
export function seatOf(s: GameState, locationId: string, worker: string): Pt | null {
  const loc = s.locations.find((l) => l.id === locationId);
  if (!loc) return null;
  const seats = seatsAt(s, loc), e = s.staff.find((x) => x.id === worker);
  const mine = e?.desk && seats.find((q) => q.sectionId === e.desk!.sectionId && q.index === e.desk!.index);
  if (mine) return mine;
  if (e) return seats[0] ?? entryTile(loc, officePlan(s, loc));
  // The player takes the first seat no hire has claimed, else stands at the entry.
  const claimed = new Set(s.staff.filter((x) => x.desk).map((x) => `${x.desk!.sectionId}#${x.desk!.index}`));
  return seats.find((q) => !claimed.has(`${q.sectionId}#${q.index}`)) ?? entryTile(loc, officePlan(s, loc));
}

const manhattan = (a: Pt, b: Pt): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export const opensOf = (s: GameState, worker: string): WorkOrder[] => s.orders.filter((o) => o.worker === worker && !o.applied);

// Work minutes of a job kind for a worker: the player and the provider take JOB_HOURS, staff 1.5 minus skill over 100 times that.
export const workMinutes = (s: GameState, worker: string, kind: "mount" | "cable" | "parts", units = 1, modelId?: string): number => {
  const e = s.staff.find((x) => x.id === worker);
  // Parts work on a device out of support takes longer.
  const old = modelId && kind === "parts" ? workFactor(modelId, s.hour) : 1;
  return Math.round(JOB_HOURS[kind] * 60 * units * old * (e ? 1.5 - e.skill / 100 : 1));
};

// Chains a worker's orders first in, first out: each starts at the later of its queue time and the end of the one before. Started orders stay.
// The provider's orders run alongside each other at the start they were given.
function reschedule(s: GameState, worker: string): void {
  if (worker === "provider") return;
  const now = nowMin(s);
  let end = 0;
  s.orders = s.orders.map((o) => {
    if (o.worker !== worker) return o;
    const started = o.startAt !== null && o.startAt <= now, next = started ? o : { ...o, startAt: Math.max(o.queuedAt, end, now) };
    end = doneAt(next);
    return next;
  });
}

export interface OrderOpts {
  kind: OrderKind; workMin: number;
  // Minutes before the order may start; the provider's response time, the player's drive.
  waitMin?: number; walk?: boolean;
  deviceId?: string; customerId?: string; fee?: number; what?: string;
}

// Queues an order for a worker; the sixth open order of a worker is refused.
export function orderWork(s: GameState, worker: string, locationId: string, target: WorkOrder["target"], action: WorkOrder["action"], o: OrderOpts): ActionResult {
  const provider = worker === "provider";
  if (!provider && opensOf(s, worker).length >= ORDERS.max) return fail("error.queueFull");
  const front = targetFront(s, { locationId, target }), seat = seatOf(s, locationId, worker);
  const walkMin = provider || o.walk === false || !front || !seat ? 0 : 1 + Math.floor(manhattan(seat, front) / WALK.tilesPerMin);
  const now = nowMin(s), queuedAt = now + (o.waitMin ?? 0), id = `ord${s.nextId++}`;
  const order: WorkOrder = {
    id, worker, locationId, target, kind: o.kind, action, queuedAt, startAt: provider ? queuedAt : null, walkMin, workMin: o.workMin,
    ...(o.deviceId && { deviceId: o.deviceId }), ...(o.customerId && { customerId: o.customerId }), ...(o.fee !== undefined && { fee: o.fee }), ...(o.what && { what: o.what }),
  };
  s.orders = [...s.orders, order];
  reschedule(s, worker);
  return { ok: true, id };
}

// Cancels an order that has not started, or aborts the running one with no effect; the rest of the worker's queue moves up.
// A customer's job cannot be aborted once started, and cancelling one counts against the customer like a declined job.
export function cancelWorkOrder(s: GameState, orderId: string): ActionResult {
  const o = s.orders.find((x) => x.id === orderId);
  if (!o || o.applied) return fail("error.unknownOperation");
  if (o.customerId) {
    if (o.startAt !== null && o.startAt <= nowMin(s)) return fail("error.jobStarted");
    bumpLeave(s, o.locationId, o.customerId);
  }
  s.orders = s.orders.filter((x) => x !== o);
  reschedule(s, o.worker);
  return { ok: true };
}

// A customer's job counts against the customer's leave chance up to the cap.
export function bumpLeave(s: GameState, locationId: string, customerId: string): void {
  const h = s.properties.find((p) => p.hall?.locationId === locationId)?.hall;
  if (!h) return;
  h.customers = h.customers.map((c) => (c.id === customerId ? { ...c, leaveBump: Math.min(HALL.hands.leaveCap, c.leaveBump + HALL.hands.leaveBump) } : c));
}

// Finishes an order: its action, then the fee the provider or a customer pays.
function finish(s: GameState, o: WorkOrder, events: SimEvent[]): void {
  const d = s.devices.find((x) => x.id === o.deviceId), device = d?.label ?? d?.name ?? "";
  const hours = o.action ? JOB_HOURS[jobKind(o.action.name as HandsAction)] : 0;
  if (o.customerId) {
    const e = s.staff.find((x) => x.id === o.worker), c = s.properties.find((p) => p.hall?.locationId === o.locationId)?.hall?.customers.find((x) => x.id === o.customerId);
    if (!e || !c) return;
    if (rand(hashRng(s.seed, doneAt(o), 77, Number(o.id.slice(3)))) < HALL.hands.fail * (1 - e.skill / 100)) {
      bumpLeave(s, o.locationId, c.id);
      events.push({ app: "Locations", key: "event.handsFailed", params: { customer: c.name, name: e.name } });
      return;
    }
    s.cash = cents(s.cash + (o.fee ?? 0));
    s.ledger = [...s.ledger, { hour: s.hour, category: "sales", key: "ledger.hallHands", params: { customer: c.name, kind: t(`orders.kind.${o.what ?? "hands"}`) }, amount: o.fee ?? 0 }];
    return;
  }
  if (!o.action) return;
  if (!runHands(s, o.action.name as HandsAction, o.action.args).ok) return;
  if (o.worker === "player") events.push({ app: "Locations", key: "event.workDone", params: { device } });
  if (o.worker !== "provider") return;
  const fee = o.fee ?? 0, dc = s.locations.find((l) => l.id === o.locationId)?.dc ?? "";
  s.cash = cents(s.cash - fee);
  s.ledger = [...s.ledger, { hour: s.hour, category: "maintenance", key: "ledger.remoteHands", params: { device, hours, dc, done: Math.floor(doneAt(o) / 60) }, amount: -fee }];
}

// Applies the orders that are done by the minute, and marks a customer's job late once it is overdue.
export function workOrdersTick(s: GameState, now: number = nowMin(s)): SimEvent[] {
  const events: SimEvent[] = [];
  // The player's own work waits until the player stands there.
  const due = s.orders.filter((o) => !o.applied && doneAt(o) <= now && (o.worker !== "player" || present(s, o.locationId))).sort((a, b) => doneAt(a) - doneAt(b));
  if (due.length) {
    s.orders = s.orders.map((o) => (due.includes(o) ? { ...o, applied: true as const } : o));
    for (const o of due) finish(s, o, events);
  }
  // A done order stays while its worker walks back.
  if (s.orders.some((o) => o.applied && doneAt(o) + o.walkMin <= now)) s.orders = s.orders.filter((o) => !(o.applied && doneAt(o) + o.walkMin <= now));
  if (s.orders.some((o) => o.customerId && !o.applied && !o.late && now >= o.queuedAt + HALL.hands.dueHours * 60)) {
    s.orders = s.orders.map((o) => {
      if (!o.customerId || o.applied || o.late || now < o.queuedAt + HALL.hands.dueHours * 60) return o;
      bumpLeave(s, o.locationId, o.customerId);
      return { ...o, late: true };
    });
  }
  return events;
}
