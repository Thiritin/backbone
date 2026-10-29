import { AppWindow, Boxes, Feather, Gauge, Layers, Mail, PanelsTopLeft, PiggyBank, Server, SquareTerminal, TriangleAlert, type LucideIcon } from "lucide-react";
import { euroCents } from "../../../sim/00-core/money";
import { formatClock } from "../../../sim/00-core/time";
import { SERVES, softwareById, softwareOf, type Software, type SoftwareKind } from "../../../sim/10-catalog/platforms";
import { PRODUCTS } from "../../../sim/10-catalog/products";
import { PRODUCT } from "../support/labels";
import type { GameState } from "../../../sim/50-state";
import { controlPlaneUp, hostOfVm, lostDisk, workloadOnline, type Cluster, type Workload } from "../../../sim/60-infra/cluster";
import { restoreWorkload } from "../../../sim/90-actions/vms";
import { useStore } from "../../store";
import { CustomerLink } from "../customers/CustomersApp";
import { devName, disk } from "../hw";
import "./products.css";

export const BRAND: Record<string, { icon: LucideIcon; color: string }> = {
  cpanic: { icon: Gauge, color: "oklch(0.64 0.17 45)" },
  pleskit: { icon: PanelsTopLeft, color: "oklch(0.56 0.15 250)" },
  directadmen: { icon: SquareTerminal, color: "oklch(0.5 0.05 260)" },
  freepanel: { icon: Feather, color: "oklch(0.6 0.13 150)" },
  openstash: { icon: Layers, color: "oklch(0.58 0.19 25)" },
  vmwhere: { icon: Boxes, color: "oklch(0.5 0.04 250)" },
  proxmocks: { icon: Server, color: "oklch(0.66 0.16 55)" },
  hypervee: { icon: AppWindow, color: "oklch(0.56 0.15 240)" },
  postfixit: { icon: Mail, color: "oklch(0.55 0.13 20)" },
  mailpig: { icon: PiggyBank, color: "oklch(0.68 0.13 355)" },
};

export function Mark({ id, size = 28 }: { id: string | null; size?: number }) {
  if (!id) return <span className="prd-mark" style={{ width: size, height: size, background: "var(--text-3)" }}><Server size={Math.round(size * 0.62)} /></span>;
  const { icon: Icon, color } = BRAND[id] ?? BRAND.proxmocks;
  return <span className="prd-mark" style={{ background: color, width: size, height: size }}><Icon size={Math.round(size * 0.62)} /></span>;
}

const UNIT: Record<Software["pricing"], string> = { free: "", account: "per web space", server: "per server", core: "per core" };
export const licenseText = (sw: Software) => (sw.pricing === "free" ? "Free" : `${euroCents(sw.fee)} ${UNIT[sw.pricing]}`);
const cp = (sw: Software) => `${+sw.controlPlane.vcpu.toFixed(2)} vCPU · ${+sw.controlPlane.ramGb.toFixed(2)} GB`;

export const KIND_NAME: Record<SoftwareKind, string> = { panel: "Hosting panel", cloud: "Hypervisor", mail: "Mail server" };
export const servesText = (kind: SoftwareKind) => SERVES[kind].filter((p) => !PRODUCTS[p].ha).map((p) => PRODUCT[p]).join(", ");

// The competing software of one kind as cards; the chosen one is pressed.
export function SoftwareCards({ kind, value, onPick, compact, blocked }: { kind: SoftwareKind; value: string | null; onPick: (id: string) => void; compact?: boolean; blocked?: (id: string) => boolean }) {
  return (
    <div className="prd-cards" role="group" aria-label={KIND_NAME[kind]}>
      {softwareOf(kind).map((sw) => (
        <button key={sw.id} className="prd-card" aria-pressed={sw.id === value} aria-disabled={blocked?.(sw.id) || undefined} onClick={() => onPick(sw.id)}>
          <span className="prd-card-h"><Mark id={sw.id} size={24} /><span className="t">{sw.name}</span></span>
          <dl>
            <div><dt>License</dt><dd className="num">{licenseText(sw)}</dd></div>
            <div><dt>Install</dt><dd className="num">{sw.installHours} h</dd></div>
            {kind === "mail" ? <div><dt>Needs</dt><dd className="num">{cp(sw)} · {sw.controlPlane.diskGb} GB</dd></div> : <>
            <div><dt>CPU overcommit</dt><dd className="num">Up to {sw.overcommit.cpu}×</dd></div>
            <div><dt>RAM overcommit</dt><dd className="num">{sw.overcommit.ram > 1 ? `Up to ${sw.overcommit.ram}×` : "None"}</dd></div></>}
            {compact || kind === "mail" ? null : <>
            <div><dt>Tickets</dt><dd className="num">×{sw.tickets}</dd></div>
            {kind === "cloud" && <div><dt>Density</dt><dd className="num">×{sw.density}</dd></div>}
            {kind === "cloud" && <div><dt>Live migration</dt><dd>{sw.live ? "Yes" : "No"}</dd></div>}
            <div><dt>Control plane</dt><dd className="num">{cp(sw)}</dd></div>
            </>}
          </dl>
        </button>
      ))}
    </div>
  );
}

// A load curve from 0 to 1 as a line; each point names its hour and value on hover.
export function Sparkline({ values, from, w = 240, h = 44 }: { values: number[]; from: number; w?: number; h?: number }) {
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * (w - 4) + 2, y = (v: number) => h - 2 - v * (h - 4);
  const step = (w - 4) / Math.max(1, values.length - 1);
  return (
    <svg className="prd-spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Load over the day">
      <line x1={0} x2={w} y1={y(0)} y2={y(0)} className="base" />
      <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
      {values.map((v, i) => (
        <rect key={i} x={x(i) - step / 2} y={0} width={step} height={h} className="hit">
          <title>{`${formatClock(from + i).split(" · ")[1]}  ${Math.round(v * 100)}%`}</title>
        </rect>
      ))}
    </svg>
  );
}

export type VmState = "running" | "stopped" | "lost" | "restoring" | "migrating" | "down" | "frozen";
export const VM_STATE: Record<VmState, [string, string]> = {
  running: ["Running", "ok"], frozen: ["Frozen", "bad"], stopped: ["Stopped", ""], lost: ["Lost disk", "bad"], restoring: ["Restoring", "accent"], migrating: ["Migrating", "accent"], down: ["Down", "bad"],
};
export function vmState(game: GameState, w: Workload): VmState {
  if (lostDisk(game, w)) return "lost";
  if (w.busyUntil > game.hour) return game.lossReports.some((r) => r.items.some((i) => i.workloadId === w.id && i.restored)) ? "restoring" : "migrating";
  if (w.stopped) return "stopped";
  if (w.clusterId && w.deviceId && game.frozen.includes(w.deviceId)) return "frozen";
  return workloadOnline(game, w) ? "running" : "down";
}

const age = (at: number | null, lostAt: number) => (at === null ? "None" : `${lostAt - at} h old`);

// Every incident report with its lost disks, their customers and the age of each last backup.
export function IncidentReports({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const reports = [...game.lossReports].reverse();
  if (!reports.length) return <div className="fin-empty"><TriangleAlert />No incidents</div>;
  return (
    <div className="prd-pad">
      {reports.map((r) => {
        const d = game.devices.find((x) => x.id === r.deviceId);
        return (
          <section key={r.id} className="fin-card">
            <div className="fin-card-h"><TriangleAlert />{d ? devName(d) : r.deviceId} lost its disks<span className="grow" /><span className="num">{formatClock(r.hour)}</span></div>
            <table className="table">
              <thead><tr><th>Customer</th><th>Service</th><th className="r">Disk</th><th>Last backup</th><th>Status</th><th /></tr></thead>
              <tbody>
                {r.items.map((i) => {
                  const v = game.services.find((x) => x.id === i.serviceId), c = game.customers.find((x) => x.id === i.customerId);
                  const w = game.workloads.find((x) => x.id === i.workloadId), lost = !!w && lostDisk(game, w);
                  return (
                    <tr key={i.workloadId}>
                      <td>{c ? <CustomerLink id={c.id} name={c.name} /> : "?"}</td>
                      <td>{v?.label}</td>
                      <td className="r num">{disk(i.diskGb)}</td>
                      <td className="num">{age(i.backupAt, r.hour)}</td>
                      <td>
                        <span className="fin-pills">
                          <span className={`pill ${i.restored ? "ok" : "bad"}`}>{i.restored ? "Restored" : "Lost"}</span>
                        </span>
                      </td>
                      <td className="r">
                        <span className="fin-pills">
                          {lost && <button className="btn" onClick={() => act((g) => restoreWorkload(g, i.workloadId))}>{i.backupAt === null ? "Start empty" : "Restore"}</button>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

export function ControlPlanePill({ game, cluster }: { game: GameState; cluster: Cluster }) {
  const [tone, label] = cluster.switching ? ["accent", `Installing, ${cluster.switching.doneAt - game.hour} h left`]
    : !cluster.panel && !cluster.platform ? ["bad", "No control plane"]
    : controlPlaneUp(game, cluster) ? ["ok", "Control plane up"] : ["bad", "Control plane down"];
  return <span className={`pill ${tone}`}>{label}</span>;
}

// Who a VM belongs to and what it runs: a customer's service, or one of the player's panel hosts.
export function vmLabel(game: GameState, w: Workload): { name: string; service: string } {
  const host = hostOfVm(game, w.id);
  if (host) return { name: host.name, service: "Panel VM" };
  if (!w.serviceId) return { name: `vm-${w.id.replace(/\D/g, "")}`, service: "VM" };
  const v = game.services.find((x) => x.id === w.serviceId), c = game.customers.find((x) => x.id === v?.customerId);
  return { name: c?.name ?? "", service: v?.domain ?? v?.label ?? "" };
}

export const softwareName =(id: string | null) => (id ? softwareById(id).name : "None");
