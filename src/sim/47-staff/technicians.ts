import { COMPONENTS, modelById, type ComponentKind } from "../10-catalog/hardware";
import { phpAt, softwareById } from "../10-catalog/platforms";
import { yearOf } from "../00-core/time";
import type { Device, GameState } from "../50-state";
import { beginTransfer, TRANSFER_MINUTES } from "../30-customers/registrar";
import { anchorOf } from "../60-infra/cluster";
import { openVulns, rank } from "../60-infra/vulns";
import { HOURS_PER_YEAR, hotKind, hotSwappable, locationOf, spotOf, working as deviceWorks } from "../60-infra/status";
import type { SimEvent } from "../88-tick/tick";
import { drain, upgradeNodePhp } from "../90-actions/clusters";
import { updateDue, updateSoftware } from "../90-actions/software";
import { installPart, removePart, replaceComponent, replaceSpares, reset, resetBmc, setPower, shutdown, spareFits, type ActionResult } from "../90-actions/hardware";
import { migrateWebspace, recover } from "../90-actions/vms";
import { continueBoot, recoverGear } from "../90-actions/remote";
import { callOut, onCallAt, onCallPayroll, respond, restUntil } from "./oncall";
import { atFair, onShift, working, type Employee, type Task } from "./staff";

export type OpKind = "replace" | "off" | "on" | "drain" | "php" | "migrate" | "part" | "domains" | "update" | "reset" | "bmcreset" | "recover" | "boot" | "gear";
// One operation on one device; componentId is set for a replace and for taking a part out, partId for putting a spare in,
// auto when a rule queued it; an update carries the cluster id in componentId. A migrate runs at the device the web space sits on and carries the web space and the panel
// host it moves to.
export interface TechOp { id: string; kind: OpKind; deviceId: string; componentId: string | null; queuedAt: number; auto: boolean; target?: { workloadId: string; clusterId: string }; partId?: string | null }
// failed: replace failed parts when a spare is in storage. worn: replace parts past their life that swap while running.
// blackhole: the on-call technician blackholes an attack that saturates their location's links.
// updates: update software with an open high or critical vulnerability.
// recover: run the recovery of workloads a pulled plug corrupted.
export interface TechRules { failed: boolean; worn: boolean; blackhole: boolean; updates: boolean; recover: boolean }
export const OP_TASK: Record<OpKind, Task> = { replace: "hardware", off: "hardware", on: "hardware", drain: "servers", php: "panels", migrate: "panels", part: "hardware", domains: "panels", update: "panels", reset: "hardware", bmcreset: "hardware", recover: "servers", boot: "hardware", gear: "hardware" };
// An update of a hypervisor is server work; a panel or mail host update is panel work.
export const taskFor = (s: GameState, kind: OpKind, componentId: string | null): Task =>
  kind === "update" && s.clusters.find((c) => c.id === componentId)?.kind === "cloud" ? "servers" : OP_TASK[kind];

// A domains operation belongs to the company, not to a device: it is worked at the first location.
export const opLocation = (s: GameState, o: TechOp): string | null => {
  if (o.kind === "domains") return s.locations[0]?.id ?? null;
  const d = s.devices.find((x) => x.id === o.deviceId);
  return (d && locationOf(s, d)?.id) ?? null;
};
export const techsAt = (s: GameState, locationId: string, task?: Task): Employee[] =>
  s.staff.filter((e) => e.role === "technician" && e.location === locationId && (!task || e.trained.includes(task)));
// Spares in the location's storage that can take the place of a component, none while they cannot cover a swap.
const spares = (s: GameState, locationId: string, d: Device, c: Device["components"][number]) =>
  replaceSpares(s, d, c, locationId).length && s.devices.filter((x) => x.model === `part-${c.kind}` && x.store === locationId && spareFits(modelById(d.model), d, x, c)).length;
const worn = (s: GameState, c: Device["components"][number]) => s.hour - c.installedAt >= COMPONENTS[c.kind].life * HOURS_PER_YEAR;

// When no technician is on shift the on-call technician comes in for these: a failed part and starting a device again.
export const urgent = (s: GameState, o: Pick<TechOp, "kind" | "deviceId" | "componentId">): boolean =>
  o.kind === "on" || o.kind === "reset" || (o.kind === "replace" && !!s.devices.find((d) => d.id === o.deviceId)?.components.some((c) => c.id === o.componentId && c.failedAt !== null));

// The technician and hour a new operation at the location would get, counting the queue ahead of it and rest after call-outs;
// an urgent one goes to the on-call technician while nobody is on shift.
// ponytail: assumes every queued op takes a slot in turn and ignores incidents; a per-technician schedule comes with shifts.
export function nextSlot(s: GameState, locationId: string, task: Task, isUrgent = false): { name: string; hour: number; onCall?: true } | null {
  const techs = techsAt(s, locationId, task).filter((e) => e.assignment === "queue");
  if (!techs.length) return null;
  const ops = s.techOps.filter((o) => opLocation(s, o) === locationId);
  let ahead = ops.length, urgentAhead = ops.filter((o) => urgent(s, o)).length;
  for (let hour = s.hour + 1; hour < s.hour + 24 * 90; hour++) {
    const shift = techs.filter((e) => onShift(s, e, hour));
    if (shift.length) {
      const free = shift.filter((e) => restUntil(s, e) <= hour);
      if (ahead < free.length) return { name: free[ahead].name, hour };
      ahead -= free.length;
      urgentAhead = Math.max(0, urgentAhead - free.length);
      continue;
    }
    const e = isUrgent && task === "hardware" ? onCallAt(s, locationId, hour) : undefined;
    if (!e) continue;
    if (!urgentAhead) return { name: e.name, hour, onCall: true };
    urgentAhead--;
    ahead--;
  }
  return null;
}

export function queueOp(s: GameState, kind: OpKind, deviceId: string, componentId: string | null = null, auto = false, target?: TechOp["target"], partId: string | null = null): TechOp {
  const op: TechOp = { id: `op${s.nextId++}`, kind, deviceId, componentId, queuedAt: s.hour, auto, ...(target && { target }), ...(partId ? { partId } : {}) };
  s.techOps = [...s.techOps, op];
  return op;
}

// The rules queue a swap for each failed or worn part a spare in storage can cover, at locations with a hardware technician.
function autoQueue(s: GameState): void {
  if (!s.techRules.failed && !s.techRules.worn) return;
  const sites = new Set(s.staff.filter((e) => e.role === "technician" && e.trained.includes("hardware")).map((e) => e.location));
  for (const d of s.devices) {
    const rack = d.rackId ? spotOf(s, d.rackId) : undefined;
    if (!rack || !sites.has(rack.locationId)) continue;
    for (const c of d.components) {
      const due = (s.techRules.failed && c.failedAt !== null) || (s.techRules.worn && c.failedAt === null && worn(s, c) && hotSwappable(d, c));
      if (!due || d.maintenance?.componentId === c.id || s.techOps.some((o) => o.componentId === c.id && o.deviceId === d.id)) continue;
      const queued = s.techOps.filter((o) => o.kind === "replace" && opLocation(s, o) === rack.locationId
        && s.devices.find((x) => x.id === o.deviceId)?.components.find((x) => x.id === o.componentId)?.kind === c.kind).length;
      if (spares(s, rack.locationId, d, c) > queued) queueOp(s, "replace", d.id, c.id, true);
    }
  }
}

// With the updates rule on, software with an open high or critical vulnerability is queued for a technician trained on it.
function autoUpdates(s: GameState): void {
  if (!s.techRules.updates) return;
  for (const c of s.clusters) {
    const at = anchorOf(s, c), d = s.devices.find((x) => x.id === at), loc = d && locationOf(s, d);
    if (!d || !loc || !updateDue(s, c) || s.techOps.some((o) => o.kind === "update" && o.componentId === c.id)) continue;
    if (!openVulns(s, c.id).some((v) => rank(v.severity) >= rank("high")) || !techsAt(s, loc.id, taskFor(s, "update", c.id)).length) continue;
    queueOp(s, "update", d.id, c.id, true);
  }
}

// With the recover rule on, a corrupted workload that is not being repaired or restored is queued where a technician trained on servers works.
function autoRecover(s: GameState): void {
  if (!s.techRules.recover) return;
  for (const w of s.workloads) {
    const d = w.deviceId ? s.devices.find((x) => x.id === w.deviceId) : undefined, loc = d && locationOf(s, d);
    if (!d || !loc || !w.corrupted || w.recoverDoneAt !== undefined || w.recoverFailed || !deviceWorks(s, d.id)) continue;
    if (!techsAt(s, loc.id, "servers").length || s.techOps.some((o) => o.kind === "recover" && o.componentId === w.id)) continue;
    queueOp(s, "recover", d.id, w.id, true);
  }
}

// An operation waits while an earlier one on the same device is queued, a swap is under way, or no spare is in storage.
function ready(s: GameState, o: TechOp, taken: Set<string>): boolean {
  if (o.kind === "domains") return true;
  const d = s.devices.find((x) => x.id === o.deviceId)!;
  if (d.maintenance || taken.has(d.id) || s.techOps.findIndex((x) => x.deviceId === d.id) !== s.techOps.indexOf(o)) return false;
  if (o.kind !== "replace") return true;
  const c = d.components.find((x) => x.id === o.componentId), loc = locationOf(s, d);
  return !c || !loc || spares(s, loc.id, d, c) > 0;
}

// A technician shuts a server down cleanly when its OS answers and pulls the plug when it does not.
const powerDown = (s: GameState, id: string): ActionResult => (shutdown(s, id).ok ? { ok: true } : setPower(s, id, false));

// A part that only swaps with the device off costs a shutdown first; the device is started again after the swap.
function perform(s: GameState, o: TechOp): ActionResult | "off" {
  const d = s.devices.find((x) => x.id === o.deviceId)!;
  if (o.kind === "replace") {
    const c = d.components.find((x) => x.id === o.componentId);
    if (!c) return { ok: false, error: "error.unknownComponent" };
    if (d.on && !hotSwappable(d, c)) return powerDown(s, d.id).ok ? "off" : { ok: false, error: "error.notMounted" };
    return replaceComponent(s, d.id, c.id, true);
  }
  if (o.kind === "part") {
    const c = o.componentId ? d.components.find((x) => x.id === o.componentId) : undefined;
    const spare = o.partId ? s.devices.find((x) => x.id === o.partId) : undefined;
    if (o.componentId ? !c : !spare) return { ok: false, error: o.componentId ? "error.unknownComponent" : "error.noPart" };
    const hot = c ? hotSwappable(d, c) : hotKind(d, spare!.model.slice(5) as ComponentKind);
    if (d.rackId && d.on && !hot) return powerDown(s, d.id).ok ? "off" : { ok: false, error: "error.notMounted" };
    return c ? removePart(s, d.id, c.id, true) : installPart(s, d.id, spare!.id, undefined, true);
  }
  if (o.kind === "off") return powerDown(s, d.id);
  if (o.kind === "on") return setPower(s, d.id, true);
  if (o.kind === "reset") return reset(s, d.id, true);
  if (o.kind === "bmcreset") return resetBmc(s, d.id, true);
  if (o.kind === "boot") return continueBoot(s, d.id, true);
  if (o.kind === "gear") return recoverGear(s, d.id, true);
  if (o.kind === "recover") return o.componentId ? recover(s, o.componentId) : { ok: false, error: "error.unknownWorkload" };
  if (o.kind === "drain") return drain(s, d.id);
  if (o.kind === "update") return o.componentId ? updateSoftware(s, o.componentId) : { ok: false, error: "error.unknownCluster" };
  if (o.kind === "migrate") return o.target ? migrateWebspace(s, o.target.workloadId, o.target.clusterId) : { ok: false, error: "error.unknownWorkload" };
  return upgradeNodePhp(s, d.id);
}

// Hourly: rules queue repairs; each technician on shift who is not resting does at most one operation at their location.
// At a location with nobody on shift the on-call technician answers incidents first, then urgent operations, one per call-out hour.
export function techTick(s: GameState): SimEvent[] {
  onCallPayroll(s);
  if (!s.staff.some((e) => e.role === "technician")) return [];
  const events: SimEvent[] = [];
  s.techOps = s.techOps.filter((o) => (o.kind === "domains" ? !!s.registrar?.transfer && s.registrar.transfer.doneAt === null : s.devices.some((d) => d.id === o.deviceId)));
  autoQueue(s);
  autoUpdates(s);
  autoRecover(s);
  const taken = new Set<string>();
  const shift = s.staff.filter((x) => x.role === "technician" && working(x) && !atFair(s, x) && onShift(s, x, s.hour));
  for (const l of s.locations) {
    if (shift.some((x) => x.location === l.id)) continue;
    const e = onCallAt(s, l.id, s.hour);
    if (e && (respond(s, e, events) || work(s, e, events, taken, true))) callOut(s, e);
  }
  for (const e of shift.filter((x) => restUntil(s, x) <= s.hour)) work(s, e, events, taken, false);
  return events;
}

// One operation for the technician at their location; true when it took the hour.
function work(s: GameState, e: Employee, events: SimEvent[], taken: Set<string>, onlyUrgent: boolean): boolean {
  const o = s.techOps.find((x) => e.trained.includes(taskFor(s, x.kind, x.componentId)) && opLocation(s, x) === e.location && (!onlyUrgent || urgent(s, x)) && ready(s, x, taken));
  if (!o) return false;
  if (o.kind === "domains") {
    s.techOps = s.techOps.filter((x) => x !== o);
    beginTransfer(s, s.hour + Math.ceil(((s.registrar?.transfer?.domains ?? 0) * TRANSFER_MINUTES) / 60));
    return true;
  }
  taken.add(o.deviceId);
  // Actions change devices and the ledger in place; the tick works on copies.
  s.devices = s.devices.map((d) => (d.id === o.deviceId ? { ...d } : d));
  s.ledger = [...s.ledger];
  const d = s.devices.find((x) => x.id === o.deviceId)!, device = d.label ?? d.name;
  const part = d.components.find((c) => c.id === o.componentId)?.kind ?? s.devices.find((x) => x.id === o.partId)?.model.slice(5) ?? "";
  const r = perform(s, o);
  if (r === "off") {
    const i = s.techOps.indexOf(o);
    s.techOps = [...s.techOps.slice(0, i + 1), { ...o, id: `op${s.nextId++}`, kind: "on", componentId: null, auto: o.auto }, ...s.techOps.slice(i + 1)];
    return true;
  }
  s.techOps = s.techOps.filter((x) => x !== o);
  if (!r.ok) {
    if (r.error !== "error.unknownComponent") events.push({ app: "Staff", key: "event.techFailed", params: { name: e.name, device, error: r.error } });
  } else if (o.kind === "replace") events.push({ app: "Staff", key: "event.techReplaced", params: { name: e.name, device, component: part } });
  else if (o.kind === "part") events.push({ app: "Staff", key: o.partId ? "event.techInstalled" : "event.techRemoved", params: { name: e.name, device, component: part } });
  else if (o.kind === "update") {
    const c = s.clusters.find((x) => x.id === o.componentId);
    events.push({ app: "Staff", key: "event.techUpdated", params: { name: e.name, software: softwareById(c?.panel ?? c?.platform ?? "").name, device } });
  } else if (o.kind === "php") {
    const php = phpAt(yearOf(s.hour));
    for (const c of s.clusters.filter((x) => x.kind === "panel" && anchorOf(s, x) === d.id && x.php === php && x.phpUntil >= s.hour)) {
      events.push({ app: "Staff", key: "event.phpUpgraded", params: { cluster: c.name, version: php } });
    }
  }
  return true;
}
