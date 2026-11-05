// Whose hands do hands-on work (docs/design/gdd/the-world.md, Simulation pieces): the player's on site, the datacenter's remote hands
// from afar, nobody's in the basement while the player is away.
import { canPay } from "../46-finance/payables";
import { datacenterById } from "../20-world/datacenters";
// A cycle with hardware.ts, which calls viaHands; neither uses the other while loading.
import type { GameState, WorkOrder } from "../50-state";
import { ORDERS } from "../20-world/properties";
import { shiftTechs } from "../60-infra/properties";
import { playerAt, present, type How } from "../60-infra/handwork";
import {
  connect, disconnect, installPart, mountDevice, mountStack, moveInRack, removePart, replaceComponent, setPlugged, unmountDevice, type ActionResult,
} from "./hardware";
import { opensOf, orderWork, cancelWorkOrder, workMinutes } from "./work-orders";
import { travelTo } from "./travel";
import { busyAction } from "./busy";

export type Hands = "own" | "remote" | "none";

export function hands(s: GameState, locationId: string): Hands {
  if (present(s, locationId)) return "own";
  if (s.properties.some((p) => p.hall?.locationId === locationId)) return shiftTechs(s, locationId).length ? "remote" : "none";
  return s.locations.find((l) => l.id === locationId)?.dc ? "remote" : "none";
}

// The hands-on actions and the job kind each is billed as.
const JOBS = {
  mountDevice: [mountDevice, "mount"], mountStack: [mountStack, "mount"], unmountDevice: [unmountDevice, "mount"], moveInRack: [moveInRack, "mount"],
  installPart: [installPart, "parts"], removePart: [removePart, "parts"], replaceComponent: [replaceComponent, "parts"],
  connect: [connect, "cable"], disconnect: [disconnect, "cable"], setPlugged: [setPlugged, "cable"],
} as const;
export type HandsAction = keyof typeof JOBS;
export type JobKind = (typeof JOBS)[HandsAction][1];
// Billed hours of a remote hands job.
export const JOB_HOURS: Record<JobKind, number> = { mount: 0.5, cable: 0.25, parts: 1 };

export const jobKind = (action: HandsAction): JobKind => JOBS[action][1];

// The fee and the hours until done of a remote hands job at a location.
export function jobQuote(s: GameState, locationId: string, kind: JobKind): { fee: number; wait: number } | null {
  const dc = s.locations.find((l) => l.id === locationId)?.dc;
  if (!dc) return null;
  const rh = datacenterById(dc).remoteHands;
  return { fee: Math.round(JOB_HOURS[kind] * rh.perHour * 100) / 100, wait: rh.responseHours + JOB_HOURS[kind] };
}

// "job" runs a queued job: own hands at once.
const run = (s: GameState, action: HandsAction, args: unknown[]): ActionResult =>
  (JOBS[action][0] as (g: GameState, ...a: unknown[]) => ActionResult)(s, ...args, "job");
export const runHands = run;

// The rack a job is worked at: the device's, or the rack an argument names.
function jobRack(s: GameState, deviceId: string, args: unknown[]): string | undefined {
  const d = s.devices.find((x) => x.id === deviceId);
  return d?.rackId ?? args.find((a): a is string => typeof a === "string" && s.racks.some((r) => r.id === a));
}

// The hall technician with the fewest open orders, on shift first; null when every one has a full queue.
export function hallDoer(s: GameState, locationId: string): string | null {
  const techs = s.staff.filter((e) => e.role === "technician" && e.location === locationId);
  const shift = new Set(shiftTechs(s, locationId).map((e) => e.id));
  return [...techs].sort((a, b) => Number(shift.has(b.id)) - Number(shift.has(a.id)) || opensOf(s, a.id).length - opensOf(s, b.id).length)
    .find((e) => opensOf(s, e.id).length < ORDERS.max)?.id ?? null;
}

// Applies the presence rule to a hands-on action. Returns the way to do the work now, or the result: a refusal or a queued order.
// A technician, a friend and a running job pass through. The player's own work, the hall technicians' and the provider's are work orders.
export function viaHands(s: GameState, action: HandsAction, args: unknown[], locationId: string, how: How | boolean): How | boolean | ActionResult {
  if (how === true || how === "tech" || how === "friend" || how === "job") return how;
  const h = hands(s, locationId), self = how === "self" || h === "own";
  const hall = s.properties.some((p) => p.hall?.locationId === locationId);
  if (h === "none" && !self) return { ok: false, error: "error.notThere" };
  const busy = busyAction(s, action, args);
  if (busy) return { ok: false, error: busy };
  // ponytail: validates on a full copy of the game; a per-action check function if this gets slow.
  const trial = run(structuredClone(s), action, args);
  if (!trial.ok) return trial;
  const kind = jobKind(action), first = args[0];
  // The unit the order is about: a cable's first end, the first unit of a stack.
  const deviceId = action === "mountStack" ? trial.id! : typeof first === "object" ? (first as { device: string }).device : String(first);
  const target = { rackId: jobRack(s, deviceId, args) }, act = { name: action, args: JSON.parse(JSON.stringify(args)) as unknown[] };
  const model = s.devices.find((d) => d.id === deviceId)?.model;
  const units = action === "mountStack" ? Number(args[3]) || 1 : 1;
  if (!self && hall) {
    const doer = hallDoer(s, locationId);
    if (!doer) return { ok: false, error: "error.queueFull" };
    return orderWork(s, doer, locationId, target, act, { kind, workMin: workMinutes(s, doer, kind, units, model), deviceId });
  }
  if (!self) {
    const q = jobQuote(s, locationId, kind)!;
    if (!canPay(s, q.fee)) return { ok: false, error: "error.noCash" };
    return orderWork(s, "provider", locationId, target, act, { kind, workMin: JOB_HOURS[kind] * 60, waitMin: (q.wait - JOB_HOURS[kind]) * 60, fee: q.fee, deviceId });
  }
  if (opensOf(s, "player").length >= ORDERS.max) return { ok: false, error: "error.queueFull" };
  if (playerAt(s).id !== locationId) {
    const drove = travelTo(s, locationId);
    if (!drove.ok) return drove;
  }
  const arrive = s.player.doing === "travel" && s.player.until > s.hour ? s.player.until * 60 - (s.hour * 60 + s.minute) : 0;
  return orderWork(s, "player", locationId, target, act, { kind, workMin: workMinutes(s, "player", kind, units, model), waitMin: arrive, deviceId });
}

// What the Locations app lists as queued hand jobs: the provider's and the player's own, as hours and euros.
export interface HandsJobView { id: string; action: string; args: unknown[]; locationId: string; deviceId: string; dueAt: number; fee: number; self?: true }
export const handsJobs = (s: GameState): HandsJobView[] =>
  s.orders.filter((o): o is WorkOrder & { action: NonNullable<WorkOrder["action"]> } => !o.applied && !!o.action && (o.worker === "provider" || o.worker === "player") && !!o.deviceId)
    .map((o) => ({ id: o.id, action: o.action.name, args: o.action.args, locationId: o.locationId, deviceId: o.deviceId!,
      dueAt: ((o.startAt ?? o.queuedAt) + o.walkMin + o.workMin) / 60, fee: o.fee ?? 0, ...(o.worker === "player" && { self: true as const }) }));

export const cancelHandsJob = cancelWorkOrder;
