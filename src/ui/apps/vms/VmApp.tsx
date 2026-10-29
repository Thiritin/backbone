import { Boxes, MonitorCog, Plus, RotateCcw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useSessionState } from "../../session";
import { softwareById } from "../../../sim/10-catalog/platforms";
import type { Resources } from "../../../sim/10-catalog/products";
import type { GameState } from "../../../sim/50-state";
import { hostOfVm, type Workload } from "../../../sim/60-infra/cluster";
import { workloadLoad } from "../../../sim/60-infra/usage";
import { createVm, deleteVm, PANEL_VM_SIZE } from "../../../sim/90-actions/clusters";
import { migrateWorkload, migrationTargets, restoreWorkload, startWorkload, stopWorkload } from "../../../sim/90-actions/vms";
import type { MenuEntry } from "../../desktop/ContextMenu";
import { menuOn } from "../../desktop/ContextMenu";
import { useFocus, useStore } from "../../store";
import { More } from "../More";
import { migrateEntries } from "./migrate";
import "../billing/billing.css";
import { CustomerLink } from "../customers/CustomersApp";
import { day, devName, disk, ram } from "../hw";
import { ResizeCard, SizeFields } from "../products/PanelHosts";
import { SoftwareGrid } from "../software/Software";
import { Mark, IncidentReports, Sparkline, VM_STATE, vmLabel, vmState, type VmState } from "../products/parts";
import { PRODUCT } from "../support/labels";
import { AddressRows } from "../network/Addresses";
import { fqdn } from "../../../sim/30-customers/domains";

type StateFilter = "all" | "running" | "stopped" | "lost";
const FILTERS: [StateFilter, string][] = [["all", "All"], ["running", "Running"], ["stopped", "Stopped"], ["lost", "Lost disk"]];
const matches = (f: StateFilter, st: VmState) => f === "all" || (f === "lost" ? st === "lost" : f === "stopped" ? st === "stopped" : st === "running");
const num = (n: number) => `${+n.toFixed(2)}`;

// Start, stop, restore and migrate for a VM or web space, shared by every list that shows one.
export function workloadActions(game: GameState, w: Workload): MenuEntry[] {
  const act = useStore.getState().act;
  const st = vmState(game, w);
  const on = st === "running" || st === "down" || st === "frozen";
  const web = game.clusters.find((c) => c.id === w.clusterId)?.kind === "panel";
  const targets = !web && (on || st === "stopped") ? migrationTargets(game, w.id) : [];
  const where = (id: string) => game.clusters.find((c) => c.id === id)?.name;
  return [
    st === "lost" && { label: w.backupAt === null ? "Start empty" : "Restore", run: () => act((g) => restoreWorkload(g, w.id)) },
    st === "stopped" && { label: "Start", run: () => act((g) => startWorkload(g, w.id)) },
    on && { label: "Stop", run: () => act((g) => stopWorkload(g, w.id)) },
    ...(web && (on || st === "stopped" || st === "migrating") ? migrateEntries(game, w) : []),
    targets.length > 0 && {
      label: "Migrate to",
      items: targets.map((t) => ({
        label: t.to !== t.clusterId && t.clusterId !== w.clusterId ? `${t.name} · ${where(t.clusterId)}` : t.name,
        run: () => act((g) => migrateWorkload(g, w.id, t.to)),
      })),
    },
  ];
}

function vmMenu(game: GameState, w: Workload): MenuEntry[] {
  const v = game.services.find((x) => x.id === w.serviceId), { act, openApp } = useStore.getState();
  return [
    ...workloadActions(game, w), null,
    v && { label: "Open customer", run: () => openApp("Customers", { kind: "customer", id: v.customerId }) },
    !v && !hostOfVm(game, w.id) && { label: "Delete", run: () => act((g) => deleteVm(g, w.id)) },
  ];
}

export function VmApp() {
  const game = useStore((s) => s.game);
  const [clusterId, setCluster] = useSessionState<string | null>("vms.cluster", null);
  const [incidents, setIncidents] = useSessionState("vms.incidents", false);
  const [node, setNode] = useSessionState<string | null>("vms.node", null);
  const [filter, setFilter] = useSessionState<StateFilter>("vms.tab", "all");
  const [selected, setSelected] = useSessionState<string | null>("vms.sel", null);
  const [creating, setCreating] = useState(false);
  useFocus("Virtual machines", (f) => { if (f.kind === "workload") { setCluster(null); setNode(null); setFilter("all"); setIncidents(false); setSelected(f.id); } });
  const cluster = game.clusters.find((c) => c.id === clusterId);
  const clouds = game.clusters.filter((c) => c.kind === "cloud");
  const vms = game.workloads.filter((w) => clouds.some((c) => c.id === w.clusterId));
  const brand = cluster?.platform ? softwareById(cluster.platform) : null;
  const shown = vms.filter((w) => (!cluster || w.clusterId === cluster.id) && (!node || w.deviceId === node) && matches(filter, vmState(game, w)));
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
          <Boxes />All clusters<span className="side-count">{vms.length}</span>
        </button>
        {clouds.map((c) => (
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
            {clouds.length > 0 && <button className="btn" onClick={() => { setCreating(true); setSelected(null); }}><Plus />New VM</button>}
          </div>
          <div className="fin-scroll">
            {shown.length === 0 ? <div className="fin-empty"><MonitorCog />No virtual machines</div> : (
              <table className="table fin-table">
                <thead><tr><th>Name</th><th>Customer</th><th>Product</th><th>Host</th><th className="r">Size</th><th>State</th></tr></thead>
                <tbody>
                  {shown.map((w) => {
                    const v = game.services.find((x) => x.id === w.serviceId), c = game.customers.find((x) => x.id === v?.customerId), own = vmLabel(game, w);
                    const d = game.devices.find((x) => x.id === w.deviceId), [label, tone] = VM_STATE[vmState(game, w)];
                    return (
                      <tr key={w.id} className={w.id === selected ? "sel" : ""} onClick={() => { setSelected(w.id); setCreating(false); }} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setSelected(w.id)}
                        onContextMenu={menuOn(() => vmMenu(game, w))}>
                        <td>{v ? v.label : own.name}{w.hostname && <div className="cus-sub num">{fqdn(game, w.hostname)}</div>}</td>
                        <td>{c ? <CustomerLink id={c.id} name={c.name} /> : "Own"}</td>
                        <td>{v ? PRODUCT[v.product] : own.service}</td>
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
      {!incidents && creating && <NewVm game={game} clusterId={clusterId ?? clouds[0]?.id} onDone={(id) => { setCreating(false); setSelected(id); }} />}
      {!incidents && !creating && vm && <VmDetail game={game} w={vm} />}
    </div>
  );
}

function VmDetail({ game, w }: { game: GameState; w: Workload }) {
  const act = useStore((s) => s.act);
  const v = game.services.find((x) => x.id === w.serviceId), c = game.customers.find((x) => x.id === v?.customerId);
  const cluster = game.clusters.find((x) => x.id === w.clusterId)!;
  const host = game.devices.find((x) => x.id === w.deviceId), panel = hostOfVm(game, w.id);
  const st = vmState(game, w), [label, tone] = VM_STATE[st], own = vmLabel(game, w);
  const from = game.hour - (game.hour % 24);
  const load = Array.from({ length: 24 }, (_, i) => workloadLoad(game, { ...w, stopped: false, busyUntil: 0 }, from + i));
  return (
    <aside className="fin-detail vm-detail">
      <div className="fin-detail-h"><h2>{v ? v.label : own.name}</h2><span className={`pill ${tone}`}>{label}</span><More label={v ? v.label : own.name} entries={() => vmMenu(game, w)} /></div>
      <dl className="fin-facts">
        {w.hostname && <div className="span"><dt>Hostname</dt><dd className="num">{fqdn(game, w.hostname)}</dd></div>}
        <div><dt>Customer</dt><dd>{c ? <CustomerLink id={c.id} name={c.name} /> : "Own"}</dd></div>
        <div><dt>Product</dt><dd>{v ? PRODUCT[v.product] : own.service}</dd></div>
        <div><dt>Host</dt><dd>{host ? devName(host) : "None"}</dd></div>
        <div><dt>Cluster</dt><dd>{cluster.name}</dd></div>
        <AddressRows game={game} id={w.id} />
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
      {st === "lost" && <div className="fin-actions"><button className="btn primary" onClick={() => act((g) => restoreWorkload(g, w.id))}><RotateCcw />{w.backupAt === null ? "Start empty" : "Restore"}</button></div>}
      {!v && (
        <section className="fin-card">
          <div className="fin-card-h">Software</div>
          <div className="fin-card-b"><SoftwareGrid game={game} machineId={w.id} /></div>
        </section>
      )}
      {panel && <ResizeCard key={panel.id} game={game} host={panel} />}
    </aside>
  );
}

// Books one of the player's own VMs on a hypervisor cluster.
function NewVm({ game, clusterId, onDone }: { game: GameState; clusterId: string | undefined; onDone: (id: string) => void }) {
  const act = useStore((s) => s.act);
  const clouds = game.clusters.filter((c) => c.kind === "cloud");
  const [on, setOn] = useState(clusterId), [size, setSize] = useState<Resources>(PANEL_VM_SIZE);
  const create = () => { if (!on) return; const r = act((g) => createVm(g, on, size)); if (r.ok) onDone(r.id!); };
  return (
    <aside className="fin-detail vm-detail">
      <div className="fin-detail-h"><h2>New VM</h2></div>
      {clouds.length > 1 && (
        <div className="seg" role="group" aria-label="Cluster">
          {clouds.map((c) => <button key={c.id} aria-pressed={on === c.id} onClick={() => setOn(c.id)}>{c.name}</button>)}
        </div>
      )}
      <SizeFields value={size} onChange={setSize} />
      <div className="fin-actions"><button className="btn primary" disabled={!on} onClick={create}>Create</button></div>
    </aside>
  );
}
