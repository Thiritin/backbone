import type { GameState } from "../../../../../sim/50-state";
import type { Cluster, Workload } from "../../../../../sim/60-infra/cluster";
import { CEPH_FROM_NODES, cephCapacity, cephCopies, cephOn, cephOsds, cephReadOnly, cephRebalancing, cephUsed, REPLICA_EVERY } from "../../../../../sim/60-infra/replica";
import { raidUsable } from "../../../../../sim/60-infra/status";
import { setCeph, setReplication } from "../../../../../sim/90-actions/replication";
import { t } from "../../../../../i18n/en";
import { formatClock } from "../../../../../sim/00-core/time";
import { nodeName } from "../HypervisorBase";
import { Bar, Facts } from "../PanelBase";
import { usePageAct } from "../../pageAct";

const EVERY = REPLICA_EVERY.proxmocks;
const gb = (n: number) => `${Math.round(n)} GB`;

// Replication of one VM, or the table of every replicated VM of the cluster.
export function Replication({ game, c, w }: { game: GameState; c: Cluster; w?: Workload }) {
  const act = usePageAct(), rows = game.workloads.filter((x) => x.clusterId === c.id && x.replica);
  const one = (v: Workload) => (
    <section className="pmx-panel" key={v.id}>
      <h4>{t("pmx.replication")}</h4>
      <Facts facts={[
        { label: t("pmx.target"), value: v.replica ? nodeName(game, v.replica.toNode) : t("pmx.none") },
        { label: t("pmx.schedule"), value: v.replica ? t(`pmx.every.${v.replica.every}`) : t("pmx.none") },
        { label: t("pmx.lastSync"), value: v.replica?.lastAt != null ? formatClock(v.replica.lastAt) : t("pmx.never") },
      ]} />
      <div className="cx-tools">
        {c.nodes.filter((n) => n.deviceId !== v.deviceId).map((n) => EVERY.map((e) => (
          <button key={n.deviceId + e} className="cx-chip" aria-pressed={v.replica?.toNode === n.deviceId && v.replica.every === e} onClick={() => act(setReplication, v.id, n.deviceId, e)}>{nodeName(game, n.deviceId)}, {t(`pmx.every.${e}`)}</button>
        )))}
        {v.replica && <button className="cx-btn" onClick={() => act(setReplication, v.id, null)}>{t("pmx.removeReplication")}</button>}
      </div>
    </section>
  );
  if (w) return one(w);
  return (
    <table className="cx-table">
      <thead><tr><th>ID</th><th>{t("pmx.source")}</th><th>{t("pmx.target")}</th><th>{t("pmx.schedule")}</th><th>{t("pmx.lastSync")}</th></tr></thead>
      <tbody>
        {rows.map((v) => (
          <tr key={v.id}><td className="num">{v.hostname ?? v.id}</td><td>{nodeName(game, v.deviceId)}</td><td>{nodeName(game, v.replica!.toNode)}</td><td>{t(`pmx.every.${v.replica!.every}`)}</td><td>{v.replica!.lastAt != null ? formatClock(v.replica!.lastAt) : t("pmx.never")}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

// Datacenter > Ceph: health, monitors, OSDs, the pool and its usage.
export function CephPanel({ game, c }: { game: GameState; c: Cluster }) {
  const act = usePageAct(), on = cephOn(c), capable = c.nodes.length >= CEPH_FROM_NODES;
  const health = !on ? "" : cephReadOnly(game, c) ? "HEALTH_ERR" : cephCopies(game, c) < c.ceph!.size || cephRebalancing(game, c) ? "HEALTH_WARN" : "HEALTH_OK";
  return (
    <>
      <section className="pmx-panel">
        <h4>Ceph</h4>
        {on && <Facts facts={[
          { label: t("pmx.health"), value: health },
          { label: t("pmx.monitors"), value: String(c.nodes.length), num: true },
          { label: t("pmx.pool"), value: `size ${c.ceph!.size}`, num: true },
          { label: t("pmx.usage"), value: `${gb(cephUsed(game, c))} / ${gb(cephCapacity(game, c))}`, num: true },
        ]} />}
        {on && <Bar use={[cephUsed(game, c), cephCapacity(game, c)]} />}
        <div className="cx-tools">
          {capable && ([2, 3] as const).map((n) => <button key={n} className="cx-chip" aria-pressed={on && c.ceph!.size === n} onClick={() => act(setCeph, c.id, true, n)}>{t("pmx.createPool", { size: n })}</button>)}
          {on && <button className="cx-btn" onClick={() => act(setCeph, c.id, false)}>{t("pmx.destroyPool")}</button>}
        </div>
      </section>
      {on && (
        <table className="cx-table">
          <thead><tr><th>OSD</th><th>{t("pmx.node")}</th><th>{t("pmx.drives")}</th><th>{t("pmx.inOut")}</th><th>{t("pmx.upDown")}</th></tr></thead>
          <tbody>{cephOsds(game, c).map((o, i) => <tr key={o.deviceId}><td className="num">osd.{i}</td><td>{nodeName(game, o.deviceId)}</td><td className="num">{o.drives}</td><td>in</td><td>{o.up ? "up" : "down"}</td></tr>)}</tbody>
        </table>
      )}
    </>
  );
}

// Datacenter > Storage: each node's local disk and the Ceph pool.
export function StorageList({ game, c }: { game: GameState; c: Cluster }) {
  return (
    <table className="cx-table">
      <thead><tr><th>ID</th><th>{t("pmx.type")}</th><th>{t("pmx.usage")}</th></tr></thead>
      <tbody>
        {c.nodes.map((n) => { const d = game.devices.find((x) => x.id === n.deviceId); return <tr key={n.deviceId}><td>local ({nodeName(game, n.deviceId)})</td><td>dir</td><td className="num">{d ? gb(raidUsable(d)) : ""}</td></tr>; })}
        {cephOn(c) && <tr><td>ceph-pool</td><td>rbd</td><td className="num">{gb(cephUsed(game, c))} / {gb(cephCapacity(game, c))}</td></tr>}
      </tbody>
    </table>
  );
}
