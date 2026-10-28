import { Boxes, Plus, Wrench } from "lucide-react";
import { useState, type ReactNode } from "react";
import { yearOf } from "../../../sim/00-core/time";
import { modelById } from "../../../sim/10-catalog/hardware";
import { phpAt, phpBehind } from "../../../sim/10-catalog/platforms";
import { nextSlot } from "../../../sim/47-staff/technicians";
import { PHP_EOL } from "../../../sim/60-infra/php";
import { queuePhpUpgrade } from "../../../sim/90-actions/staff";
import { slotTime, TechButton } from "./TechButton";
import type { Device, GameState, Location } from "../../../sim/50-state";
import { bookable, clusterOf, controlPlaneUp, nodeUsed, serverTaken, workloadsOn, type Cluster, type NodeState } from "../../../sim/60-infra/cluster";
import { locationOf } from "../../../sim/60-infra/status";
import { nodeUsage } from "../../../sim/60-infra/usage";
import { addNode, CLUSTER_NAME_MAX, cordon, createCluster, drain, removeNode, setPlacement, uncordon, upgradePhp } from "../../../sim/90-actions/clusters";
import { restoreWorkload } from "../../../sim/90-actions/vms";
import { useStore } from "../../store";
import { cores, devName, disk, ram } from "../hw";
import { softwareName, VM_STATE, vmState } from "../products/parts";
import { Zone } from "./ui";

export const NODE_STATE: Record<NodeState, [string, string]> = { active: ["Active", "ok"], cordoned: ["Cordoned", "warn"], draining: ["Draining", "warn"], maintenance: ["Maintenance", ""] };
const STATE = NODE_STATE;
const num = (n: number) => `${+n.toFixed(1)}`;

export function Meter({ used, cap, text }: { used: number; cap: number; text: string }) {
  return (
    <span className={`loc-meter${used > cap ? " tripped" : ""}`}>
      <span className="loc-meter-bar"><span style={{ width: `${cap ? Math.min(100, (used / cap) * 100) : 0}%` }} /></span>
      <span className="num">{text}</span>
    </span>
  );
}

// Booked against what the node can book, then live use against the hardware.
function usage(game: GameState, d: Device): [string, ReactNode][] {
  const cap = bookable(game, d), used = nodeUsed(game, d.id), live = nodeUsage(game, d.id), { used: u, physical: p } = live;
  return [
    ["vCPU booked", <Meter used={used.vcpu} cap={cap.vcpu} text={`${num(used.vcpu)} of ${num(cap.vcpu)}`} />],
    ["RAM booked", <Meter used={used.ramGb} cap={cap.ramGb} text={`${ram(+used.ramGb.toFixed(2))} of ${ram(+cap.ramGb.toFixed(2))}`} />],
    ["Disk booked", <Meter used={used.diskGb} cap={cap.diskGb} text={`${disk(used.diskGb)} of ${disk(Math.round(cap.diskGb))}`} />],
    ["CPU in use", <Meter used={u.vcpu} cap={p.vcpu} text={`${num(u.vcpu)} of ${cores(p.vcpu)}`} />],
    ["RAM in use", <Meter used={u.ramGb} cap={p.ramGb} text={`${ram(+u.ramGb.toFixed(1))} of ${ram(p.ramGb)}`} />],
    ["Disk in use", <Meter used={u.diskGb} cap={p.diskGb} text={`${disk(Math.round(u.diskGb))} of ${disk(p.diskGb)}`} />],
    ...(live.perf < 1 ? [["Performance", <span className="pill warn">{Math.round(live.perf * 100)}%</span>] as [string, ReactNode]] : []),
  ];
}

// Servers mounted in the zone that no cluster or customer uses.
const freeServers = (game: GameState, az: string) =>
  game.devices.filter((d) => d.rackId && modelById(d.model).kind === "server" && locationOf(game, d)?.az === az && !serverTaken(game, d.id));

// The clusters of a location's zone, with their nodes, and a form for a new one.
export function Clusters({ game, loc }: { game: GameState; loc: Location }) {
  const act = useStore((s) => s.act);
  const [name, setName] = useState("");
  const clusters = game.clusters.filter((c) => c.az === loc.az);
  return (
    <div className="loc-card">
      <div className="loc-card-h"><h3><Boxes />Clusters</h3><Zone loc={loc} /><span className="grow" /><span className="num loc-muted">{clusters.length}</span></div>
      {clusters.map((c) => <ClusterRows key={c.id} game={game} cluster={c} />)}
      <form className="loc-row" onSubmit={(e) => { e.preventDefault(); if (act((g) => createCluster(g, loc.id, name)).ok) setName(""); }}>
        <input className="field grow" aria-label="Cluster name" placeholder="Cluster name" maxLength={CLUSTER_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={!name.trim()}><Plus />New cluster</button>
      </form>
    </div>
  );
}

function ClusterRows({ game, cluster }: { game: GameState; cluster: Cluster }) {
  const act = useStore((s) => s.act);
  const free = freeServers(game, cluster.az);
  return (
    <>
      <div className="loc-card-h loc-sub">
        <h3>{cluster.name}</h3>
        <span className="grow" />
        <div className="seg" role="group" aria-label="Placement">
          <button aria-pressed={cluster.placement === "pack"} onClick={() => act((g) => setPlacement(g, cluster.id, "pack"))}>Pack</button>
          <button aria-pressed={cluster.placement === "spread"} onClick={() => act((g) => setPlacement(g, cluster.id, "spread"))}>Spread</button>
        </div>
      </div>
      {cluster.nodes.map((n) => {
        const d = game.devices.find((x) => x.id === n.deviceId)!, [label, tone] = STATE[n.state], used = nodeUsed(game, d.id), cap = bookable(game, d);
        return (
          <div key={n.deviceId} className="loc-row">
            <span>{devName(d)}</span>
            <span className={`pill ${tone}`}>{label}</span>
            <span className="grow" />
            <span className="num loc-muted">{workloadsOn(game, d.id).length} workloads</span>
            <Meter used={used.ramGb} cap={cap.ramGb} text={`${ram(+used.ramGb.toFixed(2))} of ${ram(+cap.ramGb.toFixed(2))}`} />
          </div>
        );
      })}
      {free.length > 0 && (
        <div className="loc-row">
          {free.map((d) => <button key={d.id} className="btn" onClick={() => act((g) => addNode(g, cluster.id, d.id))}><Plus />{devName(d)}</button>)}
        </div>
      )}
    </>
  );
}

// A server's role: its cluster and node state with the workloads on it, the customer renting it, or a cluster to join.
// The node's PHP version, with an upgrade of every node by hand or through the technicians' queue.
function PhpRow({ game, cluster, device }: { game: GameState; cluster: Cluster; device: Device }) {
  const act = useStore((s) => s.act);
  const node = cluster.nodes.find((n) => n.deviceId === device.id)!;
  const year = yearOf(game.hour), latest = phpAt(year), behind = phpBehind(node.php, year);
  const queued = game.techOps.filter((o) => o.kind === "php" && cluster.nodes.some((n) => n.deviceId === o.deviceId)).length;
  const old = cluster.nodes.some((n) => n.php !== latest);
  const loc = locationOf(game, device), slot = old && !queued && loc ? nextSlot(game, loc.id, "panels") : null;
  return (
    <div className="loc-row">
      <span className="loc-k">PHP</span>
      <span className="num">{node.php}</span>
      {behind >= PHP_EOL ? <span className="pill bad">Unsupported</span> : behind > 0 && <span className="pill warn">Outdated</span>}
      <span className="grow" />
      {queued > 0 && <span className="pill accent">Queued <span className="num">{queued}</span></span>}
      {old && <button className="btn" onClick={() => act((g) => upgradePhp(g, cluster.id))}>Upgrade to {latest}</button>}
      {slot && (
        <button className="btn" onClick={() => act((g) => queuePhpUpgrade(g, cluster.id))}>
          <Wrench />{slot.name.split(" ")[0]}, <span className="num">{slotTime(game.hour, slot.hour)}</span>
        </button>
      )}
    </div>
  );
}

export function NodeCard({ game, device }: { game: GameState; device: Device }) {
  const act = useStore((s) => s.act);
  const cluster = clusterOf(game, device.id), node = cluster?.nodes.find((n) => n.deviceId === device.id);
  const loads = workloadsOn(game, device.id);
  const az = locationOf(game, device)?.az;
  const joinable = game.clusters.filter((c) => c.az === az);
  const owner = (serviceId: string) => {
    const v = game.services.find((x) => x.id === serviceId);
    return { v, c: game.customers.find((x) => x.id === v?.customerId) };
  };
  if (!cluster && loads.length) {
    const { v, c } = owner(loads[0].serviceId);
    return (
      <div className="loc-card">
        <div className="loc-card-h"><h3><Boxes />Dedicated</h3><span className="grow" /><span>{c?.name}</span></div>
        <div className="loc-row"><span>{v?.label}</span></div>
      </div>
    );
  }
  if (!cluster || !node) {
    return (
      <div className="loc-card">
        <div className="loc-card-h"><h3><Boxes />Cluster</h3><span className="grow" /><span className="loc-muted">None</span></div>
        {device.rackId && joinable.length > 0 && (
          <div className="loc-row">
            {joinable.map((c) => <button key={c.id} className="btn" onClick={() => act((g) => addNode(g, c.id, device.id))}><Plus />{c.name}</button>)}
          </div>
        )}
      </div>
    );
  }
  const [label, tone] = STATE[node.state];
  return (
    <div className="loc-card">
      <div className="loc-card-h">
        <h3><Boxes />{cluster.name}</h3>
        <span className={`pill ${tone}`}>{label}</span>
        <span className="grow" />
        {node.state === "active"
          ? <button className="btn" onClick={() => act((g) => cordon(g, device.id))}>Cordon</button>
          : <button className="btn" onClick={() => act((g) => uncordon(g, device.id))}>Uncordon</button>}
        {node.state !== "draining" && node.state !== "maintenance" && <button className="btn" onClick={() => act((g) => drain(g, device.id))}>Drain</button>}
        {node.state !== "draining" && node.state !== "maintenance" && <TechButton game={game} deviceId={device.id} kind="drain" />}
        {!loads.length && <button className="btn" onClick={() => act((g) => removeNode(g, device.id))}>Remove</button>}
      </div>
      {usage(game, device).map(([k, v]) => <div key={k} className="loc-row"><span className="loc-k">{k}</span>{v}</div>)}
      <PhpRow game={game} cluster={cluster} device={device} />
      {cluster.controlPlane === device.id && (
        <div className="loc-row">
          <span className="loc-k">Control plane</span>
          <span>{softwareName(cluster.panel)}, {softwareName(cluster.platform)}</span>
          <span className="grow" />
          <span className={`pill ${controlPlaneUp(game, cluster) ? "ok" : "bad"}`}>{controlPlaneUp(game, cluster) ? "Up" : "Down"}</span>
        </div>
      )}
      {loads.map((w) => {
        const { v, c } = owner(w.serviceId), st = vmState(game, w), [label, tone] = VM_STATE[st];
        return (
          <div key={w.id} className="loc-row">
            <span>{c?.name}</span>
            <span className="loc-muted">{v?.label}</span>
            <span className="grow" />
            <span className="num loc-muted">{num(w.vcpu)} vCPU · {ram(+w.ramGb.toFixed(2))} · {disk(w.diskGb)}</span>
            {st !== "running" && <span className={`pill ${tone}`}>{label}</span>}
            {st === "lost" && <button className="btn" onClick={() => act((g) => restoreWorkload(g, w.id))}>{w.backupAt === null ? "Start empty" : "Restore"}</button>}
          </div>
        );
      })}
    </div>
  );
}
