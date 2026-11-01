import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { modelById } from "../../../../../sim/10-catalog/hardware";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { DEFAULT_SWITCH, switchesOf, type VSwitchType } from "../../../../../sim/60-infra/vswitch";
import { deleteSwitch, saveSwitch } from "../../../../../sim/90-actions/vswitch";
import { usePageAct } from "../../pageAct";

const TYPES: VSwitchType[] = ["external", "internal", "private"];

// Virtual Switch Manager: the switches on the left, the selected one's name, connection type and adapter on the right.
export function Switches({ game, c }: { game: GameState; c: Cluster }) {
  const act = usePageAct(), all = switchesOf(c), [sel, setSel] = useState<string | null>(DEFAULT_SWITCH);
  const cur = all.find((x) => x.id === sel), [name, setName] = useState(cur?.name ?? ""), [type, setType] = useState<VSwitchType>(cur?.type ?? "external"), [nic, setNic] = useState<number | null>(cur?.nic ?? null);
  const pick = (id: string | null) => { const x = all.find((y) => y.id === id); setSel(id); setName(x?.name ?? ""); setType(x?.type ?? "external"); setNic(x?.nic ?? null); };
  const ports = Math.min(...c.nodes.map((n) => { const d = game.devices.find((x) => x.id === n.deviceId); return d ? modelById(d.model).ports.length : 1; }));
  return (
    <div className="hv-settings-body">
      <ul className="hv-parts">
        <li className="hv-group">{t("hvx.newSwitchGroup")}</li>
        <li><button aria-pressed={sel === null} onClick={() => pick(null)}>{t("hvx.newSwitch")}</button></li>
        <li className="hv-group">{t("hvx.switches")}</li>
        {all.map((x) => <li key={x.id}><button aria-pressed={sel === x.id} onClick={() => pick(x.id)}>{x.name}</button></li>)}
      </ul>
      <div className="hv-form">
        <label className="cx-field">{t("browser-consoles-1.name")}<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <b>{t("hvx.connType")}</b>
        {TYPES.map((x) => <label key={x} className="cx-check"><input type="radio" name="hv-sw-type" checked={type === x} onChange={() => setType(x)} />{t(`hvx.type.${x}`)}</label>)}
        {type === "external" && (
          <label className="cx-field">{t("hvx.adapter")}
            <select value={nic ?? ""} onChange={(e) => setNic(e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">{t("hvx.anyAdapter")}</option>
              {Array.from({ length: ports }, (_, i) => <option key={i} value={i}>{t("hvx.adapterN", { n: i + 1 })}</option>)}
            </select>
          </label>
        )}
        <div className="cx-tools">
          <button className="cx-btn primary" onClick={() => { const r = act(saveSwitch, c.id, sel, name, type, type === "external" ? nic : null); if (r.ok && r.id) setSel(r.id); }}>{t("hvx.apply")}</button>
          {sel && sel !== DEFAULT_SWITCH && <button className="cx-btn" onClick={() => { act(deleteSwitch, c.id, sel); pick(DEFAULT_SWITCH); }}>{t("hvx.remove")}</button>}
        </div>
      </div>
    </div>
  );
}
