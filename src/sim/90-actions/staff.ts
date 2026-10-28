import { yearOf } from "../00-core/time";
import { cents } from "../45-billing/billing";
import {
  AD, adCandidates, COURSE_PRICE, FULL_DAY, fullyTrained, needsTraining, salaryUpToNow, staffPrice, startTraining, TASKS, trainerFor, visibleCandidates, WORK_HOURS,
  type AdTier, type Assignment, type Employee, type Role, type Task, type WorkHours,
} from "../47-staff/staff";
import { OP_TASK, queueOp, techsAt, type OpKind, type TechRules } from "../47-staff/technicians";
import type { GameState } from "../50-state";
import { clusterOf } from "../60-infra/cluster";
import { locationOf } from "../60-infra/status";
import { phpDue } from "./clusters";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
const YEAR = 8760;

const pay = (s: GameState, key: string, params: Record<string, string | number>, amount: number) => {
  s.cash = cents(s.cash - amount);
  s.ledger = [...s.ledger, { hour: s.hour, category: "salaries", key, params, amount: -amount }];
};

// The state is a clone, so the employee is replaced by a copy before it changes.
function employee(s: GameState, id: string): Employee | null {
  const i = s.staff.findIndex((e) => e.id === id);
  if (i < 0) return null;
  const e = { ...s.staff[i] };
  s.staff = s.staff.map((x, k) => (k === i ? e : x));
  return e;
}

export function postJobAd(s: GameState, role: Role, tier: AdTier): ActionResult {
  const price = staffPrice(AD[tier].price, yearOf(s.hour));
  if (s.cash < price) return fail("error.noCash");
  pay(s, "ledger.jobAd", { role }, price);
  s.candidates = [...s.candidates, ...adCandidates(s, role, tier)];
  return { ok: true };
}

export function hire(s: GameState, candidateId: string): ActionResult {
  const c = visibleCandidates(s).find((x) => x.id === candidateId);
  if (!c) return fail("error.unknownCandidate");
  const e: Employee = {
    id: `emp${s.nextId++}`, name: c.name, role: c.role, skill: c.skill, talent: c.talent, salary: c.salary, hiredAt: s.hour, assignment: "queue",
    location: c.role === "technician" ? s.locations[0]?.id ?? null : null,
    trained: [], plan: [], training: null, busyUntil: 0, raise: null, nextRaiseAt: s.hour + YEAR, refusedAt: null, hours: FULL_DAY, hoursFrom: s.hour,
  };
  s.candidates = s.candidates.filter((x) => x.id !== c.id);
  s.staff = [...s.staff, e];
  return { ok: true, id: e.id };
}

// A leaving employee is paid for the days worked this month.
export function fire(s: GameState, id: string): ActionResult {
  const e = s.staff.find((x) => x.id === id);
  if (!e) return fail("error.unknownEmployee");
  const owed = salaryUpToNow(s, e);
  if (owed > 0) pay(s, "ledger.salary", { name: e.name, role: e.role }, owed);
  s.staff = s.staff.filter((x) => x.id !== id);
  return { ok: true };
}

// New hours count from now: the salary owed at the old hours is paid out first, as when someone leaves.
export function setHours(s: GameState, id: string, hours: WorkHours): ActionResult {
  if (!WORK_HOURS.includes(hours)) return fail("error.workHours");
  const e = employee(s, id);
  if (!e) return fail("error.unknownEmployee");
  if (e.hours === hours) return { ok: true };
  const owed = salaryUpToNow(s, e);
  if (owed > 0) pay(s, "ledger.salary", { name: e.name, role: e.role }, owed);
  Object.assign(e, { hours, hoursFrom: s.hour });
  return { ok: true };
}

export function assign(s: GameState, id: string, assignment: Assignment): ActionResult {
  const e = employee(s, id);
  if (!e) return fail("error.unknownEmployee");
  if (assignment === "trainer") {
    if (!fullyTrained(e)) return fail("error.notFullyTrained");
    if (!s.staff.some((x) => x.id !== id && x.role === e.role && needsTraining(x))) return fail("error.nobodyToTrain");
  }
  e.assignment = assignment;
  return { ok: true };
}

// Replaces the training plan with the given task types the employee has not learned yet; the first course starts at once.
export function planTraining(s: GameState, id: string, tasks: Task[]): ActionResult {
  const e = employee(s, id);
  if (!e) return fail("error.unknownEmployee");
  if (tasks.some((k) => !TASKS[e.role].includes(k))) return fail("error.unknownTask");
  const plan = TASKS[e.role].filter((k) => tasks.includes(k) && !e.trained.includes(k) && e.training?.task !== k);
  if (!e.training && plan.length && !trainerFor(s, e) && s.cash < staffPrice(COURSE_PRICE, yearOf(s.hour))) return fail("error.noCash");
  e.plan = plan;
  startTraining(s, e);
  return { ok: true };
}

// Refusing makes the employee more likely to quit for six months.
export function answerRaise(s: GameState, id: string, accept: boolean): ActionResult {
  const e = employee(s, id);
  if (!e) return fail("error.unknownEmployee");
  if (!e.raise) return fail("error.noRaise");
  if (accept) e.salary = e.raise.ask;
  else e.refusedAt = s.hour;
  e.raise = null;
  return { ok: true };
}

export function setTechLocation(s: GameState, id: string, locationId: string): ActionResult {
  const e = employee(s, id);
  if (!e) return fail("error.unknownEmployee");
  if (e.role !== "technician") return fail("error.notTechnician");
  if (!s.locations.some((l) => l.id === locationId)) return fail("error.unknownLocation");
  e.location = locationId;
  return { ok: true };
}

// Adds a technician trained on part swaps to the on-call rotation at their location, or takes them out.
export function setOnCall(s: GameState, id: string, on: boolean): ActionResult {
  const e = employee(s, id);
  if (!e) return fail("error.unknownEmployee");
  if (e.role !== "technician" || !e.trained.includes("hardware")) return fail("error.notOnCallTrained");
  const roster = s.onCall.roster.filter((x) => x !== id);
  s.onCall = { ...s.onCall, roster: on ? [...roster, id] : roster };
  return { ok: true };
}

// Queues an operation for the technicians at the device's location.
export function queueOperation(s: GameState, kind: OpKind, deviceId: string, componentId: string | null = null): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  const loc = locationOf(s, d);
  if (!loc) return fail("error.notMounted");
  if (!techsAt(s, loc.id, OP_TASK[kind]).length) return fail("error.noTechnician");
  if (kind === "replace" && !d.components.some((c) => c.id === componentId)) return fail("error.unknownComponent");
  if ((kind === "drain" || kind === "php") && !clusterOf(s, deviceId)) return fail("error.notNode");
  if (s.techOps.some((o) => o.kind === kind && o.deviceId === deviceId && o.componentId === (kind === "replace" ? componentId : null))) return fail("error.alreadyQueued");
  return { ok: true, id: queueOp(s, kind, deviceId, kind === "replace" ? componentId : null).id };
}

// One PHP upgrade per node still on an older version or missing a released patch.
export function queuePhpUpgrade(s: GameState, clusterId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === clusterId);
  if (!c) return fail("error.unknownCluster");
  const nodes = c.nodes.filter((n) => phpDue(s, n) && !s.techOps.some((o) => o.kind === "php" && o.deviceId === n.deviceId));
  if (!nodes.length) return fail("error.phpCurrent");
  for (const n of nodes) {
    const r = queueOperation(s, "php", n.deviceId);
    if (!r.ok) return r;
  }
  return { ok: true };
}

export function cancelOperation(s: GameState, id: string): ActionResult {
  if (!s.techOps.some((o) => o.id === id)) return fail("error.unknownOperation");
  s.techOps = s.techOps.filter((o) => o.id !== id);
  return { ok: true };
}

export function setTechRules(s: GameState, rules: Partial<TechRules>): ActionResult {
  s.techRules = { ...s.techRules, ...rules };
  return { ok: true };
}
