import { yearOf } from "../00-core/time";
import { importsFrom, softwareById } from "../10-catalog/platforms";
import type { GameState } from "../50-state";
import type { SimEvent } from "../88-tick/tick";
import { pickNode, type Cluster, type Workload } from "./cluster";
import { freezeTick } from "./usage";

// economy.md, Workloads and migration: a web space moves between panel hosts as a hand task. Hours are a base (2 within the
// same panel, 4 between different ones) plus 3 minutes per GB of web storage, halved by a migration tool; the site is
// unreachable for the last ten minutes.
export const MIGRATE_BASE = { same: 2, other: 4 };
export const MIGRATE_PER_GB = 0.05;
export const MIGRATE_MIN_HOURS = 0.25;
export const CUTOVER_MINUTES = 10;

// Hours the move of a web space to the panel host takes, in quarter hours.
export function migrationHours(s: GameState, w: Workload, to: Cluster): number {
  const from = s.clusters.find((c) => c.id === w.clusterId)?.panel ?? null;
  const gb = s.services.find((v) => v.id === w.serviceId)?.spec.diskGb ?? 0;
  const raw = (from === to.panel ? MIGRATE_BASE.same : MIGRATE_BASE.other) + MIGRATE_PER_GB * gb;
  const tool = !!from && !!to.panel && importsFrom(softwareById(to.panel), from, yearOf(s.hour));
  return Math.max(MIGRATE_MIN_HOURS, Math.ceil(+((tool ? raw / 2 : raw) * 4).toFixed(6)) / 4);
}

const patch = (s: GameState, id: string, p: Partial<Workload>) => {
  s.workloads = s.workloads.map((w) => (w.id === id ? { ...w, ...p } : w));
};

// Hourly, after downtime is counted: a migration that has run its hours moves the web space and starts the cutover. The
// cutover counts its ten minutes as down time; a target that lost its room in the meantime ends the migration unchanged.
export function migrationTick(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  for (const w of s.workloads.filter((x) => x.migrating && x.migrating.doneAt <= s.hour)) {
    const to = s.clusters.find((c) => c.id === w.migrating!.clusterId), at = to && pickNode(s, to, w);
    const v = s.services.find((x) => x.id === w.serviceId);
    if (!to || !at || !v) {
      patch(s, w.id, { migrating: undefined });
      if (v) events.push({ app: "Products", key: "event.migrationFailed", params: { service: v.label, cluster: to?.name ?? "" } });
      continue;
    }
    const from = s.clusters.find((c) => c.id === w.clusterId);
    patch(s, w.id, { deviceId: to.vm ? null : at, clusterId: to.id, placedAt: s.hour, busyUntil: s.hour + CUTOVER_MINUTES / 60, migrating: undefined, stuck: undefined });
    s.downHours = { ...s.downHours, [v.id]: (s.downHours[v.id] ?? 0) + CUTOVER_MINUTES / 60 };
    if (from && from.az !== to.az) s.services = s.services.map((x) => (x.id === v.id ? { ...x, zone: to.az } : x));
    freezeTick(s);
    events.push({ app: "Products", key: "event.migrated", params: { service: v.label, cluster: to.name } });
  }
  return events;
}
