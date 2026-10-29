import { Gauge, Plug, Truck, Zap, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { euro } from "../../../sim/00-core/money";
import { modelById, type DeviceKind } from "../../../sim/10-catalog/hardware";
import { BASEMENT, EXTRA_STEP_KW, extraStepPrice, maxExtraKw, SHARE_RACKS } from "../../../sim/20-world/datacenters";
import type { Device, GameState, Location, Rack } from "../../../sim/50-state";
import { EXTRA_CIRCUIT_KW, freePositions, isPlugged, locationOf, mountFrom, mountMax, moveCost, portPeers, rackPower, storageStacks } from "../../../sim/60-infra/status";
import { FEED_PRICE } from "../../../sim/88-tick/tick";
import { buyCircuit, CIRCUIT_PRICE, connect, mountDevice, mountStack, moveInRack, moveRack, sellRack, setExtraPower, setFeed } from "../../../sim/90-actions/hardware";
import { Stepper } from "../shop/Cart";
import type { Side } from "../../art/backs";
import { Isometric } from "../../art/Isometric";
import { cableColor } from "../../art/fronts";
import { RackFront, type RackItem, type RackLink, type RackRemote } from "../../art/RackFront";
import { useStore } from "../../store";
import { day, deviceLamps, devName, height, portLamps, portLights } from "../hw";
import { rackUnits } from "./Floor";
import { Inspector, SellConfirm, togglePlug, useDeviceMenu, useOfflineGuard } from "./Inspector";
import { menuOn, type MenuEntry } from "../../desktop/ContextMenu";
import { More } from "../More";
import { dcOf, Facts, positionsLabel, PowerMeter, Sheet, useDismiss } from "./ui";
import { BookedMeters } from "./Clusters";
import { clusterOf } from "../../../sim/60-infra/cluster";
import { present } from "../../../sim/60-infra/handwork";
import { useSessionState } from "../../session";

export function rackItems(g: GameState, rackId: string): RackItem[] {
  return g.devices.filter((d) => d.rackId === rackId).map((d) => {
    const model = modelById(d.model);
    return { id: d.id, slot: d.slot, model, brand: d.brand, name: devName(d), groups: d.groups, plugs: d.components.filter((c) => c.kind === "psu").map(isPlugged), ...deviceLamps(g, d.id, model) };
  });
}

function rackLinks(g: GameState, rackId: string): RackLink[] {
  const dev = new Map(g.devices.map((d) => [d.id, d]));
  return g.cables.flatMap((c) => [[c.a, c.b], [c.b, c.a]].flatMap(([end, peer]) => (dev.get(end.device)?.rackId === rackId ? [{ id: c.id, end, peer, color: cableColor(c) }] : [])));
}

const KIND_LABEL: Record<DeviceKind, string> = { server: "Server", switch: "Switch", firewall: "Firewall", gateway: "Carrier panel", patch: "Patch panel", ups: "UPS", pdu: "PDU", part: "Part", kvm: "KVM", console: "Console server", oob: "OOB switch" };

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

// Ctrl or Cmd with the wheel (or a pinch) over the rack zooms around the pointer; the rack column then scrolls.
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
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      acc.current += e.deltaY;
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
  return { zoom, ref, step, width: zoom > 1 ? base.current : undefined };
}

export function RackView({ game, rack, device, onDevice, onMoved }: { game: GameState; rack: Rack; device: string | null; onDevice: (id: string | null) => void; onMoved: (locId: string | null) => void }) {
  const act = useStore((s) => s.act);
  const [side, setSide] = useState<Side>("front");
  const [mount, setMount] = useState<{ unit: number; top: number; left: number } | null>(null);
  const [moving, setMoving] = useState(false);
  const [selling, setSelling] = useState(false);
  const [hot, setHot] = useState<string | null>(null);
  const main = useRef<HTMLDivElement>(null);
  const { zoom, ref: rackRef, step, width: rackWidth } = useRackZoom();
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
    !rack.provided && { label: "Move…", disabled: rack.arriveAt !== null, run: () => setMoving(true) },
    !rack.provided && { label: "Sell…", disabled: items.length > 0, run: () => setSelling(true) },
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
          <div className="seg" role="group" aria-label="Zoom">
            <button aria-label="Zoom out" disabled={zoom === ZOOMS[0]} onClick={() => step(-1)}><ZoomOut /></button>
            <button aria-label="Zoom in" disabled={zoom === ZOOMS.at(-1)} onClick={() => step(1)}><ZoomIn /></button>
          </div>
          <div className="seg" role="group" aria-label="Side">
            <button aria-pressed={side === "front"} onClick={() => setSide("front")}>Front</button>
            <button aria-pressed={side === "back"} onClick={() => setSide("back")}>Back</button>
          </div>
        </div>
        <div className="loc-rack-scroll" ref={rackRef} style={{ width: rackWidth }}>
          <RackFront units={units} items={items} links={rackLinks(game, rack.id)} remotes={side === "back" ? rackRemotes(game, rack) : []} side={side} w={420 * zoom} u={22 * zoom}
            hot={dev ? hot : null} selected={dev?.id ?? null} onDevice={(id) => { onDevice(id); setMount(null); if (id !== monitor) setMonitor(null); }} onDeviceMenu={deviceMenu} onFree={openMount}
            onConnect={(a, b) => act(connect, a, b)} onPlug={plug} onConsole={here ? (id) => { onDevice(id); setMonitor(id); } : undefined} onMove={(id, slot) => act(moveInRack, id, slot)} />
        </div>
      </div>
      <div className="loc-insp">
        {dev ? <Inspector key={dev.id} game={game} device={dev} side={side} onSelect={onDevice} onHot={setHot} rename={rename === dev.id} onRenaming={clearRename} monitor={monitor === dev.id && here} onUnplug={() => setMonitor(null)} /> : (
          <>
            <div className="loc-insp-h" onContextMenu={menuOn(rackMenu)}>
              <h2>{rack.name}</h2>
              {power.tripped && <span className="pill bad">Tripped</span>}
              {rack.arriveAt !== null && <span className="pill"><Truck />Arrives <span className="num">{day(rack.arriveAt)}</span></span>}
              <span className="grow" />
              {!rack.provided && <More label={rack.name} entries={rackMenu} />}
            </div>
            <div className="loc-card">
              <Facts rows={[["Location", loc.name], ["Position", <span className="num">{rack.position}</span>], ["Used", <span className="num">{used} / {units} U</span>], ...(rack.provided ? [["Owner", "Provided"]] as [string, string][] : [["Paid", <span className="num">{euro(rack.price)}</span>]] as [string, ReactNode][])]} />
            </div>
            <div className="loc-card">
              <div className="loc-card-h"><h3><Plug />Power</h3><span className="grow" /><PowerMeter watts={power.watts} limit={power.limitWatts} tripped={power.tripped} /></div>
            </div>
            {nodes.length > 0 && (
              <div className="loc-card">
                <div className="loc-card-h"><h3><Gauge />Utilization</h3></div>
                <BookedMeters game={game} devices={nodes} />
              </div>
            )}
            <Upgrades loc={loc} rack={rack} />
          </>
        )}
      </div>
      {mount && <MountPop game={game} rack={rack} {...mount} onClose={() => setMount(null)} onMounted={(id) => { setMount(null); onDevice(id); }} />}
      {moving && <MoveRack game={game} rack={rack} onClose={() => setMoving(false)} onMoved={(id) => { setMoving(false); onMoved(id); }} />}
      {dialog}
      {menus.dialog}
      {selling && <SellConfirm game={game} name={rack.name} price={rack.price} boughtAt={rack.boughtAt} onCancel={() => setSelling(false)} onSell={() => { setSelling(false); if (act(sellRack, rack.id).ok) onMoved(null); }} />}
    </div>
  );
}

// Stored units that fit the clicked free range; a stack fills the top of the range, each unit on top of the last.
function MountPop({ game, rack, unit, top, left, onClose, onMounted }: { game: GameState; rack: Rack; unit: number; top: number; left: number; onClose: () => void; onMounted: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose);
  const rows = storageStacks(game, rack.locationId).filter((st) => { const h = modelById(st.model).height; return h > 0 && mountFrom(game, rack.id, h, 1, unit) !== undefined; });
  const where = `U${unit}`;
  return (
    <div className="loc-shop" ref={ref} style={{ top, left }} role="dialog" aria-label={`Mount at ${where}`}>
      <div className="loc-shop-h"><h3>{where}</h3></div>
      <div className="loc-shop-list">
        {rows.map((st) => <MountRow key={`${st.model}|${st.brand}`} game={game} rack={rack} st={st} unit={unit} onMounted={onMounted} />)}
        {!rows.length && <div className="loc-shop-none">No stored unit fits</div>}
      </div>
    </div>
  );
}

function MountRow({ game, rack, st, unit, onMounted }: { game: GameState; rack: Rack; st: ReturnType<typeof storageStacks>[number]; unit: number; onMounted: (id: string) => void }) {
  const act = useStore((s) => s.act);
  const m = modelById(st.model), max = mountMax(game, rack.id, m.height, st.ids.length, unit);
  const [count, setCount] = useState(1);
  const n = Math.min(count, max), from = mountFrom(game, rack.id, m.height, n, unit) ?? unit;
  const mount = () => {
    const id = st.ids[0];
    const r = (n === 1 ? act(mountDevice, id, rack.id, from) : act(mountStack, st.model, st.brand, rack.id, n, from));
    if (r.ok) onMounted(id);
  };
  return (
    <div className="loc-shop-row">
      <Isometric model={m} brand={st.brand} w={64} />
      <div className="loc-shop-main">
        <div className="loc-shop-name">{m.kind === "server" ? `${st.brand} ` : ""}{m.name}<span className="pill num">{height(m)}</span></div>
        <div className="loc-shop-specs num">{st.ids.length} in storage</div>
      </div>
      {max > 1 && <Stepper value={n} min={1} onChange={(v) => setCount(Math.min(v, max))} />}
      <button className="btn primary" onClick={mount}>Mount</button>
    </div>
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
    <Sheet title={`Move ${rack.name}`} onClose={onClose}>
      <div className="loc-form">
        <div className="picks" role="group" aria-label="Location">
          {targets.map(({ l, free }) => (
            <button key={l.id} className="pick" aria-pressed={l.id === to} onClick={() => setTo(l.id)}>
              <strong>{l.name}</strong><span className="sub">{l.city} · <span className="num">{l.az}</span> · {positionsLabel(free.length)} free</span>
            </button>
          ))}
        </div>
        {!targets.length && <div className="loc-muted">No free position</div>}
        {target && (
          <div className="loc-move-pos"><span className="loc-k">Position</span>
            <div className="seg wrap" role="group" aria-label="Position">
              {target.free.map((p) => <button key={p} className="num" aria-pressed={p === position} onClick={() => setPos(p)}>{p}</button>)}
            </div>
          </div>
        )}
        {cost && <Facts rows={[["Cost", <span className="num">{euro(cost.price)}</span>], ["Travel time", <span className="num">{cost.hours / 24} {cost.hours === 24 ? "day" : "days"}</span>], ["Arrives", <span className="num">{day(game.hour + cost.hours)}</span>]]} />}
      </div>
      <div className="loc-sheet-foot">
        <span className="grow" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!target || !position} onClick={go}><Truck />Move rack</button>
      </div>
    </Sheet>
  );
}

// Power upgrades: the basement's extra household circuit, and a rented rack's second and high-density feeds.
export function Upgrades({ loc, rack }: { loc: Location; rack?: Rack }) {
  const act = useStore((s) => s.act);
  const dc = dcOf(loc);
  const rows: { name: string; effect: string; price: string; on: boolean; buy: () => void; drop?: () => void; control?: ReactNode }[] = [];
  if (loc.space === "basement") rows.push({ name: "Extra circuit", effect: `+${EXTRA_CIRCUIT_KW} kW`, price: euro(CIRCUIT_PRICE), on: loc.extraCircuit, buy: () => act(buyCircuit, loc.id) });
  if (dc && rack && !rack.provided) {
    const feed = (key: "feedB" | "highDensity", name: string, effect: string) => rows.push({
      name, effect, price: `${euro(Math.round(FEED_PRICE[key] * dc.positionPrice))}/mo`, on: rack[key],
      buy: () => act(setFeed, rack.id, key === "feedB" ? "b" : "highDensity", true),
      drop: () => act(setFeed, rack.id, key === "feedB" ? "b" : "highDensity", false),
    });
    feed("feedB", "Feed B", "Second power feed");
    feed("highDensity", "High density", "2 × kW limit");
  }
  if (dc && rack?.provided) {
    const target = rack.extraKwAt?.kw ?? rack.extraKw, size = SHARE_RACKS.find((m) => m.id === rack.model)!.size;
    rows.push({
      name: "Extra power", effect: `+${rack.extraKw} kW${rack.extraKwAt ? `, +${rack.extraKwAt.kw} kW on ${day(rack.extraKwAt.at)}` : ""}`,
      price: `${euro((target / EXTRA_STEP_KW) * extraStepPrice(dc))}/mo`, on: false, buy: () => {},
      control: <Stepper label="Extra power" value={target} step={EXTRA_STEP_KW} max={maxExtraKw(dc, size)} onChange={(kw) => act(setExtraPower, rack.id, kw)} />,
    });
  }
  if (!rows.length) return null;
  return (
    <div className="loc-card">
      <div className="loc-card-h"><h3><Zap />Upgrades</h3></div>
      <table className="table loc-parts">
        <thead><tr><th>Upgrade</th><th>Effect</th><th className="r">Price</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td>{r.name}</td>
              <td className="num">{r.effect}</td>
              <td className="r num">{r.price}</td>
              <td className="r">
                {r.control ?? (r.on ? (r.drop ? <button className="btn" onClick={r.drop}>Cancel</button> : <span className="pill ok">Installed</span>)
                  : <button className="btn primary" onClick={r.buy}>{r.drop ? "Add" : "Buy"}</button>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
