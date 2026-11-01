import { useState } from "react";
import { t } from "../../../../../i18n/en";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { MACROS, type Macro } from "../../../../../sim/60-infra/exposure";
import { DEFAULT_GROUP, floatingOf, groupsOf, volumesOf } from "../../../../../sim/60-infra/horizont";
import { allocateFloatingIp, associateFloatingIp, attachVolume, createVolume, deallocateFloatingIp, deleteGroup, deleteVolume, saveGroup, setInstanceGroups } from "../../../../../sim/90-actions/horizont";
import type { Vm } from "../HypervisorBase";
import { usePageAct } from "../../pageAct";

const empty = <tr><td colSpan={8} className="cx-empty">{t("browser-consoles-1.hzNoItems")}</td></tr>;
const macroLabel = (m: Macro) => t(`hzn.macro.${m}`);

// Project > Network > Floating IPs: the addresses rented for the project and the instance each points at.
export function FloatingIps({ game, c, vms }: { game: GameState; c: Cluster; vms: Vm[] }) {
  const act = usePageAct(), rows = floatingOf(c), mine = vms.filter((v) => v.own);
  return (
    <>
      <div className="cx-hv-head"><h1>{t("hzn.floatingIps")}</h1><button className="cx-btn primary" onClick={() => act(allocateFloatingIp, c.id)}>{t("hzn.allocate")}</button></div>
      <table className="cx-table hz-table">
        <thead><tr><th>{t("hzn.ipAddress")}</th><th>{t("hzn.mappedInstance")}</th><th>{t("hzn.pool")}</th><th>{t("browser-consoles-1.status")}</th><th /></tr></thead>
        <tbody>
          {rows.length === 0 && empty}
          {rows.map((f) => (
            <tr key={f.ip}>
              <td className="num">{f.ip}</td>
              <td>
                <select value={f.workloadId ?? ""} onChange={(e) => act(associateFloatingIp, c.id, f.ip, e.target.value || null)}>
                  <option value="">-</option>
                  {mine.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </td>
              <td>{game.locations.find((l) => l.az === c.az)?.city ?? "-"}</td>
              <td>{f.workloadId ? t("hzn.active") : t("hzn.down")}</td>
              <td><button className="cx-btn" onClick={() => act(deallocateFloatingIp, c.id, f.ip)}>{t("hzn.release")}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// Project > Network > Security Groups: the groups with their macros, and the instances each one covers.
export function SecurityGroups({ c, vms }: { c: Cluster; vms: Vm[] }) {
  const act = usePageAct(), [name, setName] = useState(""), [sel, setSel] = useState<string | null>(null);
  const groups = groupsOf(c), cur = groups.find((g) => g.id === sel);
  const toggle = (g: { id: string; name: string; allow: Macro[] }, m: Macro) => act(saveGroup, c.id, g.id, g.name, g.allow.includes(m) ? g.allow.filter((x) => x !== m) : [...g.allow, m]);
  return (
    <>
      <div className="cx-hv-head">
        <h1>{t("hzn.securityGroups")}</h1>
        <span><input value={name} onChange={(e) => setName(e.target.value)} aria-label={t("browser-consoles-1.name")} /> <button className="cx-btn primary" onClick={() => { if (act(saveGroup, c.id, null, name, []).ok) setName(""); }}>{t("hzn.createGroup")}</button></span>
      </div>
      <table className="cx-table hz-table">
        <thead><tr><th>{t("browser-consoles-1.name")}</th><th>{t("hzn.instances")}</th><th /></tr></thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.id}>
              <td>{g.name}</td>
              <td className="num">{vms.filter((v) => v.w.groupIds?.includes(g.id)).length}</td>
              <td>
                <button className="cx-btn" onClick={() => setSel(sel === g.id ? null : g.id)}>{t("hzn.manageRules")}</button>
                {g.id !== DEFAULT_GROUP.id && <button className="cx-btn" onClick={() => act(deleteGroup, c.id, g.id)}>{t("hzn.delete")}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {cur && (
        <>
          <h4 className="cx-h">{cur.name}</h4>
          <table className="cx-table hz-table">
            <thead><tr><th>{t("hzn.rule")}</th><th>{t("hzn.direction")}</th><th /></tr></thead>
            <tbody>
              {MACROS.map((m) => (
                <tr key={m}>
                  <td>{macroLabel(m)}</td><td>{t("hzn.ingress")}</td>
                  <td><input type="checkbox" checked={cur.allow.includes(m)} onChange={() => toggle(cur, m)} aria-label={macroLabel(m)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}

// The groups of one instance as ticks, on its Overview tab.
export function InstanceGroups({ c, v }: { c: Cluster; v: Vm }) {
  const act = usePageAct(), on = v.w.groupIds ?? [];
  return (
    <div className="cx-field">
      {groupsOf(c).map((g) => (
        <label key={g.id}>
          <input type="checkbox" checked={on.includes(g.id)} disabled={!v.own} onChange={() => act(setInstanceGroups, v.id, on.includes(g.id) ? on.filter((x) => x !== g.id) : [...on, g.id])} />
          {g.name} ({g.allow.map(macroLabel).join(", ") || "-"})
        </label>
      ))}
    </div>
  );
}

// Project > Volumes > Volumes: block storage that outlives its instance.
export function Volumes({ c, vms }: { c: Cluster; vms: Vm[] }) {
  const act = usePageAct(), [name, setName] = useState(""), [gb, setGb] = useState(10), mine = vms.filter((v) => v.own);
  return (
    <>
      <div className="cx-hv-head">
        <h1>{t("hzn.volumes")}</h1>
        <span>
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label={t("browser-consoles-1.name")} />
          <input type="number" min={1} max={1000} value={gb} onChange={(e) => setGb(+e.target.value)} aria-label={t("hzn.size")} />
          <button className="cx-btn primary" onClick={() => { if (act(createVolume, c.id, name, gb).ok) setName(""); }}>{t("hzn.createVolume")}</button>
        </span>
      </div>
      <table className="cx-table hz-table">
        <thead><tr><th>{t("browser-consoles-1.name")}</th><th>{t("hzn.size")}</th><th>{t("browser-consoles-1.status")}</th><th>{t("hzn.attachedTo")}</th><th /></tr></thead>
        <tbody>
          {volumesOf(c).length === 0 && empty}
          {volumesOf(c).map((v) => (
            <tr key={v.id}>
              <td>{v.name}</td><td className="num">{v.gb}GB</td>
              <td>{v.attachedTo ? t("hzn.inUse") : t("hzn.available")}</td>
              <td>
                <select value={v.attachedTo ?? ""} onChange={(e) => act(attachVolume, c.id, v.id, e.target.value || null)}>
                  <option value="">-</option>
                  {mine.map((x) => <option key={x.id} value={x.id} disabled={!!v.attachedTo && x.id !== v.attachedTo}>{x.name}</option>)}
                </select>
              </td>
              <td><button className="cx-btn" onClick={() => act(deleteVolume, c.id, v.id)}>{t("hzn.delete")}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
