import type { GameState, Location } from "../../../sim/50-state";
import { freePositions, locationRent } from "../../../sim/60-infra/status";
import { euro } from "../../../sim/00-core/money";
import type { ReactNode } from "react";
import { Logo } from "../../art/logos";
import { cityNamed, WorldMap, type Marker } from "../../map/WorldMap";
import { day } from "../hw";
import { backupLabel, dcOf, exchangeLabel, Facts, feedsLabel, locationPower, PowerMeter, providerOf, spaceLabel, Zone } from "./ui";

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

function LocationCard({ game, loc, onOpen }: { game: GameState; loc: Location; onOpen: () => void }) {
  const dc = dcOf(loc), power = locationPower(game, loc.id), used = loc.positions - freePositions(game, loc.id).length;
  const arriving = game.racks.filter((r) => r.locationId === loc.id && r.arriveAt !== null);
  return (
    <div className="loc-card loc-site" onClick={onOpen}>
      <div className="loc-card-h">
        <h3><Logo provider={providerOf(loc)} size={18} /><button className="loc-link" onClick={onOpen}>{loc.name}</button><Zone loc={loc} /></h3>
        <span className="grow" />
        {loc.readyAt > game.hour && <span className="pill">Ready <span className="num">{day(loc.readyAt)}</span></span>}
      </div>
      <Facts rows={[
        ["Space", spaceLabel(loc, game)],
        ...(loc.space === "share" ? [] : [["Positions", <span className="num">{used} / {loc.positions}</span>] as [string, ReactNode]]),
        ["Rent", loc.dc ? <span className="num">{euro(locationRent(game, loc))} / month</span> : "None"],
        ["Power protection", dc ? `${feedsLabel(dc)}, ${backupLabel(dc)}` : "None"],
        ["Green power", dc?.green ? "Yes" : "No"],
        ["Carriers", dc ? <span className="num">{dc.carriers}</span> : "Home line"],
        ["Exchange", exchangeLabel(dc)],
      ]} />
      <div className="loc-row"><span className="loc-k">Power</span><PowerMeter watts={power.watts} limit={power.limit} tripped={power.tripped} /></div>
      {arriving.map((r) => <div key={r.id} className="loc-row"><span className="loc-k">In transit</span>{r.name}<span className="grow" /><span className="num">{day(r.arriveAt!)}</span></div>)}
    </div>
  );
}
