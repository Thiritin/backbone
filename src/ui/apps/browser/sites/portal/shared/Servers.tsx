import { PSelect, PBtn } from "./ui";
import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { SERVES } from "../../../../../../sim/10-catalog/platforms";
import type { ShopId } from "../../../../../../sim/10-catalog/shops";
import { nodeCapacity, nodeUsed, type Cluster } from "../../../../../../sim/60-infra/cluster";
import type { GameState } from "../../../../../../sim/50-state";
import { accountsOn, groupKind, groupOf, type Fill } from "../../../../../../sim/80-business/shop";
import { addToGroup, createGroup, deleteGroup, moveMember, removeFromGroup, setGroupFill, setMemberActive } from "../../../../../../sim/90-actions/shop";
import { useStore } from "../../../../../store";

// Shop systems whose real counterpart lets a server group choose how it fills its servers.
const FILL_CHOICE: ShopId[] = ["whmCache", "hostBull", "blessta"];
const FILL: [Fill, string][] = [["spread", t("shop-admin.fillSpread")], ["fill", t("shop-admin.fillFirst")]];

// The share of its nodes' RAM an installation has booked.
function load(s: GameState, c: Cluster): string {
  const devices = c.nodes.map((n) => s.devices.find((d) => d.id === n.deviceId)).filter((d) => !!d);
  const cap = devices.reduce((n, d) => n + nodeCapacity(d, s).ramGb, 0), used = devices.reduce((n, d) => n + nodeUsed(s, d.id, true).ramGb, 0);
  return cap > 0 ? (used / cap).toLocaleString(LOCALE, { style: "percent" }) : "";
}

// Server groups: the installations each group's products are placed on, which take new orders, and in what order.
export function Servers({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const [name, setName] = useState("");
  const choice = !!game.shop.variant && FILL_CHOICE.includes(game.shop.variant);
  return (
    <div className="pt-list">
      <div className="pt-list-h">{t("marketing.serverGroups")}</div>
      {game.shop.groups.map((g) => {
        const kind = groupKind(game, g);
        const free = game.clusters.filter((c) => SERVES[c.kind].length && (!kind || c.kind === kind) && !groupOf(game, c.id));
        const members = g.members.map((id) => game.clusters.find((c) => c.id === id)).filter((c) => !!c);
        return (
          <div key={g.id} className="pt-list">
            <div className="pt-row">
              <strong className="pt-grow">{g.name}</strong>
              <PBtn onClick={() => act(deleteGroup, g.id)}>{t("marketing.delete")}</PBtn>
            </div>
            {choice && (
              <div className="pt-row" role="radiogroup" aria-label={t("shop-admin.fill")}>
                <span className="pt-grow">{t("shop-admin.fill")}</span>
                {FILL.map(([k, label]) => <label key={k}><input type="radio" name={`fill-${g.id}`} checked={g.fill === k} onChange={() => act(setGroupFill, g.id, k)} /> {label}</label>)}
              </div>
            )}
            {members.map((c, i) => (
              <div key={c.id} className="pt-row">
                <span className="pt-grow">{c.name}</span>
                <span className="pt-sub">{t("shop-admin.accounts", { n: accountsOn(game, c.id) })}</span>
                <span className="pt-sub num">{load(game, c)}</span>
                <label>
                  {t("shop-admin.active")}{" "}
                  <input type="checkbox" checked={!g.inactive.includes(c.id)} onChange={(e) => act(setMemberActive, g.id, c.id, e.target.checked)} />
                </label>
                <PBtn aria-label={t("shop-admin.moveUp")} disabled={i === 0} onClick={() => act(moveMember, g.id, c.id, -1)}>↑</PBtn>
                <PBtn aria-label={t("shop-admin.moveDown")} disabled={i === members.length - 1} onClick={() => act(moveMember, g.id, c.id, 1)}>↓</PBtn>
                <PBtn onClick={() => act(removeFromGroup, g.id, c.id)}>{t("marketing.remove")}</PBtn>
              </div>
            ))}
            {free.length > 0 && (
              <div className="pt-row">
                <PSelect aria-label={t("marketing.addTo", { group: g.name })} value="" onChange={(e) => e.target.value && act(addToGroup, g.id, e.target.value)}>
                  <option value="">{t("marketing.addSoftware")}</option>
                  {free.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </PSelect>
              </div>
            )}
          </div>
        );
      })}
      <div className="pt-row">
        <input className="pt-grow" aria-label={t("marketing.groupName")} value={name} onChange={(e) => setName(e.target.value)} />
        <PBtn disabled={!name.trim()} onClick={() => { act(createGroup, name); setName(""); }}>{t("marketing.newGroup")}</PBtn>
      </div>
    </div>
  );
}
