import { Cpu, Ellipsis, HardDrive, MemoryStick, MonitorCog, MoveRight, Play, Square } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Resources } from "../../../sim/10-catalog/products";
import type { GameState } from "../../../sim/50-state";
import { workloadsOn, type Workload } from "../../../sim/60-infra/cluster";
import { pegged, workloadUse } from "../../../sim/60-infra/usage";
import { migrateWorkload, migrationTargets, startWorkload, stopWorkload } from "../../../sim/90-actions/vms";
import { useStore } from "../../store";
import { VM_STATE, vmState } from "../products/parts";

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
  const act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const [menu, setMenu] = useState(false), [moving, setMoving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [menu]);
  const v = game.services.find((x) => x.id === w.serviceId), c = game.customers.find((x) => x.id === v?.customerId);
  const st = vmState(game, w), [label, tone] = VM_STATE[st];
  const hot = st === "running" && pegged(game, w);
  const run = (fn: Parameters<typeof act>[0]) => { setMenu(false); act(fn); };
  return (
    <div className="wl-row">
      <div className="wl-line">
        <span className="wl-name">{c?.name}</span>
        <span className="loc-muted wl-service">{v?.domain ?? v?.label}</span>
        <span className="grow" />
        {hot && <span className="pill warn">Pegged</span>}
        {st !== "running" && <span className={`pill ${tone}`}>{label}</span>}
        <div className="wl-more" ref={ref}>
          <button className="btn ghost icon" aria-label={`Actions for ${v?.domain ?? v?.label}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><Ellipsis /></button>
          {menu && (
            <div className="wl-menu" role="menu">
              <button role="menuitem" onClick={() => { setMenu(false); setMoving(!moving); }}><MoveRight />Migrate to another host</button>
              {w.stopped
                ? <button role="menuitem" onClick={() => run((g) => startWorkload(g, w.id))}><Play />Start</button>
                : <button role="menuitem" onClick={() => run((g) => stopWorkload(g, w.id))}><Square />Stop</button>}
              <button role="menuitem" onClick={() => { setMenu(false); openApp("Virtual machines", { kind: "workload", id: w.id }); }}><MonitorCog />Open in Virtual machines</button>
            </div>
          )}
        </div>
      </div>
      <div className="wl-gauges">
        <Gauge icon={<Cpu />} label="CPU" used={u.vcpu} max={w.vcpu} unit="vCPU" />
        <Gauge icon={<MemoryStick />} label="RAM" used={u.ramGb} max={w.ramGb} unit="GB" />
        <Gauge icon={<HardDrive />} label="Disk" used={u.diskGb} max={w.diskGb} unit="GB" />
      </div>
      {moving && <Targets game={game} w={w} onDone={() => setMoving(false)} />}
    </div>
  );
}

// Nodes with room for the workload, with what each has left to book and how long the move takes it offline.
function Targets({ game, w, onDone }: { game: GameState; w: Workload; onDone: () => void }) {
  const act = useStore((s) => s.act);
  const targets = migrationTargets(game, w.id);
  if (!targets.length) return <div className="wl-targets"><span className="loc-muted">No host with room</span></div>;
  return (
    <div className="wl-targets">
      {targets.map((t) => {
        const other = t.clusterId !== w.clusterId ? game.clusters.find((x) => x.id === t.clusterId)?.name : null;
        return (
          <button key={t.to} className="wl-target" onClick={() => { if (act((g) => migrateWorkload(g, w.id, t.to)).ok) onDone(); }}>
            <b>{t.name}</b>
            {other && other !== t.name && <span className="loc-muted">{other}</span>}
            <span className="num loc-muted">{num(t.free.vcpu)} vCPU · {num(t.free.ramGb)} GB · {num(t.free.diskGb)} GB free</span>
            <span className={`pill ${t.down ? "warn" : "ok"}`}>{t.down ? `Offline ${t.down} h` : "Live"}</span>
          </button>
        );
      })}
    </div>
  );
}
