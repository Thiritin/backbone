// docs/design/software.md, section 10: what every console offers, as blocks each product lays out in its own chrome.
import { ChangePackage, planChoices } from "./PackageForms";
import { t } from "../../../../i18n/en";
import { ArrowRightLeft, CalendarClock, Circle, Code, Gamepad2, Maximize2, Pause, Play, PowerOff, RefreshCw, RotateCcw, Square, Terminal, Trash2, X, type LucideIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { yearOf } from "../../../../sim/00-core/time";
import { GAME_UNIT, NEVER, titleById } from "../../../../sim/10-catalog/games";
import { daemonOffline } from "../../../../sim/60-infra/daemons";
import { gameCrashed, gameOf, playersOf } from "../../../../sim/60-infra/games";
import { GameDetails, GameLine, TitlesSummary, type GameRow } from "./GamePanel";
import { autoUpdates, phpAt, softwareById } from "../../../../sim/10-catalog/platforms";
import type { Resources } from "../../../../sim/10-catalog/products";
import type { Look } from "../../../../sim/10-catalog/sites";
import type { GameState } from "../../../../sim/50-state";
import { backupTargets, hostOfVm, isOwnVm, vmById, workloadsOn, type BackupEvery, type Cluster, type Workload } from "../../../../sim/60-infra/cluster";
import { deviceHealth } from "../../../../sim/60-infra/status";
import { workloadUse } from "../../../../sim/60-infra/usage";
import { familyOf, openVulns } from "../../../../sim/60-infra/vulns";
import { accountUse, evcWarning, levelOf } from "../../../../sim/80-business/readouts";
import { consoleTitle, type ConsoleFeatures } from "../../../../sim/80-business/consoles";
import { deleteVm, phpDue, removePanelHost, resizePanelVm, setBackup, upgradePhp } from "../../../../sim/90-actions/clusters";
import { setSitesOffline } from "../../../../sim/90-actions/security";
import { setAutoUpdate, uninstallSoftware, updateDue, updateSoftware } from "../../../../sim/90-actions/software";
import { migrateWebspace, migrateWorkload, migrationTargets, restoreWorkload, startWorkload, stopWorkload, webspaceTargets } from "../../../../sim/90-actions/vms";
import { useStore } from "../../../store";
import { usePageAct } from "../pageAct";
import { disk, ram } from "../../hw";
import { VM_STATE, vmLabel, vmState } from "../../products/parts";
import { hoursText } from "../../workload-menu";
import { useHolds } from "./Holds";
import { HostSettings } from "./HostSettings";
import { eraOf } from "../sites/era";
import { noAutofill } from "../../../no-autofill";
import { lookOf, panelMachine } from "../../../../sim/60-infra/licence";

export type Tab = "objects" | "nodes" | "restore" | "software" | "tasks" | "logs" | "licence" | "services" | "sysinfo" | "packages" | "create" | "easyapache" | "custombuild" | "resellers" | "autossl" | "transfer" | "fail2ban" | "toolkit" | "messages" | "wings";

// What ConsolePage hands a product console; the console draws its own login while signedIn is false.
export interface PanelProps { game: GameState; c: Cluster; f: ConsoleFeatures; host: string; signedIn: boolean; login: () => void; logout: () => void;
  // The address inside the console, which opens the create form or the packages screen.
  path?: string }

export const erasFrom = (early: number, late: number): { from: number; look: Look }[] => [{ from: early, look: "early" }, { from: late, look: "late" }];
// The look of the installed version, or the game year's when the version is unknown.
export function eraAt(eras: { from: number; look: Look }[], { game, c }: { game: GameState; c: Cluster }): Look {
  const m = panelMachine(c), product = familyOf(c);
  return (m && product && lookOf(game, m, product)) || eraOf(eras, yearOf(game.hour));
}

export function usePanelTab(f: ConsoleFeatures, first: Tab = "objects"): [Tab, (t: Tab) => void] {
  const [tab, setTab] = useState<Tab>(first);
  return [tab === "nodes" && !f.cluster ? "objects" : tab, setTab];
}

export interface PanelAction { id: string; label: string; run: () => void; tone?: "primary" | "danger" }

const ICON: Record<string, LucideIcon> = {
  update: RefreshCw, auto: CalendarClock, php: Code, offline: PowerOff, resize: Maximize2, remove: Trash2, confirm: Trash2, cancel: X,
  manage: Gamepad2, hold: Pause, unhold: Play, terminate: Trash2, start: Play, stop: Square, restore: RotateCcw, migrate: ArrowRightLeft, console: Terminal, delete: Trash2,
};
export const ActionIcon = ({ id, size }: { id: string; size?: number }) => { const I = ICON[id] ?? Circle; return <I size={size} aria-hidden />; };

// Actions as icon tiles: the glyph above its label.
export function Tiles({ actions, className = "cx-tiles" }: { actions: PanelAction[]; className?: string }) {
  return <div className={className}>{actions.map((a) => <button key={a.id} className={`cx-tile ${a.tone ?? ""}`} onClick={a.run}><ActionIcon id={a.id} size={28} /><span>{a.label}</span></button>)}</div>;
}

export function Actions({ actions, className = "cx-tools", children }: { actions: PanelAction[]; className?: string; children?: ReactNode }) {
  return <div className={className}>{children}{actions.map((a) => <button key={a.id} className={`cx-btn ${a.tone ?? ""}`} onClick={a.run}>{a.label}</button>)}</div>;
}

export function LoginForm({ onLogin, button, className, children }: { onLogin: () => void; button: string; className?: string; children?: ReactNode }) {
  return (
    <form className={className} onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
      {children}
      <label className="cx-field">{t("browser-consoles-2.username")}<input defaultValue="admin" {...noAutofill} /></label>
      <label className="cx-field">{t("browser-consoles-2.password")}<input type="password" defaultValue="correcthorse" {...noAutofill} /></label>
      <button className="cx-btn primary" type="submit">{button}</button>
    </form>
  );
}

const pct = (used: number, of: number) => `${Math.min(100, of > 0 ? (used / of) * 100 : 0)}%`;
export const Bar = ({ use: [used, of] }: { use: [number, number] }) => <span className="cx-bar" data-level={levelOf(used, of)}><i style={{ width: pct(used, of) }} /></span>;
const num = (n: number) => `${+n.toFixed(2)}`;

export function Resize({ game, host, done }: { game: GameState; host: Cluster; done: () => void }) {
  const act = usePageAct(), vm = vmById(game, host.vm)!;
  const [size, setSize] = useState<Resources>({ vcpu: vm.vcpu, ramGb: vm.ramGb, diskGb: vm.diskGb });
  const field = (key: keyof Resources, label: string) => (
    <label className="cx-field">{label}
      <input type="number" min={1} value={size[key]} onChange={(e) => setSize({ ...size, [key]: Number(e.target.value) })} />
    </label>
  );
  return (
    <div className="cx-inline">
      {field("vcpu", "vCPU")}{field("ramGb", t("browser-consoles-2.ramGb"))}{field("diskGb", t("browser-consoles-2.diskGb"))}
      <button className="cx-btn primary" onClick={() => act(resizePanelVm, host.id, size).ok && done()}>{t("browser-consoles-2.resize")}</button>
      <button className="cx-btn" onClick={done}>{t("browser-consoles-2.cancel")}</button>
    </div>
  );
}

// Targets with the hours they take; the player sees the hours before confirming.
export function Migrate({ game, w, c, done }: { game: GameState; w: Workload; c: Cluster; done: () => void }) {
  const act = usePageAct(), hand = c.kind === "panel", [pick, setPick] = useState<string | null>(null);
  const clusterName = (id: string) => game.clusters.find((x) => x.id === id)?.name ?? "";
  const targets = hand
    ? webspaceTargets(game, w.id).map((x) => ({ key: x.clusterId, label: t("browser-consoles-2.webspaceTarget", { panel: x.panel, name: x.name }), hours: x.hours, evc: false, run: () => act(migrateWebspace, w.id, x.clusterId) }))
    : migrationTargets(game, w.id).map((x) => ({
      key: x.to, hours: x.down, run: () => act(migrateWorkload, w.id, x.to),
      label: x.clusterId === c.id ? x.name : `${x.name} · ${clusterName(x.clusterId)}`,
      evc: evcWarning(game, w, x.to),
    }));
  const chosen = targets.find((t) => t.key === pick), evc = chosen?.evc;
  const summary = !chosen ? "" : hand ? t("browser-consoles-2.migrationOnline", { hours: hoursText(chosen.hours) })
    : chosen.hours === 0 ? t("browser-consoles-2.machineKeepsRunning") : t("browser-consoles-2.machineOffline", { hours: hoursText(chosen.hours) });
  return (
    <div className="cx-inline">
      {targets.length === 0 && <span>{t("browser-consoles-2.noHost")}</span>}
      {targets.map((t) => <button key={t.key} className="cx-chip" aria-pressed={t.key === pick} onClick={() => setPick(t.key)}>{t.label}</button>)}
      {evc && <span className="cx-note bad">{t(`readouts.evc.warning.${c.platform === "proxmocks" || c.platform === "openstash" ? c.platform : "vmwhere"}`)}</span>}
      {chosen && <span className="cx-note">{summary}</span>}
      {chosen && <button className="cx-btn primary" onClick={() => chosen.run().ok && done()}>{t("browser-consoles-2.migrate")}</button>}
      <button className="cx-btn" onClick={done}>{t("browser-consoles-2.cancel")}</button>
    </div>
  );
}

// Each console names the switch of an account's package in its own words.
const PLAN_LABEL: Record<string, string> = { cpanic: "pkg.changeCpanic", directadmin: "pkg.changeDa" };

function gameRow(game: GameState, c: Cluster, serviceId: string): GameRow | undefined {
  if (!c.panel || !GAME_UNIT[c.panel] || game.services.find((v) => v.id === serviceId)?.product !== "gameServer") return undefined;
  const g = gameOf(game, serviceId);
  return { title: g ? t(`games.title.${g.title}`) : t("games.unknown"), faded: !!g && yearOf(game.hour) > (titleById(g.title)?.fade ?? NEVER), players: playersOf(game, serviceId), crashed: gameCrashed(game, serviceId), offline: daemonOffline(game, serviceId), ports: g?.ports ?? [], managed: !!g };
}

export interface Row {
  id: string; name: string; sub: string; pkg?: string; user?: string; node: string; state: string; tone: string;
  cpu: [number, number]; ram: [number, number]; disk: [number, number]; lead: [number, number]; traffic: [number, number]; mail: number; usage: string;
  actions: PanelAction[]; panel: ReactNode;
  // Game servers on a game panel.
  game?: GameRow;
}

// One row per web space, game server or VM; panel is the open migrate or resize form under it.
export function useRows(game: GameState, c: Cluster, f: ConsoleFeatures, node: string | null = null): Row[] {
  const act = usePageAct(), openConsole = useStore((s) => s.openConsole), [open, setOpen] = useState<{ id: string; kind: "migrate" | "resize" | "plan" | "manage" } | null>(null);
  const uses = useMemo(() => new Map(c.kind === "panel" ? game.workloads.filter((w) => w.clusterId === c.id).map((w) => [w.id, accountUse(game, w)] as const) : []), [game.hour, game.workloads.length, c.id, c.kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const web = c.kind === "panel", cloud = c.kind === "cloud", close = () => setOpen(null), holds = useHolds(game, c, f);
  return game.workloads.filter((w) => w.clusterId === c.id && (!node || w.deviceId === node)).map((w) => {
    const st = vmState(game, w), [state, tone] = VM_STATE[st], u = workloadUse(game, w), host = hostOfVm(game, w.id);
    const on = st === "running" || st === "down" || st === "frozen", site = game.services.find((v) => v.id === w.serviceId);
    const d = game.devices.find((x) => x.id === w.deviceId), movable = (on || st === "stopped") && !w.migrating, own = cloud && isOwnVm(w);
    const actions: (PanelAction | false)[] = [
      f.start && st === "stopped" && { id: "start", label: t("browser-consoles-2.start"), run: () => act(startWorkload, w.id) },
      f.stop && on && { id: "stop", label: t("browser-consoles-2.stop"), run: () => act(stopWorkload, w.id) },
      st === "lost" && f.backups && { id: "restore", label: w.backupAt === null ? t("browser-consoles-2.startEmpty") : t("browser-consoles-2.restore"), run: () => act(restoreWorkload, w.id) },
      !!f.migrate && movable && { id: "migrate", label: t("browser-consoles-2.migrate"), run: () => setOpen({ id: w.id, kind: "migrate" }) },
      f.resize && !!host && cloud && { id: "resize", label: t("browser-consoles-2.resize"), run: () => setOpen({ id: w.id, kind: "resize" }) },
      !!gameRow(game, c, w.serviceId)?.managed && { id: "manage", label: t("games.manage"), run: () => setOpen(open?.id === w.id && open.kind === "manage" ? null : { id: w.id, kind: "manage" }) },
      !!site && planChoices(game, c, site.id).length > 0 && { id: "plan", label: t(PLAN_LABEL[f.look] ?? "pkg.changePlan"), run: () => setOpen({ id: w.id, kind: "plan" }) },
      own && { id: "console", label: t("browser-consoles-2.console"), run: () => openConsole(w.id) },
      f.delete && own && !host && { id: "delete", label: t("browser-consoles-2.delete"), run: () => act(deleteVm, w.id) },
    ];
    const o = open?.id === w.id ? open.kind : null, hold = holds(w);
    return {
      id: w.id, state: hold?.state?.[0] ?? state, tone: hold?.state?.[1] ?? tone, pkg: site?.pkg, user: site?.username,
      name: web ? site?.domain ?? w.hostname ?? "" : host?.name ?? w.hostname ?? vmLabel(game, w).name,
      sub: [host?.panel ? consoleTitle(host.panel) : "", !web && site?.pkg].filter(Boolean).join(" · "),
      game: gameRow(game, c, w.serviceId),
      node: d ? d.hostname ?? d.label ?? d.name : "",
      cpu: [u.vcpu, w.vcpu], ram: [u.ramGb, w.ramGb], disk: [u.diskGb, w.diskGb], lead: web ? [u.diskGb, w.diskGb] : [u.vcpu, w.vcpu], traffic: uses.get(w.id)?.traffic ?? [0, 0], mail: uses.get(w.id)?.mailboxes ?? 0,
      usage: web ? t("browser-consoles-2.of", { used: disk(Math.round(u.diskGb)), total: disk(w.diskGb) }) : t("browser-consoles-2.usageVm", { cpu: num(u.vcpu), vcpu: w.vcpu, ram: ram(+u.ramGb.toFixed(1)), ramTotal: ram(w.ramGb) }),
      actions: [...actions.filter((a): a is PanelAction => !!a), ...(hold?.actions ?? [])],
      panel: o === "manage" && c.panel ? <GameDetails game={game} serviceId={w.serviceId} panel={c.panel} /> : o === "migrate" ? <Migrate game={game} w={w} c={c} done={close} /> : o === "plan" && site ? <ChangePackage game={game} c={c} serviceId={site.id} label={t(PLAN_LABEL[f.look] ?? "pkg.changePlan")} done={close} /> : o === "resize" && host ? <Resize game={game} host={host} done={close} /> : hold?.panel ?? null,
    };
  });
}

export const trafficText = (r: Row) => t("readouts.trafficOf", { used: num(r.traffic[0]), total: num(r.traffic[1]) });
export const cpuText = (r: Row) => t("browser-consoles-2.ofVcpu", { used: num(r.cpu[0]), total: r.cpu[1] });
export const ramText = (r: Row) => t("browser-consoles-2.of", { used: ram(+r.ram[0].toFixed(1)), total: ram(r.ram[1]) });

// The plain table most consoles show their objects in; name is the first column's heading.
export function RowsTable({ rows, name, node = false, className = "cx-table", extra, cols = [] }: { rows: Row[]; name: string; node?: boolean; className?: string; extra?: (r: Row) => ReactNode; cols?: ("user" | "pkg")[] }) {
  const span = (node ? 5 : 4) + cols.length;
  return (
    <>
    <TitlesSummary rows={rows} />
    <table className={className}>
      <thead><tr><th>{name}</th>{cols.map((k) => <th key={k}>{t(k === "user" ? "pkg.username" : "pkg.package")}</th>)}{node && <th>{t("browser-consoles-2.node")}</th>}<th>{t("browser-consoles-2.status")}</th><th>{t("browser-consoles-2.usage")}</th><th /></tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={span} className="cx-empty">{t("browser-consoles-2.nothingHere")}</td></tr>}
        {rows.map((r) => (
          <RowLines key={r.id} r={r} span={span}>
            <td><b>{r.name}</b>{r.sub && <span className="cx-sub">{r.sub}</span>}<GameLine g={r.game} /></td>
            {cols.map((k) => <td key={k}>{k === "user" ? r.user : r.pkg}</td>)}
            {node && <td>{r.node}</td>}
            <td><span className={`cx-state ${r.tone}`}>{r.state}</span></td>
            <td><Bar use={r.lead} /><span className="cx-use num">{r.usage}</span>{r.traffic[1] > 0 && <><Bar use={r.traffic} /><span className="cx-use num">{trafficText(r)}</span></>}</td>
            <td><Actions actions={r.actions} className="cx-acts" />{extra?.(r)}</td>
          </RowLines>
        ))}
      </tbody>
    </table>
    </>
  );
}

// A table row that unfolds a second row with its open panel under it.
export function RowLines({ r, span, children }: { r: Row; span: number; children: ReactNode }) {
  return (
    <>
      <tr>{children}</tr>
      {r.panel && <tr className="cx-open"><td colSpan={span}>{r.panel}</td></tr>}
    </>
  );
}

export function Nodes({ game, c, className = "cx-table" }: { game: GameState; c: Cluster; className?: string }) {
  return (
    <table className={className}>
      <thead><tr><th>{t("browser-consoles-2.node")}</th><th>{t("browser-consoles-2.state")}</th><th>{t("browser-consoles-2.health")}</th><th>{t("browser-consoles-2.workloads")}</th></tr></thead>
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

export interface Fact { label: string; value: string; num?: boolean }

export function Facts({ facts, className = "cx-table cx-facts" }: { facts: Fact[]; className?: string }) {
  return <table className={className}><tbody>{facts.map((x) => <tr key={x.label}><th>{x.label}</th><td className={x.num ? "num" : undefined}>{x.value}</td></tr>)}</tbody></table>;
}

// The software page: its facts, the actions it allows now, a note when nothing is due and the open resize form.
export function useSoftware(game: GameState, c: Cluster, f: ConsoleFeatures): { facts: Fact[]; actions: PanelAction[]; note: string | null; panel: ReactNode } {
  const act = usePageAct(), [sizing, setSizing] = useState(false), [removing, setRemoving] = useState(false);
  const family = familyOf(c)!, year = yearOf(game.hour), due = updateDue(game, c);
  const auto = f.update && autoUpdates(softwareById(family), year), on = !!c.autoUpdate;
  const off = game.security.offline.includes(c.id), machine = c.vm ?? c.nodes[0]?.deviceId ?? "";
  const facts: (Fact | false)[] = [
    { label: t("browser-consoles-2.software"), value: consoleTitle(family) },
    { label: t("browser-consoles-2.version"), value: String(c.version), num: true },
    auto && { label: t("browser-consoles-2.autoUpdates"), value: on ? t("browser-consoles-2.on") : t("browser-consoles-2.off") },
    { label: t("browser-consoles-2.openVulns"), value: String(openVulns(game, c.id).length), num: true },
    c.kind === "panel" && { label: "PHP", value: String(c.php), num: true },
  ];
  const actions: (PanelAction | false)[] = [
    f.update && due && { id: "update", label: t("browser-consoles-2.updateTo", { year }), run: () => act(updateSoftware, c.id), tone: "primary" },
    auto && { id: "auto", label: on ? t("browser-consoles-2.autoOff") : t("browser-consoles-2.autoOn"), run: () => act(setAutoUpdate, c.id, !on) },
    c.kind === "panel" && phpDue(game, c) && { id: "php", label: c.php === phpAt(year) ? t("browser-consoles-2.patchPhp") : t("browser-consoles-2.upgradePhp", { version: phpAt(year) }), run: () => act(upgradePhp, c.id) },
    f.sitesOffline && c.kind === "panel" && { id: "offline", label: off ? t("browser-consoles-2.sitesOnline") : t("browser-consoles-2.sitesOffline"), run: () => act(setSitesOffline, c.id, !off) },
    f.resize && c.kind === "panel" && !!c.vm && { id: "resize", label: t("browser-consoles-2.resize"), run: () => setSizing(!sizing) },
    f.delete && !removing && { id: "remove", label: t("browser-consoles-2.removeHost"), run: () => setRemoving(true) },
    removing && { id: "confirm", label: t("browser-consoles-2.confirmRemove"), tone: "danger", run: () => (c.kind === "panel" ? act(removePanelHost, c.id) : act(uninstallSoftware, machine)) },
    removing && { id: "cancel", label: t("browser-consoles-2.cancel"), run: () => setRemoving(false) },
  ];
  return {
    facts: facts.filter((x): x is Fact => !!x), actions: actions.filter((a): a is PanelAction => !!a),
    note: f.update && !due ? t("browser-consoles-2.upToDate") : null, panel: <>{sizing && c.vm ? <Resize game={game} host={c} done={() => setSizing(false)} /> : null}<HostSettings game={game} c={c} /></>,
  };
}

// The backup schedule and the host the backups go to; consoles show it where consoleFeatures offers backups.
export function Backups({ game, c, title = <h4 className="cx-h">{t("browser-consoles-2.backups")}</h4> }: { game: GameState; c: Cluster; title?: ReactNode }) {
  const act = usePageAct(), others = backupTargets(game, c), job = c.jobs[0], every = (job?.every ?? "off") as BackupEvery, target = job?.targetId ?? others[0]?.id ?? null;
  return (
    <>
      {title}
      <div className="cx-tools">
        {(["off", "daily", "weekly"] as BackupEvery[]).map((e) => (
          <button key={e} className="cx-chip" aria-pressed={every === e} disabled={e !== "off" && !target} onClick={() => act(setBackup, c.id, target, e)}>
            {e === "off" ? t("browser-consoles-2.off") : e === "daily" ? t("browser-consoles-2.daily") : t("browser-consoles-2.weekly")}
          </button>
        ))}
      </div>
      <div className="cx-tools">
        {others.length === 0 && <span className="cx-note">{t("browser-consoles-2.noBackupServer")}</span>}
        {others.map((x) => <button key={x.id} className="cx-chip" aria-pressed={job?.targetId === x.id} onClick={() => act(setBackup, c.id, x.id, every === "off" ? "daily" : every)}>{x.name}</button>)}
      </div>
    </>
  );
}
