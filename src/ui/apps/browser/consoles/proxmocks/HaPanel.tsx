import { useState } from "react";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { deleteHaGroup, saveHaGroup, setHaGroup } from "../../../../../sim/90-actions/hagroups";
import { t } from "../../../../../i18n/en";
import { useStore } from "../../../../store";
import { nodeName } from "../HypervisorBase";

// Datacenter > HA: the Groups and Resources tables and the Create: HA Group form.
export function HaPanel({ game, c }: { game: GameState; c: Cluster }) {
  const act = useStore((s) => s.act), groups = c.haGroups ?? [];
  const [name, setName] = useState(""), [restricted, setRestricted] = useState(false), [noFailback, setNoFailback] = useState(false);
  const [prio, setPrio] = useState<Record<string, number>>({});
  const nodes = Object.entries(prio).filter(([, p]) => p > 0).map(([deviceId, priority]) => ({ deviceId, priority }));
  const vms = game.workloads.filter((w) => w.clusterId === c.id && w.deviceId && !w.template);
  return (
    <>
      <section className="pmx-panel">
        <h4>{t("pmx.haGroups")}</h4>
        <table className="cx-table">
          <thead><tr><th>ID</th><th>{t("pmx.restricted")}</th><th>{t("pmx.noFailback")}</th><th>{t("pmx.nodes")}</th><th /></tr></thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id}>
                <td>{g.name}</td><td>{g.restricted ? t("pmx.yes") : t("pmx.no")}</td><td>{g.noFailback ? t("pmx.yes") : t("pmx.no")}</td>
                <td>{[...g.nodes].sort((a, b) => b.priority - a.priority).map((n) => `${nodeName(game, n.deviceId)}:${n.priority}`).join(", ")}</td>
                <td><button className="cx-btn" onClick={() => act(deleteHaGroup, c.id, g.id)}>{t("pmx.remove")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="pmx-panel">
        <h4>{t("pmx.createHaGroup")}</h4>
        <label className="cx-field">{t("pmx.haGroupId")}<input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
        <label className="cx-field"><input type="checkbox" checked={restricted} onChange={(e) => setRestricted(e.target.checked)} />{t("pmx.restricted")}</label>
        <label className="cx-field"><input type="checkbox" checked={noFailback} onChange={(e) => setNoFailback(e.target.checked)} />{t("pmx.noFailback")}</label>
        {c.nodes.map((n) => (
          <label className="cx-field" key={n.deviceId}>{nodeName(game, n.deviceId)}
            <input type="number" min={0} max={1000} value={prio[n.deviceId] ?? 0} onChange={(e) => setPrio({ ...prio, [n.deviceId]: Number(e.target.value) })} />
          </label>
        ))}
        <div className="cx-tools">
          <button className="cx-btn" disabled={!name.trim() || !nodes.length} onClick={() => { act(saveHaGroup, c.id, { name, nodes, restricted, noFailback }); setName(""); setPrio({}); }}>{t("pmx.create")}</button>
        </div>
      </section>
      <section className="pmx-panel">
        <h4>{t("pmx.haResources")}</h4>
        <table className="cx-table">
          <thead><tr><th>ID</th><th>{t("pmx.node")}</th><th>{t("pmx.group")}</th></tr></thead>
          <tbody>
            {vms.map((w) => (
              <tr key={w.id}>
                <td className="num">{w.hostname ?? w.id}</td><td>{nodeName(game, w.deviceId)}</td>
                <td>
                  <select value={w.haGroup ?? ""} onChange={(e) => act(setHaGroup, w.id, e.target.value || null)}>
                    <option value="">{t("pmx.none")}</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
