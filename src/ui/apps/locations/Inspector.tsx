import { ArchiveRestore, Cable, CircleDollarSign, EthernetPort, FileSignature, Network, Unplug } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { euro } from "../../../sim/00-core/money";
import { jacksOf, modelById, type DeviceModel } from "../../../sim/10-catalog/hardware";
import type { Device, End, GameState } from "../../../sim/50-state";
import { linkStatus, locationOf, portPeers, powered, resaleValue } from "../../../sim/60-infra/status";
import { buyOutLease, connect, disconnect, sellDevice, setBond, setPortGroup, unmountDevice } from "../../../sim/90-actions/hardware";
import type { Side } from "../../art/backs";
import { DeviceSvg } from "../../art/fronts";
import { BrandLogo, Logo } from "../../art/logos";

import { Confirm } from "../../desktop/Confirm";
import { useStore } from "../../store";
import { CABLE_NAME, cores, disk, height, lampOf, portLamps, portName, portsText, ram, speed } from "../hw";
import { dcOf, Facts } from "./ui";

// Sells a device or a rack after showing its resale value against the price paid.
export function SellConfirm({ game, name, price, boughtAt, cables = 0, onCancel, onSell }: { game: GameState; name: string; price: number; boughtAt: number; cables?: number; onCancel: () => void; onSell: () => void }) {
  const value = resaleValue(game, price, boughtAt);
  const plug = cables ? ` ${cables === 1 ? "Its cable is" : `Its ${cables} cables are`} unplugged.` : "";
  return <Confirm title={`Sell ${name}?`} text={`Resale value ${euro(value)}, paid ${euro(price)}.${plug}`} action={`Sell for ${euro(value)}`} onCancel={onCancel} onConfirm={onSell} />;
}

// onHot reports the cable of the hovered or selected port, so the rack view can highlight it.
export function Inspector({ game, device, side = "front", onSelect, onHot }: { game: GameState; device: Device; side?: Side; onSelect: (id: string | null) => void; onHot?: (cableId: string | null) => void }) {
  const act = useStore((s) => s.act);
  const [sel, setSel] = useState<number[]>([]);
  const [mode, setMode] = useState<"cable" | "group">("cable");
  const [selling, setSelling] = useState(false);
  const model = modelById(device.model), st = linkStatus(game, device.id), peers = portPeers(game, device.id);
  const cables = game.cables.filter((c) => c.a.device === device.id || c.b.device === device.id);
  const s = model.server;
  const pick = (i: number) => setSel((cur) => (mode === "group" ? (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]) : cur.length === 1 && cur[0] === i ? [] : [i]));
  const [hover, setHover] = useState<number | null>(null);
  const focus = hover ?? (sel.length === 1 ? sel[0] : null);
  const hot = focus === null ? null : game.cables.find((c) => [c.a, c.b].some((e) => e.device === device.id && e.port === focus))?.id ?? null;
  useEffect(() => { onHot?.(hot); }, [hot, onHot]);
  useEffect(() => () => onHot?.(null), [onHot]);
  const where = device.panel ? "Carrier panel" : model.height > 1 ? `U${device.slot}–U${device.slot + model.height - 1}` : `U${device.slot}`;

  return (
    <>
      <div className="loc-insp-h">
        {model.kind !== "gateway" && <BrandLogo brand={device.brand} size={20} />}
        <h2>{device.name}</h2>
        {model.kind !== "patch" && <span className={`pill ${st.online ? "ok" : "bad"}`}>{st.online ? "Online" : "Offline"}</span>}
        <span className="grow" />
        {device.rackId && <button className="btn" onClick={() => { if (act((g) => unmountDevice(g, device.id)).ok) onSelect(null); }}><ArchiveRestore />Unmount</button>}
        {model.kind !== "gateway" && <button className="btn" disabled={!!device.lease} onClick={() => setSelling(true)}><CircleDollarSign />Sell</button>}
      </div>
      <div className="loc-model">{model.kind === "gateway" ? "" : `${device.brand} `}{model.name} · <span className="num">{where}</span></div>

      <div className="loc-face">
        <DeviceSvg model={model} brand={device.brand} name={device.name} state={lampOf(st)} ports={portLamps(model, peers)} groups={device.groups} w={440} u={40} back={side === "back"} />
        {model.kind !== "server" && <PortGrid model={model} peers={peers} groups={device.groups} sel={sel} onPick={pick} onHover={setHover} />}
      </div>

      {model.kind === "server" && <PortTable game={game} device={device} peers={peers} sel={sel} onPick={pick} onHover={setHover} onSelect={onSelect} />}

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

      {device.lease && <LeaseCard game={game} leaseId={device.lease} />}

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
          ...(model.kind === "server" ? [] : [["Power supplies", `${model.psus}`]] as [string, string][]),
          ...(model.height ? [["Height", height(model)]] as [string, string][] : []),
          ...(device.price ? [["Paid", euro(device.price)]] as [string, string][] : []),
        ].map(([k, v]): [string, ReactNode] => [k, <span className="num">{v}</span>])} />
      </div>

      {selling && (
        <SellConfirm game={game} name={device.name} price={device.price} boughtAt={device.boughtAt} cables={cables.length}
          onCancel={() => setSelling(false)}
          onSell={() => { setSelling(false); if (act((g) => sellDevice(g, device.id)).ok) onSelect(null); }} />
      )}
    </>
  );
}

function LeaseCard({ game, leaseId }: { game: GameState; leaseId: string }) {
  const act = useStore((s) => s.act);
  const lease = game.leases.find((l) => l.id === leaseId);
  if (!lease) return null;
  const left = lease.months - lease.paid;
  return (
    <div className="loc-card">
      <div className="loc-card-h">
        <h3><FileSignature />Lease</h3>
        <span className="pill">Leased</span>
        <span className="grow" />
        <button className="btn" onClick={() => act((g) => buyOutLease(g, lease.id))}>Buy out for <span className="num">{euro(lease.monthly * left)}</span></button>
      </div>
      <Facts rows={[
        ["Lessor", <Logo provider={lease.lessor} size={16} word />],
        ["Monthly", <span className="num">{euro(lease.monthly)}</span>],
        ["Payments left", <span className="num">{left} of {lease.months}</span>],
        ["Devices", <span className="num">{lease.devices.length}</span>],
      ]} />
    </div>
  );
}

// Ports are laid out like the front: pairs top and bottom in blocks of six columns, patch jacks front over back.
function portBlocks(m: DeviceModel): { rows: number; ports: number[] }[] {
  const chunk = (ps: number[], n: number, rows: number) => Array.from({ length: Math.ceil(ps.length / n) }, (_, k) => ({ rows, ports: ps.slice(k * n, k * n + n) }));
  if (m.kind === "patch") { const n = jacksOf(m); return chunk(Array.from({ length: n }, (_, i) => [i, i + n]).flat(), 12, 2); }
  return (["rj45", "sfp"] as const).flatMap((media) => {
    const ps = m.ports.flatMap((p, i) => (p.media === media ? [i] : []));
    return ps.length > 8 ? chunk(ps, 12, 2) : ps.length ? [{ rows: 1, ports: ps }] : [];
  });
}

// A server's NICs and power supplies, one row each, with the device at the other end of every cable.
function PortTable({ game, device, peers, sel, onPick, onHover, onSelect }: { game: GameState; device: Device; peers: (End | null)[]; sel: number[]; onPick: (i: number) => void; onHover: (i: number | null) => void; onSelect: (id: string) => void }) {
  const model = modelById(device.model), on = powered(game, device.id), loc = locationOf(game, device);
  const ab = !!loc && dcOf(loc)?.feeds === "ab";
  return (
    <div className="loc-card">
      <table className="table loc-port-table">
        <thead><tr><th>Port</th><th>Media</th><th className="r">Speed</th><th>Link</th><th>Bond</th><th>Peer</th></tr></thead>
        <tbody>
          {model.ports.map((p, i) => {
            const peer = peers[i], other = peer && game.devices.find((d) => d.id === peer.device)!;
            const link = !other ? "Unplugged" : on && powered(game, other.id) ? "Up" : "Down";
            return (
              <tr key={i} aria-selected={sel.includes(i)} onClick={() => onPick(i)} onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(null)}>
                <td className="num">{portName(model, i)}</td>
                <td>{p.media === "sfp" ? "SFP" : "RJ45"}</td>
                <td className="r num">{speed(p.gbit)}</td>
                <td><span className={`pill${link === "Up" ? " ok" : link === "Down" ? " bad" : ""}`}>{link}</span></td>
                <td className="num">{model.ports.length > 1 ? "bond0" : ""}</td>
                <td>
                  {!other ? null : other.panel ? "Carrier panel" : other.rackId === device.rackId ? (
                    <button className="loc-link num" onClick={(e) => { e.stopPropagation(); onSelect(other.id); }}>{other.name} {portName(modelById(other.model), peer!.port)}</button>
                  ) : <span className="num">{other.name} {portName(modelById(other.model), peer!.port)}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="loc-row">
        <span className="loc-k">Power supplies</span>
        {Array.from({ length: model.psus }, (_, i) => (
          <span key={i} className={`pill${on ? " ok" : " bad"}`}>PSU {i + 1} · Feed {ab && i === 1 ? "B" : "A"}</span>
        ))}
      </div>
    </div>
  );
}

function PortGrid({ model, peers, groups, sel, onPick, onHover }: { model: DeviceModel; peers: (End | null)[]; groups: number[][]; sel: number[]; onPick: (i: number) => void; onHover: (i: number | null) => void }) {
  const lamps = portLamps(model, peers);
  return (
    <div className="loc-ports" role="group" aria-label="Ports">
      {portBlocks(model).map((b, k) => (
        <div key={k} className="loc-port-block" style={{ gridTemplateRows: `repeat(${b.rows}, auto)` }}>
          {b.ports.map((i) => {
            const g = groups.findIndex((x) => x.includes(i));
            return (
              <button key={i} className={`loc-port${g >= 0 ? " grouped" : ""}`} data-lamp={lamps[i]} aria-pressed={sel.includes(i)} aria-label={portName(model, i)} title={portName(model, i)} onClick={() => onPick(i)} onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(null)}>
                {model.kind === "server" ? `eth${i}` : model.kind === "patch" ? (i % jacksOf(model)) + 1 : i + 1}
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
          <button className="loc-node" onClick={() => onSelect(other.id)}><span className="k">{other.panel ? "Carrier panel" : other.name}</span><strong>{other.panel ? `${other.name} ${portName(om, peer.port)}` : portName(om, peer.port)}</strong></button>
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
  const loc = locationOf(game, device)?.id;
  // A patch panel is passive, so only the devices on either side of it have to match in speed.
  const targets = game.devices.filter((d) => d.id !== device.id && locationOf(game, d)?.id === loc).flatMap((d) => {
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
          <optgroup key={d.id} label={d.panel ? `Carrier panel, ${d.name}` : d.name}>
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
