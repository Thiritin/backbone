import { OP_TASK, techsAt } from "../../../sim/47-staff/technicians";
import type { GameState } from "../../../sim/50-state";
import { anchorOf, type Workload } from "../../../sim/60-infra/cluster";
import { locationOf } from "../../../sim/60-infra/status";
import { queueMigration } from "../../../sim/90-actions/staff";
import { migrateWebspace, webspaceTargets } from "../../../sim/90-actions/vms";
import type { MenuEntry } from "../../desktop/menu";
import { useStore } from "../../store";

// Quarter hours as "2 h 30 min".
export function hoursText(hours: number): string {
  const min = Math.round(hours * 60), h = Math.floor(min / 60);
  return h ? (min % 60 ? `${h} h ${min % 60} min` : `${h} h`) : `${min} min`;
}

// A web space's migration to another panel host, each target with the hours it takes: by hand, or queued for a technician
// at the server it runs on. While a migration runs, the entry shows where it goes and the time left.
export function migrateEntries(game: GameState, w: Workload): MenuEntry[] {
  const act = useStore.getState().act;
  if (w.migrating) {
    const to = game.clusters.find((c) => c.id === w.migrating!.clusterId)?.name ?? "panel host";
    return [{ label: `Migrating to ${to}, ${hoursText(w.migrating.doneAt - game.hour)} left`, disabled: true }];
  }
  const targets = webspaceTargets(game, w.id);
  if (!targets.length) return [];
  const c = game.clusters.find((x) => x.id === w.clusterId), at = c && anchorOf(game, c), d = game.devices.find((x) => x.id === at);
  const loc = d && locationOf(game, d), tech = !!loc && techsAt(game, loc.id, OP_TASK.migrate).length > 0;
  const label = (t: (typeof targets)[number]) => `${t.panel} on ${t.name}, ${hoursText(t.hours)}`;
  return [
    { label: "Migrate to", items: targets.map((t) => ({ label: label(t), run: () => act(migrateWebspace, w.id, t.clusterId) })) },
    tech && { label: "Migrate by technician to", items: targets.map((t) => ({ label: label(t), run: () => act(queueMigration, w.id, t.clusterId) })) },
  ];
}
