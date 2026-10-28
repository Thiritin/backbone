import { Boxes, MonitorCog, Play, RotateCcw, Square, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { softwareById } from "../../../sim/10-catalog/platforms";
import type { GameState } from "../../../sim/50-state";
import { bookable, nodeUsed, type Workload } from "../../../sim/60-infra/cluster";
import { working } from "../../../sim/60-infra/status";
import { workloadLoad } from "../../../sim/60-infra/usage";
import { migrateWorkload, restoreWorkload, startWorkload, stopWorkload } from "../../../sim/90-actions/vms";
import { useStore } from "../../store";
import "../billing/billing.css";
import { CustomerLink } from "../customers/CustomersApp";
import { day, devName, disk, ram } from "../hw";
import { Mark, IncidentReports, Sparkline, VM_STATE, vmState, type VmState } from "../products/parts";
import { PRODUCT } from "../support/labels";

type StateFilter = "all" | "running" | "stopped" | "lost";
const FILTERS: [StateFilter, string][] = [["all", "All"], ["running", "Running"], ["stopped", "Stopped"], ["lost", "Lost disk"]];
const matches = (f: StateFilter, st: VmState) => f === "all" || (f === "lost" ? st === "lost" : f === "stopped" ? st === "stopped" : st === "running");
const num = (n: number) => `${+n.toFixed(2)}`;

export function VmApp() {
  const game = useStore((s) => s.game);
  const [clusterId, setCluster] = useState<string | null>(null);
  const [incidents, setIncidents] = useState(false);
  const [node, setNode] = useState<string | null>(null);
  const [filter, setFilter] = useState<StateFilter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const cluster = game.clusters.find((c) => c.id === clusterId);
  const brand = cluster?.platform ? softwareById(cluster.platform) : null;
  const shown = game.workloads.filter((w) => w.clusterId && (!cluster || w.clusterId === cluster.id) && (!node || w.deviceId === node) && matches(filter, vmState(game, w)));
  const vm = game.workloads.find((w) => w.id === selected);
  const pickCluster = (id: string | null) => { setCluster(id); setNode(null); setIncidents(false); };
  const lost = game.lossReports.filter((r) => r.items.some((i) => !i.restored)).length;

  return (
    <div className="fin">
      <nav className="sidebar fin-side" aria-label="Inventory">
        <div className="vm-brand">
          {brand ? <Mark id={brand.id} size={32} /> : <span className="prd-mark" style={{ width: 32, height: 32, background: "var(--text-3)" }}><MonitorCog size={20} /></span>}
          <div><b>{brand ? brand.console : "Virtual machines"}</b><span>{cluster ? cluster.name : "All clusters"}</span></div>
        </div>
        <button className={`side-item${!cluster && !incidents ? " active" : ""}`} aria-pressed={!cluster && !incidents} onClick={() => pickCluster(null)}>
          <Boxes />All clusters<span className="side-count">{game.workloads.filter((w) => w.clusterId).length}</span>
        </button>
        {game.clusters.map((c) => (
          <button key={c.id} className={`side-item${c.id === clusterId && !incidents ? " active" : ""}`} aria-pressed={c.id === clusterId && !incidents} onClick={() => pickCluster(c.id)}>
            <Mark id={c.platform} size={16} />{c.name}<span className="side-count">{game.workloads.filter((w) => w.clusterId === c.id).length}</span>
          </button>
        ))}
        <button className={`side-item fin-auto-item${incidents ? " active" : ""}`} aria-pressed={incidents} onClick={() => setIncidents(true)}>
          <TriangleAlert />Incidents<span className="side-count">{lost}</span>
        </button>
      </nav>
      {incidents ? (
        <div className="fin-main"><div className="fin-scroll"><IncidentReports game={game} /></div></div>
      ) : (
        <div className="fin-main">
          <div className="vm-tools">
            <div className="seg" role="group" aria-label="State">
              {FILTERS.map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
            </div>
            {cluster && cluster.nodes.length > 1 && (
              <div className="seg" role="group" aria-label="Host">
                <button aria-pressed={!node} onClick={() => setNode(null)}>All hosts</button>
                {cluster.nodes.map((n) => {
                  const d = game.devices.find((x) => x.id === n.deviceId);
                  return d && <button key={d.id} aria-pressed={node === d.id} onClick={() => setNode(d.id)}>{devName(d)}</button>;
                })}
              </div>
            )}
          </div>
          <div className="fin-scroll">
            {shown.length === 0 ? <div className="fin-empty"><MonitorCog />No virtual machines</div> : (
              <table className="table fin-table">
                <thead><tr><th>Name</th><th>Customer</th><th>Product</th><th>Host</th><th className="r">Size</th><th>State</th></tr></thead>
                <tbody>
                  {shown.map((w) => {
                    const v = game.services.find((x) => x.id === w.serviceId), c = game.customers.find((x) => x.id === v?.customerId);
                    const d = game.devices.find((x) => x.id === w.deviceId), [label, tone] = VM_STATE[vmState(game, w)];
                    return (
                      <tr key={w.id} className={w.id === selected ? "sel" : ""} onClick={() => setSelected(w.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setSelected(w.id)}>
                        <td>{v?.label}</td>
                        <td>{c && <CustomerLink id={c.id} name={c.name} />}</td>
                        <td>{v && PRODUCT[v.product]}</td>
                        <td>{d && devName(d)}</td>
                        <td className="r num">{num(w.vcpu)} vCPU · {ram(+w.ramGb.toFixed(2))}</td>
                        <td><span className={`pill ${tone}`}>{label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      {!incidents && vm && <VmDetail game={game} w={vm} />}
    </div>
  );
}

function VmDetail({ game, w }: { game: GameState; w: Workload }) {
  const act = useStore((s) => s.act);
  const v = game.services.find((x) => x.id === w.serviceId), c = game.customers.find((x) => x.id === v?.customerId);
  const cluster = game.clusters.find((x) => x.id === w.clusterId)!;
  const host = game.devices.find((x) => x.id === w.deviceId);
  const st = vmState(game, w), [label, tone] = VM_STATE[st];
  const from = game.hour - (game.hour % 24);
  const load = Array.from({ length: 24 }, (_, i) => workloadLoad(game, { ...w, stopped: false, busyUntil: 0 }, from + i));
  // Nodes of the same zone's clusters with room for it.
  const targets = game.clusters.filter((x) => x.az === cluster.az).flatMap((x) => x.nodes.filter((n) => n.state === "active").map((n) => ({ c: x, d: game.devices.find((d) => d.id === n.deviceId)! })))
    .filter(({ d }) => d && d.id !== w.deviceId && working(game, d.id) && (["vcpu", "ramGb", "diskGb"] as const).every((k) => nodeUsed(game, d.id)[k] + w[k] <= bookable(game, d)[k] + 1e-9));
  const live = !!cluster.platform && softwareById(cluster.platform).live;
  return (
    <aside className="fin-detail vm-detail">
      <div className="fin-detail-h"><h2>{v?.label}</h2><span className={`pill ${tone}`}>{label}</span></div>
      <dl className="fin-facts">
        <div><dt>Customer</dt><dd>{c && <CustomerLink id={c.id} name={c.name} />}</dd></div>
        <div><dt>Product</dt><dd>{v && PRODUCT[v.product]}</dd></div>
        <div><dt>Host</dt><dd>{host ? devName(host) : "None"}</dd></div>
        <div><dt>Cluster</dt><dd>{cluster.name}</dd></div>
        <div><dt>vCPU</dt><dd className="num">{num(w.vcpu)}</dd></div>
        <div><dt>RAM</dt><dd className="num">{ram(+w.ramGb.toFixed(2))}</dd></div>
        <div><dt>Disk</dt><dd className="num">{disk(w.diskGb)}</dd></div>
        <div><dt>Last backup</dt><dd className="num">{w.backupAt === null ? "None" : day(w.backupAt)}</dd></div>
        {w.busyUntil > game.hour && <div><dt>Back in</dt><dd className="num">{w.busyUntil - game.hour} h</dd></div>}
      </dl>
      <section className="fin-card">
        <div className="fin-card-h">Load today</div>
        <div className="fin-card-b"><Sparkline values={load} from={from} w={250} /></div>
      </section>
      <div className="fin-actions">
        {st === "lost" && <button className="btn primary" onClick={() => act((g) => restoreWorkload(g, w.id))}><RotateCcw />{w.backupAt === null ? "Start empty" : "Restore"}</button>}
        {st === "stopped" && <button className="btn" onClick={() => act((g) => startWorkload(g, w.id))}><Play />Start</button>}
        {(st === "running" || st === "down") && <button className="btn" onClick={() => act((g) => stopWorkload(g, w.id))}><Square />Stop</button>}
      </div>
      {(st === "running" || st === "down" || st === "stopped") && targets.length > 0 && (
        <section className="fin-card">
          <div className="fin-card-h">{live ? "Live migration" : "Cold migration"}</div>
          <div className="fin-card-b">
            <div className="fin-pills">
              {targets.map(({ c: tc, d }) => <button key={d.id} className="btn" onClick={() => act((g) => migrateWorkload(g, w.id, d.id))}>{devName(d)}{tc.id !== cluster.id ? ` · ${tc.name}` : ""}</button>)}
            </div>
          </div>
        </section>
      )}
    </aside>
  );
}
