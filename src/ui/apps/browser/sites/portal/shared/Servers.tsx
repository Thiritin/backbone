import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { SERVES, type SoftwareKind } from "../../../../../../sim/10-catalog/platforms";
import type { NodeState } from "../../../../../../sim/60-infra/cluster";
import type { GameState } from "../../../../../../sim/50-state";
import { groupOf } from "../../../../../../sim/80-business/shop";
import { addToGroup, createGroup, deleteGroup, removeFromGroup, setGroupDeploy, setGroupSale } from "../../../../../../sim/90-actions/shop";
import { useStore } from "../../../../../store";
import { NodeActions } from "../../../consoles/HypervisorBase";
import { PRODUCT } from "../../../../support/labels";
import "../../../../marketing/marketing.css";

const NODE_STATE: Record<NodeState, string> = { active: t("marketing.nodeActive"), cordoned: t("marketing.nodeCordoned"), draining: t("marketing.nodeDraining"), maintenance: t("marketing.nodeMaintenance") };
const KIND: Partial<Record<SoftwareKind, string>> = { panel: t("marketing.kindPanel"), cloud: t("marketing.kindCloud"), game: t("marketing.kindGame"), dns: t("marketing.kindDns"), vpn: t("marketing.kindVpn"), storage: t("marketing.kindStorage") };

// Server groups: which software installations the shop sells from and deploys to.
export function Servers({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const [kind, setKind] = useState<SoftwareKind>("panel");
  const [name, setName] = useState("");
  return (
    <div className="mkt-list">
      <div className="side-h">{t("marketing.serverGroups")}</div>
      {game.shop.groups.map((g) => {
        const free = game.clusters.filter((c) => c.kind === g.kind && !groupOf(game, c.id));
        return (
          <div key={g.id} className="mkt-list">
            <div className="mkt-row">
              <strong className="mkt-grow">{g.name}</strong>
              <span className="mkt-sub">{KIND[g.kind]}</span>
              <button className="btn" onClick={() => act(deleteGroup, g.id)}>{t("marketing.delete")}</button>
            </div>
            {g.members.map((id) => game.clusters.find((c) => c.id === id)).filter((c) => !!c).map((c) => (
              <div key={c.id} className="mkt-list">
                <div className="mkt-row">
                  <span className="mkt-grow">{c.name}</span>
                  <button className="btn" onClick={() => act(removeFromGroup, g.id, c.id)}>{t("marketing.remove")}</button>
                </div>
                {c.nodes.map((n) => (
                  <div key={n.deviceId} className="mkt-row">
                    <span className="mkt-grow mkt-sub">{game.devices.find((d) => d.id === n.deviceId)?.label ?? game.devices.find((d) => d.id === n.deviceId)?.name}</span>
                    <span className="pill">{NODE_STATE[n.state]}</span>
                    <NodeActions c={c} n={n} className="btn" />
                  </div>
                ))}
              </div>
            ))}
            {free.length > 0 && (
              <div className="mkt-row">
                <select aria-label={t("marketing.addTo", { group: g.name })} value="" onChange={(e) => e.target.value && act(addToGroup, g.id, e.target.value)}>
                  <option value="">{t("marketing.addSoftware")}</option>
                  {free.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {SERVES[g.kind].map((p) => (
              <label key={p} className="mkt-row">
                <span className="mkt-grow">{t("marketing.sell", { product: PRODUCT[p] })}</span>
                <input type="checkbox" role="switch" className="switch" aria-label={t("marketing.sellFrom", { product: PRODUCT[p], group: g.name })} checked={g.sale.includes(p)} onChange={(e) => act(setGroupSale, g.id, p, e.target.checked)} />
              </label>
            ))}
            <label className="mkt-row">
              <span className="mkt-grow">{t("marketing.deployOrders")}</span>
              <input type="checkbox" role="switch" className="switch" aria-label={t("marketing.deployOrdersTo", { group: g.name })} checked={g.deploy} onChange={(e) => act(setGroupDeploy, g.id, e.target.checked)} />
            </label>
          </div>
        );
      })}
      <div className="mkt-row">
        <select aria-label={t("marketing.softwareKind")} value={kind} onChange={(e) => setKind(e.target.value as SoftwareKind)}>
          {Object.entries(KIND).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <input className="mkt-grow" aria-label={t("marketing.groupName")} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={!name.trim()} onClick={() => { act(createGroup, kind, name); setName(""); }}>{t("marketing.newGroup")}</button>
      </div>
    </div>
  );
}
