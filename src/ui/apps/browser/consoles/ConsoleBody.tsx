import { useState, type ReactNode } from "react";
import { yearOf } from "../../../../sim/00-core/time";
import { SOFTWARE } from "../../../../sim/10-catalog/platforms";
import type { Resources } from "../../../../sim/10-catalog/products";
import type { GameState } from "../../../../sim/50-state";
import { hostOfVm, isOwnVm, vmById, workloadsOn, type Cluster, type Workload } from "../../../../sim/60-infra/cluster";
import { deviceHealth } from "../../../../sim/60-infra/status";
import { workloadUse } from "../../../../sim/60-infra/usage";
import { familyOf, openVulns } from "../../../../sim/60-infra/vulns";
import { consoleTitle, type ConsoleFeatures } from "../../../../sim/80-business/consoles";
import { mailImpaired, seatsFor } from "../../../../sim/80-business/mail";
import { createPanelVm, createVm, deleteVm, PANEL_VM_SIZE, removePanelHost, resizePanelVm } from "../../../../sim/90-actions/clusters";
import { setSitesOffline } from "../../../../sim/90-actions/security";
import { uninstallSoftware, updateDue, updateSoftware } from "../../../../sim/90-actions/software";
import { migrateWebspace, migrateWorkload, migrationTargets, restoreWorkload, startWorkload, stopWorkload, webspaceTargets } from "../../../../sim/90-actions/vms";
import { useStore } from "../../../store";
import { disk, ram } from "../../hw";
import { VM_STATE, vmLabel, vmState } from "../../products/parts";
import { hoursText } from "../../vms/migrate";

export type Tab = "objects" | "nodes" | "software";

export const objectsLabel = (f: ConsoleFeatures, c: Cluster): string =>
  f.look === "game" ? "Game servers" : f.look === "mail" ? "Mailboxes" : c.kind === "cloud" ? "Virtual machines" : "Web spaces";

const num = (n: number) => `${+n.toFixed(2)}`;
const pct = (used: number, of: number) => `${Math.min(100, of > 0 ? (used / of) * 100 : 0)}%`;

interface Props { game: GameState; c: Cluster; f: ConsoleFeatures }

function Resize({ game, host, done }: { game: GameState; host: Cluster; done: () => void }) {
  const act = useStore((s) => s.act), vm = vmById(game, host.vm)!;
  const [size, setSize] = useState<Resources>({ vcpu: vm.vcpu, ramGb: vm.ramGb, diskGb: vm.diskGb });
  const field = (key: keyof Resources, label: string) => (
    <label className="cx-field">{label}
      <input type="number" min={1} value={size[key]} onChange={(e) => setSize({ ...size, [key]: Number(e.target.value) })} />
    </label>
  );
  return (
    <div className="cx-inline">
      {field("vcpu", "vCPU")}{field("ramGb", "RAM, GB")}{field("diskGb", "Disk, GB")}
      <button className="cx-btn primary" onClick={() => act(resizePanelVm, host.id, size).ok && done()}>Resize</button>
      <button className="cx-btn" onClick={done}>Cancel</button>
    </div>
  );
}

// Targets with the hours they take; the player sees the hours before confirming.
function Migrate({ game, w, c, done }: { game: GameState; w: Workload; c: Cluster; done: () => void }) {
  const act = useStore((s) => s.act), hand = c.kind === "panel", [pick, setPick] = useState<string | null>(null);
  const clusterName = (id: string) => game.clusters.find((x) => x.id === id)?.name ?? "";
  const targets = hand
    ? webspaceTargets(game, w.id).map((t) => ({ key: t.clusterId, label: `${t.panel} on ${t.name}`, hours: t.hours, run: () => act(migrateWebspace, w.id, t.clusterId) }))
    : migrationTargets(game, w.id).map((t) => ({
      key: t.to, hours: t.down, run: () => act(migrateWorkload, w.id, t.to),
      label: t.clusterId === c.id ? t.name : `${t.name} · ${clusterName(t.clusterId)}`,
    }));
  const chosen = targets.find((t) => t.key === pick);
  const summary = !chosen ? "" : hand ? `The migration takes ${hoursText(chosen.hours)} and the site stays online.`
    : chosen.hours === 0 ? "The machine keeps running during the move." : `The machine is offline for ${hoursText(chosen.hours)}.`;
  return (
    <div className="cx-inline">
      {targets.length === 0 && <span>No host can take it.</span>}
      {targets.map((t) => <button key={t.key} className="cx-chip" aria-pressed={t.key === pick} onClick={() => setPick(t.key)}>{t.label}</button>)}
      {chosen && <span className="cx-note">{summary}</span>}
      {chosen && <button className="cx-btn primary" onClick={() => chosen.run().ok && done()}>Migrate</button>}
      <button className="cx-btn" onClick={done}>Cancel</button>
    </div>
  );
}

function Create({ game, c }: { game: GameState; c: Cluster }) {
  const act = useStore((s) => s.act), year = yearOf(game.hour);
  return (
    <div className="cx-tools">
      <button className="cx-btn primary" onClick={() => act(createVm, c.id, PANEL_VM_SIZE)}>New VM</button>
      {SOFTWARE.filter((x) => x.kind === "panel" && x.from <= year).map((x) => (
        <button key={x.id} className="cx-btn" onClick={() => act(createPanelVm, c.id, x.id)}>{x.console} VM</button>
      ))}
    </div>
  );
}

export function Objects({ game, c, f, node }: Props & { node: string | null }) {
  const act = useStore((s) => s.act), [open, setOpen] = useState<{ id: string; kind: "migrate" | "resize" } | null>(null);
  if (f.look === "mail") {
    const mine = game.company.mail.kind === "self" && game.company.mail.clusterId === c.id;
    return (
      <table className="cx-table">
        <tbody>
          <tr><th>Mailboxes</th><td className="num">{mine ? seatsFor(game) : 0}</td></tr>
          <tr><th>Delivery</th><td>{mine && mailImpaired(game) ? "Delayed" : "Normal"}</td></tr>
        </tbody>
      </table>
    );
  }
  const web = c.kind === "panel", rows = game.workloads.filter((w) => w.clusterId === c.id && (!node || w.deviceId === node));
  const close = () => setOpen(null);
  return (
    <>
      {f.create && c.kind === "cloud" && <Create game={game} c={c} />}
      <table className="cx-table">
        <thead><tr><th>{web ? "Domain" : "Name"}</th>{!web && <th>Node</th>}<th>Status</th><th>Usage</th><th /></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} className="cx-empty">Nothing here yet.</td></tr>}
          {rows.map((w) => {
            const st = vmState(game, w), [label, tone] = VM_STATE[st], u = workloadUse(game, w), host = hostOfVm(game, w.id);
            const on = st === "running" || st === "down" || st === "frozen", site = game.services.find((v) => v.id === w.serviceId);
            const d = game.devices.find((x) => x.id === w.deviceId), movable = (on || st === "stopped") && !w.migrating;
            const name = web ? site?.domain ?? w.hostname ?? "" : host?.name ?? w.hostname ?? vmLabel(game, w).name;
            const lead = web ? [u.diskGb, w.diskGb] : [u.vcpu, w.vcpu];
            return (
              <FragmentRow key={w.id} open={open?.id === w.id ? open : null} span={5} panel={(o) => (o.kind === "migrate"
                ? <Migrate game={game} w={w} c={c} done={close} /> : host && <Resize game={game} host={host} done={close} />)}>
                <td><b>{name}</b>{host && <span className="cx-sub">{host.panel && consoleTitle(host.panel)}</span>}</td>
                {!web && <td>{d ? d.hostname ?? d.label ?? d.name : ""}</td>}
                <td><span className={`cx-state ${tone}`}>{label}</span></td>
                <td>
                  <span className="cx-bar"><i style={{ width: pct(lead[0], lead[1]) }} /></span>
                  <span className="cx-use num">{web ? `${disk(Math.round(u.diskGb))} of ${disk(w.diskGb)}` : `${num(u.vcpu)} of ${w.vcpu} vCPU, ${ram(+u.ramGb.toFixed(1))} of ${ram(w.ramGb)}`}</span>
                </td>
                <td><div className="cx-acts">
                  {f.start && st === "stopped" && <button className="cx-btn" onClick={() => act(startWorkload, w.id)}>Start</button>}
                  {f.stop && on && <button className="cx-btn" onClick={() => act(stopWorkload, w.id)}>Stop</button>}
                  {st === "lost" && f.backups && <button className="cx-btn" onClick={() => act(restoreWorkload, w.id)}>{w.backupAt === null ? "Start empty" : "Restore"}</button>}
                  {f.migrate && movable && <button className="cx-btn" onClick={() => setOpen({ id: w.id, kind: "migrate" })}>Migrate</button>}
                  {f.resize && host && c.kind === "cloud" && <button className="cx-btn" onClick={() => setOpen({ id: w.id, kind: "resize" })}>Resize</button>}
                  {f.delete && c.kind === "cloud" && isOwnVm(w) && !host && <button className="cx-btn" onClick={() => act(deleteVm, w.id)}>Delete</button>}
                </div></td>
              </FragmentRow>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

// A table row that unfolds a second row with its open panel under it.
function FragmentRow<T>({ open, span, panel, children }: { open: T | null; span: number; panel: (o: T) => ReactNode; children: ReactNode }) {
  return (
    <>
      <tr>{children}</tr>
      {open && <tr className="cx-open"><td colSpan={span}>{panel(open)}</td></tr>}
    </>
  );
}

export function Nodes({ game, c }: { game: GameState; c: Cluster }) {
  return (
    <table className="cx-table">
      <thead><tr><th>Node</th><th>State</th><th>Health</th><th>Workloads</th></tr></thead>
      <tbody>
        {c.nodes.map((n) => {
          const d = game.devices.find((x) => x.id === n.deviceId);
          return (
            <tr key={n.deviceId}>
              <td><b>{d?.hostname ?? d?.name}</b>{d?.label && <span className="cx-sub">{d.label}</span>}</td>
              <td className="cx-cap">{n.state}</td>
              <td className="cx-cap">{d ? deviceHealth(game, d.id).state : ""}</td>
              <td className="num">{workloadsOn(game, n.deviceId).length}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function Software({ game, c, f }: Props) {
  const act = useStore((s) => s.act), [sizing, setSizing] = useState(false), [removing, setRemoving] = useState(false);
  const family = familyOf(c)!, year = yearOf(game.hour), vulns = openVulns(game, c.id).length, due = updateDue(game, c);
  const off = game.security.offline.includes(c.id), machine = c.vm ?? c.nodes[0]?.deviceId ?? "";
  const remove = () => (c.kind === "panel" ? act(removePanelHost, c.id) : act(uninstallSoftware, machine));
  return (
    <>
      <table className="cx-table cx-facts">
        <tbody>
          <tr><th>Software</th><td>{consoleTitle(family)}</td></tr>
          <tr><th>Version</th><td className="num">{c.version}</td></tr>
          <tr><th>Open vulnerabilities</th><td className="num">{vulns}</td></tr>
          {f.backups && <tr><th>Backups</th><td className="cx-cap">{c.backup.every}</td></tr>}
        </tbody>
      </table>
      <div className="cx-tools">
        {f.update && due && <button className="cx-btn primary" onClick={() => act(updateSoftware, c.id)}>{`Update to ${year}`}</button>}
        {f.update && !due && <span className="cx-note">Up to date</span>}
        {f.sitesOffline && c.kind === "panel" && <button className="cx-btn" onClick={() => act(setSitesOffline, c.id, !off)}>{off ? "Bring sites online" : "Take sites offline"}</button>}
        {f.resize && c.kind === "panel" && c.vm && <button className="cx-btn" onClick={() => setSizing(!sizing)}>Resize</button>}
        {f.delete && !removing && <button className="cx-btn" onClick={() => setRemoving(true)}>Remove host</button>}
        {removing && <button className="cx-btn danger" onClick={remove}>Confirm remove</button>}
        {removing && <button className="cx-btn" onClick={() => setRemoving(false)}>Cancel</button>}
      </div>
      {sizing && c.vm && <Resize game={game} host={c} done={() => setSizing(false)} />}
    </>
  );
}
