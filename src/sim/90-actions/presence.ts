// Whose hands do hands-on work (docs/design/gdd/the-world.md, Simulation pieces): the player's on site, the datacenter's remote hands
// from afar, nobody's in the basement while the player is away.
import { datacenterById } from "../20-world/datacenters";
// A cycle with hardware.ts, which calls viaHands; neither uses the other while loading.
import type { GameState } from "../50-state";
import { present, type How } from "../60-infra/handwork";
import {
  connect, disconnect, installPart, mountDevice, mountStack, moveInRack, removePart, replaceComponent, setPlugged, unmountDevice, type ActionResult,
} from "./hardware";

export type Hands = "own" | "remote" | "none";

export function hands(s: GameState, locationId: string): Hands {
  if (present(s, locationId)) return "own";
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

// Applies the presence rule to a hands-on action. Returns the way to do the work now, or the result: a refusal or a queued job.
// A technician, a friend and a running job pass through.
export function viaHands(s: GameState, action: HandsAction, args: unknown[], locationId: string, how: How | boolean): How | boolean | ActionResult {
  if (how === true || how === "tech" || how === "friend" || how === "job") return how;
  const h = hands(s, locationId);
  if (h === "own") return "self";
  if (h === "none" || how === "self") return { ok: false, error: "error.notThere" };
  // ponytail: validates on a full copy of the game; a per-action check function if this gets slow.
  const trial = run(structuredClone(s), action, args);
  if (!trial.ok) return trial;
  const q = jobQuote(s, locationId, jobKind(action))!;
  if (s.cash < q.fee) return { ok: false, error: "error.noCash" };
  const id = `hj${s.nextId++}`, first = args[0];
  // The unit the job is about: a cable's first end, the first unit of a stack.
  const deviceId = action === "mountStack" ? trial.id! : typeof first === "object" ? (first as { device: string }).device : String(first);
  // A JSON round trip so the job saves as it loads.
  s.handsJobs.push({ id, action, args: JSON.parse(JSON.stringify(args)) as unknown[], locationId, deviceId, dueAt: s.hour + q.wait, fee: q.fee });
  return { ok: true, id };
}

export function cancelHandsJob(s: GameState, jobId: string): ActionResult {
  if (!s.handsJobs.some((j) => j.id === jobId)) return { ok: false, error: "error.unknownOperation" };
  s.handsJobs = s.handsJobs.filter((j) => j.id !== jobId);
  return { ok: true };
}

// Runs the jobs that are due and bills the ones that got done.
export function handsJobsTick(s: GameState) {
  const due = s.handsJobs.filter((j) => j.dueAt <= s.hour);
  if (!due.length) return;
  s.handsJobs = s.handsJobs.filter((j) => j.dueAt > s.hour);
  for (const j of due) {
    if (!run(s, j.action as HandsAction, j.args).ok) continue;
    const d = s.devices.find((x) => x.id === j.deviceId), dc = s.locations.find((l) => l.id === j.locationId)?.dc ?? "";
    s.cash = Math.round((s.cash - j.fee) * 100) / 100;
    s.ledger.push({ hour: s.hour, category: "maintenance", key: "ledger.remoteHands", params: { device: d?.label ?? d?.name ?? "", hours: JOB_HOURS[jobKind(j.action as HandsAction)], dc, done: s.hour }, amount: -j.fee });
  }
}
