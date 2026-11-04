// docs/design/gdd/connectivity.md: a connection between two racks, both backs side by side.
import { useEffect, useState } from "react";
import { t } from "../../../i18n/en";
import { euro } from "../../../sim/00-core/money";
import { PANEL_JACKS, PROVIDER_CABLE } from "../../../sim/10-catalog/uplinks";
import { rackUnits } from "../../../sim/20-world/datacenters";
import type { End } from "../../../sim/50-state";
import { isProviderPanel, panelOf } from "../../../sim/60-infra/panels";
import { portPeers } from "../../../sim/60-infra/status";
import { orderProviderCable } from "../../../sim/90-actions/connectivity";
import { connect } from "../../../sim/90-actions/hardware";
import { RackFront } from "../../art/RackFront";
import { formatDay } from "../../apps/billing/format";
import { roleName } from "../../apps/locations/ProviderJack";
import { rackItems, rackLinks, rackRemotes } from "../../apps/locations/RackView";
import { useStore } from "../../store";
import { Slab } from "../panel/Slab";
import { endName } from "./Cables";
import { ProviderPanel } from "./ProviderPanel";
import "../../apps/locations/locations.css";
import "../panel/panel.css";
import "./rack.css";

const BACK_U = 30;
const same = (a: End, b: End) => a.device === b.device && a.port === b.port;

// A cable is dragged, or clicked port to port, from one back to the other. Two provider-side jacks on different racks become a
// provider cable order on a slip the player signs; everything else is cabled by hand where the floor allows it.
export function PairPanel({ a, b, from = null, onClose }: { a: string; b: string; from?: string | null; onClose: () => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const [hand, setHand] = useState<End | null>(null);
  const [slip, setSlip] = useState<{ a: End; b: End } | null>(null);
  const [sel, setSel] = useState<string | null>(from);
  const racks = [a, b].map((id) => game.racks.find((r) => r.id === id)!).filter(Boolean);
  const gone = racks.length < 2;
  useEffect(() => { if (gone) onClose(); }, [gone, onClose]);
  if (gone) return null;

  const peerOf = (e: End) => portPeers(game, e.device)[e.port] ?? null;
  const jackRack = (e: End) => { const d = game.devices.find((x) => x.id === e.device); return d && isProviderPanel(d) && e.port < PANEL_JACKS ? d.rackId : null; };
  const join = (x: End, y: End) => {
    setHand(null);
    const rx = jackRack(x), ry = jackRack(y);
    if (rx && ry && rx !== ry) setSlip({ a: x, b: y });
    else act(connect, x, y);
  };
  const plug = (e: End) => {
    if (!hand) { setSlip(null); setHand(e); }
    else if (same(hand, e)) setHand(null);
    else join(hand, e);
  };
  const title = (e: End) => { const p = peerOf(e); return `${endName(game, e)} ↔ ${p ? endName(game, p) : t("locations-1.free")}`; };
  const sign = () => {
    const s = slip!, ra = jackRack(s.a)!, rb = jackRack(s.b)!;
    if (act(orderProviderCable, ra, s.a.port, rb, s.b.port).ok) setSlip(null);
  };

  return (
    <Slab title={racks.map((r) => r.name).join(" ↔ ")} onClose={onClose} onBack={() => (hand ? (setHand(null), true) : slip ? (setSlip(null), true) : false)} data={{ "pair-panel": `${a} ${b}` }}>
      <div className="wr-stage pp" style={{ ["--z" as string]: 0.9, ["--units" as string]: Math.max(...racks.map((r) => rackUnits(r.model))) }}>
        <div className="wr-room">
          <div className="wr-pair">
            {racks.map((r) => {
              const pp = panelOf(game, r.id), units = rackUnits(r.model);
              return (
                <div key={r.id} className="wr-scene" data-side={r.id}>
                  <div className="wr-cab">
                    {pp && <ProviderPanel game={game} panel={pp} hand={hand} onJack={plug} onConnect={join} />}
                    <div className="wr-plate" data-plate=""><b>{r.name}</b></div>
                    <div className="wr-face">
                      <RackFront units={units} items={rackItems(game, r.id)} links={rackLinks(game, r.id)} remotes={rackRemotes(game, r)} side="back" w={BACK_U * 19} u={BACK_U} duct
                        selected={sel} onDevice={(id) => setSel(id === sel ? null : id)} onFree={() => {}} onPort={plug} hand={hand} portTitle={title} onConnect={join} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {slip && (
            <div className="wr-tag wr-slip" data-slip="">
              <div className="wr-tag-body">
                <div className="wr-tag-h"><strong>{roleName("provider-cable")}</strong></div>
                <div className="wr-model">{endName(game, slip.a)} ↔ {endName(game, slip.b)}</div>
                <div className="wr-model">{t("locations-1.dueOn", { day: formatDay(game.hour + PROVIDER_CABLE.leadHours) })}</div>
                <div className="wr-lines">
                  <button className="wr-line" onClick={sign}>{t("locations-1.orderProviderCable", { fee: euro(PROVIDER_CABLE.fee), days: PROVIDER_CABLE.leadHours / 24 })}</button>
                  <button className="wr-line" onClick={() => setSlip(null)}>{t("locations-2.cancel")}</button>
                </div>
              </div>
            </div>
          )}
          <div className="wr-floor" />
        </div>
      </div>
    </Slab>
  );
}
