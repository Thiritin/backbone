import { Gauge, Plug, Truck, Zap } from "lucide-react";
import { plugStick, unplugStick } from "../../../sim/90-actions/media";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { euro } from "../../../sim/00-core/money";
import { modelById, type DeviceKind } from "../../../sim/10-catalog/hardware";
import { BASEMENT, EXTRA_STEP_KW, extraStepPrice, FLAT_CONTRACTS, flatMonthly, maxExtraKw, SHARE_RACKS } from "../../../sim/20-world/datacenters";
import { yearOf } from "../../../sim/00-core/time";
import type { Device, GameState, Location, Rack } from "../../../sim/50-state";
import { EXTRA_CIRCUIT_KW, flatOffer, freePositions, freeSlots, isPlugged, locationOf, mountFrom, mountMax, moveCost, portPeers, rackPower, storageStacks } from "../../../sim/60-infra/status";
import { FEED_PRICE } from "../../../sim/88-tick/tick";
import { buyCircuit, CIRCUIT_PRICE, connect, mountDevice, mountStack, moveInRack, moveRack, moveServer, sellRack, setExtraPower, setFeed, setFlatPower } from "../../../sim/90-actions/hardware";
import { Stepper } from "../shop/Cart";
import type { Side } from "../../art/backs";
import { Isometric } from "../../art/Isometric";
import { cableColor } from "../../art/fronts";
import { RackFront, type RackItem, type RackLink, type RackRemote } from "../../art/RackFront";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { day, deviceLamps, devName, height, portLamps, portLights } from "../hw";
import { rackUnits } from "./Floor";
import { Inspector, SellConfirm, togglePlug, useDeviceMenu, useOfflineGuard } from "./Inspector";
import { menuOn, type MenuEntry } from "../../desktop/ContextMenu";
import { More } from "../More";
import { dcOf, Facts, positionsLabel, PowerMeter, Sheet, useDismiss } from "./ui";
import { BookedMeters } from "./Clusters";
import { clusterOf } from "../../../sim/60-infra/cluster";
import { rackAlarms } from "../../../sim/60-infra/alarms";
import { present } from "../../../sim/60-infra/handwork";
import { useSessionState } from "../../session";
import { useHandWork, type HandTask } from "./HandSheet";

export function rackItems(g: GameState, rackId: string): RackItem[] {
  return g.devices.filter((d) => d.rackId === rackId).map((d) => {
    const model = modelById(d.model);
    return { id: d.id, slot: d.slot, model, brand: d.brand, name: devName(d), groups: d.groups, chassisId: d.chassisId, plugs: d.components.filter((c) => c.kind === "psu").map(isPlugged), stick: g.media.stick.in === d.id, ...deviceLamps(g, d.id, model) };
  });
}

function rackLinks(g: GameState, rackId: string): RackLink[] {
  const dev = new Map(g.devices.map((d) => [d.id, d]));
  return g.cables.flatMap((c) => [[c.a, c.b], [c.b, c.a]].flatMap(([end, peer]) => (dev.get(end.device)?.rackId === rackId ? [{ id: c.id, end, peer, color: cableColor(c) }] : [])));
}

const KIND_LABEL: Record<DeviceKind, string> = { server: t("locations-2.kind.server"), switch: t("locations-2.kind.switch"), firewall: t("locations-2.kind.firewall"), gateway: t("locations-2.kind.gateway"), patch: t("locations-2.kind.patch"), ups: t("locations-2.kind.ups"), pdu: t("locations-2.kind.pdu"), part: t("locations-2.kind.part"), kvm: t("locations-2.kind.kvm"), console: t("locations-2.kind.console"), oob: t("locations-2.kind.oob"), chassis: t("locations-2.kind.chassis") };

// Devices outside the rack that it is cabled to, plus the location's carrier panel and patch panels to cable to.
function rackRemotes(g: GameState, rack: Rack): RackRemote[] {
  const here = g.devices.filter((d) => (d.rackId || d.panel) && locationOf(g, d)?.id === rack.locationId);
  const ids = new Set(g.devices.filter((d) => d.rackId === rack.id).map((d) => d.id));
  const cabled = new Set(g.cables.flatMap((c) => (ids.has(c.a.device) ? [c.b.device] : ids.has(c.b.device) ? [c.a.device] : [])));
  const kind = (d: Device) => modelById(d.model).kind;
  return g.devices.filter((d) => !ids.has(d.id) && (cabled.has(d.id) || (here.includes(d) && (kind(d) === "gateway" || kind(d) === "patch")))).map((d) => {
    const m = modelById(d.model), same = here.filter((x) => kind(x) === m.kind).sort((x, y) => x.name.localeCompare(y.name));
    const other = g.racks.find((r) => r.id === d.rackId);
    return {
      id: d.id,
      label: d.label ?? (same.length > 1 ? `${KIND_LABEL[m.kind]} ${same.indexOf(d) + 1}` : KIND_LABEL[m.kind]),
      title: other ? `${devName(d)}, ${other.name}` : devName(d),
      model: m,
      ports: portLamps(m, portPeers(g, d.id)),
      lights: portLights(g, d.id, m),
    };
  });
}

const ZOOMS = [1, 1.5, 2, 3];
// Wheel delta per zoom step; a trackpad pinch sends many small ctrl+wheel events.
const WHEEL_STEP = 40;

// Shift, Ctrl or Cmd with the wheel (or a pinch) over the rack zooms around the pointer; the rack column then scrolls.
function useRackZoom() {
  const [zoom, setZoom] = useState(1);
  const ref = useRef<HTMLDivElement>(null), anchor = useRef<{ x: number; y: number } | null>(null), acc = useRef(0), cur = useRef(1), base = useRef(0);
  cur.current = zoom;
  const step = useCallback((dir: 1 | -1, at?: { x: number; y: number }) => {
    const el = ref.current, z = cur.current, n = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + dir))];
    if (!el || n === z) return;
    if (z === 1) base.current = el.offsetWidth;
    const p = at ?? { x: el.clientWidth / 2, y: el.clientHeight / 2 };
    anchor.current = { x: (el.scrollLeft + p.x) * (n / z) - p.x, y: (el.scrollTop + p.y) * (n / z) - p.y };
    cur.current = n;
    setZoom(n);
  }, []);
  useLayoutEffect(() => {
    const el = ref.current, a = anchor.current;
    if (el && a) { el.scrollLeft = a.x; el.scrollTop = a.y; anchor.current = null; }
  }, [zoom]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) return;
      e.preventDefault();
      // macOS turns a shifted vertical wheel into a horizontal one.
      acc.current += e.deltaY || e.deltaX;
      if (Math.abs(acc.current) < WHEEL_STEP) return;
      const r = el.getBoundingClientRect();
      step(acc.current < 0 ? 1 : -1, { x: e.clientX - r.left, y: e.clientY - r.top });
      acc.current = 0;
    };
    // Dragging anywhere but a port pans the rack; a drag past a few pixels swallows the click it ends with.
    let pan: { x: number; y: number; left: number; top: number; moved: boolean } | null = null;
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as Element).closest("[data-end]")) return;
      pan = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
    };
    const move = (e: PointerEvent) => {
      if (!pan) return;
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      if (!pan.moved && Math.hypot(dx, dy) < 5) return;
      if (!pan.moved) { pan.moved = true; el.setPointerCapture(e.pointerId); el.classList.add("panning"); }
      el.scrollLeft = pan.left - dx;
      el.scrollTop = pan.top - dy;
    };
    const up = () => { el.classList.remove("panning"); if (!pan?.moved) pan = null; };
    const click = (e: MouseEvent) => { if (pan?.moved) { e.stopPropagation(); e.preventDefault(); } pan = null; };
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("click", click, true);
    return () => {
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("click", click, true);
    };
  }, [step]);
  return { zoom, ref, width: zoom > 1 ? base.current : undefined };
}

export function RackView({ game, rack, device, onDevice, onMoved }: { game: GameState; rack: Rack; device: string | null; onDevice: (id: string | null) => void; onMoved: (locId: string | null) => void }) {
  const act = useStore((s) => s.act);
  const [side, setSide] = useState<Side>("front");
  const [mount, setMount] = useState<{ unit: number; top: number; left: number } | null>(null);
  const [moving, setMoving] = useState(false);
  const [movingServers, setMovingServers] = useState(false);
  const hand = useHandWork();
  const [selling, setSelling] = useState(false);
  const [hot, setHot] = useState<string | null>(null);
  const main = useRef<HTMLDivElement>(null);
  const { zoom, ref: rackRef, width: rackWidth } = useRackZoom();
  const items = rackItems(game, rack.id), units = rackUnits(rack), power = rackPower(game, rack.id);
  const used = items.reduce((n, it) => n + it.model.height, 0);
  const nodes = game.devices.filter((d) => d.rackId === rack.id && clusterOf(game, d.id));
  const dev = game.devices.find((d) => d.id === device && d.rackId === rack.id);
  const loc = game.locations.find((l) => l.id === rack.locationId)!;
  const { guarded, dialog } = useOfflineGuard(game);
  const [rename, setRename] = useState<string | null>(null);
  // The one monitor, on the server whose console end was clicked; it works where the player stands.
  const [monitor, setMonitor] = useSessionState<string | null>("loc.monitor", null);
  const here = present(game, rack.locationId);
  const clearRename = useCallback(() => setRename(null), []);
  const menus = useDeviceMenu(game, onDevice, (id) => { onDevice(id); setRename(id); });
  const deviceMenu = (id: string, e: ReactMouseEvent) => {
    const d = game.devices.find((x) => x.id === id);
    if (d) menuOn(() => menus.entries(d, id !== dev?.id))(e);
  };
  const rackMenu = (): MenuEntry[] => [
    !rack.provided && { label: t("locations-2.moveMenu"), disabled: rack.arriveAt !== null, run: () => setMoving(true) },
    serverTargets(game, rack).length > 0 && { label: t("locations-2.moveServersMenu"), run: () => setMovingServers(true) },
    !rack.provided && { label: t("locations-2.sellMenu"), disabled: items.length > 0, run: () => setSelling(true) },
  ];
  const plug = (id: string, k: number) => {
    const d = game.devices.find((x) => x.id === id), psu = d?.components.filter((c) => c.kind === "psu")[k];
    if (d && psu) togglePlug(guarded, d, psu.id);
  };
  const openMount = (unit: number, el: Element) => {
    const m = main.current!.getBoundingClientRect(), r = el.getBoundingClientRect();
    setMount({ unit, top: Math.max(8, Math.min(r.top - m.top, m.height - 300)), left: Math.min(r.right - m.left + 10, m.width - 420) });
  };

  return (
    <div className="loc-split" ref={main}>
      <div className="loc-rack">
        <div className="loc-rack-h">
          <h2>{rack.name}</h2>
          <div className="seg" role="group" aria-label={t("locations-2.side")}>
            <button aria-pressed={side === "front"} onClick={() => setSide("front")}>{t("locations-2.front")}</button>
            <button aria-pressed={side === "back"} onClick={() => setSide("back")}>{t("locations-2.back")}</button>
          </div>
        </div>
        <div className="loc-rack-scroll" ref={rackRef} style={{ width: rackWidth }}>
          <RackFront units={units} items={items} links={rackLinks(game, rack.id)} remotes={side === "back" ? rackRemotes(game, rack) : []} side={side} w={420 * zoom} u={22 * zoom}
            hot={dev ? hot : null} selected={dev?.id ?? null} onDevice={(id) => { onDevice(id); setMount(null); if (id !== monitor) setMonitor(null); }} onDeviceMenu={deviceMenu} onFree={openMount}
            onConnect={(a, b) => act(connect, a, b)} onPlug={plug} onConsole={here ? (id) => { onDevice(id); setMonitor(id); } : undefined} onUsb={here ? (id) => (game.media.stick.in === id ? act(unplugStick) : act(plugStick, id)) : undefined} onMove={(id, slot) => act(moveInRack, id, slot)} />
        </div>
      </div>
      <div className="loc-insp">
        {dev ? <Inspector key={dev.id} game={game} device={dev} side={side} onSelect={onDevice} onHot={setHot} rename={rename === dev.id} onRenaming={clearRename} monitor={monitor === dev.id && here} onUnplug={() => setMonitor(null)} onConsole={here ? () => setMonitor(dev.id) : undefined} /> : (
          <>
            <div className="loc-insp-h" onContextMenu={menuOn(rackMenu)}>
              <h2>{rack.name}</h2>
              {power.tripped && <span className="pill bad">{t("locations-2.tripped")}</span>}
              {rack.arriveAt !== null && <span className="pill"><Truck />{t("locations-2.arrives", { day: day(rack.arriveAt) })}</span>}
              <span className="grow" />
              {!rack.provided && <More label={rack.name} entries={rackMenu} />}
            </div>
            <div className="loc-card">
              <Facts rows={[[t("locations-2.location"), loc.name], [t("locations-2.position"), <span className="num">{rack.position}</span>], [t("locations-2.used"), <span className="num">{used} / {units} U</span>], ...(rack.provided ? [[t("locations-2.owner"), t("locations-2.provided")]] as [string, string][] : [[t("locations-2.paid"), <span className="num">{euro(rack.price)}</span>]] as [string, ReactNode][])]} />
            </div>
            <div className="loc-card">
              <div className="loc-card-h"><h3><Plug />{t("locations-2.power")}</h3><span className="grow" /><PowerMeter watts={power.watts} limit={power.limitWatts} tripped={power.tripped} /></div>
              {rack.feedB && (["a", "b"] as const).map((f) => (
                <div key={f} className="loc-row"><span className="loc-k">{t("locations-1.feed", { feed: f.toUpperCase() })}</span><span className="grow" /><PowerMeter watts={power[f]} limit={power.limitWatts} tripped={power[f] > power.limitWatts} /></div>
              ))}
              {rackAlarms(game, rack.id).map((a) => <div key={a.key + (a.params.feed ?? "")} className={`loc-row loc-alarm ${a.severity}`}>{t(a.key, a.params)}</div>)}
            </div>
            {nodes.length > 0 && (
              <div className="loc-card">
                <div className="loc-card-h"><h3><Gauge />{t("locations-2.utilization")}</h3></div>
                <BookedMeters game={game} devices={nodes} />
              </div>
            )}
            <Upgrades loc={loc} rack={rack} />
          </>
        )}
      </div>
      {mount && <MountPop game={game} rack={rack} {...mount} onClose={() => setMount(null)} onMount={(task) => { setMount(null); hand.start(game, { ...task, onDone: () => onDevice(task.deviceId) }); }} />}
      {moving && <MoveRack game={game} rack={rack} onClose={() => setMoving(false)} onMoved={(id) => { setMoving(false); onMoved(id); }} />}
      {movingServers && <MoveServers game={game} rack={rack} onClose={() => setMovingServers(false)} onMove={(ids, to) => { setMovingServers(false); hand.start(game, { title: t("locations-2.moveServersTitle", { n: ids.length, to: to.name }), deviceId: ids[0], at: to.id, action: moveServer, args: [ids, to.id] }); }} />}
      {dialog}
      {menus.dialog}
      {hand.dialog}
      {selling && <SellConfirm game={game} name={rack.name} price={rack.price} boughtAt={rack.boughtAt} onCancel={() => setSelling(false)} onSell={() => { setSelling(false); if (act(sellRack, rack.id).ok) onMoved(null); }} />}
    </div>
  );
}

// Stored units that fit the clicked free range; a stack fills the top of the range, each unit on top of the last.
function MountPop({ game, rack, unit, top, left, onClose, onMount }: { game: GameState; rack: Rack; unit: number; top: number; left: number; onClose: () => void; onMount: (task: HandTask) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose);
  const rows = storageStacks(game, rack.locationId).filter((st) => { const h = modelById(st.model).height; return h > 0 && mountFrom(game, rack.id, h, 1, unit) !== undefined; });
  const where = `U${unit}`;
  return (
    <div className="loc-shop" ref={ref} style={{ top, left }} role="dialog" aria-label={t("locations-2.mountAt", { where })}>
      <div className="loc-shop-h"><h3>{where}</h3></div>
      <div className="loc-shop-list">
        {rows.map((st) => <MountRow key={`${st.model}|${st.brand}`} game={game} rack={rack} st={st} unit={unit} onMount={onMount} />)}
        {!rows.length && <div className="loc-shop-none">{t("locations-2.noStoredFits")}</div>}
      </div>
    </div>
  );
}

function MountRow({ game, rack, st, unit, onMount }: { game: GameState; rack: Rack; st: ReturnType<typeof storageStacks>[number]; unit: number; onMount: (task: HandTask) => void }) {
  const m = modelById(st.model), max = mountMax(game, rack.id, m.height, st.ids.length, unit);
  const [count, setCount] = useState(1);
  const n = Math.min(count, max), from = mountFrom(game, rack.id, m.height, n, unit) ?? unit;
  const mount = () => onMount(mountTask(st, rack.id, n, from));
  return (
    <div className="loc-shop-row">
      <Isometric model={m} brand={st.brand} w={64} />
      <div className="loc-shop-main">
        <div className="loc-shop-name">{m.kind === "server" ? `${st.brand} ` : ""}{m.name}<span className="pill num">{height(m)}</span></div>
        <div className="loc-shop-specs num">{t("locations-2.nInStorage", { n: st.ids.length })}</div>
      </div>
      {max > 1 && <Stepper value={n} min={1} onChange={(v) => setCount(Math.min(v, max))} />}
      <button className="btn primary" onClick={mount}>{t("locations-2.mount")}</button>
    </div>
  );
}

const rackServers = (game: GameState, rack: Rack) => game.devices.filter((d) => d.rackId === rack.id && modelById(d.model).kind === "server");
// The other ready locations with a rack that has room for the smallest server in this rack.
function serverTargets(game: GameState, rack: Rack): Location[] {
  const servers = rackServers(game, rack);
  if (!servers.length) return [];
  const height = Math.min(...servers.map((d) => modelById(d.model).height));
  return game.locations.filter((l) => l.id !== rack.locationId && l.readyAt <= game.hour
    && game.racks.some((r) => r.locationId === l.id && r.arriveAt === null && freeSlots(game, r.id, height).length));
}

function MoveServers({ game, rack, onClose, onMove }: { game: GameState; rack: Rack; onClose: () => void; onMove: (ids: string[], to: Location) => void }) {
  const servers = rackServers(game, rack), targets = serverTargets(game, rack);
  const serves = (d: Device) => { const c = clusterOf(game, d.id);
    return game.workloads.some((w) => (w.deviceId === d.id || (c && w.clusterId === c.id)) && game.services.some((v) => v.id === w.serviceId && v.endedAt === null)); };
  const [picked, setPicked] = useState(() => servers.filter((d) => !serves(d)).map((d) => d.id));
  const [to, setTo] = useState(targets[0]?.id ?? "");
  const target = targets.find((l) => l.id === to), ids = servers.filter((d) => picked.includes(d.id)).map((d) => d.id);
  return (
    <Sheet title={t("locations-2.moveServers")} onClose={onClose}>
      <div className="loc-form">
        <div className="picks" role="group" aria-label={t("locations-2.servers")}>
          {servers.map((d) => (
            <button key={d.id} className="pick" aria-pressed={picked.includes(d.id)} onClick={() => setPicked(picked.includes(d.id) ? picked.filter((x) => x !== d.id) : [...picked, d.id])}>
              <strong>{devName(d)}</strong><span className="sub">{clusterOf(game, d.id)?.name ?? modelById(d.model).name}</span>
            </button>
          ))}
        </div>
        <div className="picks" role="group" aria-label={t("locations-2.location")}>
          {targets.map((l) => (
            <button key={l.id} className="pick" aria-pressed={l.id === to} onClick={() => setTo(l.id)}>
              <strong>{l.name}</strong><span className="sub">{l.city} · <span className="num">{l.az}</span></span>
            </button>
          ))}
        </div>
      </div>
      <div className="loc-sheet-foot">
        <span className="grow" />
        <button className="btn" onClick={onClose}>{t("locations-2.cancel")}</button>
        <button className="btn primary" disabled={!target || !ids.length} onClick={() => target && onMove(ids, target)}><Truck />{t("locations-2.move")}</button>
      </div>
    </Sheet>
  );
}

function MoveRack({ game, rack, onClose, onMoved }: { game: GameState; rack: Rack; onClose: () => void; onMoved: (locId: string) => void }) {
  const act = useStore((s) => s.act);
  const targets = game.locations.flatMap((l) => {
    const free = freePositions(game, l.id);
    return free.length && (l.space !== "basement" || rackUnits(rack) <= BASEMENT.maxUnits) ? [{ l, free }] : [];
  });
  const [to, setTo] = useState(targets.find((t) => t.l.id !== rack.locationId)?.l.id ?? targets[0]?.l.id ?? "");
  const target = targets.find((t) => t.l.id === to);
  const [pos, setPos] = useState(0);
  const position = target?.free.includes(pos) ? pos : target?.free[0];
  const cost = target && moveCost(game, rack.id, target.l.id);
  const go = () => { if (target && position && act(moveRack, rack.id, target.l.id, position).ok) onMoved(target.l.id); };
  return (
    <Sheet title={t("locations-2.moveRack", { name: rack.name })} onClose={onClose}>
      <div className="loc-form">
        <div className="picks" role="group" aria-label={t("locations-2.location")}>
          {targets.map(({ l, free }) => (
            <button key={l.id} className="pick" aria-pressed={l.id === to} onClick={() => setTo(l.id)}>
              <strong>{l.name}</strong><span className="sub">{l.city} · <span className="num">{l.az}</span> · {t("locations-2.positionsFree", { n: positionsLabel(free.length) })}</span>
            </button>
          ))}
        </div>
        {!targets.length && <div className="loc-muted">{t("locations-2.noFreePosition")}</div>}
        {target && (
          <div className="loc-move-pos"><span className="loc-k">{t("locations-2.position")}</span>
            <div className="seg wrap" role="group" aria-label={t("locations-2.position")}>
              {target.free.map((p) => <button key={p} className="num" aria-pressed={p === position} onClick={() => setPos(p)}>{p}</button>)}
            </div>
          </div>
        )}
        {cost && <Facts rows={[[t("locations-2.cost"), <span className="num">{euro(cost.price)}</span>], [t("locations-2.travelTime"), <span className="num">{t("locations-2.nDays", { n: cost.hours / 24 })}</span>], [t("locations-2.arrivesHead"), <span className="num">{day(game.hour + cost.hours)}</span>]]} />}
      </div>
      <div className="loc-sheet-foot">
        <span className="grow" />
        <button className="btn" onClick={onClose}>{t("locations-2.cancel")}</button>
        <button className="btn primary" disabled={!target || !position} onClick={go}><Truck />{t("locations-2.moveRackBtn")}</button>
      </div>
    </Sheet>
  );
}

// Power upgrades: the basement's extra household circuit, a rented rack's second and high-density feeds and its power contract.
export function Upgrades({ loc, rack }: { loc: Location; rack?: Rack }) {
  const act = useStore((s) => s.act), game = useStore((s) => s.game);
  const dc = dcOf(loc);
  const rows: { name: string; effect: string; price: string; on: boolean; buy: () => void; drop?: () => void; control?: ReactNode }[] = [];
  if (loc.space === "basement") rows.push({ name: t("locations-2.extraCircuit"), effect: `+${EXTRA_CIRCUIT_KW} kW`, price: euro(CIRCUIT_PRICE), on: loc.extraCircuit, buy: () => act(buyCircuit, loc.id) });
  if (dc && rack && !rack.provided) {
    const feed = (key: "feedB" | "highDensity", name: string, effect: string) => rows.push({
      name, effect, price: t("locations-2.perMo", { amount: euro(Math.round(FEED_PRICE[key] * dc.positionPrice)) }), on: rack[key],
      buy: () => act(setFeed, rack.id, key === "feedB" ? "b" : "highDensity", true),
      drop: () => act(setFeed, rack.id, key === "feedB" ? "b" : "highDensity", false),
    });
    feed("feedB", t("locations-2.feedB"), t("locations-2.feedBEffect"));
    feed("highDensity", t("locations-2.highDensity"), t("locations-2.highDensityEffect"));
  }
  if (dc && rack?.provided) {
    const target = rack.extraKwAt?.kw ?? rack.extraKw, size = SHARE_RACKS.find((m) => m.id === rack.model)!.size;
    rows.push({
      name: t("locations-2.extraPower"), effect: rack.extraKwAt ? t("locations-2.extraChange", { kw: rack.extraKw, next: rack.extraKwAt.kw, day: day(rack.extraKwAt.at) }) : `+${rack.extraKw} kW`,
      price: t("locations-2.perMo", { amount: euro((target / EXTRA_STEP_KW) * extraStepPrice(dc)) }), on: false, buy: () => {},
      control: <Stepper label={t("locations-2.extraPower")} value={target} step={EXTRA_STEP_KW} max={maxExtraKw(dc, size)} onChange={(kw) => act(setExtraPower, rack.id, kw)} />,
    });
  }
  const offer = rack && !rack.provided ? flatOffer(game, rack.locationId) : "metered";
  if (dc && rack && offer !== "metered") {
    const target = rack.flatKwAt?.kw ?? rack.flatKw, year = yearOf(game.hour);
    const kwLabel = (kw: number) => (kw ? `${kw} kW` : t("locations-2.metered"));
    const options = [...(offer === "both" ? [{ kw: 0, label: t("locations-2.metered") }] : []), ...FLAT_CONTRACTS.map((c) => ({ kw: c.kw, label: `2 × ${c.amps} A` }))];
    rows.push({
      name: t("locations-2.powerContract"), effect: rack.flatKwAt ? t("locations-2.contractChange", { now: kwLabel(rack.flatKw), next: kwLabel(rack.flatKwAt.kw), day: day(rack.flatKwAt.at) }) : kwLabel(rack.flatKw),
      price: target ? t("locations-2.perMo", { amount: euro(flatMonthly(dc, target, year)) }) : t("locations-2.perKwh"), on: false, buy: () => {},
      control: (
        <div className="seg" role="group" aria-label={t("locations-2.powerContract")}>
          {options.map((o) => <button key={o.kw} aria-pressed={target === o.kw} onClick={() => act(setFlatPower, rack.id, o.kw)}>{o.label}</button>)}
        </div>
      ),
    });
  }
  if (!rows.length) return null;
  return (
    <div className="loc-card">
      <div className="loc-card-h"><h3><Zap />{t("locations-2.upgrades")}</h3></div>
      <table className="table loc-parts">
        <thead><tr><th>{t("locations-2.upgrade")}</th><th>{t("locations-2.effect")}</th><th className="r">{t("locations-2.price")}</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td>{r.name}</td>
              <td className="num">{r.effect}</td>
              <td className="r num">{r.price}</td>
              <td className="r">
                {r.control ?? (r.on ? (r.drop ? <button className="btn" onClick={r.drop}>{t("locations-2.cancel")}</button> : <span className="pill ok">{t("locations-2.installed")}</span>)
                  : <button className="btn primary" onClick={r.buy}>{r.drop ? t("locations-2.add") : t("locations-2.buy")}</button>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Mounting as hand work: one unit can also go to a technician, a stack goes in one job.
export const mountTask = (st: { ids: string[]; model: string; brand: string }, rackId: string, n: number, from: number): HandTask => ({
  title: t("locations-2.mountName", { name: `${st.brand} ${modelById(st.model).name}` }),
  deviceId: st.ids[0],
  ...(n === 1
    ? { action: mountDevice, args: [st.ids[0], rackId, from], tech: { kind: "mount" as const, componentId: rackId, slot: from } }
    : { action: mountStack, args: [st.model, st.brand, rackId, n, from] }),
});
