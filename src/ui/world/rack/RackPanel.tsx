import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { t } from "../../../i18n/en";
import { modelById, modelName } from "../../../sim/10-catalog/hardware";
import { rackUnits } from "../../../sim/20-world/datacenters";
import type { Device, End, GameState, Rack } from "../../../sim/50-state";
import { deviceHealth, heightIn, mountFrom, portPeers } from "../../../sim/60-infra/status";
import { connect, setPortGroup } from "../../../sim/90-actions/hardware";
import { Isometric } from "../../art/Isometric";
import { RackFront, shelfPitch, type RackItem } from "../../art/RackFront";
import { menuOn } from "../../desktop/ContextMenu";
import { tidy, type MenuItem } from "../../desktop/menu";
import { reduced } from "../../desktop/motion";
import { deviceLamps, partLabel, portLamps } from "../../apps/hw";
import { handsWays, useHandWork, wayLabel, type HandTask } from "../../apps/locations/HandSheet";
import { LabelEdit, PortCard, useDeviceMenu } from "../../apps/locations/Inspector";
import { mountable, mountTask, rackItems, rackLinks, rackRemotes } from "../../apps/locations/RackView";
import { useStore } from "../../store";
import { formatDay } from "../../apps/billing/format";
import "../../apps/locations/locations.css";
import { Slab } from "../panel/Slab";
import { endName } from "./Cables";
import { LidScene } from "./LidScene";
import { jackEntries, jacksOf, jackText, ProviderPanel } from "./ProviderPanel";
import { panelOf } from "../../../sim/60-infra/panels";
import "../panel/panel.css";
import "./rack.css";
import { WorkTag } from "../figures";

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
export function RackPanel({ rackId, onClose, hand = null, onHand = () => {}, port: startPort = null, onConnectFrom }: {
  rackId: string; onClose: () => void; hand?: End | null; onHand?: (e: End | null) => void; port?: End | null; onConnectFrom?: (deviceId: string) => void;
}) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const rack = game.racks.find((r) => r.id === rackId);
  const [sel, setSel] = useState<string | null>(null);
  const [back, setBack] = useState(!!(hand || startPort));
  // The side turning away while the other turns in.
  const [turning, setTurning] = useState<boolean | null>(null);
  const [port, setPort] = useState<End | null>(startPort);
  // A carried unit opens the panel on the lowest free unit it fits.
  const [free, setFree] = useState<number | null>(null);
  const [lid, setLid] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pin, setPin] = useState<{ x: number; y: number; top: number } | null>(null);
  // The provider jack whose tag hangs open.
  const [jack, setJack] = useState<number | null>(null);
  const stage = useRef<HTMLDivElement>(null), scene = useRef<HTMLDivElement>(null), tagEl = useRef<HTMLDivElement>(null);
  const pick = (id: string | null) => { setSel(id); setFree(null); setLid(null); setRenaming(false); setPort(null); setJack(null); };
  const menus = useDeviceMenu(game, pick, (id) => { pick(id); setRenaming(true); }, [lid, (id) => { if (id) pick(id); setLid(id); }]);
  const work = useHandWork();
  const turn = (to: boolean) => {
    if (to === back) return;
    if (!to) { setPort(null); setJack(null); }
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
  const pp = rack && rack.model !== "shelf" ? panelOf(game, rack.id) : undefined;
  const anchor = back && jack !== null && !hand ? `[data-jack="${jack}"]` : back && hand ? `[data-end="${key(hand)}"]` : back && port ? `[data-end="${key(port)}"]` : dev ? `.rack-dev[aria-pressed="true"]` : free !== null ? `.rack-free[aria-label="${t("art.rackFree", { n: free })}"]` : null;
  // The tag hangs level with what it names, pushed up so it stays above the floor; its string runs from that unit's right edge.
  useLayoutEffect(() => {
    const at = anchor && scene.current?.querySelector(`.wr-face:not(.out) ${anchor}, .wr-pp ${anchor}`);
    if (!at || !scene.current) { setPin(null); return; }
    const s = scene.current.getBoundingClientRect(), r = at.getBoundingClientRect(), y = r.top + r.height / 2 - s.top;
    setPin({ x: r.right - s.left, y, top: Math.max(Math.min(-HOLE, y - HOLE), Math.min(y - HOLE, s.height + 40 - (tagEl.current?.offsetHeight ?? 0))) });
  }, [anchor, sel, back, zoom, game, turning, jack]);
  if (!rack) return null;

  const units = rackUnits(rack.model), items = rackItems(game, rack.id).map((it) => withFault(game, it));
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

  const entries = (d: Device) => [...menus.entries(d), ...(onConnectFrom ? [null, { label: t("world.newConnection"), run: () => onConnectFrom(d.id) }] : [])];
  let tag: ReactNode = null;
  if (back && pp && jack !== null && !hand) tag = <JackTag game={game} panel={pp} jack={jack} />;
  else if (back && hand) tag = <HandTag name={endName(game, hand)} onAway={onClose} onDrop={() => onHand(null)} />;
  else if (back && port && portDev && peerOf(port)) tag = <div className="wr-tag-body" data-port={key(port)}><PortCard game={game} device={portDev} model={modelById(portDev.model)} port={port.port} peer={peerOf(port)} onSelect={pick} /><GroupRow game={game} d={portDev} port={port.port} /></div>;
  else if (dev && !lid) tag = <DeviceTag deviceId={dev.id} renaming={renaming} onRenaming={setRenaming} entries={() => entries(dev)} onPorts={CABLED.includes(modelById(dev.model).kind) && !back ? () => turn(true) : undefined} />;
  // A picked free unit sets what fits there on the floor beside the rack.
  const floor = !dev && free !== null ? <FloorUnits rack={rack} unit={free} onMount={(task) => work.start(game, { ...task, onDone: () => pick(task.deviceId) })} /> : null;

  const shelf = rack.model === "shelf", tall = shelf ? (units * shelfPitch(FRONT_U)) / FRONT_U : units;
  const face = (side: boolean) => side ? (
    <RackFront units={units} shelf={shelf} items={items} links={rackLinks(game, rack.id)} remotes={rackRemotes(game, rack)} side="back" w={BACK_U * 19} u={BACK_U} duct
      selected={dev?.id ?? null} hot={cableAt?.id ?? null} onDevice={(id) => pick(id === sel ? null : id)} onFree={() => {}} onPort={plug} hand={hand} portTitle={title}
      onPlug={(id, k) => { const d = game.devices.find((x) => x.id === id), psu = d?.components.filter((c) => c.kind === "psu")[k]; if (d && psu) menus.plug(d, psu.id); }}
      onConnect={(a, b) => { act(connect, a, b); }} onAway={away} onDeviceMenu={(id, e) => { const d = game.devices.find((x) => x.id === id); if (d) menuOn(() => entries(d))(e); }} />
  ) : (
    <RackFrame units={tall} bare={shelf}>
      {(w, u) => (
        <RackFront units={units} shelf={shelf} items={items} w={w} u={u} selected={dev?.id ?? null}
          onDevice={(id) => pick(id === sel ? null : id)} onFree={(unit) => { pick(null); setFree(unit); }} onDeviceMenu={(id, e) => { const d = game.devices.find((x) => x.id === id); if (d) menuOn(() => entries(d))(e); }} />
      )}
    </RackFrame>
  );

  return (
    <Slab title={rack.name} onClose={onClose} onBack={() => (hand ? (onHand(null), true) : lid ? (setLid(null), true) : false)} data={{ "rack-panel": rack.id }}>
      <div ref={stage} className={`wr-stage${back && pp ? " pp" : ""}`} style={{ ["--z" as string]: zoom, ["--units" as string]: tall }}>
        <div className={`wr-room${lid ? " lidded" : ""}`}>
          <div ref={scene} className={`wr-scene${tag || floor ? " tagged" : ""}`}>
            <div className={`wr-cab${shelf ? " shelf" : ""}`}>
              {back && pp && <ProviderPanel game={game} panel={pp} picked={jack} hand={hand} onJack={(e) => (hand ? plug(e) : (pick(null), setJack(e.port)))} onConnect={(a, b) => { act(connect, a, b); }} />}
              <WorkTag game={game} rackId={rack.id} />
              <div className="wr-plate" data-plate=""><b>{rack.name}</b><span>{shelf ? `${used} / ${units}` : `${used} / ${units} U`}</span></div>
              {turning !== null && <div className="wr-face out" aria-hidden="true">{face(turning)}</div>}
              <div className={`wr-face${turning !== null ? " in" : ""}`}>{face(back)}</div>
            </div>
            <Turntable back={back} onTurn={() => turn(!back)} />
            {tag && (
              <div ref={tagEl} className={`wr-tag${back && pp && jack !== null && !hand ? " far" : ""}`} style={pin ? { top: pin.top } : undefined}>{tag}</div>
            )}
            {floor && <div className="wr-floor-units">{floor}</div>}
            {tag && pin && (
              <svg className="wr-string" aria-hidden="true"><line x1={pin.x} y1={pin.y} x2={(tagEl.current?.offsetLeft ?? scene.current!.offsetWidth + TAG_GAP) + HOLE} y2={pin.top + HOLE} /></svg>
            )}
          </div>
          <div className="wr-floor">
            {back && <div className="wr-away" data-away="" role="button" tabIndex={0} aria-label={t("world.toRack")} onClick={() => hand && onClose()}><span>{t("world.toRack")}</span></div>}
          </div>
        </div>
        {lid && dev && <LidScene key={lid} deviceId={lid} onClose={() => setLid(null)} />}
      </div>
      {menus.dialog}
      {work.dialog}
    </Slab>
  );
}

// The disc the rack stands on: a click turns it, the side facing the room is the darker word on its near edge.
function Turntable({ back, onTurn }: { back: boolean; onTurn: () => void }) {
  return (
    <svg className="wr-table" viewBox="0 0 400 44" role="button" tabIndex={0} aria-label={t(back ? "locations-2.front" : "locations-2.back")} aria-pressed={back}
      onClick={onTurn} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTurn(); } }}>
      <ellipse className="wr-table-rim" cx="200" cy="24" rx="196" ry="14" />
      <rect className="wr-table-rim" x="4" y="18" width="392" height="6" />
      <ellipse className="wr-table-top" cx="200" cy="18" rx="196" ry="14" />
      <path className="wr-table-mark" d="M290 30.6Q340 27.5 366 22.5M366 22.5l-7.5-1M366 22.5l-5.5 4.6" />
      <text className={`wr-table-word${back ? "" : " on"}`} x="165" y="30" textAnchor="end">{t("locations-2.front")}</text>
      <text className={`wr-table-word${back ? " on" : ""}`} x="235" y="30">{t("locations-2.back")}</text>
    </svg>
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

// A device with a failed part shows its fault light; one the failure took down shows no other light.
function withFault(g: GameState, it: RackItem): RackItem {
  const h = deviceHealth(g, it.id);
  if (!h.failed.length) return it;
  return h.state === "down" ? { ...it, fault: true, state: "off", blink: false, ports: portLamps(it.model, []), lights: [] } : { ...it, fault: true };
}

// The paper tag tied to a unit: its name and model, its LED, and its actions as lines written on the tag.
function DeviceTag({ deviceId, renaming, onRenaming, entries, onPorts }: { deviceId: string; renaming: boolean; onRenaming: (on: boolean) => void; entries: () => ReturnType<ReturnType<typeof useDeviceMenu>["entries"]>; onPorts?: () => void }) {
  const game = useStore((s) => s.game);
  const d = game.devices.find((x) => x.id === deviceId)!;
  const m = modelById(d.model), lamps = deviceLamps(game, d.id, m);
  const items = tidy(entries()), failed = d.components.filter((c) => c.failedAt !== null);
  return (
    <div className="wr-tag-body" data-device={d.id}>
      {failed.length > 0 && <div className="wr-model wr-fault" data-fault="">{failed.map(partLabel).join(", ")} · {t("locations-1.failed")}</div>}
      <div className="wr-tag-h">
        <span className={`wr-led ${lamps.state}`} role="img" aria-label={t(d.on ? "locations-1.stOn" : "locations-1.stOff")} />
        <LabelEdit device={d} editing={renaming} onEditing={onRenaming} />
      </div>
      <div className="wr-model">{m.kind === "server" ? `${d.brand} ${modelName(m, d.brand)}` : m.name}</div>
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

// A provider jack's tag: what it carries and, when free, the uplinks and provider cables it can take.
function JackTag({ game, panel, jack }: { game: GameState; panel: Device; jack: number }) {
  const j = jacksOf(game, panel)[jack], items = tidy(jackEntries(game, panel, jack));
  return (
    <div className="wr-tag-body" data-jack-tag={jack}>
      <div className="wr-tag-h"><strong>{t("locations-2.jack", { panel: panel.name, jack: jack + 1 })}</strong></div>
      <div className="wr-model">{jackText(j)}</div>
      {j.due !== undefined && <div className="wr-model">{t("locations-1.dueOn", { day: formatDay(j.due) })}</div>}
      {items.length > 0 && <div className="wr-lines">{items.map((e, i) => (e === null ? <hr key={i} /> : <Act key={i} e={e} />))}</div>}
    </div>
  );
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

// What fits the picked free unit from stored stock, standing on the floor; a click mounts one.
function FloorUnits({ rack, unit, onMount }: { rack: Rack; unit: number; onMount: (task: HandTask) => void }) {
  const game = useStore((s) => s.game), ways = handsWays(game, rack.locationId, "mountDevice");
  const box = (k: string, model: string, brand: string, label: string, run: () => void) => {
    const m = modelById(model);
    return (
      <div key={k} className="wp-unit">
        <button aria-label={`${t("locations-2.mount")}: ${m.kind === "server" ? `${brand} ` : ""}${modelName(m, brand)}`} onClick={run}>
          <Isometric model={m} brand={brand} w={84} />
          <span className="wp-label"><b>{m.kind === "server" ? `${brand} ${modelName(m, brand)}` : m.name}</b>{label}</span>
        </button>
      </div>
    );
  };
  return (
    <div data-free={unit}>
      {mountable(game, rack, unit).map((st) => {
        const from = mountFrom(game, rack.id, heightIn(game, rack.id, st.model), 1, unit) ?? unit;
        return ways.map((w) => box(`${st.model}|${st.brand}|${w.how}`, st.model, st.brand, wayLabel(t("locations-2.nInStorage", { n: st.ids.length }), w), () => onMount({ ...mountTask(st, rack.id, 1, from), how: w.how })));
      })}
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
