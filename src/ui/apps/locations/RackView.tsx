import { CircleDollarSign, Gauge, Plug, Truck, Zap } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { euro } from "../../../sim/00-core/money";
import { modelById, type DeviceKind } from "../../../sim/10-catalog/hardware";
import { BASEMENT } from "../../../sim/20-world/datacenters";
import type { Device, GameState, Location, Rack } from "../../../sim/50-state";
import { EXTRA_CIRCUIT_KW, freePositions, isPlugged, locationOf, moveCost, portPeers, rackPower, storageStacks } from "../../../sim/60-infra/status";
import { FEED_PRICE } from "../../../sim/88-tick/tick";
import { buyCircuit, CIRCUIT_PRICE, connect, mountDevice, mountStack, moveRack, sellRack, setFeed } from "../../../sim/90-actions/hardware";
import { Stepper } from "../shop/Cart";
import type { Side } from "../../art/backs";
import { Isometric } from "../../art/Isometric";
import { cableColor } from "../../art/fronts";
import { RackFront, type RackItem, type RackLink, type RackRemote } from "../../art/RackFront";
import { useStore } from "../../store";
import { day, deviceLamps, devName, height, portLamps } from "../hw";
import { rackUnits } from "./Floor";
import { Inspector, SellConfirm } from "./Inspector";
import { dcOf, Facts, PowerMeter, Sheet, UsageBars, useDismiss } from "./ui";
import { usageOf } from "../../../sim/60-infra/usage";

function rackItems(g: GameState, rackId: string): RackItem[] {
  return g.devices.filter((d) => d.rackId === rackId).map((d) => {
    const model = modelById(d.model);
    return { id: d.id, slot: d.slot, model, brand: d.brand, name: devName(d), groups: d.groups, plugs: d.components.filter((c) => c.kind === "psu").map(isPlugged), ...deviceLamps(g, d.id, model) };
  });
}

function rackLinks(g: GameState, rackId: string): RackLink[] {
  const dev = new Map(g.devices.map((d) => [d.id, d]));
  return g.cables.flatMap((c) => [[c.a, c.b], [c.b, c.a]].flatMap(([end, peer]) => (dev.get(end.device)?.rackId === rackId ? [{ id: c.id, end, peer, color: cableColor(c) }] : [])));
}

const KIND_LABEL: Record<DeviceKind, string> = { server: "Server", switch: "Switch", firewall: "Firewall", gateway: "Carrier panel", patch: "Patch panel", ups: "UPS", part: "Part" };

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
      ports: portLamps(m, portPeers(g, d.id)),
    };
  });
}

export function RackView({ game, rack, device, onDevice, onMoved }: { game: GameState; rack: Rack; device: string | null; onDevice: (id: string | null) => void; onMoved: (locId: string | null) => void }) {
  const act = useStore((s) => s.act);
  const [side, setSide] = useState<Side>("front");
  const [mount, setMount] = useState<{ lo: number; hi: number; top: number; left: number } | null>(null);
  const [moving, setMoving] = useState(false);
  const [selling, setSelling] = useState(false);
  const [hot, setHot] = useState<string | null>(null);
  const main = useRef<HTMLDivElement>(null);
  const items = rackItems(game, rack.id), units = rackUnits(rack), power = rackPower(game, rack.id);
  const used = items.reduce((n, it) => n + it.model.height, 0);
  const dev = game.devices.find((d) => d.id === device && d.rackId === rack.id);
  const loc = game.locations.find((l) => l.id === rack.locationId)!;
  const openMount = (lo: number, hi: number, el: Element) => {
    const m = main.current!.getBoundingClientRect(), r = el.getBoundingClientRect();
    setMount({ lo, hi, top: Math.max(8, Math.min(r.top - m.top, m.height - 300)), left: Math.min(r.right - m.left + 10, m.width - 420) });
  };

  return (
    <div className="loc-split" ref={main}>
      <div className="loc-rack">
        <div className="loc-rack-h">
          <h2>{rack.name}</h2>
          <div className="seg" role="group" aria-label="Side">
            <button aria-pressed={side === "front"} onClick={() => setSide("front")}>Front</button>
            <button aria-pressed={side === "back"} onClick={() => setSide("back")}>Back</button>
          </div>
        </div>
        <RackFront units={units} items={items} links={rackLinks(game, rack.id)} remotes={side === "back" ? rackRemotes(game, rack) : []} side={side} w={420} u={22}
          hot={dev ? hot : null} selected={dev?.id ?? null} onDevice={(id) => { onDevice(id); setMount(null); }} onFree={openMount}
          onConnect={(a, b) => act((g) => connect(g, a, b))} />
      </div>
      <div className="loc-insp">
        {dev ? <Inspector key={dev.id} game={game} device={dev} side={side} onSelect={onDevice} onHot={setHot} /> : (
          <>
            <div className="loc-insp-h">
              <h2>{rack.name}</h2>
              {power.tripped && <span className="pill bad">Tripped</span>}
              {rack.arriveAt !== null && <span className="pill"><Truck />Arrives <span className="num">{day(rack.arriveAt)}</span></span>}
              <span className="grow" />
              {!rack.provided && <button className="btn" disabled={rack.arriveAt !== null} onClick={() => setMoving(true)}><Truck />Move</button>}
              {!items.length && !rack.provided && <button className="btn" onClick={() => setSelling(true)}><CircleDollarSign />Sell</button>}
            </div>
            <div className="loc-card">
              <Facts rows={[["Location", loc.name], ["Position", <span className="num">{rack.position}</span>], ["Used", <span className="num">{used} / {units} U</span>], ...(rack.provided ? [["Owner", "Provided"]] as [string, string][] : [["Paid", <span className="num">{euro(rack.price)}</span>]] as [string, ReactNode][])]} />
            </div>
            <div className="loc-card">
              <div className="loc-card-h"><h3><Plug />Power</h3><span className="grow" /><PowerMeter watts={power.watts} limit={power.limitWatts} tripped={power.tripped} /></div>
            </div>
            <div className="loc-card">
              <div className="loc-card-h"><h3><Gauge />Utilization</h3></div>
              <UsageBars usage={usageOf(game, game.devices.filter((d) => d.rackId === rack.id))} />
            </div>
            <Upgrades loc={loc} rack={rack} />
          </>
        )}
      </div>
      {mount && <MountPop game={game} rack={rack} {...mount} onClose={() => setMount(null)} onMounted={(id) => { setMount(null); onDevice(id); }} />}
      {moving && <MoveRack game={game} rack={rack} onClose={() => setMoving(false)} onMoved={(id) => { setMoving(false); onMoved(id); }} />}
      {selling && <SellConfirm game={game} name={rack.name} price={rack.price} boughtAt={rack.boughtAt} onCancel={() => setSelling(false)} onSell={() => { setSelling(false); if (act((s) => sellRack(s, rack.id)).ok) onMoved(null); }} />}
    </div>
  );
}

// Stored units that fit the clicked free range; a stack fills the top of the range, each unit on top of the last.
function MountPop({ game, rack, lo, hi, top, left, onClose, onMounted }: { game: GameState; rack: Rack; lo: number; hi: number; top: number; left: number; onClose: () => void; onMounted: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose);
  const rows = storageStacks(game, rack.locationId).filter((st) => { const h = modelById(st.model).height; return h > 0 && h <= hi - lo + 1; });
  const where = `U${hi}`;
  return (
    <div className="loc-shop" ref={ref} style={{ top, left }} role="dialog" aria-label={`Mount at ${where}`}>
      <div className="loc-shop-h"><h3>{where}</h3></div>
      <div className="loc-shop-list">
        {rows.map((st) => <MountRow key={`${st.model}|${st.brand}`} rack={rack} st={st} lo={lo} hi={hi} onMounted={onMounted} />)}
        {!rows.length && <div className="loc-shop-none">No stored unit fits</div>}
      </div>
    </div>
  );
}

function MountRow({ rack, st, lo, hi, onMounted }: { rack: Rack; st: ReturnType<typeof storageStacks>[number]; lo: number; hi: number; onMounted: (id: string) => void }) {
  const act = useStore((s) => s.act);
  const m = modelById(st.model), max = Math.min(st.ids.length, Math.floor((hi - lo + 1) / m.height));
  const [count, setCount] = useState(1);
  const n = Math.min(count, max), from = hi - n * m.height + 1;
  const mount = () => {
    const id = st.ids[0];
    const r = act((s) => (n === 1 ? mountDevice(s, id, rack.id, from) : mountStack(s, st.model, st.brand, rack.id, n, from)));
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
  const go = () => { if (target && position && act((s) => moveRack(s, rack.id, target.l.id, position)).ok) onMoved(target.l.id); };
  return (
    <Sheet title={`Move ${rack.name}`} onClose={onClose}>
      <div className="loc-form">
        <label><span className="loc-k">Location</span>
          <select className="field" value={to} onChange={(e) => setTo(e.target.value)} disabled={!targets.length}>
            {targets.length ? targets.map(({ l }) => <option key={l.id} value={l.id}>{l.name}, {l.city}</option>) : <option>No free position</option>}
          </select>
        </label>
        <label><span className="loc-k">Position</span>
          <select className="field num" value={position ?? ""} onChange={(e) => setPos(Number(e.target.value))} disabled={!target}>
            {target?.free.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
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
  const rows: { name: string; effect: string; price: string; on: boolean; buy: () => void; drop?: () => void }[] = [];
  if (loc.space === "basement") rows.push({ name: "Extra circuit", effect: `+${EXTRA_CIRCUIT_KW} kW`, price: euro(CIRCUIT_PRICE), on: loc.extraCircuit, buy: () => act((g) => buyCircuit(g, loc.id)) });
  if (dc && rack && !rack.provided) {
    const feed = (key: "feedB" | "highDensity", name: string, effect: string) => rows.push({
      name, effect, price: `${euro(Math.round(FEED_PRICE[key] * dc.positionPrice))}/mo`, on: rack[key],
      buy: () => act((g) => setFeed(g, rack.id, key === "feedB" ? "b" : "highDensity", true)),
      drop: () => act((g) => setFeed(g, rack.id, key === "feedB" ? "b" : "highDensity", false)),
    });
    feed("feedB", "Feed B", "Second power feed");
    feed("highDensity", "High density", "2 × kW limit");
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
                {r.on ? (r.drop ? <button className="btn" onClick={r.drop}>Cancel</button> : <span className="pill ok">Installed</span>)
                  : <button className="btn primary" onClick={r.buy}>{r.drop ? "Add" : "Buy"}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
