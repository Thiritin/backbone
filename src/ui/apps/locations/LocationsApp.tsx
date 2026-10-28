import { Building2, Cable, EthernetPort, House, Network, Server, Trash2, Unplug, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { CITIES, RACK_U_PER_MONTH } from "../../../sim/10-catalog/economy";
import { modelById, PATCH_JACKS, SERVER_BRANDS, shopModels, type DeviceModel, type PortSpec } from "../../../sim/10-catalog/hardware";
import type { Device, End, GameState, Rack } from "../../../sim/50-state";
import { freeSlots, linkStatus, portPeers, type LinkStatus } from "../../../sim/60-infra/status";
import { buyDevice, connect, disconnect, removeDevice, rentRack, RENTED_RACK_UNITS, setBond, setPortGroup } from "../../../sim/90-actions/hardware";
import { DeviceSvg, type Lamp, type PortLamp } from "../../art/fronts";
import { RackFront, type RackItem } from "../../art/RackFront";
import { Confirm } from "../../desktop/Confirm";
import { useStore } from "../../store";
import "./locations.css";

const speed = (g: number) => (g >= 1 ? `${g}G` : `${g * 1000}M`);
const ram = (gb: number) => (gb >= 1024 ? `${+(gb / 1024).toFixed(1)} TB` : `${gb} GB`);
const disk = (gb: number) => (gb >= 1000 ? `${+(gb / 1000).toFixed(1)} TB` : `${gb} GB`);
const cores = (n: number) => `${n} ${n === 1 ? "core" : "cores"}`;
const height = (m: DeviceModel) => (m.shelf ? "Shelf" : `${m.height}U`);
const lampOf = (st: LinkStatus): Lamp => (!st.online ? "bad" : st.warning ? "warn" : "ok");
const CABLE_NAME = { copper: "copper", dac: "DAC", fiber: "fiber" };

function portsText(m: DeviceModel): string {
  if (m.kind === "patch") return `${PATCH_JACKS} jacks`;
  const runs: { p: PortSpec; n: number }[] = [];
  for (const p of m.ports) {
    const last = runs.at(-1);
    if (last && last.p.media === p.media && last.p.gbit === p.gbit) last.n++;
    else runs.push({ p, n: 1 });
  }
  return runs.map(({ p, n }) => `${n} × ${p.media === "sfp" ? "SFP " : ""}${speed(p.gbit)}`).join(", ");
}

function specs(m: DeviceModel): string[] {
  const s = m.server;
  return [
    ...(s ? [cores(s.cores), ram(s.ramGb), `${disk(s.diskGb)} ${s.disk}`] : []),
    portsText(m),
    `${m.watts} W`,
    `${m.psus} PSU`,
  ];
}

function portName(m: DeviceModel, i: number): string {
  if (m.kind === "server") return `eth${i}`;
  if (m.kind === "patch") return i < PATCH_JACKS ? `Front ${i + 1}` : `Back ${i - PATCH_JACKS + 1}`;
  return `${m.ports[i].media === "sfp" && m.ports.some((p) => p.media === "rj45") ? "SFP" : "Port"} ${i + 1}`;
}

const portLamps = (m: DeviceModel, peers: (End | null)[]): PortLamp[] => peers.map((p, i) => (p ? (m.ports[i].media === "sfp" ? "fiber" : "ok") : "off"));

function rackItems(g: GameState, rackId: string): RackItem[] {
  return g.devices.filter((d) => d.rackId === rackId).map((d) => {
    const model = modelById(d.model);
    return { id: d.id, slot: d.slot, model, brand: d.brand, name: d.name, state: lampOf(linkStatus(g, d.id)), ports: portLamps(model, portPeers(g, d.id)), groups: d.groups };
  });
}

export function LocationsApp() {
  const game = useStore((s) => s.game);
  const [rackId, setRackId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [shop, setShop] = useState<{ lo: number; hi: number; top: number; left: number } | null>(null);
  const main = useRef<HTMLDivElement>(null);
  const rack = game.racks.find((r) => r.id === rackId) ?? game.racks[0];
  const device = game.devices.find((d) => d.id === deviceId && d.rackId === rack?.id);

  const pickRack = (id: string) => { setRackId(id); setDeviceId(null); setShop(null); };
  const openShop = (lo: number, hi: number, el: Element) => {
    const m = main.current!.getBoundingClientRect(), r = el.getBoundingClientRect();
    setShop({ lo, hi, top: Math.max(8, Math.min(r.top - m.top, m.height - 400)), left: Math.min(r.right - m.left + 10, m.width - 500) });
  };

  return (
    <div className="loc">
      <Sidebar game={game} rack={rack} onRack={pickRack} />
      <div className="loc-main" ref={main}>
        {rack && (
          <>
            <RackColumn game={game} rack={rack} selected={device?.id ?? null} onDevice={(id) => { setDeviceId(id); setShop(null); }} onFree={openShop} />
            <div className="loc-insp">
              {device ? <Inspector key={device.id} game={game} device={device} onSelect={setDeviceId} /> : <SiteFacts game={game} rack={rack} />}
            </div>
            {shop && <Shop game={game} rack={rack} {...shop} onClose={() => setShop(null)} onBought={(id) => { setShop(null); setDeviceId(id ?? null); }} />}
          </>
        )}
      </div>
    </div>
  );
}

function Sidebar({ game, rack, onRack }: { game: GameState; rack?: Rack; onRack: (id: string) => void }) {
  const act = useStore((s) => s.act);
  const [city, setCity] = useState(CITIES[0].name);
  const rent = () => {
    const r = act((s) => rentRack(s, city));
    if (r.ok && r.id) onRack(r.id);
  };
  return (
    <aside className="sidebar loc-side">
      <div className="side-h">Locations</div>
      {game.locations.map((l) => {
        const racks = game.racks.filter((r) => r.locationId === l.id);
        const Icon = l.kind === "basement" ? House : Building2;
        return (
          <Fragment key={l.id}>
            <button className="side-item" onClick={() => racks[0] && onRack(racks[0].id)}><Icon />{l.name}</button>
            {racks.map((r) => (
              <button key={r.id} className={`side-item loc-sub${r.id === rack?.id ? " active" : ""}`} aria-current={r.id === rack?.id} onClick={() => onRack(r.id)}>
                <Server />{r.name}<span className="side-count num">{game.devices.filter((d) => d.rackId === r.id).length}</span>
              </button>
            ))}
          </Fragment>
        );
      })}
      <div className="side-h">Rent a rack</div>
      <div className="loc-rent">
        <select className="field" aria-label="City" value={city} onChange={(e) => setCity(e.target.value)}>
          {CITIES.map((c) => <option key={c.name}>{c.name}</option>)}
        </select>
        <div className="loc-rent-price"><span className="num">{RENTED_RACK_UNITS}U</span><span className="num">{euro(RENTED_RACK_UNITS * RACK_U_PER_MONTH)} / month</span></div>
        <button className="btn" onClick={rent}>Rent a rack</button>
      </div>
    </aside>
  );
}

function RackColumn({ game, rack, selected, onDevice, onFree }: { game: GameState; rack: Rack; selected: string | null; onDevice: (id: string) => void; onFree: (lo: number, hi: number, el: Element) => void }) {
  const items = rackItems(game, rack.id);
  const used = items.reduce((n, it) => n + it.model.height, 0), watts = items.reduce((n, it) => n + it.model.watts, 0);
  return (
    <div className="loc-rack">
      <div className="loc-rack-h">
        <h2>{rack.name}</h2>
        <span className="pill"><span className="num">{used} / {rack.units}</span>{rack.shelf ? " slots" : " U"}</span>
        <span className="pill"><span className="num">{watts.toLocaleString("en-GB")}</span> W</span>
      </div>
      <RackFront units={rack.units} shelf={rack.shelf} items={items} w={300} u={22} selected={selected} onDevice={onDevice} onFree={onFree} />
    </div>
  );
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="loc-facts">
      {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}
    </dl>
  );
}

function SiteFacts({ game, rack }: { game: GameState; rack: Rack }) {
  const loc = game.locations.find((l) => l.id === rack.locationId);
  return (
    <>
      <div className="loc-insp-h"><h2>{loc?.name}</h2></div>
      <div className="loc-card">
        <Facts rows={[
          ["City", loc?.city ?? ""],
          ["Kind", loc?.kind === "basement" ? "Basement" : "Rented rack"],
          ["Space", `${rack.units}${rack.shelf ? " slots" : "U"}`],
          ["Rent", `${euro(rack.rentPerMonth)} / month`],
        ]} />
      </div>
    </>
  );
}

function Shop({ game, rack, lo, hi, top, left, onClose, onBought }: { game: GameState; rack: Rack; lo: number; hi: number; top: number; left: number; onClose: () => void; onBought: (id?: string) => void }) {
  const act = useStore((s) => s.act);
  const [brands, setBrands] = useState<Record<string, string>>({});
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointerdown", down); window.removeEventListener("keydown", key); };
  }, [onClose]);

  // The highest fitting slot keeps the rest of the free range in one piece below it.
  const rows = shopModels(yearOf(game.hour)).filter((m) => m.shelf === rack.shelf).flatMap((m) => {
    const slot = freeSlots(game, rack.id, m.height).filter((s) => s >= lo && s + m.height - 1 <= hi).at(-1);
    return slot === undefined ? [] : [{ m, slot }];
  });
  const where = rack.shelf ? `Slot ${lo}` : lo === hi ? `U${lo}` : `U${lo}–U${hi}`;

  return (
    <div className="loc-shop" ref={ref} style={{ top, left }} role="dialog" aria-label={`Buy for ${where}`}>
      <div className="loc-shop-h"><h3>{where}</h3><span className="grow" /><button className="btn ghost icon" aria-label="Close" onClick={onClose}><X /></button></div>
      <div className="loc-shop-list">
        {rows.map(({ m, slot }) => {
          const brand = brands[m.id] ?? SERVER_BRANDS[0];
          const buy = () => {
            const r = act((s) => buyDevice(s, m.id, rack.id, slot, m.kind === "server" ? brand : undefined));
            if (r.ok) onBought(r.id);
          };
          return (
            <div className="loc-shop-row" key={m.id}>
              <div className="loc-shop-main">
                <div className="loc-shop-name">{m.name}<span className="pill num">{height(m)}</span></div>
                <div className="loc-shop-specs num">{specs(m).join(" · ")}</div>
              </div>
              {m.kind === "server" && (
                <select className="field" aria-label={`Brand for ${m.name}`} value={brand} onChange={(e) => setBrands({ ...brands, [m.id]: e.target.value })}>
                  {SERVER_BRANDS.map((b) => <option key={b}>{b}</option>)}
                </select>
              )}
              <span className="loc-shop-price num">{euro(m.price)}</span>
              <button className="btn primary" onClick={buy}>Buy</button>
            </div>
          );
        })}
        {!rows.length && <div className="loc-shop-none">No models fit here</div>}
      </div>
    </div>
  );
}

function Inspector({ game, device, onSelect }: { game: GameState; device: Device; onSelect: (id: string | null) => void }) {
  const act = useStore((s) => s.act);
  const [sel, setSel] = useState<number[]>([]);
  const [mode, setMode] = useState<"cable" | "group">("cable");
  const [confirm, setConfirm] = useState(false);
  const model = modelById(device.model), st = linkStatus(game, device.id), peers = portPeers(game, device.id);
  const rack = game.racks.find((r) => r.id === device.rackId)!;
  const cables = game.cables.filter((c) => c.a.device === device.id || c.b.device === device.id);
  const s = model.server;
  const pick = (i: number) => setSel((cur) => (mode === "group" ? (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]) : cur.length === 1 && cur[0] === i ? [] : [i]));

  return (
    <>
      <div className="loc-insp-h">
        <h2>{device.name}</h2>
        {model.kind !== "patch" && <span className={`pill ${st.online ? "ok" : "bad"}`}>{st.online ? "Online" : "Offline"}</span>}
        <span className="grow" />
        {model.kind !== "gateway" && <button className="btn danger" onClick={() => setConfirm(true)}><Trash2 />Remove</button>}
      </div>
      <div className="loc-model">{model.kind === "server" ? `${device.brand} ` : ""}{model.name} · <span className="num">{rack.shelf ? `Slot ${device.slot}` : model.height > 1 ? `U${device.slot}–U${device.slot + model.height - 1}` : `U${device.slot}`}</span></div>

      <div className="loc-face">
        <DeviceSvg model={model} brand={device.brand} name={device.name} state={lampOf(st)} ports={portLamps(model, peers)} groups={device.groups} w={440} u={40} />
        <PortGrid model={model} peers={peers} groups={device.groups} sel={sel} onPick={pick} />
      </div>

      {model.kind === "switch" && (
        <div className="seg loc-mode" role="group" aria-label="Port selection">
          <button aria-pressed={mode === "cable"} onClick={() => { setMode("cable"); setSel(sel.slice(0, 1)); }}>Cable</button>
          <button aria-pressed={mode === "group"} onClick={() => setMode("group")}>Group</button>
        </div>
      )}

      {mode === "group" && model.kind === "switch" ? (
        <GroupCard device={device} sel={sel} onDone={() => setSel([])} />
      ) : sel.length === 1 ? (
        <PortCard game={game} device={device} model={model} port={sel[0]} peer={peers[sel[0]]} onSelect={onSelect} />
      ) : null}

      {model.kind === "server" && (
        <div className="loc-card">
          <div className="loc-card-h">
            <h3><Network />Link</h3>
            <span className={`pill ${st.online ? "ok" : "bad"}`}>{st.online ? "Online" : "Offline"}</span>
            {st.warning === "bondNotGrouped" && <span className="pill warn">Bond not grouped</span>}
            <span className="grow" />
            <span className="num">{st.gbit} Gbit/s</span>
          </div>
          {model.ports.length > 1 && <div className="loc-row">
            <span className="loc-k">Bond</span>
            <div className="seg" role="group" aria-label="Bond mode">
              <button aria-pressed={device.bond === "failover"} onClick={() => act((g) => setBond(g, device.id, "failover"))}>Failover</button>
              <button aria-pressed={device.bond === "balance"} onClick={() => act((g) => setBond(g, device.id, "balance"))}>Load balance</button>
            </div>
          </div>}
        </div>
      )}

      <div className="loc-card">
        <Facts rows={[
          ...(s ? [["CPU", `${s.sockets} × ${cores(s.cores / s.sockets)}`], ["RAM", `${ram(s.ramGb)} of ${ram(s.maxRamGb)}`], ["Disk", `${disk(s.diskGb)} ${s.disk}, ${s.bays} bays`]] as [string, string][] : []),
          ["Network", portsText(model)],
          ["Power", model.idleWatts === model.watts ? `${model.watts} W` : `${model.idleWatts}–${model.watts} W`],
          ["Power supplies", `${model.psus}`],
          ["Height", height(model)],
          ...(model.price ? [["Price", euro(model.price)]] as [string, string][] : []),
        ]} />
      </div>

      {confirm && (
        <Confirm
          title={`Remove ${device.name}?`}
          text={cables.length ? `${device.name} is removed without a refund, and its ${cables.length} ${cables.length === 1 ? "cable is" : "cables are"} unplugged.` : `${device.name} is removed without a refund.`}
          action="Remove"
          onCancel={() => setConfirm(false)}
          onConfirm={() => { setConfirm(false); if (act((g) => removeDevice(g, device.id)).ok) onSelect(null); }}
        />
      )}
    </>
  );
}

// Ports are laid out like the front: pairs top and bottom in blocks of six columns, patch jacks front over back.
function portBlocks(m: DeviceModel): { rows: number; ports: number[] }[] {
  const chunk = (ps: number[], n: number, rows: number) => Array.from({ length: Math.ceil(ps.length / n) }, (_, k) => ({ rows, ports: ps.slice(k * n, k * n + n) }));
  if (m.kind === "patch") return chunk(Array.from({ length: PATCH_JACKS }, (_, i) => [i, i + PATCH_JACKS]).flat(), 12, 2);
  return (["rj45", "sfp"] as const).flatMap((media) => {
    const ps = m.ports.flatMap((p, i) => (p.media === media ? [i] : []));
    return ps.length > 8 ? chunk(ps, 12, 2) : ps.length ? [{ rows: 1, ports: ps }] : [];
  });
}

function PortGrid({ model, peers, groups, sel, onPick }: { model: DeviceModel; peers: (End | null)[]; groups: number[][]; sel: number[]; onPick: (i: number) => void }) {
  const lamps = portLamps(model, peers);
  return (
    <div className={`loc-ports${model.kind === "server" ? " wide" : ""}`} role="group" aria-label="Ports">
      {portBlocks(model).map((b, k) => (
        <div key={k} className="loc-port-block" style={{ gridTemplateRows: `repeat(${b.rows}, auto)` }}>
          {b.ports.map((i) => {
            const g = groups.findIndex((x) => x.includes(i));
            return (
              <button key={i} className={`loc-port${g >= 0 ? " grouped" : ""}`} data-lamp={lamps[i]} aria-pressed={sel.includes(i)} aria-label={portName(model, i)} title={portName(model, i)} onClick={() => onPick(i)}>
                {model.kind === "server" ? `eth${i}` : model.kind === "patch" ? (i % PATCH_JACKS) + 1 : i + 1}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function PortCard({ game, device, model, port, peer, onSelect }: { game: GameState; device: Device; model: DeviceModel; port: number; peer: End | null; onSelect: (id: string) => void }) {
  const act = useStore((s) => s.act);
  const here = model.ports[port];
  const group = device.groups.findIndex((g) => g.includes(port));
  const title = <h3><EthernetPort />{portName(model, port)}</h3>;

  if (peer) {
    const cable = game.cables.find((c) => (c.a.device === device.id && c.a.port === port) || (c.b.device === device.id && c.b.port === port))!;
    const other = game.devices.find((d) => d.id === peer.device)!, om = modelById(other.model);
    return (
      <div className="loc-card">
        <div className="loc-card-h">
          {title}<span className="pill ok">Up</span>{group >= 0 && <span className="pill">Group {group + 1}</span>}
          <span className="grow" />
          <button className="btn danger" onClick={() => act((g) => disconnect(g, cable.id))}><Unplug />Disconnect</button>
        </div>
        <div className="loc-path">
          <div className="loc-node here"><span className="k">{device.name}</span><strong>{portName(model, port)}</strong></div>
          <div className={`loc-wire ${cable.kind}`}><span><span className="num">{Math.min(here.gbit, om.ports[peer.port].gbit)} Gbit/s</span> {CABLE_NAME[cable.kind]}</span></div>
          <button className="loc-node" onClick={() => onSelect(other.id)}><span className="k">{other.name}</span><strong>{portName(om, peer.port)}</strong></button>
        </div>
      </div>
    );
  }

  return (
    <div className="loc-card">
      <div className="loc-card-h">{title}<span className="pill">Free</span>{group >= 0 && <span className="pill">Group {group + 1}</span>}</div>
      <ConnectRow key={port} game={game} device={device} model={model} port={port} />
    </div>
  );
}

function ConnectRow({ game, device, model, port }: { game: GameState; device: Device; model: DeviceModel; port: number }) {
  const act = useStore((s) => s.act);
  const here = model.ports[port];
  const loc = game.racks.find((r) => r.id === device.rackId)!.locationId;
  const racks = new Set(game.racks.filter((r) => r.locationId === loc).map((r) => r.id));
  // A patch panel is passive, so only the devices on either side of it have to match in speed.
  const targets = game.devices.filter((d) => d.id !== device.id && racks.has(d.rackId)).flatMap((d) => {
    const m = modelById(d.model), peers = portPeers(game, d.id);
    const free = m.ports.flatMap((p, i) => (!peers[i] && p.media === here.media && (p.gbit === here.gbit || m.kind === "patch" || model.kind === "patch") ? [i] : []));
    return free.length ? [{ d, m, free }] : [];
  });
  const [picked, setTarget] = useState("");
  if (!targets.length) return <div className="loc-row loc-muted">No compatible ports</div>;
  const target = targets.some(({ d, free }) => free.some((i) => `${d.id}:${i}` === picked)) ? picked : `${targets[0].d.id}:${targets[0].free[0]}`;
  const go = () => {
    const [d, p] = target.split(":");
    act((g) => connect(g, { device: device.id, port }, { device: d, port: Number(p) }));
  };
  return (
    <div className="loc-row">
      <select className="field grow" aria-label="Connect to" value={target} onChange={(e) => setTarget(e.target.value)}>
        {targets.map(({ d, m, free }) => (
          <optgroup key={d.id} label={d.name}>
            {free.map((i) => <option key={i} value={`${d.id}:${i}`}>{d.name} {portName(m, i)}</option>)}
          </optgroup>
        ))}
      </select>
      <button className="btn primary" onClick={go}><Cable />Connect</button>
    </div>
  );
}

function GroupCard({ device, sel, onDone }: { device: Device; sel: number[]; onDone: () => void }) {
  const act = useStore((s) => s.act);
  const sorted = [...sel].sort((a, b) => a - b);
  const inGroup = sorted.find((p) => device.groups.some((g) => g.includes(p)));
  const run = (ports: number[]) => { if (act((g) => setPortGroup(g, device.id, ports)).ok) onDone(); };
  return (
    <div className="loc-card">
      <div className="loc-card-h">
        <h3>{sorted.length ? <>Ports <span className="num">{sorted.map((p) => p + 1).join(", ")}</span></> : "Port groups"}</h3>
        <span className="grow" />
        {inGroup !== undefined && <button className="btn" onClick={() => run([inGroup])}>Ungroup</button>}
        <button className="btn primary" disabled={sorted.length < 2 || sorted.length > 8} onClick={() => run(sorted)}>Group</button>
      </div>
      {device.groups.map((g, k) => (
        <div className="loc-row" key={k}>
          <span className="loc-k">Group {k + 1}</span>
          <span className="loc-chips">{g.map((p) => <span key={p} className="loc-chip num">{p + 1}</span>)}</span>
        </div>
      ))}
    </div>
  );
}
