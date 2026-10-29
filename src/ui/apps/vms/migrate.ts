import { OP_TASK, techsAt } from "../../../sim/47-staff/technicians";
import type { GameState } from "../../../sim/50-state";
import { anchorOf, type Workload } from "../../../sim/60-infra/cluster";
import { locationOf } from "../../../sim/60-infra/status";
import { queueMigration } from "../../../sim/90-actions/staff";
import { announceMigration, moveTargets, offerMigration, type MoveTarget } from "../../../sim/90-actions/moves";
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

// A target's menu label: the host, with its cluster when that is another one.
const targetLabel = (game: GameState, t: MoveTarget, from: string | null) =>
  t.clusterId !== from && t.to !== t.clusterId ? `${t.name} · ${game.clusters.find((c) => c.id === t.clusterId)?.name}` : t.name;

// "Offer migration": asks the service's customer to agree to a move to one of the hosts it can move to.
export function offerEntries(game: GameState, w: Workload): MenuEntry[] {
  if (!w.serviceId) return [];
  const act = useStore.getState().act, serviceId = w.serviceId, targets = moveTargets(game, w.id);
  if (!targets.length) return [];
  if (game.tickets.some((t) => t.kind === "migration" && t.serviceId === serviceId && t.status === "waiting")) return [{ label: "Migration offered", disabled: true }];
  return [{ label: "Offer migration", items: targets.map((t) => ({ label: targetLabel(game, t, w.clusterId), run: () => act(offerMigration, serviceId, t.to) })) }];
}

// "Announce migration": offers every service on a host (a node's device id or a panel host's cluster id) the same move.
export function announceEntries(game: GameState, hostId: string): MenuEntry[] {
  const act = useStore.getState().act;
  const loads = game.workloads.filter((w) => w.serviceId && (w.deviceId === hostId || w.clusterId === hostId));
  const targets = new Map<string, MoveTarget>();
  for (const w of loads) for (const t of moveTargets(game, w.id)) targets.set(t.to, t);
  if (!targets.size) return [];
  return [{ label: "Announce migration", items: [...targets.values()].map((t) => ({ label: targetLabel(game, t, null), run: () => act(announceMigration, hostId, t.to) })) }];
}
