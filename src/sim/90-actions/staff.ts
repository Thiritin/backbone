import { yearOf } from "../00-core/time";
import { employeeMailbox, hireTenant, mailboxInUse, removeMailbox } from "../42-mail/accounts";
import { cents } from "../45-billing/billing";
import {
  AD, adCandidates, COURSE_PRICE, fullyTrained, MAX_SHIFT, needsTraining, salaryUpToNow, staffPrice, startTraining, TASKS, trainerFor, visibleCandidates, weekdays,
  type AdTier, type Assignment, type Employee, type Role, type Shift, type Task,
} from "../47-staff/staff";
import { OP_TASK, queueOp, taskFor, techsAt, type OpKind, type TechRules } from "../47-staff/technicians";
import type { GameState } from "../50-state";
import { anchorOf, clusterOf } from "../60-infra/cluster";
import { locationOf } from "../60-infra/status";
import { phpDue } from "./clusters";
import { updateDue } from "./software";
import { webspaceBlock } from "./vms";
import { mountError, mountStack, type ActionResult } from "./hardware";

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

export function hire(s: GameState, candidateId: string, team = s.teams[0]?.id): ActionResult {
  const c = visibleCandidates(s).find((x) => x.id === candidateId);
  if (!c) return fail("error.unknownCandidate");
  if (!s.teams.some((t) => t.id === team)) return fail("error.unknownTeam");
  const mail = hireTenant(s);
  if (!mail) return fail("error.hireNoMailbox");
  const e: Employee = {
    id: `emp${s.nextId++}`, name: c.name, role: c.role, skill: c.skill, talent: c.talent, salary: c.salary, hiredAt: s.hour, assignment: "queue",
    location: c.role === "technician" ? s.locations[0]?.id ?? null : null,
    trained: [], plan: [], training: null, busyUntil: 0, raise: null, nextRaiseAt: s.hour + YEAR, refusedAt: null, team, worked: 0,
  };
  s.candidates = s.candidates.filter((x) => x.id !== c.id);
  s.staff = [...s.staff, e];
  employeeMailbox(s, mail, e.id, e.name);
  return { ok: true, id: e.id };
}

// A leaving employee is paid for the days worked this month.
export function fire(s: GameState, id: string): ActionResult {
  const e = s.staff.find((x) => x.id === id);
  if (!e) return fail("error.unknownEmployee");
  const box = s.mail.accounts.find((a) => a.employee === id);
  if (box && (box.roles.length || mailboxInUse(s, box))) return fail("error.mailInUse");
  if (box) removeMailbox(s, box);
  const owed = salaryUpToNow(s, e);
  if (owed > 0) pay(s, "ledger.salary", { name: e.name, role: e.role }, owed);
  s.staff = s.staff.filter((x) => x.id !== id);
  return { ok: true };
}

export function setTeam(s: GameState, id: string, team: string): ActionResult {
  if (!s.teams.some((t) => t.id === team)) return fail("error.unknownTeam");
  const e = employee(s, id);
  if (!e) return fail("error.unknownEmployee");
  e.team = team;
  return { ok: true };
}

// A new team starts on office hours.
export function addTeam(s: GameState, name: string): ActionResult {
  if (!name.trim()) return fail("error.teamName");
  const id = `team${s.nextId++}`;
  s.teams = [...s.teams, { id, name: name.trim(), days: weekdays(9, 8) }];
  return { ok: true, id };
}

export function removeTeam(s: GameState, id: string): ActionResult {
  if (!s.teams.some((t) => t.id === id)) return fail("error.unknownTeam");
  if (s.staff.some((e) => e.team === id)) return fail("error.teamInUse");
  s.teams = s.teams.filter((t) => t.id !== id);
  return { ok: true };
}

// Sets one weekday's shift, or a day off with null; day is 0 for Sunday.
export function setShift(s: GameState, id: string, day: number, shift: Shift | null): ActionResult {
  if (!s.teams.some((t) => t.id === id)) return fail("error.unknownTeam");
  if (!Number.isInteger(day) || day < 0 || day > 6) return fail("error.shift");
  if (shift && ![shift.start, shift.hours].every(Number.isInteger)) return fail("error.shift");
  if (shift && (shift.start < 0 || shift.start > 23 || shift.hours < 1 || shift.hours > MAX_SHIFT)) return fail("error.shift");
  s.teams = s.teams.map((t) => (t.id === id ? { ...t, days: t.days.map((d, i) => (i === day ? shift && { start: shift.start, hours: shift.hours } : d)) } : t));
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
// A mount names the rack in componentId and the position in slot; count above 1 mounts a stack of units like the device.
export function queueOperation(s: GameState, kind: OpKind, deviceId: string, componentId: string | null = null, partId: string | null = null, slot = 0, count = 1): ActionResult {
  const d = s.devices.find((x) => x.id === deviceId);
  if (!d) return fail("error.unknownDevice");
  const loc = locationOf(s, d) ?? s.locations.find((l) => l.id === d.store);
  if (!loc) return fail("error.notMounted");
  if (!techsAt(s, loc.id, taskFor(s, kind, componentId)).length) return fail("error.noTechnician");
  if (kind === "update") {
    const c = s.clusters.find((x) => x.id === componentId);
    if (!c || anchorOf(s, c) !== deviceId) return fail("error.unknownCluster");
    if (!updateDue(s, c)) return fail("error.upToDate");
  }
  if ((kind === "replace" || (kind === "part" && !partId)) && !d.components.some((c) => c.id === componentId)) return fail("error.unknownComponent");
  if (kind === "part" && partId && !s.devices.some((x) => x.id === partId && x.store === loc.id)) return fail("error.noPart");
  // A drain names the software installation in componentId; without one it drains the server's first.
  if (kind === "drain" && !(componentId ? s.clusters.some((c) => c.id === componentId && c.nodes.some((n) => n.deviceId === deviceId)) : clusterOf(s, deviceId))) return fail("error.notNode");
  if (kind === "php" && !s.clusters.some((c) => c.kind === "panel" && anchorOf(s, c) === deviceId)) return fail("error.notPanelHost");
  if (kind === "recover" && !s.workloads.some((w) => w.id === componentId && w.deviceId === deviceId && w.corrupted)) return fail("error.notCorrupted");
  if (kind === "reset" && !d.hung) return fail("error.notHung");
  if (kind === "bmcreset" && !d.bmcHung) return fail("error.bmcFine");
  const stack = kind === "mount" && count > 1 ? mountStack(structuredClone(s), d.model, d.brand, componentId ?? "", count, slot, true) : null;
  const rackError = stack ? (stack.ok ? null : stack.error) : kind === "mount" ? mountError(s, d, componentId ?? "", slot) : kind === "unmount" && !d.rackId ? "error.notMounted" : null;
  if (rackError) return fail(rackError);
  const comp = kind === "replace" || kind === "part" || kind === "recover" || kind === "drain" || kind === "mount" ? componentId ?? null : null, spare = kind === "part" ? partId : null;
  if (s.techOps.some((o) => o.kind === kind && o.deviceId === deviceId && o.componentId === comp && (o.partId ?? null) === spare)) return fail("error.alreadyQueued");
  const op = queueOp(s, kind, deviceId, comp, false, undefined, spare);
  if (kind === "mount") Object.assign(op, { slot, ...(count > 1 && { count }) });
  return { ok: true, id: op.id };
}

// A PHP upgrade of a panel host still on an older version or missing a released patch, done at the server it runs on.
export function queuePhpUpgrade(s: GameState, hostId: string): ActionResult {
  const c = s.clusters.find((x) => x.id === hostId);
  if (!c) return fail("error.unknownCluster");
  const at = anchorOf(s, c);
  if (!phpDue(s, c) || !at) return fail("error.phpCurrent");
  if (s.techOps.some((o) => o.kind === "php" && o.deviceId === at)) return fail("error.alreadyQueued");
  return queueOperation(s, "php", at);
}

// Hands the move of a web space to a panel host to the technicians at the server it runs on.
export function queueMigration(s: GameState, workloadId: string, toClusterId: string): ActionResult {
  const w = s.workloads.find((x) => x.id === workloadId), c = w && s.clusters.find((x) => x.id === w.clusterId), to = s.clusters.find((x) => x.id === toClusterId);
  if (!w || !c) return fail("error.unknownWorkload");
  if (c.kind !== "panel" || !w.serviceId) return fail("error.notWebspace");
  if (!to) return fail("error.unknownCluster");
  const at = anchorOf(s, c), d = s.devices.find((x) => x.id === at), loc = d && locationOf(s, d);
  if (!d || !loc) return fail("error.notMounted");
  if (!techsAt(s, loc.id, OP_TASK.migrate).length) return fail("error.noTechnician");
  const bad = webspaceBlock(s, w, c, to);
  if (bad) return fail(bad);
  if (s.techOps.some((o) => o.kind === "migrate" && o.target?.workloadId === w.id)) return fail("error.alreadyQueued");
  return { ok: true, id: queueOp(s, "migrate", d.id, null, false, { workloadId: w.id, clusterId: to.id }).id };
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
