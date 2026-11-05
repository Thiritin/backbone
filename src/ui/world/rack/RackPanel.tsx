import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { t } from "../../../i18n/en";
import { modelById, modelName, wanPort } from "../../../sim/10-catalog/hardware";
import { rackUnits } from "../../../sim/20-world/datacenters";
import type { Device, End, GameState, Rack } from "../../../sim/50-state";
import { booting, connectError, deviceHealth, halting, heightIn, mountFrom, pluggedIn, portPeers } from "../../../sim/60-infra/status";
import { present } from "../../../sim/60-infra/handwork";
import { connect, setPortGroup } from "../../../sim/90-actions/hardware";
import { plugStick, unplugStick } from "../../../sim/90-actions/media";
import { Isometric } from "../../art/Isometric";
import type { PanelOp } from "../../art/fronts";
import { RackFront, shelfPitch, type RackItem } from "../../art/RackFront";
import { menuOn } from "../../desktop/ContextMenu";
import { tidy, type MenuItem } from "../../desktop/menu";
import { reduced } from "../../desktop/motion";
import { devName, portLamps } from "../../apps/hw";
import { affected, frontGuide, panelPress } from "./panelPress";
import { handsWays, useHandWork, wayLabel, type HandTask } from "../../apps/locations/HandSheet";
import { PortCard, useDeviceMenu } from "../../apps/locations/Inspector";
import { mountable, mountTask, rackItems, rackLinks, rackRemotes } from "../../apps/locations/RackView";
import { useStore } from "../../store";
import { formatDay } from "../../apps/billing/format";
import "../../apps/locations/locations.css";
import { Slab } from "../panel/Slab";
import { endName } from "./Cables";
import { CrashCart } from "./CrashCart";
import { noteSelected, setPlug, useCable } from "./cartPlug";
import { LidScene } from "./LidScene";
import { jackEntries, jacksOf, jackText, ProviderPanel } from "./ProviderPanel";
import { panelOf } from "../../../sim/60-infra/panels";
import "../panel/panel.css";
import "./rack.css";
import { WorkTag } from "../figures";
import { Slip, UnitTag } from "./UnitTag";
import { clampZoom, stepZoom, tagLeft, wheelZoom } from "./zoom";

// The rack frame's border in pixels: a cap above the units, sides and a foot.
const CAP = 36, SIDE = 18, FOOT = 18;
const FRONT_U = 28, BACK_U = 30;
// Each half of the turn between front and back.
const TURN_MS = 150;
// The tag's distance from the rack and its string hole's offset from the tag's corner.
const TAG_GAP = 56, HOLE = 16, TAG_W = 260;
// The stage height the fitted rack leaves for the room around it; rack.css reserves the same in the fit height.
const CHROME = 84;
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
  const [cart, setCart] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pin, setPin] = useState<{ x: number; y: number; top: number; left: number } | null>(null);
  // The provider jack whose tag hangs open.
  const [jack, setJack] = useState<number | null>(null);
  const stage = useRef<HTMLDivElement>(null), scene = useRef<HTMLDivElement>(null), tagEl = useRef<HTMLDivElement>(null);
  const plugged = useCable(game);
  const pick = (id: string | null) => { noteSelected(id); setSel(id); setFree(null); setLid(null); setRenaming(false); setPort(null); setJack(null); };
  const menus = useDeviceMenu(game, pick, (id) => { pick(id); setRenaming(true); }, [lid, (id) => { if (id) pick(id); setLid(id); }], true);
  const work = useHandWork();
  const loc = game.locations.find((l) => l.id === rack?.locationId), offSite = !!loc?.dc && !present(game, loc.id);
  const [ask, setAsk] = useState<{ id: string; op: PanelOp; count: number } | null>(null);
  const run = (id: string, op: PanelOp) => {
    const d = game.devices.find((x) => x.id === id), k = d && panelPress(game, act, d, op);
    if (k) setOut(k);
  };
  // A press that takes customers offline waits for the slip.
  const press = (id: string, op: PanelOp) => {
    const d = game.devices.find((x) => x.id === id), count = d ? affected(game, d, op) : 0;
    if (d && count > 0 && !booting(game, d) && !halting(d)) setAsk({ id, op, count });
    else run(id, op);
  };
  useEffect(() => { if (out) { const h = setTimeout(() => setOut(null), 4000); return () => clearTimeout(h); } }, [out]);
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
  // The scroll position that keeps the point under the pointer still once the zoom changes.
  const anchorAt = useRef<{ fx: number; fy: number; px: number; py: number; z: number } | null>(null);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const zoomTo = (z: number, at?: { x: number; y: number }) => {
    const el = stage.current, next = clampZoom(z);
    if (!el || next === zoomRef.current) return;
    const r = el.getBoundingClientRect(), px = at ? at.x - r.left : r.width / 2, py = at ? at.y - r.top : r.height / 2;
    anchorAt.current = { fx: (el.scrollLeft + px) / zoomRef.current, fy: (el.scrollTop + py) / zoomRef.current, px, py, z: next };
    zoomRef.current = next;
    setZoom(next);
  };
  const zoomFns = useRef({ zoomTo, turn, fit: () => {} });
  zoomFns.current = { ...zoomFns.current, zoomTo, turn };
  // The default framing makes the rack at least 60 percent of the stage wide, centred on its occupied units; the fit key shows it whole.
  const [view, setView] = useState<{ t: number; h: number; marks: [number, number][] } | null>(null);
  const sync = () => {
    const el = stage.current;
    if (!el) return;
    const o = el.getBoundingClientRect(), n = el.scrollHeight, h = el.clientHeight / n;
    const marks = [...el.querySelectorAll(".wr-face:not(.out) .rack-dev")].map((d) => d.getBoundingClientRect()).map((r): [number, number] => [(r.top - o.top + el.scrollTop) / n, r.height / n]);
    setView(!n || h > 0.98 ? null : { t: el.scrollTop / n, h, marks });
  };
  const jump = (e: React.PointerEvent) => {
    const el = stage.current, r = e.currentTarget.getBoundingClientRect();
    if (el && (e.type === "pointerdown" || e.buttons)) el.scrollTop = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, ((e.clientY - r.top) / r.height) * el.scrollHeight - el.clientHeight / 2));
  };
  const framing = useRef(0), framed = useRef(1);
  useLayoutEffect(() => {
    const el = stage.current, svg = el?.querySelector(".wr-face > svg");
    const vb = svg?.getAttribute("viewBox")?.split(" ").map(Number), all = rack ? rackUnits(rack.model) : 0;
    // Up to 24U the whole rack shows; a taller rack zooms to the width target, or less so its equipment span stays in view.
    if (!svg || !el || !vb || !rack || back || all <= 24) return;
    const fitH = Math.min(el.clientHeight - CHROME, tall * 34 + 80), mine = rackItems(game, rack.id);
    const lo = Math.min(...mine.map((it) => it.slot)), hi = Math.max(...mine.map((it) => it.slot + heightIn(game, rack.id, it.model.id) - 1));
    const spanPx = mine.length ? ((hi - lo + 1) * FRONT_U * fitH) / vb[3] : 0;
    const z = clampZoom(Math.min((0.6 * el.clientWidth * vb[3]) / (fitH * vb[2]), spanPx ? (el.clientHeight - 56) / spanPx : 4));
    if (z < 1.05) return;
    framed.current = z; framing.current = z; zoomRef.current = z; setZoom(z);
  }, []);
  const fitToggle = () => {
    if (zoomRef.current > 1.001) { zoomTo(1); return; }
    framing.current = framed.current; zoomRef.current = framed.current; setZoom(framed.current);
  };
  zoomFns.current.fit = fitToggle;
  useLayoutEffect(() => {
    const el = stage.current, a = anchorAt.current;
    sync();
    if (el && framing.current === zoom) {
      framing.current = 0;
      const o = el.getBoundingClientRect(), devs = [...el.querySelectorAll(".wr-face:not(.out) .rack-dev")].map((d) => d.getBoundingClientRect());
      const top = Math.min(...devs.map((d) => d.top)) - o.top + el.scrollTop, bottom = Math.max(...devs.map((d) => d.bottom)) - o.top + el.scrollTop;
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
      el.scrollTop = !devs.length || bottom - top > el.clientHeight - 24 ? el.scrollHeight : (top + bottom - el.clientHeight) / 2;
      return;
    }
    if (!el || !a || a.z !== zoom) return;
    el.scrollLeft = a.fx * zoom - a.px; el.scrollTop = a.fy * zoom - a.py;
    anchorAt.current = null;
  }, [zoom]);
  // The wheel zooms around the pointer; a native listener, since React's wheel handler is passive.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => { if ((e.target as Element).closest?.(".wr-tag")) return; e.preventDefault(); zoomFns.current.zoomTo(wheelZoom(zoomRef.current, e), { x: e.clientX, y: e.clientY }); };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [gone]);
  // Keys: R turns the rack, + and - zoom, 0 fits.
  const backRef = useRef(back);
  backRef.current = back;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest("input,textarea,select,[contenteditable]")) return;
      const z = zoomRef.current, f = zoomFns.current;
      if (e.key === "r" || e.key === "R") { e.preventDefault(); f.turn(!backRef.current); }
      else if (e.key === "+" || e.key === "=") f.zoomTo(stepZoom(z, 1));
      else if (e.key === "-" || e.key === "_") f.zoomTo(stepZoom(z, -1));
      else if (e.key === "0") f.fit();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  // A drag on empty rack, floor or backdrop pans the zoomed scene; a drag that moved swallows its click.
  const pan = useRef<{ x: number; y: number; l: number; t: number; moved: boolean } | null>(null);
  const SKIP = ".wr-mini,button,[role=button],input,select,textarea,a,.wr-tag,.rack-dev,.rack-free,.rack-port,.rack-seated,.rack-pull,.rack-remote,[data-end],[data-jack],.wr-jack";
  const panDown = (e: React.PointerEvent) => {
    const el = stage.current;
    if (e.button !== 0 || zoomRef.current <= 1 || !el || (e.target as Element).closest(SKIP)) return;
    pan.current = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop, moved: false };
  };
  const panMove = (e: React.PointerEvent) => {
    const p = pan.current, el = stage.current;
    if (!p || !el) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) < 4) return;
    if (!p.moved) { p.moved = true; el.classList.add("panning"); el.setPointerCapture?.(e.pointerId); }
    el.scrollLeft = p.l - dx; el.scrollTop = p.t - dy;
  };
  const panUp = () => {
    const p = pan.current;
    pan.current = null;
    stage.current?.classList.remove("panning");
    if (p?.moved) {
      const eat = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener("click", eat, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", eat, true), 0);
    }
  };

  const dev = rack && game.devices.find((d) => d.id === sel && d.rackId === rack.id);
  const portDev = port && game.devices.find((d) => d.id === port.device);
  const peerOf = (e: End) => portPeers(game, e.device)[e.port] ?? null;
  const pp = rack && rack.model !== "shelf" ? panelOf(game, rack.id) : undefined;
  const anchor = back && jack !== null && !hand ? `[data-jack="${jack}"]` : back && hand ? `[data-end="${key(hand)}"]` : back && port ? `[data-end="${key(port)}"]` : dev ? `.rack-dev[aria-pressed="true"]` : free !== null ? `.rack-free[aria-label="${t("art.rackFree", { n: free })}"]` : null;
  // The tag hangs level with what it names, pushed up so it stays above the floor; its string runs from that unit's right edge.
  // The tag stays inside the visible stage: a zoomed rack wider than the screen slides it over the rack's edge.
  const repin = () => {
    const at = anchor && scene.current?.querySelector(`.wr-face:not(.out) ${anchor}, .wr-pp ${anchor}`), sc = scene.current, st = stage.current;
    if (!at || !sc || !st) { setPin(null); return; }
    const s = sc.getBoundingClientRect(), r = at.getBoundingClientRect(), y = r.top + r.height / 2 - s.top;
    const base = sc.offsetLeft - (TAG_W + TAG_GAP) / 2;
    const left = st.clientWidth ? tagLeft(sc.offsetWidth + TAG_GAP, base, st.scrollLeft, st.clientWidth, TAG_W) : sc.offsetWidth + TAG_GAP;
    setPin({ x: r.right - s.left, y, left, top: Math.max(Math.min(-HOLE, y - HOLE), Math.min(y - HOLE, s.height + 40 - (tagEl.current?.offsetHeight ?? 0))) });
  };
  useLayoutEffect(repin, [anchor, sel, back, zoom, game, turning, jack]);
  // A tag opened at high zoom is brought into view.
  useEffect(() => { tagEl.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" }); }, [sel, free, port, jack, back]);
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
  // What the first cabling still lacks: the router's line, a link between router and server, and a server's power.
  const needs: string[] = [];
  for (const d of game.devices.filter((x) => x.rackId === rack.id)) {
    const m = modelById(d.model), peers = portPeers(game, d.id), data = m.ports.map((p, i) => ({ p, i })).filter(({ p }) => p.media === "rj45" || p.media === "dsl");
    if (m.kind === "gateway") {
      const wan = wanPort(m), lan = data.find(({ i }) => i !== wan);
      if (wan >= 0 && !peers[wan]) needs.push(`${d.id}:${wan}`);
      if (lan && !data.some(({ i }) => i !== wan && peers[i])) needs.push(`${d.id}:${lan.i}`);
    } else if (m.kind === "server") {
      if (data[0] && !data.some(({ i }) => peers[i])) needs.push(`${d.id}:${data[0].i}`);
      if (!pluggedIn(d)) d.components.filter((c) => c.kind === "psu").forEach((_, k) => needs.push(`${d.id}#psu${k}`));
    }
  }
  const away = (e: End) => { if (!peerOf(e)) { onHand(e); onClose(); } };

  const entries = (d: Device) => menus.entries(d, false, {
    cart: () => { setPlug(d.id); setCart(d.id); },
    ports: () => { pick(d.id); turn(true); },
    connect: onConnectFrom && (() => onConnectFrom(d.id)),
  });
  let tag: ReactNode = null, unit = false;
  if (back && pp && jack !== null && !hand) tag = <JackTag game={game} panel={pp} jack={jack} />;
  else if (back && hand) tag = <HandTag name={endName(game, hand)} onAway={onClose} onDrop={() => onHand(null)} />;
  else if (back && port && portDev && peerOf(port)) tag = <div className="wr-tag-body" data-port={key(port)}><PortCard game={game} device={portDev} model={modelById(portDev.model)} port={port.port} peer={peerOf(port)} onSelect={pick} /><GroupRow game={game} d={portDev} port={port.port} /></div>;
  else if (dev && !lid) { unit = true; tag = <UnitTag deviceId={dev.id} renaming={renaming} onRenaming={setRenaming} menus={menus} onSold={() => pick(null)} onPanel={offSite ? undefined : (op) => press(dev.id, op)} back={back} onPorts={CABLED.includes(modelById(dev.model).kind) ? () => turn(!back) : undefined}
    onCart={modelById(dev.model).kind === "server" && !back && present(game, rack.locationId) ? () => { setPlug(dev.id); setCart(dev.id); } : undefined} />; }
  // A picked free unit sets what fits there on the floor beside the rack.
  const floor = !dev && free !== null ? <FloorUnits rack={rack} unit={free} onMount={(task) => work.start(game, { ...task, onDone: () => pick(task.deviceId) })} /> : null;

  const shelf = rack.model === "shelf", tall = shelf ? (units * shelfPitch(FRONT_U)) / FRONT_U : units;
  const face = (side: boolean) => side ? (
    <RackFront units={units} shelf={shelf} items={items} links={rackLinks(game, rack.id)} remotes={rackRemotes(game, rack)} side="back" away={offSite} guide={frontGuide(game)} onPanel={press} w={BACK_U * 19} u={BACK_U} duct
      selected={dev?.id ?? null} hot={cableAt?.id ?? null} onDevice={(id) => pick(id === sel ? null : id)} onFree={() => {}} onPort={plug} onConsole={present(game, rack.locationId) ? (id) => { setPlug(id); pick(id); } : undefined} consoleOn={plugged} hand={hand} portTitle={title} needs={needs} canLink={(a, b) => !connectError(game, a, b)}
      onPlug={(id, k) => { const d = game.devices.find((x) => x.id === id), psu = d?.components.filter((c) => c.kind === "psu")[k]; if (d && psu) menus.plug(d, psu.id); }}
      onConnect={(a, b) => { act(connect, a, b); }} onAway={away} onRename={(id) => { pick(id); setRenaming(true); }} onDeviceMenu={(id, e) => { const d = game.devices.find((x) => x.id === id); if (d) { pick(id); menuOn(() => entries(d))(e); } }} />
  ) : (
    <RackFrame units={tall} bare={shelf}>
      {(w, u) => (
        <RackFront units={units} shelf={shelf} items={items} w={w} u={u} selected={dev?.id ?? null} away={offSite} guide={frontGuide(game)} onPanel={press}
          onDevice={(id) => pick(id === sel ? null : id)} onFree={(unit) => { pick(null); setFree(unit); }} onRename={(id) => { pick(id); setRenaming(true); }} onDeviceMenu={(id, e) => { const d = game.devices.find((x) => x.id === id); if (d) { pick(id); menuOn(() => entries(d))(e); } }}
          onUsb={(id) => (game.media.stick.in === id ? act(unplugStick) : act(plugStick, id))} />
      )}
    </RackFrame>
  );

  return (
    <Slab title={rack.name} onClose={onClose} onBack={() => (hand ? (onHand(null), true) : cart ? (setCart(null), true) : lid ? (setLid(null), true) : false)} data={{ "rack-panel": rack.id }}>
      <div ref={stage} className={`wr-stage${back && pp ? " pp" : ""}`} style={{ ["--z" as string]: zoom, ["--units" as string]: tall }}
        onScroll={() => { sync(); if (pin) repin(); }} onPointerDown={panDown} onPointerMove={panMove} onPointerUp={panUp} onPointerCancel={panUp} onLostPointerCapture={panUp} onDoubleClick={(e) => { if (!(e.target as Element).closest(SKIP)) fitToggle(); }}>
        {view && (
          <div className="wr-mini"><div className="wr-mini-bar" role="scrollbar" aria-orientation="vertical" aria-controls="" aria-valuenow={Math.round(view.t * 100)} onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture?.(e.pointerId); jump(e); }} onPointerMove={jump}>
            {view.marks.map(([t0, h0], i) => <i key={i} className="wr-mini-mark" style={{ top: `${t0 * 100}%`, height: `${Math.max(h0 * 100, 1)}%` }} />)}
            <b className="wr-mini-view" style={{ top: `${view.t * 100}%`, height: `${view.h * 100}%` }} />
          </div></div>
        )}
        <Keys back={back} zoom={zoom} onTurn={() => turn(!back)} onZoom={(z) => zoomTo(z)} onFit={fitToggle} />
        <div className={`wr-room${lid ? " lidded" : ""}`}>
          <div ref={scene} className={`wr-scene${tag || floor ? " tagged" : ""}`}>
            <div className={`wr-cab${shelf ? " shelf" : ""}`}>
              {back && pp && <ProviderPanel game={game} panel={pp} picked={jack} hand={hand} onJack={(e) => (hand ? plug(e) : (pick(null), setJack(e.port)))} onConnect={(a, b) => { act(connect, a, b); }} />}
              <WorkTag game={game} rackId={rack.id} />
              <div className="wr-plate" data-plate=""><b>{rack.name}</b><span>{shelf ? `${used} / ${units}` : `${used} / ${units} U`}</span></div>
              {ask && (() => { const d = game.devices.find((x) => x.id === ask.id); return d && (
                <div className="wr-slip-pin"><Slip slip="customers" name={devName(d)} text={t("world.affected", { count: ask.count })} action={t(ask.op === "reset" ? "art.reset" : "art.shutDown")}
                  onCancel={() => setAsk(null)} onStamp={() => { setAsk(null); run(ask.id, ask.op); }} /></div>
              ); })()}
              {turning !== null && <div className="wr-face out" aria-hidden="true">{face(turning)}</div>}
              <div className={`wr-face${turning !== null ? " in" : ""}`}>{face(back)}</div>
              <button className="wr-flank" aria-hidden="true" onClick={() => turn(!back)} tabIndex={-1} />
            </div>
            <div className="wr-rail" />
            {tag && (
              <div ref={tagEl} className={`wr-tag${unit ? " unit" : ""}${back && pp && jack !== null && !hand ? " far" : ""}`} style={pin ? { top: pin.top, left: pin.left } : undefined}>{tag}</div>
            )}
            {floor && <div className="wr-floor-units">{floor}</div>}
            {tag && pin && (
              <svg className="wr-string" aria-hidden="true"><line x1={pin.x} y1={pin.y} x2={pin.left + HOLE} y2={pin.top + HOLE} /></svg>
            )}
          </div>
          <div className="wr-floor">
            {out && <div className="wr-out" role="status">{out}</div>}
            {back && <div className="wr-away" data-away="" role="button" tabIndex={0} aria-label={t("world.toRack")} onClick={() => hand && onClose()}><span className="wr-k" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="8" height="16" /><path d="M11 9h3q3 0 3 3t3 3M17 15l3 0M20 15l-2-2M20 15l-2 2" /></svg></span><span>{t("world.toRack")}</span></div>}
          </div>
        </div>
        {lid && dev && <LidScene key={lid} deviceId={lid} onClose={() => setLid(null)} />}
      </div>
      {menus.dialog}
      {cart && game.devices.some((x) => x.id === cart) && <CrashCart deviceId={cart} onClose={() => setCart(null)} backLabel={t("console.back")} />}
      {work.dialog}
    </Slab>
  );
}

// One rail of square keys over the scene: the side facing you, turn, a separator, zoom out, zoom in, fit.
function Keys({ back, zoom, onTurn, onZoom, onFit }: { back: boolean; zoom: number; onTurn: () => void; onZoom: (z: number) => void; onFit: () => void }) {
  const key = (label: string, onClick: () => void, icon: ReactNode, disabled = false) => (
    <button className="wr-k" aria-label={label} title={label} data-tip={label} disabled={disabled} onClick={onClick}><svg viewBox="0 0 24 24">{icon}</svg></button>
  );
  return (
    <div className="wr-keys"><div>
      {key(t("world.turn"), onTurn, <><path d="M5 12a7 7 0 0 1 12-4.9M19 12a7 7 0 0 1-12 4.9" /><path d="M18 3v4.5h-4.5M6 21v-4.5h4.5" /></>)}
      <span className="wr-face-ind" role="img" aria-label={t(back ? "locations-2.back" : "locations-2.front")} title={t(back ? "locations-2.back" : "locations-2.front")} data-tip={t(back ? "locations-2.back" : "locations-2.front")}>
        <svg viewBox="0 0 24 24">{back ? <><rect x="3" y="3" width="18" height="18" /><rect x="6" y="6.5" width="5" height="4" /><rect x="13" y="6.5" width="5" height="4" /><path d="M8.5 14h7l1.2 4.5H7.3z" /></> : <><rect className="post" x="4" y="2.5" width="3" height="19" /><rect className="post" x="17" y="2.5" width="3" height="19" /><path d="M9 6.5h6M9 9.5h6M9 12.5h6" /><circle cx="12" cy="17.5" r="1.3" /></>}</svg>
      </span>
      <i className="wr-sep" />
      {key(t("world.zoomOut"), () => onZoom(stepZoom(zoom, -1)), <path d="M6 12h12" />, zoom <= 1)}
      {key(t("world.zoomIn"), () => onZoom(stepZoom(zoom, 1)), <path d="M6 12h12M12 6v12" />, zoom >= 4)}
      {key(t("world.zoomFit"), onFit, <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />)}
    </div></div>
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

// A menu entry as a line on the tag; one with a submenu opens it beside the line.
function Act({ e }: { e: MenuItem }) {
  return <button className="wr-line" disabled={e.disabled} onClick={e.items ? menuOn(() => e.items!) : e.run}>{e.label}{e.items && " ›"}</button>;
}

// A provider jack's tag: what it carries and, when free, the uplinks and provider cables it can take.
function JackTag({ game, panel, jack }: { game: GameState; panel: Device; jack: number }) {
  const j = jacksOf(game, panel)[jack], items = tidy(jackEntries(game, panel, jack));
  return (
    <div className="wr-tag-body" data-jack-tag={jack}>
      <div className="wr-tag-h"><strong>{t("locations-2.jack", { panel: t("locations-1.carrierPanel"), jack: jack + 1 })}</strong></div>
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
