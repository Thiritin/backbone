import { ChevronDown, ChevronRight, Map as MapIcon, Package, Plus } from "lucide-react";
import { useRef, useState } from "react";
import type { GameState } from "../../../sim/50-state";
import { storageStacks } from "../../../sim/60-infra/status";
import { Logo } from "../../art/logos";
import { useStore } from "../../store";
import { day } from "../hw";
import { AddLocation } from "./AddLocation";
import { CarrierPanel, Floor } from "./Floor";
import { Inspector } from "./Inspector";
import "./locations.css";
import { Overview } from "./Overview";
import { RackView } from "./RackView";
import { Storage } from "./Storage";
import { backupLabel, dcOf, exchangeLabel, feedsLabel, locationPower, PowerMeter, providerOf, spaceLabel, useDismiss } from "./ui";

// view: null is the overview, "storage" the storage list, otherwise a location id.
export function LocationsApp() {
  const game = useStore((s) => s.game);
  const [view, setView] = useState<string | null>(null);
  const [rackId, setRackId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const loc = game.locations.find((l) => l.id === view);
  const rack = loc && game.racks.find((r) => r.id === rackId && r.locationId === loc.id);
  const go = (v: string | null, r: string | null = null) => { setView(v); setRackId(r); setDeviceId(null); };
  const stored = storageStacks(game).reduce((n, s) => n + s.ids.length, 0);

  return (
    <div className="loc">
      <div className="loc-bar">
        <button className="btn ghost" aria-pressed={view === null} onClick={() => go(null)}><MapIcon />Overview</button>
        <Switcher current={loc?.id ?? null} onPick={(id) => go(id)} />
        <button className="btn ghost icon" aria-label="Add location" onClick={() => setAdding(true)}><Plus /></button>
        {rack && <><ChevronRight className="loc-crumb" /><span className="loc-crumb-name">{rack.name}</span></>}
        <span className="grow" />
        <button className="btn ghost" aria-pressed={view === "storage"} onClick={() => go("storage")}><Package />Storage<span className="num loc-muted">{stored}</span></button>
      </div>
      <div className="loc-body">
        {view === "storage" ? (
          <div className="loc-scroll"><Storage game={game} /></div>
        ) : !loc ? (
          <Overview game={game} onOpen={(id) => go(id)} />
        ) : rack ? (
          <RackView key={rack.id} game={game} rack={rack} device={deviceId} onDevice={setDeviceId} onMoved={(id) => go(id ?? loc.id)} />
        ) : (
          <div className="loc-split">
            <div className="loc-scroll">
              <LocationHead game={game} locId={loc.id} />
              <Floor game={game} loc={loc} onRack={(id) => go(loc.id, id)} />
              <CarrierPanel game={game} loc={loc} selected={deviceId} onDevice={setDeviceId} />
              <Storage game={game} locationId={loc.id} />
            </div>
            {deviceId && game.devices.some((d) => d.id === deviceId && d.panel === loc.id) && (
              <div className="loc-insp"><Inspector key={deviceId} game={game} device={game.devices.find((d) => d.id === deviceId)!} onSelect={setDeviceId} /></div>
            )}
          </div>
        )}
      </div>
      {adding && <AddLocation onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); go(id); }} />}
    </div>
  );
}

function LocationHead({ game, locId }: { game: GameState; locId: string }) {
  const loc = game.locations.find((l) => l.id === locId)!, dc = dcOf(loc), power = locationPower(game, loc.id);
  return (
    <div className="loc-head">
      <Logo provider={providerOf(loc)} size={28} />
      <div className="loc-head-name">
        <h2>{loc.name}</h2>
        <span className="loc-muted">{loc.city} · {spaceLabel(loc)}</span>
      </div>
      <span className="grow" />
      {loc.readyAt > game.hour && <span className="pill">Ready <span className="num">{day(loc.readyAt)}</span></span>}
      {dc && <span className="pill">{feedsLabel(dc)}</span>}
      {dc && <span className="pill">{backupLabel(dc)}</span>}
      {dc?.green && <span className="pill">Green power</span>}
      {dc && <span className="pill">{exchangeLabel(dc)}</span>}
      <PowerMeter watts={power.watts} limit={power.limit} tripped={power.tripped} />
    </div>
  );
}

function Switcher({ current, onPick }: { current: string | null; onPick: (id: string) => void }) {
  const locations = useStore((s) => s.game.locations);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, () => setOpen(false));
  const loc = locations.find((l) => l.id === current);
  return (
    <div className="loc-switch" ref={ref}>
      <button className="btn ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {loc ? <><Logo provider={providerOf(loc)} size={16} />{loc.name}</> : "Locations"}<ChevronDown className="loc-caret" />
      </button>
      {open && (
        <div className="loc-menu" role="menu">
          {locations.map((l) => (
            <button key={l.id} role="menuitemradio" aria-checked={l.id === current} onClick={() => { setOpen(false); onPick(l.id); }}>
              <Logo provider={providerOf(l)} size={16} /><span>{l.name}</span><span className="loc-muted">{l.city}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
