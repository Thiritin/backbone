import { OP_TASK, techsAt } from "../../sim/47-staff/technicians";
import type { GameState } from "../../sim/50-state";
import { anchorOf, type Workload } from "../../sim/60-infra/cluster";
import { locationOf } from "../../sim/60-infra/status";
import { queueMigration } from "../../sim/90-actions/staff";
import { announceMigration, moveTargets, offerMigration, type MoveTarget } from "../../sim/90-actions/moves";
import { migrateWebspace, migrateWorkload, migrationTargets, rescueTargets, rescueWorkload, restoreWorkload, startWorkload, stopWorkload, webspaceTargets } from "../../sim/90-actions/vms";
import { ask } from "../desktop/Confirm";
import type { MenuEntry } from "../desktop/menu";
import { useStore } from "../store";
import type { HandTask } from "./locations/HandSheet";
import { vmLabel, vmState } from "./products/parts";
import { t } from "../../i18n/en";

// Asks before a VM or web space shuts down, restarts or is checkpointed; action is the label of the control that asked.
export const askPower = (kind: "stop" | "reboot" | "checkpoint", name: string, action: string, run: () => void) =>
  ask({ title: t(`console.confirm.${kind}Title`, { name }), text: t(`console.confirm.${kind}Text`, { name }), action, run });

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
    const to = game.clusters.find((c) => c.id === w.migrating!.clusterId)?.name ?? t("misc2.panelHost");
    return [{ label: t("misc2.migratingTo", { to, time: hoursText(w.migrating.doneAt - game.hour) }), disabled: true }];
  }
  const targets = webspaceTargets(game, w.id);
  if (!targets.length) return [];
  const c = game.clusters.find((x) => x.id === w.clusterId), at = c && anchorOf(game, c), d = game.devices.find((x) => x.id === at);
  const loc = d && locationOf(game, d), tech = !!loc && techsAt(game, loc.id, OP_TASK.migrate).length > 0;
  const label = (x: (typeof targets)[number]) => t("misc2.targetOn", { panel: x.panel, name: x.name, time: hoursText(x.hours) });
  return [
    { label: t("misc2.migrateTo"), items: targets.map((x) => ({ label: label(x), run: () => act(migrateWebspace, w.id, x.clusterId) })) },
    tech && { label: t("misc2.migrateByTech"), items: targets.map((x) => ({ label: label(x), run: () => act(queueMigration, w.id, x.clusterId) })) },
  ];
}

// A target's menu label: the host, with its cluster when that is another one.
const targetLabel = (game: GameState, t: MoveTarget, from: string | null) =>
  t.clusterId !== from && t.to !== t.clusterId ? `${t.name} · ${game.clusters.find((c) => c.id === t.clusterId)?.name}` : t.name;

// "Offer migration": asks the service's customer to agree to a move to one of the hosts it can move to.
export function offerEntries(game: GameState, w: Workload): MenuEntry[] {
  if (!w.serviceId) return [];
  const act = useStore.getState().act, serviceId = w.serviceId, targets = moveTargets(game, w.id);
  if (game.tickets.some((k) => k.kind === "migration" && k.serviceId === serviceId && k.status === "waiting")) return [{ label: t("misc2.migrationOffered"), disabled: true }];
  if (!targets.length) return game.tickets.some((k) => k.kind === "migration" && k.serviceId === serviceId) ? [{ label: t("misc2.offerNoHost"), disabled: true }] : [];
  return [{ label: t("misc2.offerMigration"), items: targets.map((x) => ({ label: targetLabel(game, x, w.clusterId), run: () => act(offerMigration, serviceId, x.to) })) }];
}

// "Announce migration": offers every service on a host (a node's device id or a panel host's cluster id) the same move.
export function announceEntries(game: GameState, hostId: string): MenuEntry[] {
  const act = useStore.getState().act;
  const loads = game.workloads.filter((w) => w.serviceId && (w.deviceId === hostId || w.clusterId === hostId));
  const targets = new Map<string, MoveTarget>();
  for (const w of loads) for (const t of moveTargets(game, w.id)) targets.set(t.to, t);
  if (!targets.size) return [];
  return [{ label: t("misc2.announceMigration"), items: [...targets.values()].map((x) => ({ label: targetLabel(game, x, null), run: () => act(announceMigration, hostId, x.to) })) }];
}

// Recovery by hand off a server that is off, when its cluster's control plane is down; start runs the hand work.
export function rescueEntries(game: GameState, w: Workload, start: (game: GameState, t: HandTask) => void): MenuEntry[] {
  const targets = rescueTargets(game, w.id), { name } = vmLabel(game, w);
  return targets.length ? [{ label: t("misc2.recoverTo"), items: targets.map((x) => ({
    label: t("misc2.offlineHours", { name: x.name, h: x.down }),
    run: () => start(game, { title: t("misc2.recoverTitle", { name, target: x.name }), deviceId: w.deviceId!, action: rescueWorkload, args: [w.id, x.to] }),
  })) }] : [];
}

// Start, stop, restore and migrate for a VM or web space, shared by every list that shows one; with start, also recovery by hand.
export function workloadActions(game: GameState, w: Workload, start?: (game: GameState, t: HandTask) => void): MenuEntry[] {
  const act = useStore.getState().act;
  const st = vmState(game, w);
  const on = st === "running" || st === "down" || st === "frozen" || st === "booting";
  const web = game.clusters.find((c) => c.id === w.clusterId)?.kind === "panel";
  const targets = !web && (on || st === "stopped") ? migrationTargets(game, w.id) : [];
  const where = (id: string) => game.clusters.find((c) => c.id === id)?.name;
  return [
    st === "lost" && { label: w.backupAt === null ? t("misc2.startEmpty") : t("misc2.restore"), run: () => act(restoreWorkload, w.id) },
    st === "stopped" && { label: t("misc2.start"), run: () => act(startWorkload, w.id) },
    on && { label: t("misc2.stop"), run: () => askPower("stop", vmLabel(game, w).name, t("misc2.stop"), () => act(stopWorkload, w.id)) },
    ...(start ? rescueEntries(game, w, start) : []),
    ...(web && (on || st === "stopped" || st === "migrating") ? migrateEntries(game, w) : []),
    targets.length > 0 && {
      label: t("misc2.migrateTo"),
      items: targets.map((x) => ({
        label: x.to !== x.clusterId && x.clusterId !== w.clusterId ? `${x.name} · ${where(x.clusterId)}` : x.name,
        run: () => act(migrateWorkload, w.id, x.to),
      })),
    },
    ...offerEntries(game, w),
  ];
}
