import { formatClock } from "../../../../../sim/00-core/time";
import { t } from "../../../../../i18n/en";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster, Workload } from "../../../../../sim/60-infra/cluster";
import { REPLICA_EVERY, replicaHost, replicaReady } from "../../../../../sim/60-infra/replica";
import { failoverReplica, setReplication } from "../../../../../sim/90-actions/replication";
import { nodeName } from "../HypervisorBase";
import { Facts } from "../PanelBase";
import { usePageAct } from "../../pageAct";

// Replication Health: Normal while the last copy is recent, Warning while it ages, Critical after half a day.
const health = (game: GameState, w: Workload) => (w.replica?.lastAt == null ? "warning" : game.hour - w.replica.lastAt <= 2 ? "normal" : game.hour - w.replica.lastAt <= 12 ? "warning" : "critical");

// The hosts a replica can go to: the cluster's other nodes and the nodes of other HyperVee clusters in the zone.
const hostsFor = (game: GameState, c: Cluster, w: Workload): string[] =>
  game.clusters.flatMap((x) => x.nodes.map((n) => n.deviceId)).filter((id) => id !== w.deviceId && replicaHost(game, c, id));

// The Replication tab of a VM: Enable Replication, health and Failover.
export function Replica({ game, c, w }: { game: GameState; c: Cluster; w: Workload }) {
  const act = usePageAct(), r = w.replica;
  return (
    <>
      <table className="hv-kv"><tbody><tr><th>{t("browser-consoles-1.hvReplicationState")}:</th><td>{r ? t("hvx.replicating") : t("browser-consoles-1.hvNotEnabled")}</td></tr></tbody></table>
      {r && (
        <Facts facts={[
          { label: t("pmx.target"), value: nodeName(game, r.toNode) },
          { label: t("hvx.frequency"), value: t(`hvx.every.${r.every}`) },
          { label: t("hvx.health"), value: t(`hvx.health.${health(game, w)}`) },
          { label: t("pmx.lastSync"), value: r.lastAt != null ? formatClock(r.lastAt) : t("pmx.never") },
        ]} />
      )}
      <div className="cx-tools">
        {hostsFor(game, c, w).map((id) => REPLICA_EVERY.hypervee.map((e) => (
          <button key={id + e} className="cx-chip" aria-pressed={r?.toNode === id && r.every === e} onClick={() => act(setReplication, w.id, id, e)}>{nodeName(game, id)}, {t(`hvx.every.${e}`)}</button>
        )))}
        {r && replicaReady(game, w) && <button className="cx-btn" onClick={() => act(failoverReplica, w.id)}>{t("hvx.failover")}</button>}
        {r && <button className="cx-btn" onClick={() => act(setReplication, w.id, null)}>{t("pmx.removeReplication")}</button>}
      </div>
    </>
  );
}
