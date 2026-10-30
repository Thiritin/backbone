import { Landmark, Map as MapIcon, ShieldAlert } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { euro } from "../../../sim/00-core/money";
import { PROTECTIONS, type Protection } from "../../../sim/10-catalog/network";
import { datacenterById } from "../../../sim/20-world/datacenters";
import type { GameState } from "../../../sim/50-state";
import { monthlyNetworkCost, route } from "../../../sim/60-infra/network";
import { addressBills } from "../../../sim/60-infra/addresses";
import { setProtection } from "../../../sim/90-actions/network";
import { cityNamed, WorldMap, type Marker } from "../../map/WorldMap";
import { useStore } from "../../store";
import { mbps } from "../locations/NetworkTab";
import { Ripe } from "./Addresses";
import "../shop/shop.css";
import "../billing/billing.css";
import "../marketing/marketing.css";
import "./network.css";

type Page = "map" | "ddos" | "ripe";

// Company-wide network: the map of every site, DDoS protection and the address registry. Each site's uplinks and peering live in Locations.
export function NetworkApp() {
  const game = useStore((s) => s.game);
  const [page, setPage] = useState<Page>("map");
  const routing = useMemo(() => route(game), [game]);
  const now = Object.values(routing.zones).reduce((n, z) => n + z.carried, 0);
  const dropped = Object.values(routing.zones).reduce((n, z) => n + z.dropped, 0);
  const item = (key: Page, icon: ReactNode, label: string) => (
    <button key={key} className={`side-item${page === key ? " active" : ""}`} aria-pressed={page === key} onClick={() => setPage(key)}>{icon}{label}</button>
  );

  return (
    <div className="fin">
      <nav className="sidebar fin-side" aria-label="Sections">
        {item("map", <MapIcon />, "Map")}
        {item("ddos", <ShieldAlert />, "DDoS protection")}
        {item("ripe", <Landmark />, "RIPE")}
      </nav>
      <div className="fin-main">
        <dl className="fin-totals">
          <div><dt>Network per month</dt><dd className="num">{euro(monthlyNetworkCost(game) || 0)}</dd></div>
          <div><dt>Addresses</dt><dd className="num">{euro(-addressBills(game).reduce((n, b) => n + b.amount, 0) || 0)}</dd></div>
          <div><dt>Traffic now</dt><dd className="num">{mbps(now)}</dd></div>
          <div><dt>Dropped now</dt><dd className={`num${dropped > 0 ? " net-bad" : ""}`}>{mbps(dropped)}</dd></div>
          <div><dt>AS number</dt><dd className="num">{game.network.asn ? `AS${game.network.asn}` : "None"}</dd></div>
        </dl>
        <div className="fin-scroll">
          {page === "map" && <NetworkMap game={game} />}
          {page === "ddos" && <Ddos game={game} />}
          {page === "ripe" && <Ripe game={game} />}
        </div>
      </div>
    </div>
  );
}

function NetworkMap({ game }: { game: GameState }) {
  const markers = game.locations.flatMap((l): Marker[] => {
    const c = cityNamed(l.city);
    return c ? [{ id: l.id, lon: c.lon, lat: c.lat, label: `${l.az} ${l.name}`, kind: l.dc ? "location" : "basement", provider: l.dc ? datacenterById(l.dc).provider : null, alert: game.network.saturated.includes(l.id) }] : [];
  });
  return <WorldMap className="net-map" markers={markers} />;
}


const PROTECTION_INFO: Record<Protection, { name: string; text: string }> = {
  none: { name: "No protection", text: "Attacks hit your links at full strength." },
  onDemand: { name: PROTECTIONS.onDemand.name, text: "Filters an attack once it is detected, about ten minutes in." },
  alwaysOn: { name: PROTECTIONS.alwaysOn.name, text: "Filters all traffic all the time." },
};

function Ddos({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const n = game.network;
  return (
    <>
      <div className="shop-grid mkt-flat">
        {(["none", "onDemand", "alwaysOn"] as Protection[]).map((p) => {
          const def = p === "none" ? null : PROTECTIONS[p];
          return (
            <div key={p} className="shop-card">
              <div className="shop-name"><strong>{PROTECTION_INFO[p].name}</strong><span>{PROTECTION_INFO[p].text}</span></div>
              <dl className="shop-specs">
                <div><dt>Per month</dt><dd className="num">{euro(def?.monthly ?? 0)}</dd></div>
                <div><dt>Per attack</dt><dd className="num">{euro(def?.perIncident ?? 0)}</dd></div>
              </dl>
              <div className="shop-buy"><span className="grow" />
                {n.protection === p ? <span className="pill ok">Active</span> : <button className="btn" onClick={() => act(setProtection, p)}>Switch</button>}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
