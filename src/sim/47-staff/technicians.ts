import { COMPONENTS } from "../10-catalog/hardware";
import { phpAt } from "../10-catalog/platforms";
import { yearOf } from "../00-core/time";
import type { Device, GameState } from "../50-state";
import { clusterOf } from "../60-infra/cluster";
import { HOURS_PER_YEAR, hotSwappable, locationOf } from "../60-infra/status";
import type { SimEvent } from "../88-tick/tick";
import { drain, upgradeNodePhp } from "../90-actions/clusters";
import { replaceComponent, setPower, type ActionResult } from "../90-actions/hardware";
import { atFair, isWorkHour, working, type Employee, type Task } from "./staff";

export type OpKind = "replace" | "off" | "on" | "drain" | "php";
// One operation on one device; componentId is set for a replace, auto when a rule queued it.
export interface TechOp { id: string; kind: OpKind; deviceId: string; componentId: string | null; queuedAt: number; auto: boolean }
// failed: replace failed parts when a spare is in storage. worn: replace parts past their life that swap while running.
export interface TechRules { failed: boolean; worn: boolean }
export const OP_TASK: Record<OpKind, Task> = { replace: "hardware", off: "hardware", on: "hardware", drain: "servers", php: "panels" };

export const opLocation = (s: GameState, o: TechOp): string | null => {
  const d = s.devices.find((x) => x.id === o.deviceId);
  return (d && locationOf(s, d)?.id) ?? null;
};
export const techsAt = (s: GameState, locationId: string, task?: Task): Employee[] =>
  s.staff.filter((e) => e.role === "technician" && e.location === locationId && (!task || e.trained.includes(task)));
const spares = (s: GameState, locationId: string, kind: string) => s.devices.filter((x) => x.model === `part-${kind}` && x.store === locationId).length;
const worn = (s: GameState, c: Device["components"][number]) => s.hour - c.installedAt >= COMPONENTS[c.kind].life * HOURS_PER_YEAR;

// The technician and work hour a new operation at the location would get, counting the queue ahead of it.
// ponytail: assumes every queued op takes a slot in turn; a per-technician schedule comes with shifts.
export function nextSlot(s: GameState, locationId: string, task: Task): { name: string; hour: number } | null {
  const techs = techsAt(s, locationId, task).filter((e) => e.assignment === "queue");
  if (!techs.length) return null;
  const ahead = s.techOps.filter((o) => opLocation(s, o) === locationId).length;
  let hour = s.hour;
  for (let k = 0; k <= Math.floor(ahead / techs.length); k++) do hour++; while (!isWorkHour(hour));
  return { name: techs[ahead % techs.length].name, hour };
}

export function queueOp(s: GameState, kind: OpKind, deviceId: string, componentId: string | null = null, auto = false): TechOp {
  const op: TechOp = { id: `op${s.nextId++}`, kind, deviceId, componentId, queuedAt: s.hour, auto };
  s.techOps = [...s.techOps, op];
  return op;
}

// The rules queue a swap for each failed or worn part a spare in storage can cover, at locations with a hardware technician.
function autoQueue(s: GameState): void {
  if (!s.techRules.failed && !s.techRules.worn) return;
  const sites = new Set(s.staff.filter((e) => e.role === "technician" && e.trained.includes("hardware")).map((e) => e.location));
  for (const d of s.devices) {
    const rack = d.rackId ? s.racks.find((r) => r.id === d.rackId) : undefined;
    if (!rack || !sites.has(rack.locationId)) continue;
    for (const c of d.components) {
      const due = (s.techRules.failed && c.failedAt !== null) || (s.techRules.worn && c.failedAt === null && worn(s, c) && hotSwappable(d, c));
      if (!due || d.maintenance?.componentId === c.id || s.techOps.some((o) => o.componentId === c.id && o.deviceId === d.id)) continue;
      const queued = s.techOps.filter((o) => o.kind === "replace" && opLocation(s, o) === rack.locationId
        && s.devices.find((x) => x.id === o.deviceId)?.components.find((x) => x.id === o.componentId)?.kind === c.kind).length;
      if (spares(s, rack.locationId, c.kind) > queued) queueOp(s, "replace", d.id, c.id, true);
    }
  }
}

// An operation waits while an earlier one on the same device is queued, a swap is under way, or no spare is in storage.
function ready(s: GameState, o: TechOp, taken: Set<string>): boolean {
  const d = s.devices.find((x) => x.id === o.deviceId)!;
  if (d.maintenance || taken.has(d.id) || s.techOps.findIndex((x) => x.deviceId === d.id) !== s.techOps.indexOf(o)) return false;
  if (o.kind !== "replace") return true;
  const c = d.components.find((x) => x.id === o.componentId), loc = locationOf(s, d);
  return !c || !loc || spares(s, loc.id, c.kind) > 0;
}

// A part that only swaps with the device off costs a shutdown first; the device is started again after the swap.
function perform(s: GameState, o: TechOp): ActionResult | "off" {
  const d = s.devices.find((x) => x.id === o.deviceId)!;
  if (o.kind === "replace") {
    const c = d.components.find((x) => x.id === o.componentId);
    if (!c) return { ok: false, error: "error.unknownComponent" };
    if (d.on && !hotSwappable(d, c)) return setPower(s, d.id, false).ok ? "off" : { ok: false, error: "error.notMounted" };
    return replaceComponent(s, d.id, c.id, true);
  }
  if (o.kind === "off" || o.kind === "on") return setPower(s, d.id, o.kind === "on");
  if (o.kind === "drain") return drain(s, d.id);
  return upgradeNodePhp(s, d.id);
}

// Hourly: rules queue repairs; in office hours each technician does at most one operation at their location.
export function techTick(s: GameState): SimEvent[] {
  if (!s.staff.some((e) => e.role === "technician")) return [];
  const events: SimEvent[] = [];
  s.techOps = s.techOps.filter((o) => s.devices.some((d) => d.id === o.deviceId));
  autoQueue(s);
  if (!isWorkHour(s.hour) || !s.techOps.length) return events;
  const taken = new Set<string>();
  for (const e of s.staff.filter((x) => x.role === "technician" && working(x) && !atFair(s, x))) {
    const o = s.techOps.find((x) => e.trained.includes(OP_TASK[x.kind]) && opLocation(s, x) === e.location && ready(s, x, taken));
    if (!o) continue;
    taken.add(o.deviceId);
    // Actions change devices and the ledger in place; the tick works on copies.
    s.devices = s.devices.map((d) => (d.id === o.deviceId ? { ...d } : d));
    s.ledger = [...s.ledger];
    const d = s.devices.find((x) => x.id === o.deviceId)!, device = d.label ?? d.name;
    const part = d.components.find((c) => c.id === o.componentId)?.kind ?? "";
    const r = perform(s, o);
    if (r === "off") {
      const i = s.techOps.indexOf(o);
      s.techOps = [...s.techOps.slice(0, i + 1), { ...o, id: `op${s.nextId++}`, kind: "on", componentId: null, auto: o.auto }, ...s.techOps.slice(i + 1)];
      continue;
    }
    s.techOps = s.techOps.filter((x) => x !== o);
    if (!r.ok) {
      if (r.error !== "error.unknownComponent") events.push({ app: "Staff", key: "event.techFailed", params: { name: e.name, device, error: r.error } });
    } else if (o.kind === "replace") events.push({ app: "Staff", key: "event.techReplaced", params: { name: e.name, device, component: part } });
    else if (o.kind === "php") {
      const c = clusterOf(s, d.id)!, php = phpAt(yearOf(s.hour));
      if (c.nodes.every((n) => n.php === php)) events.push({ app: "Staff", key: "event.phpUpgraded", params: { cluster: c.name, version: php } });
    }
  }
  return events;
}
