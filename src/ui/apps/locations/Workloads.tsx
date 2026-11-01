import { Cpu, Globe, HardDrive, MemoryStick } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Resources } from "../../../sim/10-catalog/products";
import type { GameState } from "../../../sim/50-state";
import { softwareById } from "../../../sim/10-catalog/platforms";
import { clusterOf, controlPlaneUse, workloadsOn, type Workload } from "../../../sim/60-infra/cluster";
import { pegged, workloadUse } from "../../../sim/60-infra/usage";
import { siteHost } from "../../../sim/80-business/website";
import { migrateWorkload, migrationTargets, startWorkload, stopWorkload } from "../../../sim/90-actions/vms";
import { announceEntries, migrateEntries, offerEntries, rescueEntries } from "../workload-menu";
import { menuOn, type MenuEntry } from "../../desktop/ContextMenu";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { More } from "../More";
import { useHandWork, type HandTask } from "./HandSheet";
import { consoleEntry, VM_STATE, vmLabel, vmState } from "../products/parts";

type Sort = "vcpu" | "ramGb" | "diskGb";
const SORTS: [Sort, string][] = [["vcpu", t("locations-2.sort.cpu")], ["ramGb", t("locations-2.sort.ram")], ["diskGb", t("locations-2.sort.disk")]];
const num = (n: number) => `${+n.toFixed(n < 1 ? 2 : n < 10 ? 1 : 0)}`;
const HOT = 0.9;

// Use against the workload's booking: a small bar and the figures.
function Gauge({ icon, used, max, unit, label, fixed }: { icon: ReactNode; used: number; max: number; unit: string; label: string; fixed?: boolean }) {
  const share = max ? used / max : 0;
  return (
    <span className={`wl-gauge${share >= HOT && !fixed ? " hot" : ""}`} aria-label={t("locations-2.gaugeLabel", { label, used: num(used), max: num(max), unit })}>
      {icon}
      <span className="wl-gauge-bar"><span style={{ width: `${Math.min(100, share * 100)}%` }} /></span>
      <span className="num">{num(used)}/{num(max)} {unit}</span>
    </span>
  );
}

const share = (u: Resources, w: Workload, k: Sort) => (w[k] ? u[k] / w[k] : 0);

// The workloads of a cluster node, busiest first, each with a menu to move, stop or start it or open its web console.
export function NodeWorkloads({ game, deviceId }: { game: GameState; deviceId: string }) {
  const [sort, setSort] = useState<Sort>("vcpu");
  const loads = workloadsOn(game, deviceId).filter((w) => w.clusterId).map((w) => ({ w, u: workloadUse(game, w) }));
  const c = clusterOf(game, deviceId), cpId = c?.controlPlane === deviceId ? c.panel ?? c.platform : null;
  if (!loads.length && !cpId) return null;
  loads.sort((a, b) => share(b.u, b.w, sort) - share(a.u, a.w, sort) || b.u[sort] - a.u[sort]);
  return (
    <>
      <div className="loc-card-h loc-sub">
        <h3>{t("locations-2.workloads")}</h3>
        <span className="num loc-muted">{loads.length + (cpId ? 1 : 0)}</span>
        <span className="grow" />
        {announceEntries(game, deviceId).length > 0 && <More label={t("locations-2.workloadsLower")} entries={() => announceEntries(game, deviceId)} />}
        <div className="seg" role="group" aria-label={t("locations-2.sortBy")}>
          {SORTS.map(([k, label]) => <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>)}
        </div>
      </div>
      {cpId && <ControlPlaneRow name={softwareById(cpId).name} u={controlPlaneUse(c!)} web={consoleEntry(game, c!.id)} />}
      {loads.map(({ w, u }) => <WorkloadRow key={w.id} game={game} w={w} u={u} />)}
    </>
  );
}

// The cluster's management services take a fixed share of the node that runs them.
function ControlPlaneRow({ name, u, web }: { name: string; u: Resources; web: MenuEntry | false }) {
  return (
    <div className="wl-row">
      <div className="wl-line">
        <span className="wl-name">{t("locations-2.controlPlane")}</span>
        <span className="loc-muted wl-service">{name}</span>
        {web && <button className="btn ghost icon" aria-label={t("locations-2.openName", { name })} title={t("locations-2.openName", { name })} onClick={web.run}><Globe /></button>}
      </div>
      <div className="wl-gauges">
        <Gauge icon={<Cpu />} label={t("locations-2.sort.cpu")} used={u.vcpu} max={u.vcpu} unit="vCPU" fixed />
        <Gauge icon={<MemoryStick />} label={t("locations-2.sort.ram")} used={u.ramGb} max={u.ramGb} unit="GB" fixed />
        <Gauge icon={<HardDrive />} label={t("locations-2.sort.disk")} used={u.diskGb} max={u.diskGb} unit="GB" fixed />
      </div>
    </div>
  );
}

function WorkloadRow({ game, w, u }: { game: GameState; w: Workload; u: Resources }) {
  const { name, service } = vmLabel(game, w);
  const st = vmState(game, w), [label, tone] = VM_STATE[st];
  const hot = st === "running" && pegged(game, w);
  const hand = useHandWork();
  const entries = () => workloadMenu(game, w, hand.start);
  const site = w.serviceId ? siteHost(game, w.serviceId) : null;
  return (
    <div className="wl-row" onContextMenu={menuOn(entries)}>
      <div className="wl-line">
        <span className="wl-name">{name}</span>
        {site
          ? <button className="loc-link wl-service num" onClick={() => useStore.getState().openApp("Browser", { kind: "url", id: `http://${site}/` })}>{site}</button>
          : <span className="loc-muted wl-service">{service}</span>}
        <span className="grow" />
        {hot && <span className="pill warn">{t("locations-2.pegged")}</span>}
        {st !== "running" && <span className={`pill ${tone}`}>{label}</span>}
        <More label={service} entries={entries} />
      </div>
      <div className="wl-gauges">
        <Gauge icon={<Cpu />} label={t("locations-2.sort.cpu")} used={u.vcpu} max={w.vcpu} unit="vCPU" />
        <Gauge icon={<MemoryStick />} label={t("locations-2.sort.ram")} used={u.ramGb} max={w.ramGb} unit="GB" />
        <Gauge icon={<HardDrive />} label={t("locations-2.sort.disk")} used={u.diskGb} max={w.diskGb} unit="GB" />
      </div>
      {hand.dialog}
    </div>
  );
}

// A workload's actions: move it to a node with room or recover it by hand, stop or start it, or open it elsewhere.
export function workloadMenu(game: GameState, w: Workload, start: (game: GameState, t: HandTask) => void): MenuEntry[] {
  const { act, openApp } = useStore.getState();
  const web = game.clusters.find((c) => c.id === w.clusterId)?.kind === "panel";
  const targets = web ? [] : migrationTargets(game, w.id), rescue = rescueEntries(game, w, start);
  const customer = game.services.find((v) => v.id === w.serviceId)?.customerId;
  return [
    ...rescue,
    ...(web ? migrateEntries(game, w) : rescue.length ? [] : [{ label: t("locations-2.migrateTo"), disabled: !targets.length, items: targets.map((x) => ({ label: x.down ? t("locations-2.targetOffline", { name: x.name, h: x.down }) : x.name, run: () => act(migrateWorkload, w.id, x.to) })) }]),
    ...offerEntries(game, w),
    w.stopped ? { label: t("locations-2.start"), run: () => act(startWorkload, w.id) } : { label: t("locations-2.stop"), run: () => act(stopWorkload, w.id) },
    null,
    consoleEntry(game, w.clusterId),
    !!customer && { label: t("locations-2.openCustomer"), run: () => openApp("Customers", { kind: "customer", id: customer }) },
  ];
}

