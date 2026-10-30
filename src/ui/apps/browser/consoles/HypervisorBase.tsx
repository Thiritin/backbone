// docs/design/software.md, section 9: what every hypervisor console offers, as blocks each product lays out its own way.
import { useState, type ReactNode } from "react";
import { euroCents } from "../../../../sim/00-core/money";
import { formatClock, yearOf } from "../../../../sim/00-core/time";
import { SOFTWARE, softwareById } from "../../../../sim/10-catalog/platforms";
import type { Resources } from "../../../../sim/10-catalog/products";
import { HA_SKILL } from "../../../../sim/10-catalog/research";
import { APP_SUITE_FEE, licensingAt, serverOsAt, serverOsById, type ServerOsId } from "../../../../sim/10-catalog/server-os";
import type { GameState } from "../../../../sim/50-state";
import { privateIp } from "../../../../sim/60-infra/addresses";
import { hostOfVm, isOwnVm, workloadsOn, type Cluster, type Ha, type Workload } from "../../../../sim/60-infra/cluster";
import { deviceHealth } from "../../../../sim/60-infra/status";
import { nodeUsage, workloadUse } from "../../../../sim/60-infra/usage";
import { consoleTitle, type ConsoleFeatures } from "../../../../sim/80-business/consoles";
import { setMedia } from "../../../../sim/90-actions/console";
import { addNode, createVm, deleteVm, PANEL_VM_SIZE, removeNode, resizeVm, setHa } from "../../../../sim/90-actions/clusters";
import { mountableImages } from "../../../../sim/90-actions/media";
import { joinableServers } from "../../../../sim/90-actions/software";
import { buyAppSuite, cancelAppSuite, deployFromSuite } from "../../../../sim/90-actions/suite";
import { rescueTargets, rescueWorkload, restoreWorkload, startWorkload, stopWorkload } from "../../../../sim/90-actions/vms";
import { useStore } from "../../../store";
import { day, disk, ram } from "../../hw";
import { useHandWork } from "../../locations/HandSheet";
import { VM_STATE, vmLabel, vmState, type VmState } from "../../products/parts";
import { Bar, Migrate, Resize, type Fact, type PanelAction } from "./PanelBase";
import "./hypervisor.css";

// Toolbar glyphs; the consoles draw no images.
export const GLYPH: Record<string, string> = {
  start: "▶", stop: "■", reset: "↻", restore: "⟲", recover: "⛑", migrate: "⇄", resize: "⤢", console: "▣", delete: "✕", create: "✚",
};

export interface Vm {
  w: Workload; id: string; name: string; sub: string; st: VmState; state: string; tone: string; own: boolean;
  node: string; ip: string; os: string; media: ServerOsId | null; use: Resources; actions: PanelAction[]; panel: ReactNode;
}

const num = (n: number) => `${+n.toFixed(2)}`;
const nodeName = (game: GameState, id: string | null) => { const d = game.devices.find((x) => x.id === id); return d ? d.hostname ?? d.label ?? d.name : ""; };
export const osText = (w: Workload) => (w.os ? `${serverOsById(w.os.id).name} ${w.os.version}` : "None");
export const isoName = (id: ServerOsId, year: number) => `${id}-${serverOsAt(id, year).version}.iso`.replace(/\s+/g, "-").toLowerCase();

// An own VM's size, changed through resizeVm.
function SizeForm({ w, done }: { w: Workload; done: () => void }) {
  const act = useStore((s) => s.act), [size, setSize] = useState<Resources>({ vcpu: w.vcpu, ramGb: w.ramGb, diskGb: w.diskGb });
  return (
    <div className="cx-inline">
      <SizeFields size={size} set={setSize} />
      <button className="cx-btn primary" onClick={() => act(resizeVm, w.id, size).ok && done()}>Resize</button>
      <button className="cx-btn" onClick={done}>Cancel</button>
    </div>
  );
}

export function SizeFields({ size, set, labels = ["vCPU", "Memory, GB", "Disk, GB"], only }: { size: Resources; set: (r: Resources) => void; labels?: [string, string, string]; only?: keyof Resources }) {
  const keys: (keyof Resources)[] = ["vcpu", "ramGb", "diskGb"];
  return <>{keys.map((k, i) => (!only || only === k) && (
    <label key={k} className="cx-field">{labels[i]}<input type="number" min={1} value={size[k]} onChange={(e) => set({ ...size, [k]: Number(e.target.value) })} /></label>
  ))}</>;
}

// Every VM of the cluster with the actions its state allows; panel is the open form under it, dialog the hand work popover.
export function useVms(game: GameState, c: Cluster, f: ConsoleFeatures): { vms: Vm[]; dialog: ReactNode } {
  const act = useStore((s) => s.act), openConsole = useStore((s) => s.openConsole), hand = useHandWork();
  const [open, setOpen] = useState<{ id: string; kind: string } | null>(null), close = () => setOpen(null);
  const vms = game.workloads.filter((w) => w.clusterId === c.id).map((w): Vm => {
    const st = vmState(game, w), [state, tone] = VM_STATE[st], host = hostOfVm(game, w.id), own = isOwnVm(w), label = vmLabel(game, w);
    const on = st === "running" || st === "down" || st === "frozen", rescue = rescueTargets(game, w.id);
    const toggle = (kind: string) => () => setOpen(open?.id === w.id && open.kind === kind ? null : { id: w.id, kind });
    const actions: (PanelAction | false)[] = [
      f.start && st === "stopped" && { id: "start", label: "Start", run: () => act(startWorkload, w.id) },
      f.stop && on && { id: "stop", label: "Shutdown", run: () => act(stopWorkload, w.id) },
      f.stop && on && own && { id: "reset", label: "Reset", run: () => { if (act(stopWorkload, w.id).ok) act(startWorkload, w.id); } },
      st === "lost" && { id: "restore", label: w.backupAt === null ? "Start empty" : "Restore", run: () => act(restoreWorkload, w.id) },
      rescue.length > 0 && { id: "recover", label: "Recover", run: toggle("recover") },
      !!f.migrate && (on || st === "stopped") && !w.migrating && { id: "migrate", label: "Migrate", run: toggle("migrate") },
      f.resize && own && { id: "resize", label: "Resize", run: toggle("resize") },
      own && { id: "console", label: "Console", run: () => openConsole(w.id) },
      f.delete && own && !host && { id: "delete", label: "Delete", tone: "danger", run: toggle("delete") },
    ];
    const kind = open?.id === w.id ? open.kind : null;
    const panel = kind === "migrate" ? <Migrate game={game} w={w} c={c} done={close} />
      : kind === "resize" ? (host ? <Resize game={game} host={host} done={close} /> : <SizeForm w={w} done={close} />)
      : kind === "delete" ? (
        <div className="cx-inline">
          <button className="cx-btn danger" onClick={() => act(deleteVm, w.id).ok && close()}>Delete {label.name}</button>
          <button className="cx-btn" onClick={close}>Cancel</button>
        </div>
      ) : kind === "recover" ? (
        <div className="cx-inline">
          {rescue.map((t) => (
            <button key={t.to} className="cx-chip" onClick={() => { hand.start(game, { title: `Recover ${label.name} to ${t.name}`, deviceId: w.deviceId!, action: rescueWorkload, args: [w.id, t.to] }); close(); }}>
              {t.name}, offline {t.down} h
            </button>
          ))}
          <button className="cx-btn" onClick={close}>Cancel</button>
        </div>
      ) : null;
    return {
      w, id: w.id, st, state, tone, own, name: host?.name ?? label.name, sub: own ? (host ? consoleTitle(host.panel ?? host.platform ?? "") : "") : label.service,
      node: nodeName(game, w.deviceId), ip: privateIp(game, w.id) ?? "", os: own ? osText(w) : "", media: w.media ?? null,
      use: workloadUse(game, w), actions: actions.filter((a): a is PanelAction => !!a), panel,
    };
  });
  return { vms, dialog: hand.dialog };
}

export const cpuUse = (v: Vm): [number, number] => [v.use.vcpu, v.w.vcpu];
export const ramUse = (v: Vm): [number, number] => [v.use.ramGb, v.w.ramGb];
export const diskUse = (v: Vm): [number, number] => [v.use.diskGb, v.w.diskGb];
export const cpuText = (v: Vm) => `${num(v.use.vcpu)} of ${v.w.vcpu} vCPU`;
export const ramText = (v: Vm) => `${ram(+v.use.ramGb.toFixed(1))} of ${ram(v.w.ramGb)}`;
export const diskText = (v: Vm) => `${disk(Math.round(v.use.diskGb))} of ${disk(v.w.diskGb)}`;

// The facts a VM page lists; each console picks and labels its own.
export function vmFacts(game: GameState, v: Vm): Record<"status" | "node" | "ip" | "os" | "cpu" | "memory" | "disk" | "backup" | "media", Fact> {
  return {
    status: { label: "Status", value: v.state }, node: { label: "Node", value: v.node }, ip: { label: "IP address", value: v.ip || "None", num: true },
    os: { label: "Guest OS", value: v.own ? v.os : v.sub }, cpu: { label: "Processors", value: `${v.w.vcpu} vCPU`, num: true },
    memory: { label: "Memory", value: ram(+v.w.ramGb.toFixed(2)), num: true }, disk: { label: "Hard disk", value: disk(v.w.diskGb), num: true },
    backup: { label: "Last backup", value: v.w.backupAt === null ? "None" : day(v.w.backupAt), num: true },
    media: { label: "CD/DVD drive", value: v.media ? isoName(v.media, yearOf(game.hour)) : "Empty", num: !!v.media },
  };
}

// The ISO loaded in an own VM, picked from the downloaded images.
export function MediaMenu({ game, v, label = "Media", none = "No media", className = "cx-field" }: { game: GameState; v: Vm; label?: string; none?: string; className?: string }) {
  const act = useStore((s) => s.act), year = yearOf(game.hour);
  if (!v.own) return null;
  return (
    <label className={className}>{label}
      <select value={v.media ?? ""} onChange={(e) => act(setMedia, v.id, (e.target.value || null) as ServerOsId | null)}>
        <option value="">{none}</option>
        {mountableImages(game).map((o) => <option key={o.id} value={o.id}>{isoName(o.id, year)}</option>)}
      </select>
    </label>
  );
}

export interface Step { id: string; label: string; body: ReactNode }

// The new VM a wizard books: its size, the ISO it boots and, on a VMwhere cluster with the App Suite, the software it
// deploys with. create returns the new VM's id.
export function useNewVm(game: GameState, c: Cluster) {
  const act = useStore((s) => s.act), [size, setSize] = useState<Resources>(PANEL_VM_SIZE);
  const [iso, setIso] = useState<ServerOsId | "">(""), [suite, setSuite] = useState<string | null>(null);
  const create = (): string | null => {
    const r = suite ? act(deployFromSuite, c.id, size, suite) : act(createVm, c.id, size);
    if (!r.ok || !r.id) return null;
    if (suite) return useStore.getState().game.clusters.find((x) => x.id === r.id)?.vm ?? null;
    if (iso) act(setMedia, r.id, iso);
    return r.id;
  };
  const isoPick = (label = "ISO image", none = "Do not use any media") => (
    <label className="cx-field">{label}
      <select value={iso} onChange={(e) => setIso(e.target.value as ServerOsId | "")}>
        <option value="">{none}</option>
        {mountableImages(game).map((o) => <option key={o.id} value={o.id}>{isoName(o.id, yearOf(game.hour))}</option>)}
      </select>
    </label>
  );
  return { size, setSize, iso, isoLabel: iso ? isoName(iso, yearOf(game.hour)) : null, isoPick, suite, setSuite, create };
}

// A step wizard: the step list or tab row, the current step, Back, Next and the finish button on the last step.
export function Wizard({ title, steps, finish, onFinish, onCancel, numbered = false, className = "" }: {
  title: string; steps: Step[]; finish: string; onFinish: () => void; onCancel: () => void; numbered?: boolean; className?: string;
}) {
  const [at, setAt] = useState(0), last = at === steps.length - 1, step = steps[Math.min(at, steps.length - 1)];
  return (
    <div className={`cx-wiz ${className}`}>
      <div className="cx-wiz-title">{title}</div>
      <div className="cx-wiz-body">
        <ol className="cx-wiz-steps">
          {steps.map((s, i) => <li key={s.id}><button aria-pressed={i === at} onClick={() => setAt(i)}>{numbered ? `${i + 1} ` : ""}{s.label}</button></li>)}
        </ol>
        <div className="cx-wiz-page"><h3>{step.label}</h3>{step.body}</div>
      </div>
      <div className="cx-wiz-foot">
        <button className="cx-btn" onClick={onCancel}>Cancel</button>
        <button className="cx-btn" disabled={at === 0} onClick={() => setAt(at - 1)}>Back</button>
        {last ? <button className="cx-btn primary" onClick={onFinish}>{finish}</button> : <button className="cx-btn primary" onClick={() => setAt(at + 1)}>Next</button>}
      </div>
    </div>
  );
}

// The software the App Suite deploys this year: everything that is not a hypervisor, with the OS it comes on.
export const suiteSoftware = (year: number) => SOFTWARE.filter((x) => x.kind !== "cloud" && x.from <= year);
export const windoorsLicence = (year: number) => { const e = licensingAt(serverOsById("windoors"), year); return `${euroCents(e.fee)} ${e.kind === "core" ? "per core" : "per socket once"}`; };

// The App Suite tile: bought and cancelled per cluster, with its monthly fee.
export function AppSuiteTile({ c, className = "cx-suite" }: { c: Cluster; className?: string }) {
  const act = useStore((s) => s.act);
  if (c.platform !== "vmwhere") return null;
  return (
    <div className={className}>
      <b>VMwhere App Suite</b>
      <span className="num">{euroCents(APP_SUITE_FEE)} per month</span>
      <span>{c.appSuite ? "Active" : "Not purchased"}</span>
      {c.appSuite
        ? <button className="cx-btn" onClick={() => act(cancelAppSuite, c.id)}>Cancel subscription</button>
        : <button className="cx-btn primary" onClick={() => act(buyAppSuite, c.id)}>Buy</button>}
    </div>
  );
}

// The nodes with their usage; where the hypervisor clusters this year, Add node, Remove node and the HA flags.
export function NodeList({ game, c, f, className = "cx-table" }: { game: GameState; c: Cluster; f: ConsoleFeatures; className?: string }) {
  const act = useStore((s) => s.act), join = f.cluster ? joinableServers(game, c.id) : [], [adding, setAdding] = useState(false);
  const ha = f.cluster && game.unlocks.includes(HA_SKILL);
  const flags: [keyof Ha, string][] = [["live", "Live migration"], ["balance", "Load balancing"], ["failover", "Failover"]];
  return (
    <>
      <table className={className}>
        <thead><tr><th>Node</th><th>Status</th><th>CPU</th><th>Memory</th><th>VMs</th>{f.cluster && <th />}</tr></thead>
        <tbody>
          {c.nodes.map((n) => {
            const u = nodeUsage(game, n.deviceId), vms = workloadsOn(game, n.deviceId).length;
            return (
              <tr key={n.deviceId}>
                <td><b>{nodeName(game, n.deviceId)}</b></td>
                <td className="cx-cap">{n.state === "active" ? deviceHealth(game, n.deviceId).state : n.state}</td>
                <td><Bar use={[u.used.vcpu, u.physical.vcpu]} /><span className="cx-use num">{num(u.used.vcpu)} of {u.physical.vcpu}</span></td>
                <td><Bar use={[u.used.ramGb, u.physical.ramGb]} /><span className="cx-use num">{ram(+u.used.ramGb.toFixed(1))} of {ram(u.physical.ramGb)}</span></td>
                <td className="num">{vms}</td>
                {f.cluster && <td>{c.nodes.length > 1 && vms === 0 && <button className="cx-btn" onClick={() => act(removeNode, n.deviceId)}>Remove node</button>}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      {f.cluster && (
        <div className="cx-tools">
          <button className="cx-btn primary" aria-pressed={adding} onClick={() => setAdding(!adding)}>Add node</button>
          {adding && join.length === 0 && <span className="cx-note">No servers</span>}
          {adding && join.map((d) => <button key={d} className="cx-chip" onClick={() => act(addNode, c.id, d).ok && setAdding(false)}>{nodeName(game, d)}</button>)}
        </div>
      )}
      {ha && (
        <div className="cx-tools cx-ha">
          {flags.map(([k, label]) => (
            <label key={k} className="cx-check"><input type="checkbox" checked={c.ha[k]} onChange={(e) => act(setHa, c.id, k, e.target.checked)} />{label}</label>
          ))}
        </div>
      )}
    </>
  );
}

export interface Task { key: string; at: number; text: string; status: string; tone: string }

// The task log: the cluster's software install or update, VMs being moved or restored, and disks its nodes lost.
export function tasks(game: GameState, c: Cluster, vms: Vm[]): Task[] {
  const nodes = new Set(c.nodes.map((n) => n.deviceId));
  const out: Task[] = [
    ...(c.switching ? [{ key: "sw", at: c.switching.doneAt, text: `Install ${softwareById(c.switching.to).name}`, status: "Running", tone: "accent" }] : []),
    ...vms.filter((v) => v.st === "migrating" || v.st === "restoring").map((v) => ({ key: v.id, at: v.w.migrating?.doneAt ?? v.w.busyUntil, text: `${v.state} ${v.name}`, status: "Running", tone: "accent" })),
    ...game.lossReports.filter((r) => nodes.has(r.deviceId)).map((r) => ({ key: r.id, at: r.hour, text: `${nodeName(game, r.deviceId)} lost its disks`, status: "Error", tone: "bad" })),
  ];
  return out.sort((a, b) => b.at - a.at).slice(0, 8);
}

export function TaskLog({ game, c, vms, title, className = "cx-tasks" }: { game: GameState; c: Cluster; vms: Vm[]; title: string; className?: string }) {
  const list = tasks(game, c, vms);
  return (
    <section className={className}>
      <h4>{title}</h4>
      <table>
        <thead><tr><th>Time</th><th>Task</th><th>Status</th></tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={3} className="cx-empty">No tasks</td></tr>}
          {list.map((t) => <tr key={t.key}><td className="num">{formatClock(t.at)}</td><td>{t.text}</td><td><span className={`cx-state ${t.tone}`}>{t.status}</span></td></tr>)}
        </tbody>
      </table>
    </section>
  );
}

// Glyph toolbar buttons for a VM's actions.
export function Toolbar({ actions, className = "cx-toolbar", labels = {} }: { actions: PanelAction[]; className?: string; labels?: Record<string, string> }) {
  return <div className={className}>{actions.map((a) => <button key={a.id} className={a.tone ?? ""} onClick={a.run}><i aria-hidden>{GLYPH[a.id] ?? "•"}</i>{labels[a.id] ?? a.label}</button>)}</div>;
}

// CPU, memory and disk of a VM as labelled bars.
export function UsageBars({ v, labels = ["CPU", "Memory", "Disk"] }: { v: Vm; labels?: [string, string, string] }) {
  const rows: [string, [number, number], string][] = [[labels[0], cpuUse(v), cpuText(v)], [labels[1], ramUse(v), ramText(v)], [labels[2], diskUse(v), diskText(v)]];
  return <div className="cx-hv-bars">{rows.map(([l, u, t]) => <span key={l} style={{ display: "contents" }}><span>{l}</span><Bar use={u} /><span className="num">{t}</span></span>)}</div>;
}

// What a console has selected: the whole cluster, one node, one VM, or the new VM wizard.
export type Sel = { kind: "all" } | { kind: "node"; id: string } | { kind: "vm"; id: string } | { kind: "new" };
export const ALL: Sel = { kind: "all" };
