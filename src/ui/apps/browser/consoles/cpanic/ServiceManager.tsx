import { Check } from "lucide-react";
import { t } from "../../../../../i18n/en";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";

const DAEMONS = ["web", "mail", "name", "ssh", "panel"] as const;

// WHN > Service Configuration > Service Manager.
export function ServiceManager({ game, c }: { game: GameState; c: Cluster }) {
  const off = game.security.offline.includes(c.id);
  return (
    <table className="cx-table">
      <thead><tr><th>{t("readouts.service")}</th><th>{t("readouts.enabled")}</th><th>{t("readouts.monitor")}</th><th>{t("readouts.status")}</th></tr></thead>
      <tbody>
        {DAEMONS.map((d) => {
          const stopped = d === "web" && off;
          return (
            <tr key={d}>
              <td><b>{t(`readouts.svc.${d}`)}</b></td>
              <td><Check size={14} aria-label={t("readouts.enabled")} /></td>
              <td><Check size={14} aria-label={t("readouts.monitor")} /></td>
              <td><span className={`cx-state ${stopped ? "bad" : "ok"}`}>{t(stopped ? "readouts.stopped" : "readouts.running")}</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
