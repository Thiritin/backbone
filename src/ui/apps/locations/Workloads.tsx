import { Cpu, HardDrive, MemoryStick } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Resources } from "../../../sim/10-catalog/products";
import type { GameState } from "../../../sim/50-state";
import { workloadsOn, type Workload } from "../../../sim/60-infra/cluster";
import { pegged, workloadUse } from "../../../sim/60-infra/usage";
import { migrateWorkload, migrationTargets, startWorkload, stopWorkload } from "../../../sim/90-actions/vms";
import { menuOn, type MenuEntry } from "../../desktop/ContextMenu";
import { useStore } from "../../store";
import { More } from "../More";
import { VM_STATE, vmLabel, vmState } from "../products/parts";

type Sort = "vcpu" | "ramGb" | "diskGb";
const SORTS: [Sort, string][] = [["vcpu", "CPU"], ["ramGb", "RAM"], ["diskGb", "Disk"]];
const num = (n: number) => `${+n.toFixed(n < 1 ? 2 : n < 10 ? 1 : 0)}`;
const HOT = 0.9;

// Use against the workload's booking: a small bar and the figures.
function Gauge({ icon, used, max, unit, label }: { icon: ReactNode; used: number; max: number; unit: string; label: string }) {
  const share = max ? used / max : 0;
  return (
    <span className={`wl-gauge${share >= HOT ? " hot" : ""}`} aria-label={`${label} ${num(used)} of ${num(max)} ${unit}`}>
      {icon}
      <span className="wl-gauge-bar"><span style={{ width: `${Math.min(100, share * 100)}%` }} /></span>
      <span className="num">{num(used)}/{num(max)} {unit}</span>
    </span>
  );
}

const share = (u: Resources, w: Workload, k: Sort) => (w[k] ? u[k] / w[k] : 0);

// The workloads of a cluster node, busiest first, each with a menu to move, stop or start it or open it in Virtual machines.
export function NodeWorkloads({ game, deviceId }: { game: GameState; deviceId: string }) {
  const [sort, setSort] = useState<Sort>("vcpu");
  const loads = workloadsOn(game, deviceId).filter((w) => w.clusterId).map((w) => ({ w, u: workloadUse(game, w) }));
  if (!loads.length) return null;
  loads.sort((a, b) => share(b.u, b.w, sort) - share(a.u, a.w, sort) || b.u[sort] - a.u[sort]);
  return (
    <>
      <div className="loc-card-h loc-sub">
        <h3>Workloads</h3>
        <span className="num loc-muted">{loads.length}</span>
        <span className="grow" />
        <div className="seg" role="group" aria-label="Sort by">
          {SORTS.map(([k, label]) => <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>)}
        </div>
      </div>
      {loads.map(({ w, u }) => <WorkloadRow key={w.id} game={game} w={w} u={u} />)}
    </>
  );
}

function WorkloadRow({ game, w, u }: { game: GameState; w: Workload; u: Resources }) {
  const { name, service } = vmLabel(game, w);
  const st = vmState(game, w), [label, tone] = VM_STATE[st];
  const hot = st === "running" && pegged(game, w);
  const entries = () => workloadMenu(game, w);
  return (
    <div className="wl-row" onContextMenu={menuOn(entries)}>
      <div className="wl-line">
        <span className="wl-name">{name}</span>
        <span className="loc-muted wl-service">{service}</span>
        <span className="grow" />
        {hot && <span className="pill warn">Pegged</span>}
        {st !== "running" && <span className={`pill ${tone}`}>{label}</span>}
        <More label={service} entries={entries} />
      </div>
      <div className="wl-gauges">
        <Gauge icon={<Cpu />} label="CPU" used={u.vcpu} max={w.vcpu} unit="vCPU" />
        <Gauge icon={<MemoryStick />} label="RAM" used={u.ramGb} max={w.ramGb} unit="GB" />
        <Gauge icon={<HardDrive />} label="Disk" used={u.diskGb} max={w.diskGb} unit="GB" />
      </div>
    </div>
  );
}

// A workload's actions: move it to a node with room, stop or start it, or open it elsewhere.
export function workloadMenu(game: GameState, w: Workload): MenuEntry[] {
  const { act, openApp } = useStore.getState();
  const targets = migrationTargets(game, w.id);
  const customer = game.services.find((v) => v.id === w.serviceId)?.customerId;
  return [
    { label: "Migrate to", disabled: !targets.length, items: targets.map((t) => ({ label: `${t.name}${t.down ? `, offline ${t.down} h` : ""}`, run: () => act((g) => migrateWorkload(g, w.id, t.to)) })) },
    w.stopped ? { label: "Start", run: () => act((g) => startWorkload(g, w.id)) } : { label: "Stop", run: () => act((g) => stopWorkload(g, w.id)) },
    null,
    { label: "Open in Virtual machines", run: () => openApp("Virtual machines", { kind: "workload", id: w.id }) },
    !!customer && { label: "Open customer", run: () => openApp("Customers", { kind: "customer", id: customer }) },
  ];
}

