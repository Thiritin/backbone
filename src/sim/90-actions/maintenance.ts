// GDD, Support, Planned maintenance: the player announces a window on a server, cluster or location; each affected customer
// gets a notice email, and some answer it.
import { impact, type Maintenance, type MaintenanceTarget } from "../60-infra/maintenance";
import { createTicket, isFinal } from "../40-support/tickets";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

const exists = (s: GameState, t: MaintenanceTarget): boolean =>
  (t.kind === "device" ? s.devices : t.kind === "cluster" ? s.clusters : s.locations).some((x) => x.id === t.id);

// One notice per customer, as the player sent it; shops that want another time and gamers who refuse write back.
// Customers who agree are covered by the window.
function announce(s: GameState, m: Maintenance, topic: "notice" | "moved"): void {
  const rows = impact(s, m.target, m.from, m.hours);
  m.customerIds = [];
  m.notifiedAt = s.hour;
  const maint = { windowId: m.id, from: m.from, hours: m.hours };
  for (const id of new Set(rows.map((r) => r.customer.id))) {
    const mine = rows.filter((r) => r.customer.id === id), { customer, service } = mine[0];
    const sent = createTicket(s, customer, "maintenance", service.id, topic);
    Object.assign(sent, { status: "closed", unread: false, maint });
    const reaction = mine[0].reaction;
    if (reaction === "accepts") { m.customerIds.push(id); continue; }
    const answer = createTicket(s, customer, "maintenance", service.id, reaction === "asksMove" ? "move" : "declined");
    Object.assign(answer, { maint });
    if (reaction === "declines") Object.assign(answer, { status: "resolved", outcome: "declined" });
  }
}

export function planMaintenance(s: GameState, target: MaintenanceTarget, from: number, hours: number): ActionResult {
  if (!exists(s, target)) return fail("error.maintenanceTarget");
  if (from <= s.hour) return fail("error.maintenanceStart");
  if (!(hours > 0)) return fail("error.maintenanceHours");
  const m: Maintenance = { id: `mnt${s.nextId++}`, target, from, hours, notifiedAt: s.hour, customerIds: [] };
  announce(s, m, "notice");
  s.maintenance = [...s.maintenance, m];
  return { ok: true, id: m.id };
}

// Moving a window is free; every customer gets a new notice, and the day of notice starts again.
export function moveMaintenance(s: GameState, id: string, from: number, hours?: number): ActionResult {
  const m = s.maintenance.find((x) => x.id === id);
  if (!m || m.from <= s.hour) return fail("error.unknownMaintenance");
  if (from <= s.hour) return fail("error.maintenanceStart");
  if (hours !== undefined && !(hours > 0)) return fail("error.maintenanceHours");
  closeAsks(s, m.id, "moved");
  const next = { ...m, from, hours: hours ?? m.hours };
  announce(s, next, "moved");
  s.maintenance = s.maintenance.map((x) => (x.id === id ? next : x));
  return { ok: true, id };
}

export function cancelMaintenance(s: GameState, id: string): ActionResult {
  if (!s.maintenance.some((x) => x.id === id)) return fail("error.unknownMaintenance");
  closeAsks(s, id, "withdrawn");
  s.maintenance = s.maintenance.filter((x) => x.id !== id);
  return { ok: true, id };
}

function closeAsks(s: GameState, windowId: string, outcome: "moved" | "withdrawn"): void {
  s.tickets = s.tickets.map((t) => (t.kind === "maintenance" && t.topic === "move" && t.maint?.windowId === windowId && !isFinal(t) ? { ...t, status: "resolved", outcome, updatedAt: s.hour } : t));
}
