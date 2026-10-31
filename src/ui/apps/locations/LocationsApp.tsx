import { Hourglass, Map as MapIcon, Plus } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { t } from "../../../i18n/en";
import { useSessionState } from "../../session";
import type { GameState, Location, Rack } from "../../../sim/50-state";
import { locationOf, storageStacks } from "../../../sim/60-infra/status";
import { clusterOf } from "../../../sim/60-infra/cluster";
import { Logo } from "../../art/logos";
import { humOf, setHum } from "../../sounds";
import { useFocus, useStore } from "../../store";
import { readyIn } from "../hw";
import { AddLocation } from "./AddLocation";
import { Cabling } from "./Cabling";
import { BookedMeters } from "./Clusters";
import { CarrierPanel, Floor } from "./Floor";
import { HomeLinePanel } from "./HomeLine";
import { Inspector } from "./Inspector";
import { PlanButton, useMaintenance, Windows, windowsAtLocation } from "./Maintenance";
import { menuOn } from "../../desktop/ContextMenu";
import "./locations.css";
import { NetworkTab, networkCount } from "./NetworkTab";
import { Overview, Waitlist } from "./Overview";
import { RackView, Upgrades } from "./RackView";
import { Storage } from "./Storage";
import { backupLabel, dcOf, exchangeLabel, feedsLabel, LocName, locationPower, PowerMeter, providerOf, RoomTemp, spaceLabel, Zone } from "./ui";
import { REGIONS } from "../../../sim/20-world/datacenters";

type Tab = "floor" | "cabling" | "storage" | "network" | "line";

// view: null is the overview, "waitlist" the waitlist, otherwise a location id.
export function LocationsApp() {
  const game = useStore((s) => s.game);
  const [view, setView] = useSessionState<string | null>("locations.sel", null);
  const [rackId, setRackId] = useSessionState<string | null>("locations.rack", null);
  const [deviceId, setDeviceId] = useSessionState<string | null>("locations.device", null);
  const [picked, setTab] = useSessionState<Tab>("locations.tab", "floor");
  const [adding, setAdding] = useState(false);
  const loc = game.locations.find((l) => l.id === view);
  const rack = loc && game.racks.find((r) => r.id === rackId && r.locationId === loc.id);
  useHum(game, loc, rack);
  const tab: Tab = picked === "line" && loc?.space !== "basement" ? "floor" : picked;
  const setOpenLoc = useStore((s) => s.setOpenLoc);
  const go = (v: string | null, r: string | null = null) => {
    setView(v); setRackId(r); setDeviceId(null);
    if (r) setTab("floor");
    if (v && v !== "waitlist") setOpenLoc(v);
  };
  // Another app asked for a location, or for a device in its rack or on its floor.
  useFocus("Locations", (f) => {
    if (f.kind === "line") {
      const home = game.locations.find((l) => l.space === "basement");
      if (home) { go(home.id); setTab("line"); }
      return;
    }
    if (f.kind !== "device" && f.kind !== "location") return;
    const d = f.kind === "device" ? game.devices.find((x) => x.id === f.id) : undefined;
    const l = d ? locationOf(game, d) : game.locations.find((x) => x.id === f.id);
    if (!l) return;
    go(l.id, d?.rackId ?? null);
    if (d) { setTab("floor"); setDeviceId(d.id); }
  });
  const item = (key: string, active: boolean, label: ReactNode, onClick: () => void, count?: number, pending?: boolean) => (
    <button key={key} className={`side-item${active ? " active" : ""}${pending ? " loc-pending" : ""}`} aria-pressed={active} onClick={onClick}>
      {label}{count ? <span className="side-count">{count}</span> : null}
    </button>
  );

  return (
    <div className="loc">
      <nav className="sidebar fin-side" aria-label={t("locations-1.locations")}>
        {item("overview", view === null, <><MapIcon />{t("locations-1.overview")}</>, () => go(null))}
        {game.waitlist.length > 0 && item("waitlist", view === "waitlist", <><Hourglass />{t("locations-1.waitlist")}</>, () => go("waitlist"), game.waitlist.length)}
        {REGIONS.filter((r) => game.locations.some((l) => l.city === r.city)).map((r) => (
          <div key={r.id} className="fin-side" role="group" aria-label={r.name}>
            <div className="side-h">{r.name}</div>
            {game.locations.filter((l) => l.city === r.city).flatMap((l) => [
              item(l.id, l.id === loc?.id && !rack, <><Logo provider={providerOf(l)} size={16} /><LocName loc={l} />
                {l.readyAt > game.hour && <span className="side-count num">{readyIn(l.readyAt, game.hour)}</span>}</>, () => go(l.id), undefined, l.readyAt > game.hour),
              ...(l.id === loc?.id ? game.racks.filter((k) => k.locationId === l.id).map((k) =>
                item(k.id, k.id === rack?.id, <span className="loc-side-rack">{k.name}</span>, () => go(l.id, k.id))) : []),
            ])}
          </div>
        ))}
        <span className="grow" />
        {item("add", false, <><Plus />{t("locations-1.addLocation")}</>, () => setAdding(true))}
      </nav>
      <div className="loc-main">
        {view === "waitlist" ? (
          <div className="loc-scroll"><Waitlist game={game} onOpen={(id) => go(id)} /></div>
        ) : !loc ? (
          <Overview game={game} onOpen={(id) => go(id)} />
        ) : (
          <>
            {!rack && <LocationHead game={game} locId={loc.id} />}
            {!rack && <LocationTabs game={game} locId={loc.id} tab={tab} onTab={(t) => { setTab(t); setRackId(null); setDeviceId(null); }} />}
            <div className={`loc-body${loc.readyAt > game.hour ? " loc-pending" : ""}`} role="tabpanel">
              {tab === "cabling" ? (
                <Cabling key={loc.id} game={game} loc={loc} />
              ) : tab === "storage" ? (
                <div className="loc-scroll"><Storage game={game} loc={loc} onMounted={(r, d) => { go(loc.id, r); setDeviceId(d); }} /></div>
              ) : tab === "network" ? (
                <div className="loc-scroll"><NetworkTab key={loc.id} game={game} loc={loc} /></div>
              ) : tab === "line" ? (
                <div className="loc-scroll"><HomeLinePanel game={game} /></div>
              ) : rack ? (
                <RackView key={rack.id} game={game} rack={rack} device={deviceId} onDevice={setDeviceId} onMoved={(id) => go(id ?? loc.id)} />
              ) : (
                <div className="loc-split">
                  <div className="loc-scroll">
                    <Upgrades loc={loc} />
                    <Floor game={game} loc={loc} onRack={(id) => go(loc.id, id)} />
                    <CarrierPanel game={game} loc={loc} selected={deviceId} onDevice={setDeviceId} />
                  </div>
                  {deviceId && game.devices.some((d) => d.id === deviceId && d.panel === loc.id) && (
                    <div className="loc-insp"><Inspector key={deviceId} game={game} device={game.devices.find((d) => d.id === deviceId)!} onSelect={setDeviceId} /></div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {adding && <AddLocation onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); go(id); }} />}
    </div>
  );
}

function LocationTabs({ game, locId, tab, onTab }: { game: GameState; locId: string; tab: Tab; onTab: (t: Tab) => void }) {
  const loc = game.locations.find((l) => l.id === locId)!;
  const stored = storageStacks(game, loc.id).reduce((n, s) => n + s.ids.length, 0);
  const tabs: [Tab, string, number?][] = [
    ["floor", t("locations-1.floor")], ["cabling", t("locations-1.cabling")], ["storage", t("locations-1.storage"), stored],
    ["network", t("locations-1.network"), networkCount(game, loc)],
    ...(loc.space === "basement" ? [["line", t("locations-1.internetLine")] as [Tab, string]] : []),
  ];
  return (
    <div className="tabs loc-tabs" role="tablist" aria-label={t("locations-1.location")}>
      {tabs.map(([id, label, count]) => (
        <button key={id} role="tab" aria-selected={tab === id} onClick={() => onTab(id)}>
          {label}{count ? <span className="tab-count num">{count}</span> : null}
        </button>
      ))}
    </div>
  );
}


function LocationHead({ game, locId }: { game: GameState; locId: string }) {
  const loc = game.locations.find((l) => l.id === locId)!, dc = dcOf(loc), power = locationPower(game, loc.id);
  const nodes = game.devices.filter((d) => d.rackId && clusterOf(game, d.id) && locationOf(game, d)?.id === loc.id);
  const mnt = useMaintenance(), target = { kind: "location", id: loc.id } as const, windows = windowsAtLocation(game, loc.id);
  return (
    <header className="loc-top">
    <div className="loc-head" onContextMenu={menuOn(() => [{ label: t("locations-1.planMaintenance"), run: () => mnt.plan(target) }])}>
      <Logo provider={providerOf(loc)} size={28} />
      <div className="loc-head-name">
        <h2>{loc.name}<Zone loc={loc} /></h2>
        <span className="loc-muted">{loc.city} · {spaceLabel(loc, game)}</span>
      </div>
      <span className="grow" />
      {loc.readyAt > game.hour && <span className="pill warn">{t("locations-1.readyIn")} <span className="num">{readyIn(loc.readyAt, game.hour)}</span></span>}
      {dc && <span className="pill">{feedsLabel(dc)}</span>}
      {dc && <span className="pill">{backupLabel(dc)}</span>}
      {dc?.green && <span className="pill">{t("locations-1.greenPower")}</span>}
      {dc && <span className="pill">{exchangeLabel(dc)}</span>}
      <PowerMeter watts={power.watts} limit={power.limit} tripped={power.tripped} />
      <RoomTemp g={game} loc={loc} />
      <PlanButton target={target} plan={(t) => mnt.plan(t)} />
    </div>
    {windows.length > 0 && <div className="loc-head-meters"><Windows game={game} windows={windows} plan={mnt.plan} /></div>}
    {mnt.dialog}
    {nodes.length > 0 && <div className="loc-head-meters"><BookedMeters game={game} devices={nodes} /></div>}
    </header>
  );
}


const onVisibility = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};

// Fans heard close up at a rack, from the doorway on a floor, and muffled while another window is in front.
function useHum(game: GameState, loc: Location | undefined, rack: Rack | undefined) {
  const { on, ambience } = useStore((s) => s.sound);
  const front = useStore((s) => {
    const open = s.windows.filter((w) => !w.minimized), me = open.find((w) => w.app === "Locations");
    return !me ? 0 : me.z === Math.max(...open.map((w) => w.z)) ? 1 : 0.35;
  });
  const hidden = useSyncExternalStore(onVisibility, () => document.hidden);
  const { level, pitch, hall } = humOf(game, rack ? [rack.id] : game.racks.filter((r) => r.locationId === loc?.id).map((r) => r.id));
  const gain = on && !hidden ? level * ambience * front * (rack ? 1 : 0.5) : 0;
  const cutoff = (rack ? 5000 : 1400) * (front < 1 ? 0.3 : 1);
  useEffect(() => setHum(gain, pitch, cutoff, hall), [gain, pitch, cutoff, hall]);
  useEffect(() => () => setHum(0, 1, 400, false), []);
}
