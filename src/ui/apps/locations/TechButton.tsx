import { Wrench } from "lucide-react";
import { BMC_NAME } from "../../../sim/10-catalog/hardware";
import { dateOf, yearOf } from "../../../sim/00-core/time";
import { phpAt, softwareById } from "../../../sim/10-catalog/platforms";
import { nextSlot, taskFor, urgent, type OpKind, type TechOp } from "../../../sim/47-staff/technicians";
import type { GameState } from "../../../sim/50-state";
import { locationOf } from "../../../sim/60-infra/status";
import { cancelOperation, queueOperation } from "../../../sim/90-actions/staff";
import { useStore } from "../../store";
import { PART_NAME } from "../hw";
import type { MenuItem } from "../../desktop/menu";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// The time alone today, with the weekday on a later day.
export function slotTime(now: number, hour: number): string {
  const d = dateOf(hour), time = d.toISOString().slice(11, 16);
  return dateOf(now).toISOString().slice(0, 10) === d.toISOString().slice(0, 10) ? time : `${WEEKDAY[d.getUTCDay()]} ${time}`;
}

export function opLabel(game: GameState, o: TechOp): string {
  const d = game.devices.find((x) => x.id === o.deviceId);
  if (o.kind === "replace") {
    const c = d?.components.find((x) => x.id === o.componentId);
    return `Replace ${c ? PART_NAME[c.kind].toLowerCase() : "part"}`;
  }
  if (o.kind === "migrate") {
    const w = game.workloads.find((x) => x.id === o.target?.workloadId), to = game.clusters.find((c) => c.id === o.target?.clusterId);
    return `Migrate ${game.services.find((v) => v.id === w?.serviceId)?.label ?? "web space"} to ${to?.name ?? "panel host"}`;
  }
  if (o.kind === "part") {
    const c = d?.components.find((x) => x.id === o.componentId), kind = c?.kind ?? game.devices.find((x) => x.id === o.partId)?.model.slice(5);
    return `${o.partId ? "Install" : "Remove"} ${kind ? PART_NAME[kind as keyof typeof PART_NAME].toLowerCase() : "part"}`;
  }
  if (o.kind === "update") {
    const c = game.clusters.find((x) => x.id === o.componentId);
    return `Update ${softwareById(c?.panel ?? c?.platform ?? "").name}`;
  }
  return { off: "Shut down", on: "Power on", drain: "Drain", php: `Upgrade to PHP ${phpAt(yearOf(game.hour))}`, domains: "Move domains", reset: "Reset", bmcreset: `Reset ${BMC_NAME[d?.brand ?? ""] ?? "IPMI"}`, recover: "Recover", boot: "Continue boot", gear: "Recover" }[o.kind];
}

// Queues the operation for the technician who gets to it first, or shows it queued with a Cancel.
export function TechButton({ game, deviceId, kind, componentId = null, partId = null }: { game: GameState; deviceId: string; kind: OpKind; componentId?: string | null; partId?: string | null }) {
  const act = useStore((s) => s.act);
  const queued = game.techOps.find((o) => o.deviceId === deviceId && o.kind === kind && o.componentId === componentId && (o.partId ?? null) === partId);
  if (queued) {
    return (
      <>
        <span className="pill accent">Queued</span>
        <button className="btn" onClick={() => act(cancelOperation, queued.id)}>Cancel</button>
      </>
    );
  }
  const d = game.devices.find((x) => x.id === deviceId), loc = d && locationOf(game, d);
  const slot = loc && nextSlot(game, loc.id, taskFor(game, kind, componentId), urgent(game, { kind, deviceId, componentId }));
  if (!slot) return null;
  return (
    <button className="btn" onClick={() => act(queueOperation, kind, deviceId, componentId, partId)}>
      <Wrench />{slot.name.split(" ")[0]}{slot.onCall && " (on call)"}, <span className="num">{slotTime(game.hour, slot.hour)}</span>
    </button>
  );
}

// The same choice as TechButton, as a menu item: queue it for the first free technician, or cancel the queued one.
export function techItem(game: GameState, deviceId: string, kind: OpKind, componentId: string | null = null, partId: string | null = null): MenuItem | undefined {
  const act = useStore.getState().act;
  const queued = game.techOps.find((o) => o.deviceId === deviceId && o.kind === kind && o.componentId === componentId && (o.partId ?? null) === partId);
  if (queued) return { label: `Cancel queued ${opLabel(game, queued).toLowerCase()}`, run: () => act(cancelOperation, queued.id) };
  const d = game.devices.find((x) => x.id === deviceId), loc = d && locationOf(game, d);
  const slot = loc && nextSlot(game, loc.id, taskFor(game, kind, componentId), urgent(game, { kind, deviceId, componentId }));
  if (!slot) return undefined;
  const what = opLabel(game, { kind, deviceId, componentId, partId } as TechOp);
  return { label: `${what} by ${slot.name.split(" ")[0]}${slot.onCall ? " (on call)" : ""}, ${slotTime(game.hour, slot.hour)}`, run: () => act(queueOperation, kind, deviceId, componentId, partId) };
}
