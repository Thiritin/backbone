import { supportEnd } from "../../../sim/10-catalog/lifecycle";
import { Cable, Flame, Gauge, EthernetPort, Monitor, MonitorOff, FileSignature, PackageOpen, Plug, PlugZap, Plus, Power, RotateCw, SquareTerminal, Unplug, Usb, Wrench } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { euro } from "../../../sim/00-core/money";
import { VENDOR_NAME } from "../../../sim/10-catalog/cpus";
import { bayCount, boardSpec, jacksOf, modelById, modelName, wattsFactorOf, type DeviceModel } from "../../../sim/10-catalog/hardware";
import type { Cable as CableT, Device, End, GameState } from "../../../sim/50-state";
import { clusterOf, workloadsOn } from "../../../sim/60-infra/cluster";
import { deviceHealth, deviceVendor, deviceWatts, deviceValue, isPlugged, linkStatus, locationOf, pluggedIn, portPeers, resaleValue, working } from "../../../sim/60-infra/status";
import { pduOf } from "../../../sim/60-infra/pdu";
import { addSecondPsu, atServer, buyOutLease, connect, disconnect, LABEL_MAX, moveServer, resetBmc, sellDevice, setBond, setCableColor, setLabel, setPlugged, setPortGroup, setPower, unmountDevice, type ActionResult } from "../../../sim/90-actions/hardware";
import type { Side } from "../../art/backs";
import { cableColor, DeviceSvg, SWATCHES } from "../../art/fronts";
import { BrandLogo, Logo } from "../../art/logos";
import { Confirm } from "../../desktop/Confirm";
import { menuOn, type MenuEntry } from "../../desktop/ContextMenu";
import { useStore } from "../../store";
import { CABLE_NAME, cores, deviceLamps, devName, disk, height, portLamps, portName, portsText, ram, speed } from "../hw";
import { More } from "../More";
import { HOST_NAME, softwareName } from "../products/parts";
import { dcOf, Facts, UsageBars } from "./ui";
import { usageOf } from "../../../sim/60-infra/usage";
import { NodeCard } from "./Clusters";
import { softwareOn } from "../../../sim/90-actions/software";
import { deviceMenu, secondPsuPrice, type DeviceUi } from "./deviceMenu";
import { PowerCard } from "./PowerCard";
import { RemoteCard } from "./RemoteCard";
import { consoleVia, remoteFix } from "../../../sim/60-infra/oob";
import { Screen } from "../console/Screen";
import { consoleName } from "../console/ConsoleWindow";
import { continueBoot } from "../../../sim/90-actions/remote";
import { ActionTile } from "../software/Software";
import { stamp } from "../support/labels";
import { startBurnin } from "../../../sim/90-actions/burnin";
import { plugStick, unplugStick } from "../../../sim/90-actions/media";
import { burning } from "../../../sim/60-infra/status";
import { serverTaken } from "../../../sim/60-infra/cluster";
import { frontOptions, handsAway, isServerInRack, POWER_ACTION, POWER_LABEL, powerOptions, type PowerOp } from "./power";
import { atDatacenter, useHandWork } from "./HandSheet";
import type { FrontOp } from "../../../sim/60-infra/power";
import { LidSheet } from "./LidSheet";
import { PlanButton, useMaintenance, Windows, windowsOnDevice } from "./Maintenance";
import { PartsCard } from "./Slots";
import { AddressRows } from "../network/Addresses";
import { fqdn } from "../../../sim/30-customers/domains";

// Sells a device or a rack after showing its resale value against the price paid.
export function SellConfirm({ game, name, price, boughtAt, value = resaleValue(game, price, boughtAt), cables = 0, onCancel, onSell }: { game: GameState; name: string; price: number; boughtAt: number; value?: number; cables?: number; onCancel: () => void; onSell: () => void }) {
  const plug = cables ? ` ${cables === 1 ? "Its cable is" : `Its ${cables} cables are`} unplugged.` : "";
  return <Confirm title={`Sell ${name}?`} text={`Resale value ${euro(value)}, paid ${euro(price)}.${plug}`} action={`Sell for ${euro(value)}`} onCancel={onCancel} onConfirm={onSell} />;
}

// The device menu's state: the offline check, the sell sheet, and what the view does on select and rename.
export function useDeviceMenu(game: GameState, onSelect: (id: string | null) => void, onRename: (id: string) => void) {
  const act = useStore((s) => s.act);
  const { guarded, dialog } = useOfflineGuard(game);
  const [selling, setSelling] = useState<Device | null>(null);
  const [lid, setLid] = useState<string | null>(null);
  const mnt = useMaintenance();
  const hand = useHandWork();
  const ui = (d: Device, open: boolean): DeviceUi => ({
    open: open ? () => onSelect(d.id) : undefined,
    lid: () => setLid(d.id),
    power: (on) => { if (on && lid) return; if (on) act(setPower, d.id, true); else guarded(`Power off ${devName(d)}?`, "Power off", setPower, d.id, false); },
    op: (op: PowerOp) => { if (op === "on") { if (!lid) act(POWER_ACTION.on, d.id); } else { const label = powerOptions(game, d).options.find((o) => o.op === op)?.label ?? POWER_LABEL[op];
      if (op === "bmc" && atDatacenter(game, d.id)) hand.start(game, { title: `${label} ${devName(d)}`, deviceId: d.id, action: resetBmc, args: [d.id] });
      else if (op === "continue" && !remoteFix(game, d)) hand.start(game, { title: `${label} ${devName(d)}`, deviceId: d.id, action: continueBoot, args: [d.id], tech: { kind: "boot" } });
      else guarded(`${label} ${devName(d)}?`, label, POWER_ACTION[op], d.id); } },
    front: (op) => {
      if (op === "power" && !d.on && lid) return;
      const label = frontOptions(game, d).find((o) => o.op === op)?.label ?? "";
      if (handsAway(game, d)) hand.start(game, { title: `${label} ${devName(d)}`, deviceId: d.id, action: atServer, args: [d.id, op] });
      else guarded(`${label} on ${devName(d)}?`, label, atServer, d.id, op, "self");
    },
    plug: (psu) => togglePlug(guarded, d, psu),
    maintain: () => mnt.plan({ kind: "device", id: d.id }),
    move: (to) => hand.start(game, { title: `Move ${devName(d)} to ${game.locations.find((l) => l.id === to)?.name}`, deviceId: d.id, at: to, action: moveServer, args: [d.id, to] }),
    rename: () => onRename(d.id),
    unmount: () => { if (act(unmountDevice, d.id).ok) onSelect(null); },
    sell: () => setSelling(d),
  });
  const cables = selling ? game.cables.filter((c) => c.a.device === selling.id || c.b.device === selling.id).length : 0;
  return {
    plan: mnt.plan,
    entries: (d: Device, open = false) => deviceMenu(game, d, ui(d, open)),
    power: (d: Device, on: boolean) => ui(d, false).power(on),
    op: (d: Device, op: PowerOp) => ui(d, false).op(op),
    front: (d: Device, op: FrontOp) => ui(d, false).front(op),
    plug: (d: Device, psu: string) => togglePlug(guarded, d, psu),
    lid: (d: Device) => ui(d, false).lid?.(),
    dialog: (
      <>
        {dialog}
        {mnt.dialog}
        {hand.dialog}
        {lid && <LidSheet deviceId={lid} onClose={() => setLid(null)} />}
        {selling && (
          <SellConfirm game={game} name={devName(selling)} price={selling.price} boughtAt={selling.boughtAt} value={deviceValue(game, selling)} cables={cables}
            onCancel={() => setSelling(null)}
            onSell={() => { const id = selling.id; setSelling(null); if (act(sellDevice, id).ok) onSelect(null); }} />
        )}
      </>
    ),
  };
}

const POWER = {
  ok: ["On", "ok"], booting: ["Booting", "warn"], halting: ["Shutting down", "warn"], setup: ["In BIOS setup", "warn"], degraded: ["Degraded", "warn"], hot: ["Running hot", "warn"], rebuilding: ["Rebuilding", "warn"],
  maintenance: ["Maintenance", "warn"], down: ["Down", "bad"], hung: ["Hung", "bad"], stuck: ["Stuck at boot", "bad"], locked: ["Locked out", "bad"], nopower: ["No power", "bad"], off: ["Off", ""],
} as const;

// onHot reports the cable of the hovered or selected port, so the rack view can highlight it. rename opens the name field.
type InspTab = "actions" | "ports" | "lease" | "psu" | "parts";

export function Inspector({ game, device, side = "front", onSelect, onHot, rename = false, onRenaming, monitor = false, onUnplug, onConsole }: { game: GameState; device: Device; side?: Side; onSelect: (id: string | null) => void; onHot?: (cableId: string | null) => void; rename?: boolean; onRenaming?: () => void; monitor?: boolean; onUnplug?: () => void; onConsole?: () => void }) {
  const act = useStore((s) => s.act);
  const [sel, setSel] = useState<number[]>([]);
  const [mode, setMode] = useState<"cable" | "group">("cable");
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (rename) { setEditing(true); onRenaming?.(); } }, [rename, onRenaming]);
  const menus = useDeviceMenu(game, onSelect, () => setEditing(true));
  const menu = () => menus.entries(device);
  const model = modelById(device.model), peers = portPeers(game, device.id), name = devName(device);
  const pick = (i: number) => setSel((cur) => (mode === "group" ? (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]) : cur.length === 1 && cur[0] === i ? [] : [i]));
  const [hover, setHover] = useState<number | null>(null);
  const focus = hover ?? (sel.length === 1 ? sel[0] : null);
  const hot = focus === null ? null : game.cables.find((c) => [c.a, c.b].some((e) => e.device === device.id && e.port === focus))?.id ?? null;
  useEffect(() => { onHot?.(hot); }, [hot, onHot]);
  useEffect(() => () => onHot?.(null), [onHot]);
  const where = device.panel ? "Carrier panel" : model.height > 1 ? `U${device.slot}–U${device.slot + model.height - 1}` : `U${device.slot}`;
  const powered = model.kind !== "patch", server = model.kind === "server";
  const psus = device.components.filter((c) => c.kind === "psu");
  const togglePower = () => (isServerInRack(device) ? menus.op(device, device.on ? "shutdown" : "on") : menus.power(device, !device.on));
  const [picked, setTab] = useState<InspTab>("actions");
  const openApp = useStore((s) => s.openApp), openConsole = useStore((s) => s.openConsole);
  const via = server && device.rackId ? consoleVia(game, device.id) : null;
  const hand = useHandWork(), stickIn = game.media.stick.in === device.id;
  const canBurn = device.on && !device.burnin && !device.maintenance && !device.rebuild && !serverTaken(game, device.id);
  const serverActs = (
    <>
      <ActionTile icon={PackageOpen} label="Change parts" onClick={() => menus.lid(device)} />
      {device.rackId && <ActionTile icon={Gauge} label="Quick burn-in" disabled={!canBurn} onClick={() => act(startBurnin, device.id, false)} />}
      {device.rackId && <ActionTile icon={Flame} label="Full burn-in" disabled={!canBurn} onClick={() => act(startBurnin, device.id, true)} />}
      {via && <ActionTile icon={Monitor} label={consoleName(game, device)} onClick={() => openConsole(device.id)} />}
      {device.rackId && (stickIn
        ? <ActionTile icon={Usb} label="Unplug USB stick" disabled={handsAway(game, device)} onClick={() => act(unplugStick)} />
        : <ActionTile icon={Usb} label="Plug in USB stick" disabled={!!device.hands} onClick={() => hand.start(game, { title: `Plug in USB stick ${name}`, deviceId: device.id, action: plugStick, args: [device.id] })} />)}
      {device.rackId && <ActionTile icon={SquareTerminal} label="Terminal" disabled={!device.on || !device.hostname} onClick={() => openApp("Terminal", { kind: "ssh", id: device.hostname! })} />}
    </>
  );
  const tabs = server ? ([
    ["actions", "Actions"], ["ports", "Ports"], !!device.lease && ["lease", "Lease"],
    ["psu", "Power supplies"], ["parts", "Components"],
  ].filter(Boolean) as [InspTab, string][]) : [];
  const tab = tabs.some(([id]) => id === picked) ? picked : "actions";
  // Devices other than servers keep every section on one page.
  const show = (t: InspTab) => !server || tab === t;

  return (
    <div className="insp">
      <div className="loc-insp-h" onContextMenu={menuOn(menu)}>
        {model.kind !== "gateway" && <BrandLogo brand={device.brand} size={20} />}
        <LabelEdit device={device} editing={editing} onEditing={setEditing} />
        <span className="grow" />
        {monitor && <button className="btn ghost icon" aria-label="Unplug monitor" title="Unplug monitor" onClick={onUnplug}><MonitorOff /></button>}
        {model.kind === "server" && !!device.rackId && <PlanButton target={{ kind: "device", id: device.id }} plan={(t) => menus.plan(t)} />}
        {powered && !isServerInRack(device) && device.on && !!pduOf(game, device) && (
          <button className="btn ghost icon" aria-label="Power cycle" title="Power cycle" onClick={() => menus.op(device, "cycle")}><RotateCw /></button>
        )}
        {powered && !isServerInRack(device) && (
          <button className={`btn ghost icon insp-power${device.on ? " on" : ""}`} aria-label={device.on ? "Shut down" : "Power on"} title={device.on ? "Shut down" : "Power on"}
            disabled={!device.rackId && !device.panel} onClick={togglePower}>
            <Power />
          </button>
        )}
        <More label={name} entries={menu} />
      </div>
      <div className="loc-model">
        {device.hostname && <div className="num">{fqdn(game, device.hostname)}</div>}
        {model.kind === "gateway" ? "" : `${device.brand} `}{modelName(model, device.brand)} · <span className="num">{where}</span>
      </div>

      {monitor && <>
        <Screen game={game} device={device} via="monitor" />
        {isServerInRack(device) && <PowerCard game={game} device={device} onOp={(op) => menus.op(device, op)} onFront={(op) => menus.front(device, op)} />}
        {menus.dialog}
      </>}
      {!monitor && <>
      <div className={`loc-face${model.kind === "server" ? " wide" : ""}`} onContextMenu={menuOn(menu)}>
        <DeviceSvg model={model} brand={device.brand} name={name} {...deviceLamps(game, device.id, model)} groups={device.groups} w={440} u={40} back={side === "back"}
          onPower={server && (device.rackId || device.panel) ? togglePower : undefined}
          plugs={psus.map(isPlugged)} stick={stickIn} onInlet={device.rackId || device.panel ? (k) => menus.plug(device, psus[k].id) : undefined} onConsole={device.rackId ? onConsole : undefined} />
        {model.kind !== "server" && <PortGrid model={model} peers={peers} groups={device.groups} sel={sel} onPick={pick} onHover={setHover} />}
      </div>

      {tabs.length > 0 && (
        <div className="tabs" role="tablist" aria-label="Server">
          {tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}
        </div>
      )}

      {show("actions") && <>
      {powered && <Status game={game} device={device} />}
      {(server || model.kind === "switch" || model.kind === "firewall") && (
        <UsageBars usage={usageOf(game, [device])} only={server ? undefined : ["net"]} wide />
      )}

      {isServerInRack(device)
        ? <PowerCard game={game} device={device} onOp={(op) => menus.op(device, op)} onFront={(op) => menus.front(device, op)}>{serverActs}</PowerCard>
        : server && device.store && <div className="loc-card"><div className="act-tiles">{serverActs}</div></div>}
      <RemoteCard game={game} device={device} />

      {model.kind === "switch" && (
        <div className="seg loc-mode" role="group" aria-label="Port selection">
          <button aria-pressed={mode === "cable"} onClick={() => { setMode("cable"); setSel(sel.slice(0, 1)); }}>Cable</button>
          <button aria-pressed={mode === "group"} onClick={() => setMode("group")}>Group</button>
        </div>
      )}

      {mode === "group" && model.kind === "switch" ? (
        <GroupCard device={device} sel={sel} onDone={() => setSel([])} />
      ) : sel.length === 1 && !server ? (
        <PortCard game={game} device={device} model={model} port={sel[0]} peer={peers[sel[0]]} onSelect={onSelect} />
      ) : null}
      {server && <NodeCard game={game} device={device} />}
      </>}

      {show("ports") && server && <>
        <PortTable game={game} device={device} peers={peers} sel={sel} onPick={pick} onHover={setHover} onSelect={onSelect} />
        {model.ports.length > 1 && (
          <div className="loc-row insp-bond">
            <span className="loc-k">Bond</span>
            <div className="seg" role="group" aria-label="Bond mode">
              <button aria-pressed={device.bond === "none"} onClick={() => act(setBond, device.id, "none")}>None</button>
              <button aria-pressed={device.bond === "failover"} onClick={() => act(setBond, device.id, "failover")}>Failover</button>
              <button aria-pressed={device.bond === "balance"} onClick={() => act(setBond, device.id, "balance")}>Load balance</button>
            </div>
          </div>
        )}
        {sel.length === 1 && <PortCard game={game} device={device} model={model} port={sel[0]} peer={peers[sel[0]]} onSelect={onSelect} />}
      </>}

      {windowsOnDevice(game, device).length > 0 && (
        <div className="loc-card">
          <div className="loc-card-h"><h3><Wrench />Maintenance</h3></div>
          <Windows game={game} windows={windowsOnDevice(game, device)} plan={menus.plan} />
        </div>
      )}
      {show("lease") && device.lease && <LeaseCard game={game} leaseId={device.lease} />}
      {show("psu") && powered && <PowerSupplies game={game} device={device} onPlug={(psu) => menus.plug(device, psu)} />}
      {show("parts") && device.components.length > 0 && <PartsCard game={game} device={device} />}

      {show("parts") && <div className="loc-card">
        <div className="loc-card-h"><h3>Specifications</h3></div>
        <Facts rows={[
          ...(model.server ? [["CPU", `${model.server.sockets} × ${VENDOR_NAME[deviceVendor(device)]}, ${cores(device.components.find((c) => c.kind === "cpu")?.size ?? model.server.cores / model.server.sockets)}`], ["Mainboard", boardSpec(model, deviceVendor(device))?.name ?? ""], ["RAM", `${ram(model.server.ramGb)} of ${ram(model.server.maxRamGb)}`], ["Disk", `${disk(model.server.diskGb)} ${model.server.disk}, ${bayCount(model.server)} bays`]] as [string, string][] : []),
          ["Network", portsText(model)],
          ["Power", model.idleWatts === Math.round(deviceWatts(device)) ? `${model.watts} W` : `${Math.round(model.idleWatts * wattsFactorOf(model, device.brand))}–${Math.round(deviceWatts(device))} W`],
          ...(model.height ? [["Height", height(model)]] as [string, string][] : []),
          ...(device.price ? [["Paid", euro(device.price)]] as [string, string][] : []),
          ...(supportEnd(model) !== null ? [["End of support", `${supportEnd(model)}`]] as [string, string][] : []),
        ].map(([k, v]): [string, ReactNode] => [k, <span className="num">{v}</span>])} />
      </div>}
      {menus.dialog}
      {hand.dialog}
      </>}
    </div>
  );
}

// Power, link, control plane and role as plain values under the device.
function Status({ game, device }: { game: GameState; device: Device }) {
  const model = modelById(device.model), st = linkStatus(game, device.id);
  const [power, tone] = !device.rackId && !device.panel ? ["Not mounted", ""] : device.on && device.rackId && !pluggedIn(device) ? ["Unplugged", "bad"] : POWER[deviceHealth(game, device.id).state];
  const cluster = model.kind === "server" ? clusterOf(game, device.id) : undefined;
  const loads = model.kind === "server" && !cluster ? workloadsOn(game, device.id) : [];
  const service = loads.length ? game.services.find((v) => v.id === loads[0].serviceId) : undefined;
  const customer = service && game.customers.find((c) => c.id === service.customerId);
  const role = cluster ? `${cluster.kind === "cloud" ? "Hypervisor node" : HOST_NAME[cluster.kind]} in ${cluster.name}`
    : service ? `${service.product === "colocation" ? "Colocation" : "Dedicated"} for ${customer?.name ?? "a customer"}`
    : burning(game, device) ? `Burn-in until ${stamp(device.burnin!.until)}` : "Free";
  const plane = softwareOn(game, device.id).map((x) => softwareName(x.id)).join(", ") || "None";
  return (
    <dl className="insp-status">
      <div><dt>Power</dt><dd><span className={`insp-dot ${tone}`} />{power}</dd></div>
      {model.kind === "pdu" && <div><dt>Outlets</dt><dd className="num">{model.outlets}</dd></div>}
      {model.kind !== "ups" && model.kind !== "pdu" && (
        <div>
          <dt>Link</dt>
          <dd>
            <span className={`insp-dot ${st.online ? "ok" : "bad"}`} />{st.online ? <>Online <span className="num insp-sub">{st.gbit} Gbit/s</span></> : "Offline"}
            {st.warning === "bondNotGrouped" && <span className="pill warn">Bond not grouped</span>}
          </dd>
        </div>
      )}
      {model.kind === "server" && (
        <div>
          <dt>Control plane</dt>
          <dd>{plane}</dd>
        </div>
      )}
      {model.kind === "server" && <div><dt>Role</dt><dd>{role}</dd></div>}
      {model.kind === "server" && device.rackId && <AddressRows game={game} id={device.id} />}
    </dl>
  );
}

function LeaseCard({ game, leaseId }: { game: GameState; leaseId: string }) {
  const act = useStore((s) => s.act);
  const lease = game.leases.find((l) => l.id === leaseId);
  if (!lease) return null;
  const left = lease.months - lease.paid;
  return (
    <div className="loc-card" onContextMenu={menuOn(() => [{ label: `Buy out lease, ${euro(lease.monthly * left)}`, run: () => act(buyOutLease, lease.id) }])}>
      <div className="loc-card-h">
        <h3><FileSignature />Lease</h3>
        <span className="pill">Leased</span>
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
  const act = useStore((s) => s.act);
  const model = modelById(device.model), on = working(game, device.id);
  const portMenu = (i: number): MenuEntry[] => {
    const cable = game.cables.find((c) => [c.a, c.b].some((e) => e.device === device.id && e.port === i));
    const peer = peers[i], other = peer && game.devices.find((d) => d.id === peer.device);
    return [
      { label: "Show port", run: () => onPick(i) },
      other && !other.panel && { label: `Show ${devName(other)}`, run: () => onSelect(other.id) },
      null,
      cable && { label: "Cable colour", items: [...SWATCHES.map(([n, hex]) => ({ label: n, checked: cable.color === hex, run: () => act(setCableColor, cable.id, hex) })), null, { label: "Kind default", checked: cable.color === null, run: () => act(setCableColor, cable.id, null) }] },
      cable && { label: "Disconnect", run: () => act(disconnect, cable.id) },
    ];
  };
  return (
    <div className="loc-card">
      <table className="table loc-port-table">
        <thead><tr><th>Port</th><th>Media</th><th className="r">Speed</th><th>Link</th><th>Bond</th><th>Peer</th></tr></thead>
        <tbody>
          {model.ports.map((p, i) => {
            const peer = peers[i], other = peer && game.devices.find((d) => d.id === peer.device)!;
            const link = !other ? "Unplugged" : on && working(game, other.id) ? "Up" : "Down";
            return (
              <tr key={i} aria-selected={sel.includes(i)} onClick={() => onPick(i)} onContextMenu={menuOn(() => portMenu(i))} onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(null)}>
                <td className="num">{portName(model, i)}</td>
                <td>{p.media === "sfp" ? "SFP" : "RJ45"}</td>
                <td className="r num">{speed(p.gbit)}</td>
                <td><span className={`pill${link === "Up" ? " ok" : link === "Down" ? " bad" : ""}`}>{link}</span></td>
                <td className="num">{model.ports.length > 1 && device.bond !== "none" ? "bond0" : ""}</td>
                <td>
                  {!other ? null : other.panel ? "Carrier panel" : other.rackId === device.rackId ? (
                    <button className="loc-link num" onClick={(e) => { e.stopPropagation(); onSelect(other.id); }}>{devName(other)} {portName(modelById(other.model), peer!.port)}</button>
                  ) : <span className="num">{devName(other)} {portName(modelById(other.model), peer!.port)}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
          <button className="btn danger" onClick={() => act(disconnect, cable.id)}><Unplug />Disconnect</button>
        </div>
        <div className="loc-path">
          <div className="loc-node here"><span className="k">{devName(device)}</span><strong>{portName(model, port)}</strong></div>
          <div className={`loc-wire ${cable.kind}`} style={cable.color ? { background: cable.color } : undefined}><span><span className="num">{Math.min(here.gbit, (om.ports[peer.port] ?? here).gbit)} Gbit/s</span> {CABLE_NAME[cable.kind]}</span></div>
          <button className="loc-node" onClick={() => onSelect(other.id)}><span className="k">{other.panel ? "Carrier panel" : devName(other)}</span><strong>{other.panel ? `${other.name} ${portName(om, peer.port)}` : portName(om, peer.port)}</strong></button>
        </div>
        <ColorRow cable={cable} />
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
  const [picked, setPicked] = useState<{ device: string; port: number | null }>({ device: "", port: null });
  if (!targets.length) return <div className="loc-row loc-muted">No compatible ports</div>;
  const t = targets.find(({ d }) => d.id === picked.device) ?? targets[0];
  const to = picked.port !== null && t.free.includes(picked.port) ? picked.port : t.free[0];
  const go = () => act(connect, { device: device.id, port }, { device: t.d.id, port: to });
  return (
    <div className="loc-connect">
      <div className="picks" role="group" aria-label="Connect to">
        {targets.map(({ d, free }) => (
          <button key={d.id} className="pick" aria-pressed={d.id === t.d.id} onClick={() => setPicked({ device: d.id, port: null })}>
            <strong>{d.panel ? "Carrier panel" : devName(d)}</strong><span className="sub num">{free.length} free</span>
          </button>
        ))}
      </div>
      <div className="loc-row">
        <div className="seg wrap" role="group" aria-label="Port">
          {t.free.map((i) => <button key={i} className="num" aria-pressed={i === to} onClick={() => setPicked({ device: t.d.id, port: i })}>{portName(t.m, i).replace(/^Port /, "")}</button>)}
        </div>
        <span className="grow" />
        <button className="btn primary" onClick={go}><Cable />Connect</button>
      </div>
    </div>
  );
}

function GroupCard({ device, sel, onDone }: { device: Device; sel: number[]; onDone: () => void }) {
  const act = useStore((s) => s.act);
  const sorted = [...sel].sort((a, b) => a - b);
  const inGroup = sorted.find((p) => device.groups.some((g) => g.includes(p)));
  const run = (ports: number[]) => { if (act(setPortGroup, device.id, ports).ok) onDone(); };
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

// The name doubles as the label field: click to rename, Enter or leaving the field saves, Escape cancels, empty clears.
function LabelEdit({ device, editing, onEditing }: { device: Device; editing: boolean; onEditing: (on: boolean) => void }) {
  const act = useStore((s) => s.act);
  const [text, setText] = useState(device.label ?? "");
  const cancel = useRef(false);
  if (!editing) {
    return (
      <h2 className="loc-label">
        <button onClick={() => { cancel.current = false; setText(device.label ?? ""); onEditing(true); }} aria-label={`Label ${devName(device)}`}>{devName(device)}</button>
        {device.label && <span className="loc-muted">{device.name}</span>}
      </h2>
    );
  }
  const done = () => { if (!cancel.current) act(setLabel, device.id, text); cancel.current = false; onEditing(false); };
  return (
    <input className="field loc-label-in" autoFocus aria-label="Label" value={text} placeholder={device.name} maxLength={LABEL_MAX}
      onChange={(e) => setText(e.target.value)} onBlur={done}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { cancel.current = true; e.currentTarget.blur(); } }} />
  );
}


// Runs a change at once, or asks first when it takes devices that are online now offline.
export function useOfflineGuard(game: GameState) {
  const act = useStore((s) => s.act);
  const [down, setDown] = useState<{ names: string[]; title: string; action: string; run: () => void } | null>(null);
  const guarded = <A extends unknown[]>(title: string, action: string, fn: (g: GameState, ...args: A) => ActionResult, ...args: A) => {
    const after = structuredClone(game);
    fn(after, ...args);
    const names = game.devices.filter((d) => linkStatus(game, d.id).online && !linkStatus(after, d.id).online).map(devName);
    if (names.length) setDown({ names, title, action, run: () => act(fn, ...args) });
    else act(fn, ...args);
  };
  const names = down?.names ?? [];
  const dialog = down && (
    <Confirm title={down.title}
      text={`${names.length > 3 ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more` : names.join(", ")} ${names.length === 1 ? "goes" : "go"} offline.`}
      action={down.action} onCancel={() => setDown(null)} onConfirm={() => { setDown(null); down.run(); }} />
  );
  return { guarded, dialog };
}

// Plugs a power supply in, or pulls its plug after the offline check.
export function togglePlug(guarded: ReturnType<typeof useOfflineGuard>["guarded"], device: Device, psu: string) {
  const c = device.components.find((x) => x.id === psu);
  if (!c) return;
  if (isPlugged(c)) guarded(`Unplug ${devName(device)}?`, "Unplug", setPlugged, device.id, psu, false);
  else useStore.getState().act(setPlugged, device.id, psu, true);
}

// Each power supply with its feed and plug, then the empty bay a second supply can fill.
function PowerSupplies({ game, device, onPlug }: { game: GameState; device: Device; onPlug: (psu: string) => void }) {
  const act = useStore((s) => s.act);
  const loc = locationOf(game, device), rack = game.racks.find((r) => r.id === device.rackId);
  const ab = !!loc && dcOf(loc)?.feeds === "ab";
  const psus = device.rackId ? device.components.filter((c) => c.kind === "psu") : [];
  const extra = device.rackId ? secondPsuPrice(device) : null;
  if (!psus.length) return null;
  const name = (i: number) => `Power supply${psus.length > 1 || extra !== null ? ` ${i + 1}` : ""}`;
  return (
    <div className="loc-card">
      <div className="loc-card-h"><h3><Plug />Power supplies</h3></div>
      <table className="table loc-parts">
        <tbody>
          {psus.map((c, i) => (
            <tr key={c.id} onContextMenu={menuOn(() => [{ label: isPlugged(c) ? "Unplug" : "Plug in", run: () => onPlug(c.id) }])}>
              <td>{name(i)}</td>
              <td className="loc-muted">Feed {(ab || rack?.feedB) && i === 1 ? "B" : "A"}</td>
              <td className="r">
                {isPlugged(c) ? <span className="pill ok">Plugged in</span> : <button className="btn primary" onClick={() => onPlug(c.id)}><PlugZap />Plug in</button>}
              </td>
            </tr>
          ))}
          {extra !== null && (
            <tr className="insp-addon">
              <td>{name(1)}</td>
              <td className="loc-muted">Empty bay</td>
              <td className="r"><button className="btn" onClick={() => act(addSecondPsu, device.id)}><Plus />Add <span className="num">{euro(extra)}</span></button></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ColorRow({ cable }: { cable: CableT }) {
  const act = useStore((s) => s.act);
  const set = (color: string | null) => act(setCableColor, cable.id, color);
  return (
    <div className="loc-row">
      <span className="loc-k">Colour</span>
      <div className="loc-swatches" role="radiogroup" aria-label="Cable colour">
        {SWATCHES.map(([name, hex]) => (
          <button key={hex} role="radio" aria-checked={cable.color === hex} aria-label={name} title={name} className="loc-swatch" style={{ background: hex }} onClick={() => set(hex)} />
        ))}
        <button role="radio" aria-checked={cable.color === null} className="loc-swatch-default" onClick={() => set(null)}>
          <span className="loc-swatch" style={{ background: cableColor({ ...cable, color: null }) }} />Kind default
        </button>
      </div>
    </div>
  );
}
