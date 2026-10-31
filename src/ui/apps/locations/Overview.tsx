import type { GameState, Location } from "../../../sim/50-state";
import { freePositions, locationRent } from "../../../sim/60-infra/status";
import { euro } from "../../../sim/00-core/money";
import type { ReactNode } from "react";
import { Logo } from "../../art/logos";
import { cityNamed, WorldMap, type Marker } from "../../map/WorldMap";
import { day, readyIn } from "../hw";
import { backupLabel, dcOf, exchangeLabel, Facts, feedsLabel, locationPower, PowerMeter, providerOf, spaceLabel, spaceSize, Zone } from "./ui";
import { Hourglass } from "lucide-react";
import { datacenterById, homeLineById } from "../../../sim/20-world/datacenters";
import { addLocation, leaveWaitlist } from "../../../sim/90-actions/hardware";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";

export function Overview({ game, onOpen }: { game: GameState; onOpen: (id: string) => void }) {
  return (
    <div className="loc-scroll">
      <WorldMap className="wm-overview" onMarkerClick={onOpen} markers={game.locations.flatMap((l): Marker[] => {
        const c = cityNamed(l.city);
        return c ? [{ id: l.id, lon: c.lon, lat: c.lat, label: l.name, kind: l.dc ? "location" : "basement", provider: providerOf(l), alert: locationPower(game, l.id).tripped }] : [];
      })} />
      <div className="loc-cards">
        {game.locations.map((l) => <LocationCard key={l.id} game={game} loc={l} onOpen={() => onOpen(l.id)} />)}
      </div>
    </div>
  );
}

export function Waitlist({ game, onOpen }: { game: GameState; onOpen: (id: string) => void }) {
  const act = useStore((s) => s.act);
  return (
    <div className="loc-card loc-wait">
      <div className="loc-card-h"><h3><Hourglass />{t("locations-2.waitlist")}</h3><span className="grow" /><span className="num loc-muted">{game.waitlist.length}</span></div>
      {game.waitlist.map((w) => {
        const dc = datacenterById(w.dc);
        return (
          <div key={w.id} className="loc-row">
            <Logo provider={dc.provider} size={18} />
            <strong>{dc.name}</strong>
            <span>{spaceSize(w.space, w.size)}</span>
            <span className="grow" />
            {w.heldUntil !== null
              ? <span className="loc-held">{t("locations-2.heldUntil", { day: day(w.heldUntil) })}</span>
              : <span className="loc-muted">{t("locations-2.waitingSince", { day: day(w.since) })}</span>}
            {w.heldUntil !== null && <button className="btn primary" onClick={() => { const r = act(addLocation, w.dc, w.space, w.size); if (r.ok && r.id) onOpen(r.id); }}>{t("locations-2.rent")}</button>}
            <button className="btn" onClick={() => act(leaveWaitlist, w.id)}>{t("locations-2.leave")}</button>
          </div>
        );
      })}
    </div>
  );
}

function LocationCard({ game, loc, onOpen }: { game: GameState; loc: Location; onOpen: () => void }) {
  const dc = dcOf(loc), power = locationPower(game, loc.id), used = loc.positions - freePositions(game, loc.id).length;
  const arriving = game.racks.filter((r) => r.locationId === loc.id && r.arriveAt !== null);
  return (
    <div className={`loc-card loc-site${loc.readyAt > game.hour ? " loc-pending" : ""}`} onClick={onOpen}>
      <div className="loc-card-h">
        <h3><Logo provider={providerOf(loc)} size={18} /><button className="loc-link" onClick={onOpen}>{loc.name}</button><Zone loc={loc} /></h3>
        <span className="grow" />
        {loc.readyAt > game.hour && <span className="pill warn">{t("locations-2.readyIn", { time: readyIn(loc.readyAt, game.hour) })}</span>}
      </div>
      <Facts rows={[
        [t("locations-2.space"), spaceLabel(loc, game)],
        ...(loc.space === "share" ? [] : [[t("locations-2.positions"), <span className="num">{used} / {loc.positions}</span>] as [string, ReactNode]]),
        [t("locations-2.rentLabel"), loc.dc ? <span className="num">{t("locations-2.perMonth", { amount: euro(locationRent(game, loc)) })}</span> : t("locations-2.none")],
        [t("locations-2.powerProtection"), dc ? `${feedsLabel(dc)}, ${backupLabel(dc)}` : t("locations-2.none")],
        [t("locations-2.greenPower"), dc?.green ? t("locations-2.yes") : t("locations-2.no")],
        [t("locations-2.carriers"), dc ? <span className="num">{dc.carriers}</span> : `${homeLineById(game.homeLine.id).isp} ${homeLineById(game.homeLine.id).name}`],
        [t("locations-2.exchange"), exchangeLabel(dc)],
      ]} />
      <div className="loc-row"><span className="loc-k">{t("locations-2.power")}</span><PowerMeter watts={power.watts} limit={power.limit} tripped={power.tripped} /></div>
      {arriving.map((r) => <div key={r.id} className="loc-row"><span className="loc-k">{t("locations-2.inTransit")}</span>{r.name}<span className="grow" /><span className="num">{day(r.arriveAt!)}</span></div>)}
    </div>
  );
}
