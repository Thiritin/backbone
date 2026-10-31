// docs/design/plans/readouts.md: read-only screens derived from the state the sim already holds.
import { softwareById } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import type { Cluster } from "../60-infra/cluster";

export const TASK_WINDOW_HOURS = 336;
export const TASK_MAX = 12;

export type TaskStatus = "running" | "done" | "error";
export interface PanelTask { key: string; start: number | null; finish: number; text: string; params: Record<string, string>; status: TaskStatus }

// The tasks of a panel host. The sim keeps no history, so finished work shows only as far as the stored hours reach.
export function panelTasks(s: GameState, c: Cluster, now: number = s.hour): PanelTask[] {
  const recent = (h: number | null | undefined): h is number => h != null && h <= now && now - h <= TASK_WINDOW_HOURS;
  const out: PanelTask[] = [];
  const add = (key: string, text: string, status: TaskStatus, finish: number, start: number | null = null, params: Record<string, string> = {}) =>
    out.push({ key, start, finish, text, params, status });
  if (c.switching) add(`sw-${c.id}`, "install", "running", c.switching.doneAt, c.switching.doneAt - softwareById(c.switching.to).installHours, { software: softwareById(c.switching.to).name, name: c.name });
  else if (recent(c.updatedAt)) add(`up-${c.id}`, "update", "done", c.updatedAt, c.updatedAt, { software: c.panel ? softwareById(c.panel).name : c.name });
  if (c.phpUntil > now) add(`php-${c.id}`, "php", "running", c.phpUntil);
  for (const w of s.workloads.filter((x) => x.clusterId === c.id)) {
    const name = w.hostname ?? w.id;
    if (w.migrating && w.migrating.doneAt > now) add(`mv-${w.id}`, "move", "running", w.migrating.doneAt, null, { name });
    else if (w.cloning && w.cloning > now) add(`cl-${w.id}`, "clone", "running", w.cloning, null, { name });
    else if (w.recoverDoneAt && w.recoverDoneAt > now) add(`rc-${w.id}`, "recover", "running", w.recoverDoneAt, null, { name });
    else if (w.busyUntil > now) add(`rs-${w.id}`, s.lossReports.some((r) => r.items.some((i) => i.workloadId === w.id && i.restored)) ? "restore" : "move", "running", w.busyUntil, null, { name });
    if (recent(w.placedAt)) add(`pl-${w.id}`, "created", "done", w.placedAt, w.placedAt, { name });
    if (recent(w.backupAt)) add(`bk-${w.id}`, "backup", "done", w.backupAt, w.backupAt, { name });
  }
  const nodes = new Set(c.nodes.map((n) => n.deviceId));
  for (const r of s.lossReports) if (nodes.has(r.deviceId) && recent(r.hour)) {
    const d = s.devices.find((x) => x.id === r.deviceId);
    add(`ls-${r.id}`, "lostDisks", "error", r.hour, r.hour, { name: d ? d.hostname ?? d.label ?? d.name : "" });
  }
  return out.sort((a, b) => b.finish - a.finish).slice(0, TASK_MAX);
}
