import { useState, type ReactNode } from "react";
import { t } from "../../../../i18n/en";
import { holdReason, type HoldReason } from "../../../../sim/45-billing/billing";
import { isFinal } from "../../../../sim/40-support/tickets";
import type { GameState } from "../../../../sim/50-state";
import type { Cluster, Workload } from "../../../../sim/60-infra/cluster";
import { holdAsksReason, holdLabels, type ConsoleFeatures } from "../../../../sim/80-business/consoles";
import { suspendService, terminateService, unsuspendService } from "../../../../sim/90-actions/holds";
import type { PanelAction } from "./PanelBase";
import { usePageAct } from "../pageAct";

const REASONS: HoldReason[] = ["payment", "abuse", "manual"];

export interface WorkloadHold { actions: PanelAction[]; panel: ReactNode; state: [string, string] | null }

// Suspend, unsuspend and terminate for the account behind a workload, in the console's own words.
export function useHolds(game: GameState, _c: Cluster, f: ConsoleFeatures): (w: Workload) => WorkloadHold | null {
  const act = usePageAct(), labels = holdLabels(f.look), asks = holdAsksReason(f.look);
  const [open, setOpen] = useState<{ id: string; kind: "suspend" | "terminate" } | null>(null), [reason, setReason] = useState<HoldReason>("payment");
  const close = () => setOpen(null);
  return (w) => {
    const v = game.services.find((x) => x.id === w.serviceId && x.endedAt === null);
    if (!v) return null;
    const why = holdReason(game, v), kind = open?.id === v.id ? open.kind : null;
    const noticed = game.tickets.some((x) => x.kind === "notice" && x.serviceId === v.id && !isFinal(x));
    const suspend = (r: HoldReason) => { if (act(suspendService, v.id, r).ok) close(); };
    const actions: PanelAction[] = [
      why
        ? { id: "unhold", label: t(labels.unsuspend), run: () => act(unsuspendService, v.id) }
        : { id: "hold", label: t(labels.suspend), run: () => (asks ? setOpen({ id: v.id, kind: "suspend" }) : suspend(noticed ? "abuse" : "manual")) },
      { id: "terminate", label: t(labels.terminate), tone: "danger", run: () => setOpen({ id: v.id, kind: "terminate" }) },
    ];
    const panel = kind === "suspend" ? (
      <div className="cx-inline">
        <label className="cx-field">{t("host.reason")}
          <select value={reason} onChange={(e) => setReason(e.target.value as HoldReason)}>{REASONS.map((r) => <option key={r} value={r}>{t(`host.reason.${r}`)}</option>)}</select>
        </label>
        <button className="cx-btn primary" onClick={() => suspend(reason)}>{t(labels.suspend)}</button>
        <button className="cx-btn" onClick={close}>{t("host.cancel")}</button>
      </div>
    ) : kind === "terminate" ? (
      <div className="cx-inline">
        <button className="cx-btn danger" onClick={() => act(terminateService, v.id)}>{t(labels.terminate)}</button>
        <button className="cx-btn" onClick={close}>{t("host.cancel")}</button>
      </div>
    ) : null;
    return { actions, panel, state: why ? [t("host.held", { reason: t(`host.reason.${why}`) }), "bad"] : null };
  };
}
