// docs/design/software.md, section 9: what every hypervisor console offers, as blocks each product lays out its own way.
import { Fragment, useState, type ReactNode } from "react";
import { euroCents } from "../../../../sim/00-core/money";
import { formatClock, yearOf } from "../../../../sim/00-core/time";
import { balancerIn, SOFTWARE, softwareById } from "../../../../sim/10-catalog/platforms";
import type { Resources } from "../../../../sim/10-catalog/products";
import { HA_SKILL } from "../../../../sim/10-catalog/research";
import { APP_SUITE_FEE, imageParts, licensingAt, serverOsById, type OsImage } from "../../../../sim/10-catalog/server-os";
import type { GameState } from "../../../../sim/50-state";
import { t } from "../../../../i18n/en";
import { clusterSummary, type Alarm, type Amount, type Amounts, type Severity } from "../../../../sim/60-infra/alarms";
import { machineAddress } from "../../../../sim/60-infra/addresses";
import { balances, datastoreFits, datastoreUp, deltaGb, hostOfVm, insideVm, isOwnVm, KEYS, nodeTakes, withDatastore, workloadsOn, type Cluster, type ClusterNode, type Ha, type Workload } from "../../../../sim/60-infra/cluster";
import { machineScreen } from "../../../../sim/60-infra/oob";
import { deviceHealth, working } from "../../../../sim/60-infra/status";
import { nodeUsage, workloadUse } from "../../../../sim/60-infra/usage";
import { consoleTitle, type ConsoleFeatures } from "../../../../sim/80-business/consoles";
import { setMedia } from "../../../../sim/90-actions/console";
import { addNode, cordon, createVm, deleteVm, drain, evacuate, uncordon, PANEL_VM_SIZE, removeNode, resizeVm, setBalancer, setHa } from "../../../../sim/90-actions/clusters";
import { mountableImages } from "../../../../sim/90-actions/media";
import { joinableServers } from "../../../../sim/90-actions/software";
import { buyAppSuite, cancelAppSuite, deployFromSuite } from "../../../../sim/90-actions/suite";
import { rescueTargets, rescueWorkload, restoreWorkload, startWorkload, stopWorkload } from "../../../../sim/90-actions/vms";
import { freezeWorkload, thawWorkload } from "../../../../sim/90-actions/openveezee";
import { diskMoveDowntime, moveDisk } from "../../../../sim/90-actions/datastores";
import { cloneHours, cloneTemplate, makeTemplate, makeVm } from "../../../../sim/90-actions/templates";
import { useHolds } from "./Holds";
import { useStore } from "../../../store";
import { day, disk, ram } from "../../hw";
import { bootLines } from "../../console/lunix";
import { useHandWork } from "../../locations/HandSheet";
import { VM_STATE, vmLabel, vmState, type VmState } from "../../products/parts";
import { Bar, Migrate, Resize, type Fact, type PanelAction } from "./PanelBase";
import { ChangePackage, HYPERVISOR_ORDERS, hostChoices, OrderPicker, planChoices, PlanSelect } from "./PackageForms";
import { orderChoices } from "../../../../sim/30-market/manual";
import { provisionOrder } from "../../../../sim/90-actions/orders";
import "./hypervisor.css";
import { usePageAct } from "../pageAct";

// Toolbar glyphs; the consoles draw no images.
export const GLYPH: Record<string, string> = {
  hold: "⏸", unhold: "▶", terminate: "✕", start: "▶", stop: "■", reset: "↻", restore: "⟲", recover: "⛑", migrate: "⇄", storage: "⛁", resize: "⤢", console: "▣", delete: "✕", create: "✚", template: "⧉", clone: "⎘", vm: "▢",
};

export interface Vm {
  w: Workload; id: string; name: string; sub: string; st: VmState; state: string; tone: string; own: boolean;
  node: string; ip: string; os: string; media: OsImage | null; use: Resources; actions: PanelAction[]; panel: ReactNode;
  // The datastore its disk is on, or Local.
  storage: string;
}

const num = (n: number) => `${+n.toFixed(2)}`;
export const nodeName = (game: GameState, id: string | null) => { const d = game.devices.find((x) => x.id === id); return d ? d.hostname ?? d.label ?? d.name : ""; };
export const osText = (w: Workload) => (w.os ? `${serverOsById(w.os.id).name} ${w.os.version}` : t("browser-consoles-1.none"));
export const isoName = (img: OsImage) => `${img.replace("@", "-")}.iso`.replace(/\s+/g, "-").toLowerCase();

// An own VM's size, changed through resizeVm.
function SizeForm({ w, done }: { w: Workload; done: () => void }) {
  const act = usePageAct(), [size, setSize] = useState<Resources>({ vcpu: w.vcpu, ramGb: w.ramGb, diskGb: w.diskGb });
  return (
    <div className="cx-inline">
      <SizeFields size={size} set={setSize} />
      <button className="cx-btn primary" onClick={() => act(resizeVm, w.id, size).ok && done()}>{t("browser-consoles-1.resize")}</button>
      <button className="cx-btn" onClick={done}>{t("browser-consoles-1.cancel")}</button>
    </div>
  );
}

export function SizeFields({ size, set, labels = [t("browser-consoles-1.vcpu"), t("browser-consoles-1.memoryGb"), t("browser-consoles-1.diskGb")], only }: { size: Resources; set: (r: Resources) => void; labels?: [string, string, string]; only?: keyof Resources }) {
  const keys: (keyof Resources)[] = ["vcpu", "ramGb", "diskGb"];
  return <>{keys.map((k, i) => (!only || only === k) && (
    <label key={k} className="cx-field">{labels[i]}<input type="number" min={1} value={size[k]} onChange={(e) => set({ ...size, [k]: Number(e.target.value) })} /></label>
  ))}</>;
}

// Every VM of the cluster with the actions its state allows; panel is the open form under it, dialog the hand work popover.
export function useVms(game: GameState, c: Cluster, f: ConsoleFeatures): { vms: Vm[]; dialog: ReactNode } {
  const act = usePageAct(), openConsole = useStore((s) => s.openConsole), hand = useHandWork(), holds = useHolds(game, c, f);
  const [open, setOpen] = useState<{ id: string; kind: string } | null>(null), close = () => setOpen(null);
  const vms = game.workloads.filter((w) => w.clusterId === c.id).map((w): Vm => {
    const st = vmState(game, w), [state, tone] = VM_STATE[st], host = hostOfVm(game, w.id), own = isOwnVm(w), label = vmLabel(game, w);
    const on = st === "running" || st === "down", rescue = rescueTargets(game, w.id), tpl = !!w.template;
    const templating = own && !!c.platform && !!softwareById(c.platform).datastores;
    const toggle = (kind: string) => () => setOpen(open?.id === w.id && open.kind === kind ? null : { id: w.id, kind });
    const actions: (PanelAction | false)[] = [
      f.start && st === "stopped" && !tpl && { id: "start", label: t("browser-consoles-1.hvStart"), run: () => act(startWorkload, w.id) },
      c.platform === "openveezee" && st === "running" && !tpl && { id: "checkpoint", label: t("ovz.checkpoint"), run: () => act(freezeWorkload, w.id) },
      st === "checkpointed" && { id: "thaw", label: t("ovz.restore"), run: () => act(thawWorkload, w.id) },
      f.stop && on && { id: "stop", label: t("browser-consoles-1.vmShutdown"), run: () => act(stopWorkload, w.id) },
      f.stop && on && own && { id: "reset", label: t("browser-consoles-1.hvReset"), run: () => { if (act(stopWorkload, w.id).ok) act(startWorkload, w.id); } },
      st === "lost" && { id: "restore", label: w.backupAt === null ? t("browser-consoles-1.startEmpty") : t("browser-consoles-1.hvRestore"), run: () => act(restoreWorkload, w.id) },
      rescue.length > 0 && { id: "recover", label: t("browser-consoles-1.hvRecover"), run: toggle("recover") },
      !!f.migrate && (on || st === "stopped") && !w.migrating && !tpl && { id: "migrate", label: t("browser-consoles-1.migrate"), run: toggle("migrate") },
      c.datastores.length > 0 && (on || st === "stopped") && !w.migrating && { id: "storage", label: t("browser-consoles-1.moveDisk"), run: toggle("storage") },
      templating && st === "stopped" && !tpl && { id: "template", label: t("browser-consoles-1.convertToTemplate"), run: () => act(makeTemplate, w.id) },
      tpl && { id: "clone", label: t("browser-consoles-1.clone"), run: toggle("clone") },
      tpl && { id: "vm", label: t("browser-consoles-1.convertToVm"), run: () => act(makeVm, w.id) },
      planChoices(game, c, w.serviceId).length > 0 && { id: "plan", label: t("pkg.changePlan"), run: toggle("plan") },
      f.resize && own && { id: "resize", label: t("browser-consoles-1.resize"), run: toggle("resize") },
      own && { id: "console", label: t("browser-consoles-1.console"), run: () => openConsole(w.id) },
      f.delete && own && !insideVm(game, w.id).length && { id: "delete", label: t("browser-consoles-1.delete"), tone: "danger", run: toggle("delete") },
    ];
    const kind = open?.id === w.id ? open.kind : null, hold = holds(w);
    const panel = kind === "migrate" ? <Migrate game={game} w={w} c={c} done={close} />
      : kind === "plan" && w.serviceId ? <ChangePackage game={game} c={c} serviceId={w.serviceId} done={close} />
      : kind === "storage" ? <DiskMove game={game} w={w} c={c} done={close} />
      : kind === "clone" ? <Clone game={game} w={w} c={c} done={close} />
      : kind === "resize" ? (host ? <Resize game={game} host={host} done={close} /> : <SizeForm w={w} done={close} />)
      : kind === "delete" ? (
        <div className="cx-inline">
          <button className="cx-btn danger" onClick={() => act(deleteVm, w.id).ok && close()}>{t("browser-consoles-1.deleteName", { name: label.name })}</button>
          <button className="cx-btn" onClick={close}>{t("browser-consoles-1.cancel")}</button>
        </div>
      ) : kind === "recover" ? (
        <div className="cx-inline">
          {rescue.map((r) => (
            <button key={r.to} className="cx-chip" onClick={() => { hand.start(game, { title: t("browser-consoles-1.recoverTo", { name: label.name, to: r.name }), deviceId: w.deviceId!, action: rescueWorkload, args: [w.id, r.to] }); close(); }}>
              {t("browser-consoles-1.nameOffline", { name: r.name, h: r.down })}
            </button>
          ))}
          <button className="cx-btn" onClick={close}>{t("browser-consoles-1.cancel")}</button>
        </div>
      ) : hold?.panel ?? null;
    return {
      w, id: w.id, st, state: hold?.state?.[0] ?? state, tone: hold?.state?.[1] ?? tone, own, name: host?.name ?? label.name, sub: own ? (host ? consoleTitle(host.panel ?? host.platform ?? "") : "") : label.service,
      node: nodeName(game, w.deviceId), ip: machineAddress(game, w.id) ?? "", os: own ? osText(w) : "", media: w.media ?? null,
      use: workloadUse(game, w), actions: [...actions.filter((a): a is PanelAction => !!a), ...(hold?.actions ?? [])], panel, storage: w.datastore ? nodeName(game, w.datastore) : t("browser-consoles-1.local"),
    };
  });
  return { vms, dialog: hand.dialog };
}

// The facts a VM page lists; each console picks and labels its own.
export function vmFacts(_game: GameState, v: Vm): Record<"status" | "node" | "ip" | "os" | "cpu" | "memory" | "disk" | "backup" | "media", Fact> {
  return {
    status: { label: t("browser-consoles-1.status"), value: v.state }, node: { label: t("browser-consoles-1.node"), value: v.node }, ip: { label: t("browser-consoles-1.ipAddress"), value: v.ip || t("browser-consoles-1.none"), num: true },
    os: { label: t("browser-consoles-1.guestOs"), value: v.own ? v.os : v.sub }, cpu: { label: t("browser-consoles-1.hvProcessors"), value: `${v.w.vcpu} vCPU`, num: true },
    memory: { label: t("browser-consoles-1.memory"), value: ram(+v.w.ramGb.toFixed(2)), num: true }, disk: { label: t("browser-consoles-1.hardDisk"), value: disk(v.w.diskGb), num: true },
    backup: { label: t("browser-consoles-1.lastBackup"), value: v.w.backupAt === null ? t("browser-consoles-1.none") : day(v.w.backupAt), num: true },
    media: { label: t("browser-consoles-1.cdDvdDrive"), value: v.media ? isoName(v.media) : t("browser-consoles-1.empty"), num: !!v.media },
  };
}

// Where a VM's disk can move: its node and every working datastore of the cluster with room, each with the hours offline.
function DiskMove({ game, w, c, done }: { game: GameState; w: Workload; c: Cluster; done: () => void }) {
  const act = usePageAct(), node = game.devices.find((d) => d.id === w.deviceId), size = w.diskGb + deltaGb(w);
  const to = [
    ...(w.datastore && node && nodeTakes(game, node, { ...w, diskGb: size, datastore: undefined }, w) ? [{ id: null, name: t("browser-consoles-1.local") }] : []),
    ...c.datastores.filter((x) => x.deviceId !== w.datastore && datastoreUp(game, x) && datastoreFits(game, x.deviceId, size)).map((x) => ({ id: x.deviceId, name: nodeName(game, x.deviceId) })),
  ];
  const down = (id: string | null) => diskMoveDowntime(game, size, c.datastores.filter((x) => x.deviceId === id || x.deviceId === w.datastore));
  return (
    <div className="cx-inline">
      {to.map((x) => (
        <button key={x.id ?? "local"} className="cx-chip" onClick={() => act(moveDisk, w.id, x.id).ok && done()}>
          {down(x.id) ? t("browser-consoles-1.nameOffline", { name: x.name, h: down(x.id) }) : x.name}
        </button>
      ))}
      <button className="cx-btn" onClick={done}>{t("browser-consoles-1.cancel")}</button>
    </div>
  );
}

// Where a template's clone goes: the host the scheduler picks or an active, working host with room, with the copy hours.
function Clone({ game, w, c, done }: { game: GameState; w: Workload; c: Cluster; done: () => void }) {
  const act = usePageAct(), size = withDatastore(game, c, { vcpu: w.vcpu, ramGb: w.ramGb, diskGb: w.diskGb }), hours = cloneHours(game, w);
  const hosts = c.nodes.filter((n) => n.state === "active" && working(game, n.deviceId)).map((n) => game.devices.find((d) => d.id === n.deviceId)!).filter((d) => d && nodeTakes(game, d, size));
  const to = [{ id: undefined, name: t("browser-consoles-1.automatic") }, ...hosts.map((d) => ({ id: d.id, name: nodeName(game, d.id) }))];
  return (
    <div className="cx-inline">
      {to.map((x) => <button key={x.id ?? "auto"} className="cx-chip" onClick={() => act(cloneTemplate, w.id, x.id).ok && done()}>{t("browser-consoles-1.nameHours", { name: x.name, h: hours })}</button>)}
      <button className="cx-btn" onClick={done}>{t("browser-consoles-1.cancel")}</button>
    </div>
  );
}

// The ISO loaded in an own VM, picked from the downloaded images.
export function MediaMenu({ game, v, label = t("browser-consoles-1.media"), none = t("browser-consoles-1.noMedia"), className = "cx-field" }: { game: GameState; v: Vm; label?: string; none?: string; className?: string }) {
  const act = usePageAct();
  if (!v.own) return null;
  return (
    <label className={className}>{label}
      <select value={v.media ?? ""} onChange={(e) => act(setMedia, v.id, (e.target.value || null) as OsImage | null)}>
        <option value="">{none}</option>
        {mountableImages(game).map((o) => <option key={o} value={o}>{isoName(o)}</option>)}
      </select>
    </label>
  );
}

export interface Step { id: string; label: string; body: ReactNode }

// The new VM a wizard books: its size, the ISO it boots and, on a VMwhere cluster with the App Suite, the software it
// deploys with. create returns the new VM's id.
export function useNewVm(game: GameState, c: Cluster, order?: string) {
  const act = usePageAct(), [size, setSize] = useState<Resources>(PANEL_VM_SIZE);
  const choices = orderChoices(game, HYPERVISOR_ORDERS), [ticket, setTicket] = useState(choices.some((o) => o.ticketId === order) ? order! : "");
  const [pkg, setPkg] = useState(""), [route, setRoute] = useState(c.id), picked = choices.find((o) => o.ticketId === ticket);
  const hosts = hostChoices(game, c);
  const [iso, setIso] = useState<OsImage | "">(""), [suite, setSuite] = useState<string | null>(null);
  const create = (): string | null => {
    const r = suite ? act(deployFromSuite, c.id, size, suite) : act(createVm, c.id, size);
    if (!r.ok || !r.id) return null;
    if (suite) return useStore.getState().game.clusters.find((x) => x.id === r.id)?.vm ?? null;
    if (iso) act(setMedia, r.id, iso);
    return r.id;
  };
  const isoPick = (label = t("browser-consoles-1.isoImage"), none = t("browser-consoles-1.noMediaUse")) => (
    <label className="cx-field">{label}
      <select value={iso} onChange={(e) => setIso(e.target.value as OsImage | "")}>
        <option value="">{none}</option>
        {mountableImages(game).map((o) => <option key={o} value={o}>{isoName(o)}</option>)}
      </select>
    </label>
  );
  // With an order picked the machine is the customer's: the order's own size and the chosen package are booked.
  const submit = (): boolean => !!picked && act(provisionOrder, picked.ticketId, route, { package: pkg || undefined }).ok;
  const orderFields = (
    <>
      <OrderPicker choices={choices} value={ticket} onChange={(id) => { setTicket(id); setPkg(""); }} />
      {picked && <PlanSelect c={c} o={picked} value={pkg} onChange={setPkg} label={t("pkg.package")} />}
      {picked && hosts.length > 1 && (
        <label className="cx-field">{t("pkg.node")}<select value={route} onChange={(e) => setRoute(e.target.value)}>{hosts.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}</select></label>
      )}
    </>
  );
  return { ordered: !!picked, submit, orderFields, size, setSize, iso, isoLabel: iso ? isoName(iso) : null, isoPick, suite, setSuite, create };
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
        <button className="cx-btn" onClick={onCancel}>{t("browser-consoles-1.cancel")}</button>
        <button className="cx-btn" disabled={at === 0} onClick={() => setAt(at - 1)}>{t("browser-consoles-1.back")}</button>
        {last ? <button className="cx-btn primary" onClick={onFinish}>{finish}</button> : <button className="cx-btn primary" onClick={() => setAt(at + 1)}>{t("browser-consoles-1.next")}</button>}
      </div>
    </div>
  );
}

// The software the App Suite deploys this year: everything that is not a hypervisor, with the OS it comes on.
export const suiteSoftware = (year: number) => SOFTWARE.filter((x) => x.kind !== "cloud" && x.from <= year);
export const windoorsLicence = (year: number) => { const e = licensingAt(serverOsById("windoors"), year); return t(e.kind === "core" ? "browser-consoles-1.feePerCore" : "browser-consoles-1.feePerSocketOnce", { fee: euroCents(e.fee) }); };

// The App Suite tile: bought and cancelled per cluster, with its monthly fee.
export function AppSuiteTile({ c, className = "cx-suite" }: { c: Cluster; className?: string }) {
  const act = usePageAct();
  if (c.platform !== "vmwhere") return null;
  return (
    <div className={className}>
      <b>{t("browser-consoles-1.appSuite")}</b>
      <span className="num">{t("browser-consoles-1.feePerMonth", { fee: euroCents(APP_SUITE_FEE) })}</span>
      <span>{c.appSuite ? t("browser-consoles-1.active") : t("browser-consoles-1.notPurchased")}</span>
      {c.appSuite
        ? <button className="cx-btn" onClick={() => act(cancelAppSuite, c.id)}>{t("browser-consoles-1.cancelSubscription")}</button>
        : <button className="cx-btn primary" onClick={() => act(buyAppSuite, c.id)}>{t("browser-consoles-1.buy")}</button>}
    </div>
  );
}

// The paid balancer edition of the cluster's hypervisor: bought and cancelled per cluster, billed per node.
export function BalancerTile({ game, c, className = "cx-suite" }: { game: GameState; c: Cluster; className?: string }) {
  const act = usePageAct(), b = c.platform ? balancerIn(softwareById(c.platform), yearOf(game.hour)) : null;
  if (!b || b.fee === 0) return null;
  return (
    <div className={className}>
      <b>{b.name}</b>
      <span className="num">{t("browser-consoles-1.feePerNodeMonth", { fee: euroCents(b.fee) })}</span>
      <span>{c.balancer ? t("browser-consoles-1.active") : t("browser-consoles-1.notPurchased")}</span>
      <button className={c.balancer ? "cx-btn" : "cx-btn primary"} onClick={() => act(setBalancer, c.id, !c.balancer)}>{c.balancer ? t("browser-consoles-1.cancelSubscription") : t("browser-consoles-1.buy")}</button>
    </div>
  );
}

// Cordon, drain, evacuate and uncordon one node of this software installation; other software on the server is untouched.
export function NodeActions({ c, n, className }: { c: Cluster; n: ClusterNode; className: string }) {
  const act = usePageAct();
  return <>
    {n.state === "active"
      ? <button className={className} onClick={() => act(cordon, n.deviceId, c.id)}>{t("browser-consoles-1.cordon")}</button>
      : <button className={className} onClick={() => act(uncordon, n.deviceId, c.id)}>{t("browser-consoles-1.uncordon")}</button>}
    {(n.state === "active" || n.state === "cordoned") && <button className={className} onClick={() => act(drain, n.deviceId, c.id)}>{t("browser-consoles-1.drain")}</button>}
    {n.state !== "maintenance" && <button className={className} onClick={() => act(evacuate, n.deviceId, c.id)}>{t("browser-consoles-1.evacuate")}</button>}
  </>;
}

// The nodes with their usage; where the hypervisor clusters this year, Add node, Remove node and the HA flags.
export function NodeList({ game, c, f, className = "cx-table" }: { game: GameState; c: Cluster; f: ConsoleFeatures; className?: string }) {
  const act = usePageAct(), join = f.cluster ? joinableServers(game, c.id) : [], [adding, setAdding] = useState(false);
  const ha = f.cluster && game.unlocks.includes(HA_SKILL);
  const flags: [keyof Ha, string][] = [["live", t("browser-consoles-1.liveMigration")], ["balance", t("browser-consoles-1.loadBalancing")], ["failover", t("browser-consoles-1.failover")]];
  return (
    <>
      <table className={className}>
        <thead><tr><th>{t("browser-consoles-1.node")}</th><th>{t("browser-consoles-1.status")}</th><th>{t("browser-consoles-1.cpu")}</th><th>{t("browser-consoles-1.memory")}</th><th>{t("browser-consoles-1.vms")}</th><th /></tr></thead>
        <tbody>
          {c.nodes.map((n) => {
            const u = nodeUsage(game, n.deviceId), vms = workloadsOn(game, n.deviceId).length;
            return (
              <tr key={n.deviceId}>
                <td><b>{nodeName(game, n.deviceId)}</b></td>
                <td className="cx-cap">{t(`browser-consoles-1.state_${n.state === "active" ? deviceHealth(game, n.deviceId).state : n.state}`)}</td>
                <td><Bar use={[u.used.vcpu, u.physical.vcpu]} /><span className="cx-use num">{t("browser-consoles-1.xOfY", { a: num(u.used.vcpu), b: u.physical.vcpu })}</span></td>
                <td><Bar use={[u.used.ramGb, u.physical.ramGb]} /><span className="cx-use num">{t("browser-consoles-1.xOfY", { a: ram(+u.used.ramGb.toFixed(1)), b: ram(u.physical.ramGb) })}</span></td>
                <td className="num">{vms}</td>
                <td>
                  <NodeActions c={c} n={n} className="cx-btn" />
                  {f.cluster && c.nodes.length > 1 && vms === 0 && <button className="cx-btn" onClick={() => act(removeNode, n.deviceId)}>{t("browser-consoles-1.removeNode")}</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {f.cluster && (
        <div className="cx-tools">
          <button className="cx-btn primary" aria-pressed={adding} onClick={() => setAdding(!adding)}>{t("browser-consoles-1.addNode")}</button>
          {adding && join.length === 0 && <span className="cx-note">{t("browser-consoles-1.noServers")}</span>}
          {adding && join.map((d) => <button key={d} className="cx-chip" onClick={() => act(addNode, c.id, d).ok && setAdding(false)}>{nodeName(game, d)}</button>)}
        </div>
      )}
      {ha && (
        <div className="cx-tools cx-ha">
          {flags.map(([k, label]) => (
            <label key={k} className="cx-check"><input type="checkbox" checked={c.ha[k]} disabled={k === "balance" && !c.ha.balance && !balances(game, c)} onChange={(e) => act(setHa, c.id, k, e.target.checked)} />{label}</label>
          ))}
        </div>
      )}
      {ha && <BalancerTile game={game} c={c} />}
    </>
  );
}

// Cluster summaries (sim/60-infra/alarms.ts): capacity lines, alarm severities and the alarm table every console styles its own way.
export const AMOUNT: Record<keyof Amounts, (x: number) => string> = { vcpu: (x) => `${num(x)} vCPU`, ramGb: (x) => ram(+x.toFixed(1)), diskGb: (x) => disk(+x.toFixed(1)) };
export const amountText = (k: keyof Amounts, a: Amount) => t("browser-consoles-1.amountText", { allocated: AMOUNT[k](a.allocated), capacity: AMOUNT[k](a.capacity), used: AMOUNT[k](a.used) });
export const worst = (alarms: Alarm[]): Severity | null => (alarms.some((a) => a.severity === "critical") ? "critical" : alarms.length ? "warning" : null);
export const SEV_GLYPH: Record<Severity, string> = { warning: "▲", critical: "◆" };
const width = (x: number, of: number) => `${Math.min(100, of > 0 ? (x / of) * 100 : 0)}%`;

// One bar per resource: what is allocated behind what is used, red once allocation passes capacity.
export function CapacityBar({ a }: { a: Amount }) {
  return (
    <span className="cx-bar cx-cap-bar" data-over={a.allocated > a.capacity + 1e-9 || undefined}>
      <i className="cx-cap-alloc" style={{ width: width(a.allocated, a.capacity) }} /><i style={{ width: width(a.used, a.capacity) }} />
    </span>
  );
}

// The summary of a cluster, or of one of its hosts with the alarms on it and its VMs.
export function summaryOf(game: GameState, c: Cluster, node: string | null) {
  const sum = clusterSummary(game, c.id), host = node ? sum.hosts.find((h) => h.deviceId === node) : undefined;
  const on = new Set(game.workloads.filter((w) => w.deviceId === node).map((w) => w.id));
  return { sum, use: host?.use ?? sum.total, alarms: node ? sum.alarms.filter((a) => a.on.id === node || on.has(a.on.id)) : sum.alarms };
}

export function ResourceBars({ use, labels = [t("browser-consoles-1.cpu"), t("browser-consoles-1.memory"), t("browser-consoles-1.hvStorage")], className = "cx-hv-bars" }: { use: Amounts; labels?: string[]; className?: string }) {
  return (
    <div className={className}>
      {KEYS.map((k, i) => <Fragment key={k}><span>{labels[i]}</span><CapacityBar a={use[k]} /><span className="num">{amountText(k, use[k])}</span></Fragment>)}
    </div>
  );
}

export function alarmObject(game: GameState, c: Cluster, a: Alarm): string {
  if (a.on.kind === "cluster") return c.name;
  if (a.on.kind === "host") return nodeName(game, a.on.id);
  const w = game.workloads.find((x) => x.id === a.on.id);
  return w ? vmLabel(game, w).name : a.on.id;
}

export function AlarmList({ game, c, alarms, className = "cx-table cx-alarms" }: { game: GameState; c: Cluster; alarms: Alarm[]; className?: string }) {
  if (!alarms.length) return null;
  return (
    <table className={className}>
      <thead><tr><th>{t("browser-consoles-1.severity")}</th><th>{t("browser-consoles-1.object")}</th><th>{t("browser-consoles-1.alarm")}</th></tr></thead>
      <tbody>
        {alarms.map((a, i) => (
          <tr key={i} data-sev={a.severity}>
            <td><span className="cx-sev" data-sev={a.severity}>{SEV_GLYPH[a.severity]}</span> {a.severity === "critical" ? t("browser-consoles-1.critical") : t("browser-consoles-1.warning")}</td>
            <td>{alarmObject(game, c, a)}</td><td>{t(a.key, a.params)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface Task { key: string; at: number; text: string; status: string; tone: string }

// The task log: the cluster's software install or update, VMs being moved or restored, and disks its nodes lost.
export function tasks(game: GameState, c: Cluster, vms: Vm[]): Task[] {
  const nodes = new Set(c.nodes.map((n) => n.deviceId)), ids = new Set(vms.map((v) => v.id));
  const installs = game.clusters.filter((x) => x.switching && (x.id === c.id || (x.vm && ids.has(x.vm))));
  const out: Task[] = [
    ...installs.map((x) => ({ key: `sw-${x.id}`, at: x.switching!.doneAt, text: t("browser-consoles-1.taskInstall", { software: softwareById(x.switching!.to).name, name: x.name }), status: t("browser-consoles-1.running"), tone: "accent" })),
    ...vms.filter((v) => v.st === "migrating" || v.st === "restoring" || v.st === "cloning").map((v) => ({ key: v.id, at: v.w.migrating?.doneAt ?? v.w.busyUntil, text: `${v.state} ${v.name}`, status: t("browser-consoles-1.running"), tone: "accent" })),
    ...game.lossReports.filter((r) => nodes.has(r.deviceId)).map((r) => ({ key: r.id, at: r.hour, text: t("browser-consoles-1.taskLostDisks", { name: nodeName(game, r.deviceId) }), status: t("browser-consoles-1.error"), tone: "bad" })),
  ];
  return out.sort((a, b) => b.at - a.at).slice(0, 8);
}

export function TaskLog({ game, c, vms, title, className = "cx-tasks" }: { game: GameState; c: Cluster; vms: Vm[]; title: string; className?: string }) {
  const list = tasks(game, c, vms);
  return (
    <section className={className}>
      <h4>{title}</h4>
      <table>
        <thead><tr><th>{t("browser-consoles-1.time")}</th><th>{t("browser-consoles-1.task")}</th><th>{t("browser-consoles-1.status")}</th></tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={3} className="cx-empty">{t("browser-consoles-1.noTasks")}</td></tr>}
          {list.map((x) => <tr key={x.key}><td className="num">{formatClock(x.at)}</td><td>{x.text}</td><td><span className={`cx-state ${x.tone}`}>{x.status}</span></td></tr>)}
        </tbody>
      </table>
    </section>
  );
}

// Glyph toolbar buttons for a VM's actions.
export function Toolbar({ actions, className = "cx-toolbar", labels = {} }: { actions: PanelAction[]; className?: string; labels?: Record<string, string> }) {
  return <div className={className}>{actions.map((a) => <button key={a.id} className={a.tone ?? ""} onClick={a.run}><i aria-hidden>{GLYPH[a.id] ?? "•"}</i>{labels[a.id] ?? a.label}</button>)}</div>;
}

// What a console has selected: the whole cluster, one node, one VM, or the new VM wizard.
export type Sel = { kind: "all" } | { kind: "node"; id: string } | { kind: "vm"; id: string } | { kind: "new" } | { kind: "plans" };
export const ALL: Sel = { kind: "all" };

// The VM's screen shrunk to a thumbnail, as a summary page shows it; a click opens the console.
export function ConsoleThumb({ game, v, className = "cx-thumb", label }: { game: GameState; v: Vm; className?: string; label?: string }) {
  const openConsole = useStore((s) => s.openConsole), sc = machineScreen(game, v.id), host = v.w.hostname ?? v.name;
  const os = "os" in sc ? sc.os : v.w.os?.id, win = os === "windoors" && sc.kind !== "dark";
  const text = sc.kind === "dark" ? ""
    : win ? (sc.kind === "login" ? "Press Ctrl+Alt+Delete to log on" : sc.kind === "desktop" ? "Windoors Server" : "Windoors Setup")
    : sc.kind === "login" ? `${osText(v.w)} ${host} tty1\n\n${host} login: _`
    : sc.kind === "booting" && v.w.os ? bootLines(game, v.w, v.w.os.version).slice(-8).map((l) => l.text).join("\n")
    : sc.kind === "osInstall" && v.w.os?.from ? `${serverOsById(sc.os).name} upgrade`
    : sc.kind === "bootMenu" || sc.kind === "osInstall" ? `${v.media ? serverOsById(imageParts(v.media).id).name : ""} installer`
    : sc.kind === "notFound" ? "No bootable device." : "";
  return (
    <button className={className} data-look={win ? "windoors" : "text"} disabled={!v.own} onClick={() => openConsole(v.id)} aria-label={label ?? t("browser-consoles-1.console")}>
      {text}
    </button>
  );
}

export const percent = (x: number) => `${Math.round(x * 100)}%`;
