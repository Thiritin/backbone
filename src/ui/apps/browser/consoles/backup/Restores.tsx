import { useState } from "react";
import type { GameState } from "../../../../../sim/50-state";
import { lostDisk, vmOf, type Cluster } from "../../../../../sim/60-infra/cluster";
import { restoreTargets, restoreTo } from "../../../../../sim/90-actions/vms";
import { useStore } from "../../../../store";
import { vmLabel } from "../../../products/parts";
import { hoursText } from "../../../workload-menu";
import { t } from "../../../../../i18n/en";

// The lost machines of the clusters that back up to server c, each with the nodes its backup can come back on.
export function Restores({ game, c }: { game: GameState; c: Cluster }) {
  const act = useStore((s) => s.act), [pick, setPick] = useState<Record<string, string>>({});
  const jobs = new Set(game.clusters.filter((x) => x.jobs.some((j) => j.targetId === c.id)).map((x) => x.id));
  const lost = game.workloads.filter((w) => !!w.clusterId && jobs.has(w.clusterId) && w.backupAt !== null && !vmOf(game, w) && lostDisk(game, w));
  if (!lost.length) return <p className="cx-empty">{t("browser-consoles-1.bkNoLost")}</p>;
  return (
    <table className="cx-table">
      <thead><tr><th>{t("browser-consoles-1.name")}</th><th>{t("browser-consoles-1.bkService")}</th><th>{t("browser-consoles-1.bkBackup")}</th><th>{t("browser-consoles-1.bkTarget")}</th><th /></tr></thead>
      <tbody>
        {lost.map((w) => {
          const targets = restoreTargets(game, w.id), to = pick[w.id] ?? targets[0]?.to ?? "", { name, service } = vmLabel(game, w);
          return (
            <tr key={w.id}>
              <td><b>{name}</b></td>
              <td>{service}</td>
              <td className="num">{t("browser-consoles-1.hoursAgo", { n: game.hour - w.backupAt! })}</td>
              <td>{targets.length ? (
                <select value={to} onChange={(e) => setPick({ ...pick, [w.id]: e.target.value })}>
                  {targets.map((x) => <option key={x.to} value={x.to}>{`${x.name} · ${game.clusters.find((k) => k.id === x.clusterId)?.name} · ${hoursText(x.down)}`}</option>)}
                </select>
              ) : t("browser-consoles-1.bkNoTarget")}</td>
              <td><button className="cx-btn" disabled={!to} onClick={() => act(restoreTo, w.id, to)}>{t("browser-consoles-1.bkRestore")}</button></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
