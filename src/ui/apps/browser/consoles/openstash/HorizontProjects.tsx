import { useState } from "react";
import { t } from "../../../../../i18n/en";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { ADMIN, projectsOf, projectUsage, type Quota, type QuotaKey } from "../../../../../sim/60-infra/projects";
import { deleteProject, saveProject } from "../../../../../sim/90-actions/projects";
import { useStore } from "../../../../store";

const TABS: [string, QuotaKey[]][] = [["hzp.compute", ["instances", "vcpu", "ramGb"]], ["hzp.volume", ["volumeGb"]], ["hzp.network", ["floatingIps"]]];
const KEYS: QuotaKey[] = TABS.flatMap(([, k]) => k);
const cell = (used: number, limit: number | null) => `${used} / ${limit ?? "∞"}`;

// Identity > Projects: the project table and the Create Project and Modify Quotas dialog with its Compute, Volume and Network tabs.
export function Projects({ game, c }: { game: GameState; c: Cluster }) {
  const act = useStore((s) => s.act), projects = projectsOf(c);
  const [edit, setEdit] = useState<{ id?: string; name: string; customerId: string; quota: Record<QuotaKey, string> } | null>(null), [tab, setTab] = useState(0);
  const open = (id?: string) => {
    const p = projects.find((x) => x.id === id);
    setTab(0);
    setEdit({ id, name: p?.name ?? "", customerId: p?.customerId ?? "", quota: Object.fromEntries(KEYS.map((k) => [k, p?.quota[k]?.toString() ?? ""])) as Record<QuotaKey, string> });
  };
  const save = () => {
    if (!edit) return;
    const quota = Object.fromEntries(KEYS.map((k) => [k, edit.quota[k].trim() === "" ? null : Number(edit.quota[k])])) as unknown as Quota;
    if (act(saveProject, c.id, { id: edit.id, name: edit.name, customerId: edit.customerId || null, quota }).ok) setEdit(null);
  };
  return (
    <>
      <table className="cx-table">
        <thead><tr><th>{t("hzp.name")}</th><th>{t("hzp.customer")}</th><th>{t("hzp.instances")}</th><th>{t("hzp.vcpu")}</th><th>{t("hzp.ramGb")}</th><th>{t("hzp.volumeGb")}</th><th>{t("hzp.floatingIps")}</th><th /></tr></thead>
        <tbody>
          {projects.map((p) => {
            const u = projectUsage(game, c, p.id);
            return (
              <tr key={p.id}>
                <td>{p.name}</td><td>{game.customers.find((x) => x.id === p.customerId)?.name ?? ""}</td>
                {KEYS.map((k) => <td key={k} className="num">{cell(u[k], p.quota[k])}</td>)}
                <td>
                  {p.id !== ADMIN && <button className="cx-btn" onClick={() => open(p.id)}>{t("hzp.modifyQuotas")}</button>}
                  {p.id !== ADMIN && <button className="cx-btn" onClick={() => act(deleteProject, c.id, p.id)}>{t("hzp.delete")}</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="cx-tools"><button className="cx-btn" onClick={() => open()}>{t("hzp.create")}</button></div>
      {edit && (
        <section className="hz-card" role="dialog" aria-label={edit.id ? t("hzp.modifyQuotas") : t("hzp.create")}>
          <label className="cx-field">{t("hzp.name")}<input value={edit.name} maxLength={40} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
          <label className="cx-field">{t("hzp.customer")}
            <select value={edit.customerId} onChange={(e) => setEdit({ ...edit, customerId: e.target.value })}>
              <option value="">{t("hzp.noCustomer")}</option>
              {game.customers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          <nav className="cx-hv-tabs hz-tabs">{TABS.map(([label], i) => <button key={label} aria-pressed={tab === i} onClick={() => setTab(i)}>{t(label)}</button>)}</nav>
          {TABS[tab][1].map((k) => (
            <label className="cx-field" key={k}>{t(`hzp.${k}`)}
              <input type="number" min={0} placeholder={"∞"} value={edit.quota[k]} onChange={(e) => setEdit({ ...edit, quota: { ...edit.quota, [k]: e.target.value } })} />
            </label>
          ))}
          <div className="cx-tools">
            <button className="cx-btn" disabled={!edit.name.trim()} onClick={save}>{t("hzp.save")}</button>
            <button className="cx-btn" onClick={() => setEdit(null)}>{t("hzp.cancel")}</button>
          </div>
        </section>
      )}
    </>
  );
}
