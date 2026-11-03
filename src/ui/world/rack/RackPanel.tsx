import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { t } from "../../../i18n/en";
import { modelById } from "../../../sim/10-catalog/hardware";
import { rackUnits } from "../../../sim/20-world/datacenters";
import type { Device, End, GameState, Rack } from "../../../sim/50-state";
import { freeSlots, heightIn, mountFrom, portPeers } from "../../../sim/60-infra/status";
import { installCarried, installFromDoor } from "../../../sim/90-actions/carry";
import { connect, setPortGroup } from "../../../sim/90-actions/hardware";
import { Isometric } from "../../art/Isometric";
import { RackFront, shelfPitch } from "../../art/RackFront";
import { menuOn } from "../../desktop/ContextMenu";
import { tidy, type MenuItem } from "../../desktop/menu";
import { reduced } from "../../desktop/motion";
import { deviceLamps } from "../../apps/hw";
import { useHandWork } from "../../apps/locations/HandSheet";
import { LabelEdit, PortCard, useDeviceMenu } from "../../apps/locations/Inspector";
import { LidSheet } from "../../apps/locations/LidSheet";
import { mountable, MountRow, rackItems, rackLinks, rackRemotes } from "../../apps/locations/RackView";
import { useStore } from "../../store";
import "../../apps/locations/locations.css";
import { Slab } from "../panel/Slab";
import { endName } from "./Cables";
import "./rack.css";

// The rack frame's border in pixels: a cap above the units, sides and a foot.
const CAP = 36, SIDE = 18, FOOT = 18;
const FRONT_U = 28, BACK_U = 30;
// Each half of the turn between front and back.
const TURN_MS = 150;
// The tag's distance from the rack and its string hole's offset from the tag's corner.
const TAG_GAP = 56, HOLE = 16;
const CABLED = ["switch", "gateway", "firewall", "patch", "server"];
const same = (a: End, b: End) => a.device === b.device && a.port === b.port;
const key = (e: End) => `${e.device}:${e.port}`;

// The rack close-up: the rack stands centred on the floor; a picked unit slides it left and hangs a paper tag beside it.
// On the back a cable is dragged from port to port, or a click takes a port as the cable in hand and a click on a second port plugs it in; the hand outlives the panel.
export function RackPanel({ rackId, onClose, hand = null, onHand = () => {}, port: startPort = null }: { rackId: string; onClose: () => void; hand?: End | null; onHand?: (e: End | null) => void; port?: End | null }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const rack = game.racks.find((r) => r.id === rackId);
  const [sel, setSel] = useState<string | null>(null);
  const [back, setBack] = useState(!!(hand || startPort));
  // The side turning away while the other turns in.
  const [turning, setTurning] = useState<boolean | null>(null);
  const [port, setPort] = useState<End | null>(startPort);
  // A carried unit opens the panel on the lowest free unit it fits.
  const [free, setFree] = useState<number | null>(() => carriedFit(game, rackId)[0] ?? null);
  const [lid, setLid] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pin, setPin] = useState<{ x: number; y: number; top: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null), scene = useRef<HTMLDivElement>(null), tagEl = useRef<HTMLDivElement>(null);
  const pick = (id: string | null) => { setSel(id); setFree(null); setLid(null); setRenaming(false); setPort(null); };
  const menus = useDeviceMenu(game, pick, (id) => { pick(id); setRenaming(true); }, [lid, (id) => { if (id) pick(id); setLid(id); }]);
  const work = useHandWork();
  const turn = (to: boolean) => {
    if (to === back) return;
    if (!to) setPort(null);
    setBack(to);
    if (reduced()) return;
    setTurning(back);
    setTimeout(() => setTurning(null), TURN_MS * 2);
  };

  const gone = !rack;
  useEffect(() => { if (gone) onClose(); }, [gone, onClose]);
  // The wheel zooms the scene between its fitted size and twice that; a native listener, since React's wheel handler is passive.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); setZoom((z) => Math.min(2, Math.max(1, z - e.deltaY * 0.002))); };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [gone]);

  const dev = rack && game.devices.find((d) => d.id === sel && d.rackId === rack.id);
  const portDev = port && game.devices.find((d) => d.id === port.device);
  const peerOf = (e: End) => portPeers(game, e.device)[e.port] ?? null;
  const anchor = back && hand ? `[data-end="${key(hand)}"]` : back && port ? `[data-end="${key(port)}"]` : dev ? `.rack-dev[aria-pressed="true"]` : free !== null ? `.rack-free[aria-label="${t("art.rackFree", { n: free })}"]` : null;
  // The tag hangs level with what it names, pushed up so it stays above the floor; its string runs from that unit's right edge.
  useLayoutEffect(() => {
    const at = anchor && scene.current?.querySelector(`.wr-face:not(.out) ${anchor}`);
    if (!at || !scene.current) { setPin(null); return; }
    const s = scene.current.getBoundingClientRect(), r = at.getBoundingClientRect(), y = r.top + r.height / 2 - s.top;
    setPin({ x: r.right - s.left, y, top: Math.max(-HOLE, Math.min(y - HOLE, s.height + 40 - (tagEl.current?.offsetHeight ?? 0))) });
  }, [anchor, sel, back, zoom, game, turning]);
  if (!rack) return null;

  const units = rackUnits(rack.model), items = rackItems(game, rack.id);
  const used = items.filter((it) => !it.chassisId).reduce((n, it) => n + heightIn(game, rack.id, it.model.id), 0);
  const cableAt = port && game.cables.find((c) => same(c.a, port) || same(c.b, port));
  const plug = (e: End) => {
    if (peerOf(e)) { pick(null); setPort(e); return; }
    if (!hand) { onHand(e); setPort(null); return; }
    if (same(hand, e)) { onHand(null); return; }
    if (act(connect, hand, e).ok) { onHand(null); pick(null); setPort(e); }
  };
  const title = (e: End) => { const p = peerOf(e); return `${endName(game, e)} ↔ ${p ? endName(game, p) : t("locations-1.free")}`; };
  const away = (e: End) => { if (!peerOf(e)) { onHand(e); onClose(); } };

  let tag: ReactNode = null;
  if (back && hand) tag = <HandTag name={endName(game, hand)} onAway={onClose} onDrop={() => onHand(null)} />;
  else if (back && port && portDev && peerOf(port)) tag = <div className="wr-tag-body" data-port={key(port)}><PortCard game={game} device={portDev} model={modelById(portDev.model)} port={port.port} peer={peerOf(port)} onSelect={pick} /><GroupRow game={game} d={portDev} port={port.port} /></div>;
  else if (lid && dev) tag = <LidSheet key={lid} deviceId={lid} inline onClose={() => setLid(null)} />;
  else if (dev) tag = <DeviceTag deviceId={dev.id} renaming={renaming} onRenaming={setRenaming} entries={() => menus.entries(dev)} onPorts={CABLED.includes(modelById(dev.model).kind) && !back ? () => turn(true) : undefined} />;
  else if (free !== null) tag = <InstallCard rack={rack} unit={free} onMount={(task) => work.start(game, { ...task, onDone: () => pick(task.deviceId) })} onPick={pick} />;
  const wide = !!lid || (free !== null && !dev);

  const shelf = rack.model === "shelf", tall = shelf ? (units * shelfPitch(FRONT_U)) / FRONT_U : units;
  const face = (side: boolean) => side ? (
    <RackFront units={units} shelf={shelf} items={items} links={rackLinks(game, rack.id)} remotes={rackRemotes(game, rack)} side="back" w={BACK_U * 19} u={BACK_U} duct
      selected={dev?.id ?? null} hot={cableAt?.id ?? null} onDevice={(id) => pick(id === sel ? null : id)} onFree={() => {}} onPort={plug} hand={hand} portTitle={title}
      onConnect={(a, b) => { act(connect, a, b); }} onAway={away} />
  ) : (
    <RackFrame units={tall} bare={shelf}>
      {(w, u) => (
        <RackFront units={units} shelf={shelf} items={items} w={w} u={u} selected={dev?.id ?? null}
          onDevice={(id) => pick(id === sel ? null : id)} onFree={(unit) => { pick(null); setFree(unit); }} onDeviceMenu={(id, e) => { const d = game.devices.find((x) => x.id === id); if (d) menuOn(() => menus.entries(d))(e); }} />
      )}
    </RackFrame>
  );

  return (
    <Slab title={rack.name} onClose={onClose} onBack={() => (hand ? (onHand(null), true) : lid ? (setLid(null), true) : false)} data={{ "rack-panel": rack.id }}
      head={<>
        <div className="wr-side-seg" role="group" aria-label={t("locations-2.side")}>
          <button className="wr-btn" aria-pressed={!back} onClick={() => turn(false)}>{t("locations-2.front")}</button>
          <button className="wr-btn" aria-pressed={back} onClick={() => turn(true)}>{t("locations-2.back")}</button>
        </div>
        <span className="wr-num">{rack.model === "shelf" ? `${t("rack.shelf")}, ${used} / ${units}` : `${used} / ${units} U`}</span>
      </>}>
      <div ref={stage} className="wr-stage" style={{ ["--z" as string]: zoom, ["--units" as string]: tall }}>
        <div className="wr-room">
          <div ref={scene} className={`wr-scene${tag ? (wide ? " tagged wide" : " tagged") : ""}`}>
            <div className={`wr-cab${shelf ? " shelf" : ""}`}>
              {turning !== null && <div className="wr-face out" aria-hidden="true">{face(turning)}</div>}
              <div className={`wr-face${turning !== null ? " in" : ""}`}>{face(back)}</div>
            </div>
            <div className="wr-shadow" />
            {tag && (
              <div ref={tagEl} className="wr-tag" style={pin && !wide ? { top: pin.top } : undefined}>{tag}</div>
            )}
            {tag && pin && !wide && (
              <svg className="wr-string" aria-hidden="true"><line x1={pin.x} y1={pin.y} x2={scene.current!.offsetWidth + TAG_GAP + HOLE} y2={pin.top + HOLE} /></svg>
            )}
          </div>
          <div className="wr-floor">
            {back && <div className="wr-away" data-away="" role="button" tabIndex={0} aria-label={t("world.toRack")} onClick={() => hand && onClose()}><span>{t("world.toRack")}</span></div>}
          </div>
        </div>
      </div>
      {menus.dialog}
      {work.dialog}
    </Slab>
  );
}

// The rack's metal frame around the drawn units; a shelf stands open, bare.
function RackFrame({ units, bare = false, children }: { units: number; bare?: boolean; children: (w: number, u: number) => ReactNode }) {
  const u = FRONT_U, w = u * 19, [cap, side, foot] = bare ? [0, 0, 0] : [CAP, SIDE, FOOT];
  // RackFront's front view without the cable channel it draws to the right.
  const iw = w + 36, ih = units * u + 8, ow = iw + 2 * side, oh = ih + cap + foot;
  if (bare) return <svg className="wr-rack" width={iw} height={ih} viewBox={`0 0 ${iw} ${ih}`}>{children(w, u)}</svg>;
  return (
    <svg className="wr-rack" width={ow} height={oh} viewBox={`0 0 ${ow} ${oh}`}>
      <rect className="wr-frame" width={ow} height={oh} />
      <rect className="wr-frame-top" x="3" y="3" width={ow - 6} height={CAP - 8} />
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} className="wr-vent" x={ow / 2 - 40 + i * 18} y="11" width="10" height={CAP - 24} />)}
      <rect className="wr-frame-top" x="3" y={oh - FOOT + 5} width={ow - 6} height={FOOT - 8} />
      <svg x={SIDE} y={CAP} width={iw} height={ih} overflow="hidden">{children(w, u)}</svg>
    </svg>
  );
}

// The paper tag tied to a unit: its name and model, its LED, and its actions as lines written on the tag.
function DeviceTag({ deviceId, renaming, onRenaming, entries, onPorts }: { deviceId: string; renaming: boolean; onRenaming: (on: boolean) => void; entries: () => ReturnType<ReturnType<typeof useDeviceMenu>["entries"]>; onPorts?: () => void }) {
  const game = useStore((s) => s.game);
  const d = game.devices.find((x) => x.id === deviceId)!;
  const m = modelById(d.model), lamps = deviceLamps(game, d.id, m);
  const items = tidy(entries());
  return (
    <div className="wr-tag-body" data-device={d.id}>
      <div className="wr-tag-h">
        <span className={`wr-led ${lamps.state}`} role="img" aria-label={t(d.on ? "locations-1.stOn" : "locations-1.stOff")} />
        <LabelEdit device={d} editing={renaming} onEditing={onRenaming} />
      </div>
      <div className="wr-model">{m.kind === "server" ? `${d.brand} ${m.name}` : m.name}</div>
      <div className="wr-lines">
        {onPorts && <button className="wr-line" onClick={onPorts}>{t("locations-1.ports")}</button>}
        {items.map((e, i) => (e === null ? <hr key={i} /> : <Act key={i} e={e} />))}
      </div>
    </div>
  );
}

// A menu entry as a line on the tag; one with a submenu opens it beside the line.
function Act({ e }: { e: MenuItem }) {
  return <button className="wr-line" disabled={e.disabled} onClick={e.items ? menuOn(() => e.items!) : e.run}>{e.label}{e.items && " ›"}</button>;
}

function HandTag({ name, onAway, onDrop }: { name: string; onAway: () => void; onDrop: () => void }) {
  return (
    <div className="wr-tag-body" data-hand="">
      <div className="wr-tag-h"><strong>{t("world.cableInHand")}</strong></div>
      <div className="wr-model">{name}</div>
      <div className="wr-lines">
        <button className="wr-line" onClick={onAway}>{t("world.toRack")}</button>
        <button className="wr-line" onClick={onDrop}>{t("world.dropCable")}</button>
      </div>
    </div>
  );
}

function InstallCard({ rack, unit, onMount, onPick }: { rack: Rack; unit: number; onMount: Parameters<typeof MountRow>[0]["onMount"]; onPick: (id: string) => void }) {
  const game = useStore((s) => s.game);
  const rows = mountable(game, rack, unit), parcels = doorFit(game, rack, unit), held = carriedFit(game, rack.id).includes(unit);
  return (
    <div className="wr-card" data-free={unit}>
      <div className="wr-card-h"><h2>{`U${unit}`}</h2><span className="wr-model">{t("locations-1.empty")}</span></div>
      <div className="loc-shop-list">
        {held && <HandRow game={game} rack={rack} unit={unit} d={game.devices.find((x) => x.id === game.player.carrying)!} onDone={onPick} />}
        {parcels.map((d) => <HandRow key={d.id} game={game} rack={rack} unit={unit} d={d} onDone={onPick} />)}
        {rows.map((st) => <MountRow key={`${st.model}|${st.brand}`} game={game} rack={rack} st={st} unit={unit} onMount={onMount} />)}
        {!rows.length && !parcels.length && !held && <div className="loc-shop-none">{t("locations-2.noStoredFits")}</div>}
      </div>
    </div>
  );
}

// Free units a unit in the player's hands could go into, one per start slot and every unit of its run.
function fitOf(game: GameState, rack: Rack, d: Device | undefined): number[] {
  if (!d || rack.locationId !== game.player.at) return [];
  const h = heightIn(game, rack.id, d.model);
  if (modelById(d.model).kind === "part" || !h) return [];
  return freeSlots(game, rack.id, 1).filter((u) => mountFrom(game, rack.id, h, 1, u) !== undefined);
}

function carriedFit(game: GameState, rackId: string): number[] {
  const rack = game.racks.find((r) => r.id === rackId);
  return rack ? fitOf(game, rack, game.devices.find((x) => x.id === game.player.carrying)) : [];
}

// Parcels at this room's door that fit at unit, one per model and brand.
function doorFit(game: GameState, rack: Rack, unit: number): Device[] {
  const seen = new Set<string>();
  return game.devices.filter((d) => {
    const k = `${d.model}|${d.brand}`;
    if (d.door?.at !== rack.locationId || d.chassisId || seen.has(k) || !fitOf(game, rack, d).includes(unit)) return false;
    seen.add(k);
    return true;
  });
}

// A unit carried or waiting at the door, mounted by the player's own hands.
function HandRow({ game, rack, unit, d, onDone }: { game: GameState; rack: Rack; unit: number; d: Device; onDone: (id: string) => void }) {
  const act = useStore((s) => s.act), m = modelById(d.model), carried = d.id === game.player.carrying;
  const from = mountFrom(game, rack.id, heightIn(game, rack.id, d.model), 1, unit)!;
  const mount = () => (carried ? act(installCarried, rack.id, from) : act(installFromDoor, d.id, rack.id, from));
  return (
    <div className="loc-shop-row" data-carried={carried ? d.id : undefined} data-door={carried ? undefined : d.id}>
      <Isometric model={m} brand={d.brand} w={64} />
      <div className="loc-shop-main">
        <div className="loc-shop-name">{m.kind === "server" ? `${d.brand} ` : ""}{m.name}</div>
        <div className="loc-shop-specs">{t(carried ? "world.inHands" : "locations-2.atDoor")}</div>
      </div>
      <button className="btn primary" onClick={() => { if (mount().ok) onDone(d.id); }}>{t("locations-2.mount")}</button>
    </div>
  );
}
// A managed switch port bundles with the other ports cabled to the same device, or leaves its group.
function GroupRow({ game, d, port }: { game: GameState; d: Device; port: number }) {
  const act = useStore((s) => s.act), m = modelById(d.model);
  if (m.kind !== "switch" || !m.managed) return null;
  if (d.groups.some((g) => g.includes(port))) return <div className="wr-acts"><button className="wr-btn" onClick={() => act(setPortGroup, d.id, [port])}>{t("switch.remove")}</button></div>;
  const peers = portPeers(game, d.id), to = peers[port]?.device;
  const mates = peers.flatMap((p, i) => (p && p.device === to && !d.groups.some((g) => g.includes(i)) ? [i] : [])).slice(0, 8);
  if (mates.length < 2) return null;
  return <div className="wr-acts"><button className="wr-btn" onClick={() => act(setPortGroup, d.id, mates)}>{t("switch.createGroup")}</button></div>;
}
