import { Boxes, Wrench } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { yearOf } from "../../../sim/00-core/time";
import { phpAt, phpBehind } from "../../../sim/10-catalog/platforms";
import { nextSlot } from "../../../sim/47-staff/technicians";
import { PHP_EOL } from "../../../sim/60-infra/php";
import { queuePhpUpgrade } from "../../../sim/90-actions/staff";
import { slotTime } from "./TechButton";
import type { Device, GameState } from "../../../sim/50-state";
import { bookable, clusterOf, nodeUsed, workloadsOn, type Cluster, type NodeState } from "../../../sim/60-infra/cluster";
import { locationOf } from "../../../sim/60-infra/status";
import { nodeUsage } from "../../../sim/60-infra/usage";
import { sumOf } from "../../../sim/60-infra/routes";
import { phpDue, setRamGuard, upgradePhp } from "../../../sim/90-actions/clusters";
import { restoreWorkload } from "../../../sim/90-actions/vms";
import { useStore } from "../../store";
import { cores, disk, ram } from "../hw";
import { ControlPlanePill, softwareName, VM_STATE, vmState } from "../products/parts";
import { NodeWorkloads } from "./Workloads";

export const NODE_STATE: Record<NodeState, [string, string]> = { active: ["Active", "ok"], cordoned: ["Cordoned", "warn"], draining: ["Draining", "warn"], maintenance: ["Maintenance", ""] };
const STATE = NODE_STATE;
const num = (n: number) => `${+n.toFixed(1)}`;

export function Meter({ used, cap, text }: { used: number; cap: number; text: string }) {
  return (
    <span className={`loc-meter${used > cap + 1e-9 ? " over" : ""}`}>
      <span className="loc-meter-bar"><span style={{ width: `${cap ? Math.min(100, (used / cap) * 100) : 0}%` }} /></span>
      <span className="num">{text}{used > cap + 1e-9 && cap > 0 ? ` · ${Math.round((used / cap) * 100)}%` : ""}</span>
    </span>
  );
}

// Booked against what the servers physically hold, next to live use against the hardware, row by row.
export function BookedMeters({ game, devices }: { game: GameState; devices: Device[] }) {
  const live = devices.map((d) => nodeUsage(game, d.id));
  const cap = sumOf(devices.map((d) => bookable(game, d))), used = sumOf(devices.map((d) => nodeUsed(game, d.id)));
  const u = sumOf(live.map((l) => l.used)), p = sumOf(live.map((l) => l.physical));
  const rows: [string, ReactNode, ReactNode][] = [
    ["CPU", <Meter used={used.vcpu} cap={cap.vcpu} text={`${num(used.vcpu)}/${num(cap.vcpu)} vCPU`} />, <Meter used={u.vcpu} cap={p.vcpu} text={`${num(u.vcpu)}/${cores(p.vcpu)}`} />],
    ["RAM", <Meter used={used.ramGb} cap={cap.ramGb} text={`${ram(+used.ramGb.toFixed(1))}/${ram(+cap.ramGb.toFixed(1))}`} />, <Meter used={u.ramGb} cap={p.ramGb} text={`${ram(+u.ramGb.toFixed(1))}/${ram(p.ramGb)}`} />],
    ["Disk", <Meter used={used.diskGb} cap={cap.diskGb} text={`${disk(Math.round(used.diskGb))}/${disk(Math.round(cap.diskGb))}`} />, <Meter used={u.diskGb} cap={p.diskGb} text={`${disk(Math.round(u.diskGb))}/${disk(p.diskGb)}`} />],
  ];
  return (
    <div className="node-meters">
      <span /><span className="loc-k">Booked</span><span className="loc-k">In use</span>
      {rows.map(([k, a, b]) => <Fragment key={k}><span className="loc-k">{k}</span>{a}{b}</Fragment>)}
    </div>
  );
}

function NodeMeters({ game, d }: { game: GameState; d: Device }) {
  const live = nodeUsage(game, d.id), { used: u, physical: p } = live;
  return (
    <>
      <BookedMeters game={game} devices={[d]} />
      {game.frozen.includes(d.id) && (
        <div className="loc-row"><span className="loc-k">Frozen</span><span className="pill bad">RAM in use {ram(+u.ramGb.toFixed(1))} of {ram(p.ramGb)}</span></div>
      )}
      {live.perf < 1 && <div className="loc-row"><span className="loc-k">Performance</span><span className="pill warn">{Math.round(live.perf * 100)}%</span></div>}
    </>
  );
}

// A panel host's PHP version, with an upgrade by hand or through the technicians' queue.
function PhpRow({ game, cluster, device }: { game: GameState; cluster: Cluster; device: Device }) {
  const act = useStore((s) => s.act);
  const year = yearOf(game.hour), latest = phpAt(year), behind = phpBehind(cluster.php, year);
  const queued = game.techOps.filter((o) => o.kind === "php" && o.deviceId === device.id).length;
  const old = phpDue(game, cluster), patch = cluster.php === latest;
  const loc = locationOf(game, device), slot = old && !queued && loc ? nextSlot(game, loc.id, "panels") : null;
  return (
    <div className="loc-row">
      <span className="loc-k">PHP</span>
      <span className="num">{cluster.php}</span>
      {behind >= PHP_EOL ? <span className="pill bad">Unsupported</span> : behind > 0 && <span className="pill warn">Outdated</span>}
      <span className="grow" />
      {queued > 0 && <span className="pill accent">Queued <span className="num">{queued}</span></span>}
      {old && <button className="btn" onClick={() => act(upgradePhp, cluster.id)}>{patch ? "Patch" : `Upgrade to ${latest}`}</button>}
      {slot && (
        <button className="btn" onClick={() => act(queuePhpUpgrade, cluster.id)}>
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
  const owner = (serviceId: string) => {
    const v = game.services.find((x) => x.id === serviceId);
    return { v, c: game.customers.find((x) => x.id === v?.customerId) };
  };
  if (!cluster || !node) return null;
  const [label, tone] = STATE[node.state];
  return (
    <div className="loc-card">
      <div className="loc-card-h">
        <h3><Boxes />{softwareName(cluster.switching?.to ?? cluster.panel ?? cluster.platform)}</h3>
        <span className={`pill ${tone}`}>{label}</span>
        {game.frozen.includes(device.id) && <span className="pill bad">Frozen</span>}
        <span className="grow" />
        {cluster.controlPlane === device.id && <ControlPlanePill game={game} cluster={cluster} />}
      </div>
      <NodeMeters game={game} d={device} />
      {game.unlocks.includes("memoryReservation") && (
        <div className="loc-row">
          <span className="loc-k">RAM</span>
          <div className="seg" role="group" aria-label="Memory reservation">
            <button aria-pressed={!cluster.ramGuard} onClick={() => act(setRamGuard, cluster.id, false)}>Overbook</button>
            <button aria-pressed={!!cluster.ramGuard} onClick={() => act(setRamGuard, cluster.id, true)}>Reserve</button>
          </div>
        </div>
      )}
      {cluster.kind === "panel" && <PhpRow game={game} cluster={cluster} device={device} />}
      {loads.filter((w) => vmState(game, w) === "lost").map((w) => (
        <div key={w.id} className="loc-row">
          <span>{owner(w.serviceId).c?.name}</span>
          <span className="loc-muted">{owner(w.serviceId).v?.label}</span>
          <span className="grow" />
          <span className="pill bad">{VM_STATE.lost[0]}</span>
          <button className="btn" onClick={() => act(restoreWorkload, w.id)}>{w.backupAt === null ? "Start empty" : "Restore"}</button>
        </div>
      ))}
      <NodeWorkloads game={game} deviceId={device.id} />
    </div>
  );
}
