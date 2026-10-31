import { Wrench } from "lucide-react";
import { BMC_NAME } from "../../../sim/10-catalog/hardware";
import { dateOf, yearOf } from "../../../sim/00-core/time";
import { phpAt, softwareById } from "../../../sim/10-catalog/platforms";
import { nextSlot, taskFor, urgent, type OpKind, type TechOp } from "../../../sim/47-staff/technicians";
import type { GameState } from "../../../sim/50-state";
import { locationOf } from "../../../sim/60-infra/status";
import { cancelOperation, queueOperation } from "../../../sim/90-actions/staff";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { PART_NAME } from "../hw";
import type { MenuItem } from "../../desktop/menu";

// The time alone today, with the weekday on a later day.
export function slotTime(now: number, hour: number): string {
  const d = dateOf(hour), time = d.toISOString().slice(11, 16);
  return dateOf(now).toISOString().slice(0, 10) === d.toISOString().slice(0, 10) ? time : `${t(`locations-2.day.${d.getUTCDay()}`)} ${time}`;
}

export function opLabel(game: GameState, o: TechOp): string {
  const d = game.devices.find((x) => x.id === o.deviceId);
  if (o.kind === "replace") {
    const c = d?.components.find((x) => x.id === o.componentId);
    return c ? t("locations-2.replacePart", { part: PART_NAME[c.kind] }) : t("locations-2.replacePartGeneric");
  }
  if (o.kind === "migrate") {
    const w = game.workloads.find((x) => x.id === o.target?.workloadId), to = game.clusters.find((c) => c.id === o.target?.clusterId);
    return t("locations-2.migrate", { service: game.services.find((v) => v.id === w?.serviceId)?.label ?? t("locations-2.webSpace"), to: to?.name ?? t("locations-2.panelHost") });
  }
  if (o.kind === "part") {
    const c = d?.components.find((x) => x.id === o.componentId), kind = c?.kind ?? game.devices.find((x) => x.id === o.partId)?.model.slice(5);
    const part = kind ? PART_NAME[kind as keyof typeof PART_NAME] : "";
    return t(o.partId ? (kind ? "locations-2.installKind" : "locations-2.installGeneric") : kind ? "locations-2.removePart" : "locations-2.removeGeneric", { part });
  }
  if (o.kind === "update") {
    const c = game.clusters.find((x) => x.id === o.componentId);
    return t("locations-2.updateSoftware", { name: softwareById(c?.panel ?? c?.platform ?? "").name });
  }
  return t(`locations-2.techOp.${o.kind}`, { php: phpAt(yearOf(game.hour)), name: BMC_NAME[d?.brand ?? ""] ?? "IPMI" });
}

// Queues the operation for the technician who gets to it first, or shows it queued with a Cancel.
export function TechButton({ game, deviceId, kind, componentId = null, partId = null }: { game: GameState; deviceId: string; kind: OpKind; componentId?: string | null; partId?: string | null }) {
  const act = useStore((s) => s.act);
  const queued = game.techOps.find((o) => o.deviceId === deviceId && o.kind === kind && o.componentId === componentId && (o.partId ?? null) === partId);
  if (queued) {
    return (
      <>
        <span className="pill accent">{t("locations-2.queued")}</span>
        <button className="btn" onClick={() => act(cancelOperation, queued.id)}>{t("locations-2.cancel")}</button>
      </>
    );
  }
  const d = game.devices.find((x) => x.id === deviceId), loc = d && locationOf(game, d);
  const slot = loc && nextSlot(game, loc.id, taskFor(game, kind, componentId), urgent(game, { kind, deviceId, componentId }));
  if (!slot) return null;
  return (
    <button className="btn" onClick={() => act(queueOperation, kind, deviceId, componentId, partId)}>
      <Wrench />{t("locations-2.techSlot", { name: slot.name.split(" ")[0], onCall: slot.onCall ? 1 : 0, time: slotTime(game.hour, slot.hour) })}
    </button>
  );
}

// The same choice as TechButton, as a menu item: queue it for the first free technician, or cancel the queued one.
export function techItem(game: GameState, deviceId: string, kind: OpKind, componentId: string | null = null, partId: string | null = null): MenuItem | undefined {
  const act = useStore.getState().act;
  const queued = game.techOps.find((o) => o.deviceId === deviceId && o.kind === kind && o.componentId === componentId && (o.partId ?? null) === partId);
  if (queued) return { label: t("locations-2.cancelQueued", { what: opLabel(game, queued) }), run: () => act(cancelOperation, queued.id) };
  const d = game.devices.find((x) => x.id === deviceId), loc = d && locationOf(game, d);
  const slot = loc && nextSlot(game, loc.id, taskFor(game, kind, componentId), urgent(game, { kind, deviceId, componentId }));
  if (!slot) return undefined;
  const what = opLabel(game, { kind, deviceId, componentId, partId } as TechOp);
  return { label: t("locations-2.techItem", { what, name: slot.name.split(" ")[0], onCall: slot.onCall ? 1 : 0, time: slotTime(game.hour, slot.hour) }), run: () => act(queueOperation, kind, deviceId, componentId, partId) };
}
