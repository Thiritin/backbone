import { useState, type ReactNode } from "react";
import { t } from "../../../../i18n/en";
import { holdReason, type HoldReason } from "../../../../sim/45-billing/billing";
import { isFinal } from "../../../../sim/40-support/tickets";
import type { GameState } from "../../../../sim/50-state";
import type { Cluster, Workload } from "../../../../sim/60-infra/cluster";
import { holdAsksReason, holdLabels, type ConsoleFeatures } from "../../../../sim/80-business/consoles";
import { suspendService, TERMINATE_REASONS, terminateService, unsuspendService } from "../../../../sim/90-actions/holds";
import type { TerminateReason } from "../../../../sim/30-customers/customers";
import { day } from "../../hw";
import type { PanelAction } from "./PanelBase";
import { usePageAct } from "../pageAct";

const REASONS: HoldReason[] = ["payment", "abuse", "manual"];
const MODES = ["notice", "now"] as const;

export interface WorkloadHold { actions: PanelAction[]; panel: ReactNode; state: [string, string] | null }

// Suspend, unsuspend and terminate for the account behind a workload, in the console's own words.
export function useHolds(game: GameState, _c: Cluster, f: ConsoleFeatures): (w: Workload) => WorkloadHold | null {
  const act = usePageAct(), labels = holdLabels(f.look), asks = holdAsksReason(f.look);
  const [open, setOpen] = useState<{ id: string; kind: "suspend" | "terminate" } | null>(null), [reason, setReason] = useState<HoldReason>("payment");
  const [mode, setMode] = useState<(typeof MODES)[number]>("notice"), [endWhy, setEndWhy] = useState<TerminateReason | "">("");
  const close = () => setOpen(null);
  return (w) => {
    const v = game.services.find((x) => x.id === w.serviceId && x.endedAt === null);
    if (!v) return null;
    const why = holdReason(game, v), kind = open?.id === v.id ? open.kind : null;
    const noticed = game.tickets.some((x) => x.kind === "notice" && x.serviceId === v.id && !isFinal(x));
    const suspend = (r: HoldReason) => { if (act(suspendService, v.id, r).ok) close(); };
    const ending = v.endsAt !== undefined;
    const actions: PanelAction[] = [
      why
        ? { id: "unhold", label: t(labels.unsuspend), run: () => act(unsuspendService, v.id) }
        : { id: "hold", label: t(labels.suspend), run: () => (asks ? setOpen({ id: v.id, kind: "suspend" }) : suspend(noticed ? "abuse" : "manual")) },
      ...(ending ? [] : [{ id: "terminate", label: t(labels.terminate), tone: "danger" as const, run: () => setOpen({ id: v.id, kind: "terminate" }) }]),
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
        <label className="cx-field">{t("host.terminateMode")}
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>{MODES.map((m) => <option key={m} value={m}>{t(`host.mode.${m}`)}</option>)}</select>
        </label>
        <label className="cx-field">{t("host.reason")}
          <select value={endWhy} onChange={(e) => setEndWhy(e.target.value as TerminateReason | "")}>
            <option value="" disabled={mode === "now"}>{t("host.reason.none")}</option>
            {TERMINATE_REASONS.map((r) => <option key={r} value={r}>{t(`host.reason.${r}`)}</option>)}
          </select>
        </label>
        <button className="cx-btn danger" disabled={mode === "now" && !endWhy} onClick={() => { if (act(terminateService, v.id, mode, endWhy || null).ok) close(); }}>{t(labels.terminate)}</button>
        <button className="cx-btn" onClick={close}>{t("host.cancel")}</button>
      </div>
    ) : null;
    return { actions, panel, state: why ? [t("host.held", { reason: t(`host.reason.${why}`) }), "bad"] : ending ? [t("host.ends", { date: day(v.endsAt!) }), "warn"] : null };
  };
}
