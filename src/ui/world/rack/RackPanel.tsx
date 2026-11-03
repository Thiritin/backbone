import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { t } from "../../../i18n/en";
import { modelById } from "../../../sim/10-catalog/hardware";
import { rackUnits } from "../../../sim/20-world/datacenters";
import type { GameState, Rack } from "../../../sim/50-state";
import { freeSlots, mountFrom } from "../../../sim/60-infra/status";
import { installCarried } from "../../../sim/90-actions/carry";
import { Isometric } from "../../art/Isometric";
import { RackFront } from "../../art/RackFront";
import { menuOn } from "../../desktop/ContextMenu";
import { tidy, type MenuItem } from "../../desktop/menu";
import { reduced } from "../../desktop/motion";
import { deviceLamps } from "../../apps/hw";
import { useHandWork } from "../../apps/locations/HandSheet";
import { LabelEdit, useDeviceMenu } from "../../apps/locations/Inspector";
import { LidSheet } from "../../apps/locations/LidSheet";
import { mountable, MountRow, rackItems } from "../../apps/locations/RackView";
import { useStore } from "../../store";
import "../../apps/locations/locations.css";
import "./rack.css";

export const SLIDE_MS = 220;
// The rack frame's border in pixels: a cap above the units, sides and a foot.
const CAP = 36, SIDE = 18, FOOT = 18;
const CABLED = ["switch", "gateway", "firewall"];

// The rack close-up that slides up over the room: the rack on the left, the picked unit's card on the right.
export function RackPanel({ rackId, onClose }: { rackId: string; onClose: () => void }) {
  const game = useStore((s) => s.game), openApp = useStore((s) => s.openApp);
  const rack = game.racks.find((r) => r.id === rackId);
  const [shown, setShown] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  // A carried unit opens the panel on the lowest free unit it fits.
  const [free, setFree] = useState<number | null>(() => carriedFit(game, rackId)[0] ?? null);
  const [lid, setLid] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const ref = useRef<HTMLDivElement>(null), closing = useRef(false);
  const pick = (id: string | null) => { setSel(id); setFree(null); setLid(null); setRenaming(false); };
  const menus = useDeviceMenu(game, pick, (id) => { pick(id); setRenaming(true); }, [lid, (id) => { if (id) pick(id); setLid(id); }]);
  const hand = useHandWork();

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    setShown(false);
    setTimeout(onClose, reduced() ? 0 : SLIDE_MS);
  };
  const live = useRef({ close, lid });
  live.current = { close, lid };
  useEffect(() => { const id = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(id); }, []);
  useEffect(() => {
    // Escape belongs to whatever sits above the panel first.
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || (e.target as HTMLElement).closest?.("input, textarea, select")) return;
      if ([...document.querySelectorAll("[role=dialog], [role=alertdialog], [role=menu]")].some((el) => el !== ref.current && !ref.current?.contains(el))) return;
      if (live.current.lid) setLid(null);
      else live.current.close();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const gone = !rack;
  useEffect(() => { if (gone) onClose(); }, [gone, onClose]);
  if (!rack) return null;

  const units = rackUnits(rack.model), items = rackItems(game, rack.id);
  const used = items.filter((it) => !it.chassisId).reduce((n, it) => n + it.model.height, 0);
  const dev = game.devices.find((d) => d.id === sel && d.rackId === rack.id);
  const ports = (id: string) => { onClose(); openApp("Locations", { kind: "device", id }); };

  let side: ReactNode = null;
  if (lid && dev) side = <LidSheet key={lid} deviceId={lid} inline onClose={() => setLid(null)} />;
  else if (dev) side = <DeviceCard deviceId={dev.id} renaming={renaming} onRenaming={setRenaming} entries={() => menus.entries(dev)} onPorts={CABLED.includes(modelById(dev.model).kind) ? () => ports(dev.id) : undefined} />;
  else if (free !== null) side = <InstallCard rack={rack} unit={free} onMount={(task) => hand.start(game, { ...task, onDone: () => pick(task.deviceId) })} onPick={pick} />;

  return (
    <>
      <div className={`wr-veil${shown ? " in" : ""}`} onPointerDown={close} />
      <div ref={ref} className={`wr-panel${shown ? " in" : ""}`} role="dialog" aria-label={rack.name} data-rack-panel={rack.id}>
        <div className="wr-head">
          <h2>{rack.name}</h2>
          <span className="wr-num">{used} / {units} U</span>
          <button className="wr-x" aria-label={t("locations-2.close")} onClick={close}><X /></button>
        </div>
        <div className="wr-body">
          <RackFrame units={units}>
            {(w, u) => (
              <RackFront units={units} items={items} w={w} u={u} selected={dev?.id ?? null}
                onDevice={(id) => pick(id === sel ? null : id)} onFree={(unit) => { pick(null); setFree(unit); }} onDeviceMenu={(id, e) => { const d = game.devices.find((x) => x.id === id); if (d) menuOn(() => menus.entries(d))(e); }} />
            )}
          </RackFrame>
          <div className="wr-side">{side}</div>
        </div>
        {menus.dialog}
        {hand.dialog}
      </div>
    </>
  );
}

// The rack's metal frame around the drawn units, sized so the units stay readable in the panel.
function RackFrame({ units, children }: { units: number; children: (w: number, u: number) => ReactNode }) {
  const room = (typeof innerHeight === "number" ? innerHeight : 768) * 0.66 - 120 - CAP - FOOT;
  const u = Math.max(10, Math.min(24, Math.floor((room - 8) / units))), w = u * 19;
  // RackFront's front view without the cable channel it draws to the right.
  const iw = w + 36, ih = units * u + 8, ow = iw + 2 * SIDE, oh = ih + CAP + FOOT;
  return (
    <svg className="wr-rack" width={ow} height={oh} viewBox={`0 0 ${ow} ${oh}`}>
      <rect className="wr-frame" width={ow} height={oh} rx="4" />
      <rect className="wr-frame-top" x="3" y="3" width={ow - 6} height={CAP - 8} rx="2" />
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} className="wr-vent" x={ow / 2 - 40 + i * 18} y="11" width="10" height={CAP - 24} rx="1" />)}
      <rect className="wr-frame-top" x="3" y={oh - FOOT + 5} width={ow - 6} height={FOOT - 8} rx="2" />
      <svg x={SIDE} y={CAP} width={iw} height={ih} overflow="hidden">{children(w, u)}</svg>
    </svg>
  );
}

function DeviceCard({ deviceId, renaming, onRenaming, entries, onPorts }: { deviceId: string; renaming: boolean; onRenaming: (on: boolean) => void; entries: () => ReturnType<ReturnType<typeof useDeviceMenu>["entries"]>; onPorts?: () => void }) {
  const game = useStore((s) => s.game);
  const d = game.devices.find((x) => x.id === deviceId)!;
  const m = modelById(d.model), lamps = deviceLamps(game, d.id, m);
  const items = tidy(entries());
  return (
    <div className="wr-card" data-device={d.id}>
      <div className="wr-card-h">
        <LabelEdit device={d} editing={renaming} onEditing={onRenaming} />
        <span className="wr-model">{m.kind === "server" ? `${d.brand} ${m.name}` : m.name}</span>
        <span className="wr-leds">
          <span className={`wr-led ${lamps.state}`} />
          <span>{t(d.on ? "locations-1.stOn" : "locations-1.stOff")}</span>
        </span>
      </div>
      <div className="wr-acts">
        {onPorts && <button className="wr-btn" onClick={onPorts}>{t("locations-1.ports")}</button>}
        {items.map((e, i) => (e === null ? <hr key={i} /> : <Act key={i} e={e} />))}
      </div>
    </div>
  );
}

// A menu entry as a button; one with a submenu opens it under the button.
function Act({ e }: { e: MenuItem }) {
  return <button className="wr-btn" disabled={e.disabled} onClick={e.items ? menuOn(() => e.items!) : e.run}>{e.label}{e.items && " ›"}</button>;
}

function InstallCard({ rack, unit, onMount, onPick }: { rack: Rack; unit: number; onMount: Parameters<typeof MountRow>[0]["onMount"]; onPick: (id: string) => void }) {
  const game = useStore((s) => s.game);
  const rows = mountable(game, rack, unit);
  return (
    <div className="wr-card" data-free={unit}>
      <div className="wr-card-h"><h2>{`U${unit}`}</h2><span className="wr-model">{t("locations-1.empty")}</span></div>
      <div className="loc-shop-list">
        {carriedFit(game, rack.id).includes(unit) && <CarriedRow game={game} rack={rack} unit={unit} onDone={onPick} />}
        {rows.map((st) => <MountRow key={`${st.model}|${st.brand}`} game={game} rack={rack} st={st} unit={unit} onMount={onMount} />)}
        {!rows.length && !carriedFit(game, rack.id).includes(unit) && <div className="loc-shop-none">{t("locations-2.noStoredFits")}</div>}
      </div>
    </div>
  );
}

// Free units the carried unit can go into, one per start slot and every unit of its run.
function carriedFit(game: GameState, rackId: string): number[] {
  const d = game.devices.find((x) => x.id === game.player.carrying), rack = game.racks.find((r) => r.id === rackId);
  if (!d || !rack || rack.locationId !== game.player.at) return [];
  const h = modelById(d.model).height;
  if (modelById(d.model).kind === "part" || !h) return [];
  return freeSlots(game, rackId, 1).filter((u) => mountFrom(game, rackId, h, 1, u) !== undefined);
}

function CarriedRow({ game, rack, unit, onDone }: { game: GameState; rack: Rack; unit: number; onDone: (id: string) => void }) {
  const act = useStore((s) => s.act);
  const d = game.devices.find((x) => x.id === game.player.carrying)!, m = modelById(d.model);
  const from = mountFrom(game, rack.id, m.height, 1, unit)!;
  return (
    <div className="loc-shop-row" data-carried={d.id}>
      <Isometric model={m} brand={d.brand} w={64} />
      <div className="loc-shop-main">
        <div className="loc-shop-name">{m.kind === "server" ? `${d.brand} ` : ""}{m.name}</div>
        <div className="loc-shop-specs">{t("world.inHands")}</div>
      </div>
      <button className="btn primary" onClick={() => { if (act(installCarried, rack.id, from).ok) onDone(d.id); }}>{t("locations-2.mount")}</button>
    </div>
  );
}
