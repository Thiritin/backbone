import { Check, Play, RotateCw, Square } from "lucide-react";
import { t } from "../../../../i18n/en";
import { nowMinutes } from "../../../../sim/00-core/time";
import type { GameState } from "../../../../sim/50-state";
import type { Cluster } from "../../../../sim/60-infra/cluster";
import { restarting, serviceName, servicesOf } from "../../../../sim/60-infra/panel-services";
import { restartService } from "../../../../sim/90-actions/panel-ops";
import { usePageAct } from "../pageAct";

// docs/design/plans/panel-ops.md, Services: cPanic Service Manager, Pleskit Services Management, DirectAdmen Service Monitor, FreePanel Bootup and Shutdown.
export function ServicesPage({ game, c }: { game: GameState; c: Cluster }) {
  const act = usePageAct(), family = c.panel ?? "", off = game.security.offline.includes(c.id);
  const rows = servicesOf(c).map((x) => {
    const busy = restarting(game, c.id, x.id);
    const minutes = busy ? (game.webpanel.restarts[c.id]?.[x.id] ?? 0) - nowMinutes(game) : 0;
    const stopped = !busy && x.slot === "web" && off;
    const status = <span className={`cx-state ${stopped ? "bad" : busy ? "" : "ok"}`}>{busy ? t("panel-services.restarting", { minutes }) : t(stopped ? "readouts.stopped" : "readouts.running")}</span>;
    const restart = () => act(restartService, c.id, x.id);
    return { id: x.id, name: serviceName(game, c, x.id), busy, status, restart };
  });
  const button = (r: (typeof rows)[number]) => <button className="cx-btn" disabled={r.busy} onClick={r.restart}>{t("panel-services.restart")}</button>;
  const check = (label: string) => <Check size={14} aria-label={label} />;

  if (family === "pleskit") return (
    <table className="cx-table">
      <thead><tr><th>{t("panel-services.service")}</th><th>{t("readouts.status")}</th><th>{t("panel-services.actions")}</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.id}>
          <td><b>{r.name}</b></td>
          <td>{r.status}</td>
          <td className="cx-acts">
            <button className="cx-btn" disabled aria-label={t("panel-services.start")}><Play size={14} aria-hidden /></button>
            <button className="cx-btn" disabled aria-label={t("panel-services.stop")}><Square size={14} aria-hidden /></button>
            <button className="cx-btn" disabled={r.busy} aria-label={t("panel-services.restart")} onClick={r.restart}><RotateCw size={14} aria-hidden /></button>
          </td>
        </tr>
      ))}</tbody>
    </table>
  );
  if (family === "freepanel") return (
    <table className="cx-table">
      <thead><tr><th>{t("panel-services.action")}</th><th>{t("panel-services.atBoot")}</th><th>{t("panel-services.running")}</th><th /></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.id}>
          <td>{r.name}</td>
          <td>{check(t("panel-services.atBoot"))}</td>
          <td>{r.status}</td>
          <td>{button(r)}</td>
        </tr>
      ))}</tbody>
    </table>
  );
  const cp = family === "cpanic";
  return (
    <table className="cx-table">
      <thead><tr><th>{t(cp ? "readouts.service" : "panel-services.name")}</th>{cp && <><th>{t("readouts.enabled")}</th><th>{t("readouts.monitor")}</th></>}<th>{t("readouts.status")}</th><th /></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.id}>
          <td><b>{r.name}</b></td>
          {cp && <><td>{check(t("readouts.enabled"))}</td><td>{check(t("readouts.monitor"))}</td></>}
          <td>{r.status}</td>
          <td>{button(r)}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}
