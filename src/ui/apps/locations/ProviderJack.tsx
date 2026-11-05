// docs/design/gdd/connectivity.md: a jack on the provider panel of a rented rack, and the provider cable chooser from a free one.
import { EthernetPort } from "lucide-react";
import { useState } from "react";
import { euro } from "../../../sim/00-core/money";
import { carrierById, exchangeById } from "../../../sim/10-catalog/network";
import { PROVIDER_CABLE } from "../../../sim/10-catalog/uplinks";
import { datacenterById } from "../../../sim/20-world/datacenters";
import type { Device, GameState } from "../../../sim/50-state";
import { jackRoles, panelOf, type JackRole } from "../../../sim/60-infra/panels";
import { cancelProviderCable, orderProviderCable } from "../../../sim/90-actions/connectivity";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { PayStep, type Purchase } from "../browser/sites/shared/PayStep";
import { formatDay } from "../billing/format";
import { speed } from "./NetworkTab";

const partner = (id: string) => carrierById(id)?.name ?? exchangeById(id)?.name ?? id;
export const roleName = (r: JackRole) => t(`locations-1.jackRole.${r}`);

// Racks a provider cable can reach from this one: other rented racks in the same datacenter, across shares or within one share.
export function reachable(game: GameState, rackId: string) {
  const loc = (id: string) => game.locations.find((l) => l.id === game.racks.find((r) => r.id === id)?.locationId);
  const here = loc(rackId);
  return game.racks.filter((r) => {
    const there = loc(r.id);
    return r.id !== rackId && panelOf(game, r.id) && there?.dc === here?.dc && (there?.id !== here?.id || here?.space === "share");
  });
}

// The provider cable order between two jacks, paid to the datacenter when it is installed.
export function cableOrder(game: GameState, rackA: string, jackA: number, rackB: string, jackB: number): Purchase & { key: string } {
  const dc = game.locations.find((l) => l.id === game.racks.find((r) => r.id === rackA)?.locationId)?.dc;
  return {
    key: `${rackA}-${jackA}-${rackB}-${jackB}`, supplier: "network", name: dc ? datacenterById(dc).name : "DE-KICKS", amount: PROVIDER_CABLE.fee,
    run: (m) => useStore.getState().act(orderProviderCable, rackA, jackA, rackB, jackB, m),
  };
}

export function ProviderJack({ game, device, port }: { game: GameState; device: Device; port: number }) {
  const act = useStore((s) => s.act);
  const role = jackRoles(game, device.id)[port];
  const at = (e?: { device: string; port: number }) => e?.device === device.id && e.port === port;
  const line = game.network.uplinks.flatMap((u) => u.links.map((l) => ({ u, l }))).find((x) => at(x.l.jack));
  const xc = game.crossConnects.find((x) => at(x.jack));
  const racks = reachable(game, device.rackId ?? "");
  const [rack, setRack] = useState(racks[0]?.id ?? "");
  const other = panelOf(game, rack);
  const free = other ? jackRoles(game, other.id).flatMap((r, i) => (r === "free" ? [i] : [])) : [];
  const [jack, setJack] = useState<number | null>(null);
  const [buy, setBuy] = useState<Purchase & { key: string } | null>(null);
  const to = jack !== null && free.includes(jack) ? jack : free[0];
  const queued = game.providerCables.filter((o) => o.a.device === device.id || o.b.device === device.id);
  const name = (e: { device: string; port: number }) => `${game.devices.find((d) => d.id === e.device)?.name ?? ""} ${e.port + 1}`;

  return (
    <div className="loc-card">
      <div className="loc-card-h"><h3><EthernetPort />{t("locations-2.jack", { panel: t("locations-1.carrierPanel"), jack: port + 1 })}</h3><span className={`pill${role === "free" ? "" : " ok"}`}>{roleName(role)}</span></div>
      <dl className="loc-facts">
        {line && <div><dt>{roleName("uplink")}</dt><dd>{partner(line.u.partner)} <span className="num">{speed(line.l.gbit)}</span></dd></div>}
        {xc && <div><dt>{roleName("xconnect")}</dt><dd>{partner(xc.to)}</dd></div>}
      </dl>
      {role === "free" && racks.length > 0 && (
        <div className="loc-connect">
          <div className="picks" role="group" aria-label={t("locations-2.rack")}>
            {racks.map((r) => <button key={r.id} className="pick" aria-pressed={r.id === rack} onClick={() => { setRack(r.id); setJack(null); }}><strong>{r.name}</strong></button>)}
          </div>
          <div className="loc-row">
            <div className="seg wrap" role="group" aria-label={t("locations-1.jack")}>
              {free.map((i) => <button key={i} className="num" aria-pressed={i === to} onClick={() => setJack(i)}>{i + 1}</button>)}
            </div>
            <span className="grow" />
            <button className="btn primary" disabled={to === undefined} onClick={() => setBuy(cableOrder(game, device.rackId!, port, rack, to!))}>
            {t("locations-1.orderProviderCable", { fee: euro(PROVIDER_CABLE.fee), days: PROVIDER_CABLE.leadHours / 24 })}
            </button>
          </div>
        </div>
      )}
      {buy && <PayStep key={buy.key} game={game} buy={buy} onClose={() => setBuy(null)} />}
      {queued.length > 0 && (
        <ul className="net-links">
          {queued.map((o) => (
            <li key={o.id}><span>{name(o.a)} / {name(o.b)}</span><span className="grow" /><span className="num">{t("locations-1.dueOn", { day: formatDay(o.dueAt) })}</span>
              <button className="btn" onClick={() => act(cancelProviderCable, o.id)}>{t("locations-2.cancel")}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
