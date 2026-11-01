import { parseCreate } from "../../../../../sim/80-business/consoles";
import { PackagesScreen } from "../PackageForms";
import { useState } from "react";
import { yearOf } from "../../../../../sim/00-core/time";
import { serverOsById } from "../../../../../sim/10-catalog/server-os";
import { euro } from "../../../../../sim/00-core/money";
import { modelById } from "../../../../../sim/10-catalog/hardware";
import { DATASTORE_FROM, DATASTORES_MAX, FC_HBA_PRICE, SNAPSHOTS_MAX, type DatastoreProtocol } from "../../../../../sim/10-catalog/platforms";
import { attachDatastore, datastoreBlock, detachDatastore } from "../../../../../sim/90-actions/datastores";
import { deleteSnapshot, revertSnapshot, takeSnapshot } from "../../../../../sim/90-actions/snapshots";
import { day } from "../../../hw";
import { working } from "../../../../../sim/60-infra/status";
import { t } from "../../../../../i18n/en";
import { useStore } from "../../../../store";
import type { GameState } from "../../../../../sim/50-state";
import { vmStats } from "../../../../../sim/60-infra/stats";
import { clusterSummary, type Alarm, type Amount, type Amounts, type Severity } from "../../../../../sim/60-infra/alarms";
import { withDatastore, bookable, datastoreCapacity, datastoreGbit, datastoreUsed, nodeUsed, type Cluster, type NodeState } from "../../../../../sim/60-infra/cluster";
import { COMPAT_VCPU } from "../../../../../sim/10-catalog/cpus";
import { enterMaintenance, exitMaintenance } from "../../../../../sim/90-actions/vmwhere";
import { setCompatMode } from "../../../../../sim/90-actions/cpus";
import { Chart, niceMax } from "../Chart";
import { nodeName, AlarmList, ALL, AMOUNT, amountText, AppSuiteTile, CapacityBar, SEV_GLYPH, summaryOf, worst, ConsoleThumb, isoName, MediaMenu, NodeList, SizeFields, suiteSoftware, TaskLog, Toolbar, useNewVm, useVms, vmFacts, windoorsLicence, Wizard, type Sel, type Vm } from "../HypervisorBase";
import { Actions, Backups, Bar, erasFrom, eraAt, Facts, LoginForm, useSoftware, type PanelProps } from "../PanelBase";
import type { Look } from "../../../../../sim/10-catalog/sites";
import type { Resources } from "../../../../../sim/10-catalog/products";
import { AlarmsPage, DrsPage, Licensing, PoolsPage } from "./Admin";
import "./vmwhere.css";

// docs/design/software.md, section 9: the grey and yellow fat client from 2005, the blue web client from 2015.
const ERAS = erasFrom(2005, 2015);
const labels = () => ({ start: t("browser-consoles-2.powerOn"), stop: t("browser-consoles-2.shutDownGuest"), reset: t("browser-consoles-2.reset"), migrate: t("browser-consoles-2.migrate"), storage: t("browser-consoles-2.migrateStorage"), resize: t("browser-consoles-2.editSettings"), console: t("browser-consoles-2.openConsole"), delete: t("browser-consoles-2.deleteFromDisk"), restore: t("browser-consoles-2.restore"), recover: t("browser-consoles-2.recover") });

const MHZ = 2400;
const gb = (x: number) => `${+x.toFixed(2)} GB`;

// The Summary tab: the console thumbnail beside the guest facts, the usage meters on the right, the hardware and notes portlets.
export function VmSummary({ game, v, era }: { game: GameState; v: Vm; era: Look }) {
  const now = vmStats(game, v.id)!.now, w = v.w, compat = era === "early" ? t("browser-consoles-2.compatEarly") : t("browser-consoles-2.compatLate");
  const tools = v.own && w.os && v.st === "running" ? t("browser-consoles-2.toolsRunning") : t("browser-consoles-2.toolsOff");
  const meters: [string, string, [number, number]][] = [
    [t("browser-consoles-2.cpuUsage2"), `${Math.round(now.cpu * w.vcpu * MHZ)} MHz`, [now.cpu, 1]], [t("browser-consoles-2.memoryUsage2"), gb(now.ram * w.ramGb), [now.ram, 1]], [t("browser-consoles-2.storageUsage"), gb(now.disk * w.diskGb), [now.disk, 1]],
  ];
  return (
    <>
      <div className="vsw-summary">
        <div className="vsw-thumbbox">
          <ConsoleThumb game={game} v={v} className="cx-thumb vsw-thumb" />
          {v.own && <span className="vsw-launch">{era === "early" ? t("browser-consoles-2.openConsole") : t("browser-consoles-2.launchWebConsole")}</span>}
        </div>
        <table className="vsw-facts"><tbody>
          <tr><th>{t("browser-consoles-2.guestOs")}</th><td>{v.own ? v.os : v.sub}</td></tr>
          <tr><th>{t("browser-consoles-2.compatibility")}</th><td>{compat}</td></tr>
          <tr><th>{t("browser-consoles-2.vmwhereTools")}</th><td>{tools}</td></tr>
          <tr><th>{t("browser-consoles-2.dnsName")}</th><td>{w.hostname ?? v.name}</td></tr>
          <tr><th>{t("browser-consoles-2.ipAddresses2")}</th><td className="num">{v.ip}</td></tr>
          <tr><th>{t("browser-consoles-2.host")}</th><td>{v.node}</td></tr>
        </tbody></table>
        <div className="vsw-meters">
          {meters.map(([label, value, use]) => <div key={label}><small>{label}</small><b className="num">{value}</b><Bar use={use} /></div>)}
        </div>
      </div>
      <div className="vsw-portlets">
        <section className="vsw-portlet">
          <h4>{t("browser-consoles-2.vmHardware")}</h4>
          <table><tbody>
            <tr><th>CPU</th><td className="num">{t("browser-consoles-2.cpuMhzUsed", { cpus: w.vcpu, mhz: Math.round(now.cpu * w.vcpu * MHZ) })}</td></tr>
            <tr><th>{t("browser-consoles-2.memory")}</th><td className="num">{t("browser-consoles-2.memActive", { total: `${w.ramGb} GB`, active: gb(now.ram * w.ramGb) })}</td></tr>
            <tr><th>{t("browser-consoles-2.hardDisk1")}</th><td className="num">{w.diskGb} GB</td></tr>
            <tr><th>{t("browser-consoles-2.datastore")}</th><td>{v.storage}</td></tr>
            <tr><th>{t("browser-consoles-2.networkAdapter1")}</th><td>{t("browser-consoles-2.vmNetworkState", { state: v.st === "running" ? t("browser-consoles-2.connected") : t("browser-consoles-2.disconnected") })}</td></tr>
            <tr><th>{t("browser-consoles-2.cdDvdDrive1")}</th><td>{v.media ? isoName(v.media) : t("browser-consoles-2.disconnectedCap")}</td></tr>
            <tr><th>{t("browser-consoles-2.compatibility")}</th><td>{compat}</td></tr>
          </tbody></table>
        </section>
        <section className="vsw-portlet"><h4>{t("browser-consoles-2.notes")}</h4><p>{v.sub}</p></section>
      </div>
    </>
  );
}

// Monitor, Performance, Overview: the day's CPU, memory, network and disk as blue lines.
export function VmMonitor({ game, v }: { game: GameState; v: Vm }) {
  const ring = vmStats(game, v.id)!.ring, w = v.w, end = game.hour, net = ring.map((x) => x.netMbit), mhz = ring.map((x) => x.cpu * w.vcpu * MHZ);
  return (
    <>
      <h4 className="vsw-perf">{t("browser-consoles-2.perfChart")} <span>{t("browser-consoles-2.periodLastDay")}</span></h4>
      <div className="cx-charts">
        <Chart className="vsw-chart" kind="line" title={t("browser-consoles-2.cpuMhz")} unit="MHz" values={mhz} max={niceMax([w.vcpu * MHZ])} end={end} />
        <Chart className="vsw-chart" kind="line" title={t("browser-consoles-2.memoryPct")} values={ring.map((x) => x.ram)} end={end} />
        <Chart className="vsw-chart" kind="line" title={t("browser-consoles-2.networkMbps")} unit="Mbps" values={net} max={niceMax(net)} end={end} />
        <Chart className="vsw-chart" kind="line" title={t("browser-consoles-2.diskPct")} values={ring.map((x) => x.disk)} end={end} />
      </div>
    </>
  );
}

const hostState = (): Record<NodeState, string> => ({ active: t("browser-consoles-2.hostConnected"), cordoned: t("browser-consoles-2.hostCordoned"), draining: t("browser-consoles-2.hostEntering"), maintenance: t("browser-consoles-2.hostMaintenance") });
const status = (): Record<Severity, [string, string]> => ({ critical: [t("browser-consoles-2.alert"), "bad"], warning: [t("browser-consoles-2.warning"), "warn"] });
const Status = ({ sev }: { sev: Severity | null }) => <span className={`cx-state ${sev ? status()[sev][1] : "ok"}`}>{sev ? status()[sev][0] : t("browser-consoles-2.normal")}</span>;
const Use = ({ k, a }: { k: keyof Amounts; a: Amount }) => (
  <td><CapacityBar a={a} /><span className="cx-use num">{t("browser-consoles-2.allocatedUsed", { allocated: AMOUNT[k](a.allocated), capacity: AMOUNT[k](a.capacity), used: AMOUNT[k](a.used) })}</span></td>
);

// The cluster or host Summary tab: capacity like vSphere's resource meters, the host table, triggered alarms and every VM.
function ClusterSummaryView({ game, c, node, vms, pick }: { game: GameState; c: Cluster; node: string | null; vms: Vm[]; pick: (s: Sel) => void }) {
  const { sum, use, alarms } = summaryOf(game, c, node), act = useStore((s) => s.act);
  const rows: [string, keyof Amounts][] = [["CPU", "vcpu"], [t("browser-consoles-2.memoryCaps"), "ramGb"], [t("browser-consoles-2.storageCaps"), "diskGb"]];
  return (
    <>
      <div className="vsw-portlets">
        <section className="vsw-portlet">
          <h4>{node ? t("browser-consoles-2.hostResources") : t("browser-consoles-2.clusterResources")}</h4>
          <div className="vsw-meters vsw-cap">
            {rows.map(([label, k]) => <div key={k}><small>{label}</small><b className="num">{amountText(k, use[k])}</b><CapacityBar a={use[k]} /></div>)}
          </div>
        </section>
        <section className="vsw-portlet">
          <h4>{t("browser-consoles-2.triggeredAlarms", { n: alarms.length })}</h4>
          <AlarmList game={game} c={c} alarms={alarms} className="cx-table vsw-alarms" />
        </section>
        {!node && (
          <section className="vsw-portlet">
            <h4>{t("readouts.evc")}</h4>
            <Facts facts={[{ label: t("browser-consoles-2.status"), value: c.compat ? t("readouts.evc.on") : t("readouts.evc.off") }, { label: t("readouts.evc.cost"), value: `${Math.round((1 - COMPAT_VCPU) * 100)} %`, num: true }]} />
            <div className="cx-tools"><button className="cx-btn" onClick={() => act(setCompatMode, c.id, !c.compat)}>{c.compat ? t("readouts.evc.disable") : t("readouts.evc.enable")}</button></div>
          </section>
        )}
      </div>
      {!node && (
        <table className="cx-table">
          <thead><tr><th>{t("browser-consoles-2.host")}</th><th>{t("browser-consoles-2.state")}</th><th>{t("browser-consoles-2.status")}</th><th>CPU</th><th>{t("browser-consoles-2.memory")}</th><th>{t("browser-consoles-2.storage")}</th><th>VMs</th><th /></tr></thead>
          <tbody>
            {sum.hosts.map((h) => (
              <tr key={h.deviceId} onClick={() => pick({ kind: "node", id: h.deviceId })}>
                <td><b>{h.name}</b></td><td>{h.up ? hostState()[h.state] : t("browser-consoles-2.notResponding")}</td>
                <td><Status sev={worst(sum.alarms.filter((a) => a.on.id === h.deviceId))} /></td>
                <Use k="vcpu" a={h.use.vcpu} /><Use k="ramGb" a={h.use.ramGb} /><Use k="diskGb" a={h.use.diskGb} /><td className="num">{h.vms}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  {h.state === "active" || h.state === "cordoned"
                    ? <button className="cx-btn" onClick={() => act(enterMaintenance, c.id, h.deviceId)}>{t("vw.enterMaintenance")}</button>
                    : <button className="cx-btn" onClick={() => act(exitMaintenance, c.id, h.deviceId)}>{t("vw.exitMaintenance")}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <table className="cx-table">
        <thead><tr><th>{t("browser-consoles-2.name")}</th><th>{t("browser-consoles-2.state")}</th><th>{t("browser-consoles-2.status")}</th><th>{t("browser-consoles-2.host")}</th><th>CPUs</th><th>{t("browser-consoles-2.memory")}</th><th>{t("browser-consoles-2.hostMem")}</th><th>{t("browser-consoles-2.provisionedSpace")}</th><th>{t("browser-consoles-2.usedSpace")}</th><th>{t("browser-consoles-2.hostCpu")}</th></tr></thead>
        <tbody>
          {vms.map((v) => (
            <tr key={v.id} onClick={() => pick({ kind: "vm", id: v.id })}>
              <td><b>{v.name}</b>{v.sub && <span className="cx-sub">{v.sub}</span>}</td>
              <td>{v.w.template ? t("browser-consoles-2.template") : v.st === "stopped" ? t("browser-consoles-2.poweredOff") : v.st === "running" ? t("browser-consoles-2.poweredOn") : v.state}</td>
              <td><Status sev={worst(sum.alarms.filter((a) => a.on.id === v.id)) ?? (v.tone === "bad" ? "critical" : null)} /></td>
              <td>{v.node}</td><td className="num">{v.w.vcpu}</td><td className="num">{gb(v.w.ramGb)}</td><td className="num">{gb(v.use.ramGb)}</td>
              <td className="num">{gb(v.w.diskGb)}</td><td className="num">{gb(v.use.diskGb)}</td><td className="num">{Math.round(v.use.vcpu * MHZ)} MHz</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

const Badge = ({ alarms }: { alarms: Alarm[] }) => {
  const sev = worst(alarms);
  return sev ? <em className="vsw-badge" data-sev={sev}>{SEV_GLYPH[sev]} {alarms.length}</em> : null;
};

const PROTOCOL: Record<DatastoreProtocol, string> = { nfs: "NFS", iscsi: "iSCSI", fc: "Fibre Channel" };
// Where a new VM of that size puts its disk.
const storageFacts = (game: GameState, c: Cluster, size: Resources) => {
  const x = c.datastores.find((v) => v.deviceId === withDatastore(game, c, size).datastore);
  return x ? [{ label: t("browser-consoles-2.datastore"), value: nodeName(game, x.deviceId) }, { label: t("browser-consoles-2.type"), value: PROTOCOL[x.protocol] }] : [{ label: t("browser-consoles-2.datastore"), value: "datastore1" }, { label: t("browser-consoles-2.type"), value: "VMFS" }];
};

// The Snapshots tab of a VM: its snapshots oldest first with their delta, and the buttons that take, revert and delete them.
function Snapshots({ v }: { v: Vm }) {
  const act = useStore((s) => s.act), list = v.w.snapshots ?? [];
  return (
    <>
      <table className="cx-table">
        <thead><tr><th>{t("browser-consoles-2.name")}</th><th>{t("browser-consoles-2.taken")}</th><th>{t("browser-consoles-2.size")}</th><th /></tr></thead>
        <tbody>
          {list.map((x, i) => (
            <tr key={x.id}>
              <td>{t("browser-consoles-2.snapshotN", { n: i + 1 })}</td><td>{day(x.at)}, {String(x.at % 24).padStart(2, "0")}:00</td><td className="num">{gb(x.deltaGb)}</td>
              <td>
                <button className="cx-btn" onClick={() => act(revertSnapshot, v.id, x.id)}>{t("browser-consoles-2.revert")}</button>{" "}
                <button className="cx-btn" onClick={() => act(deleteSnapshot, v.id, x.id)}>{t("browser-consoles-2.delete")}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length < SNAPSHOTS_MAX && <div className="cx-inline"><button className="cx-btn primary" onClick={() => act(takeSnapshot, v.id)}>{t("browser-consoles-2.takeSnapshot")}</button></div>}
    </>
  );
}

// The Datastores tab: each host's local disk, the shared datastores with their use, and the form that attaches a server as one.
function Datastores({ game, c }: { game: GameState; c: Cluster }) {
  const act = useStore((s) => s.act), year = yearOf(game.hour);
  const free = game.devices.filter((d) => modelById(d.model).server && !datastoreBlock(game, c, d.id));
  const protocols = (Object.keys(DATASTORE_FROM) as DatastoreProtocol[]).filter((x) => DATASTORE_FROM[x] <= year);
  const [pick, setPick] = useState(""), [protocol, setProtocol] = useState<DatastoreProtocol>("nfs");
  const server = free.some((d) => d.id === pick) ? pick : free[0]?.id ?? "";
  return (
    <>
      <table className="cx-table">
        <thead><tr><th>{t("browser-consoles-2.name")}</th><th>{t("browser-consoles-2.type")}</th><th>{t("browser-consoles-2.speed")}</th><th>{t("browser-consoles-2.used")}</th><th>{t("browser-consoles-2.capacity")}</th><th>{t("browser-consoles-2.status")}</th><th /></tr></thead>
        <tbody>
          {c.nodes.map((n) => game.devices.find((d) => d.id === n.deviceId)).filter((d) => !!d).map((d) => (
            <tr key={d.id}>
              <td>datastore1 ({nodeName(game, d.id)})</td><td>VMFS</td><td>{t("browser-consoles-2.local")}</td>
              <td className="num">{gb(nodeUsed(game, d.id).diskGb)}</td><td className="num">{gb(bookable(game, d).diskGb)}</td>
              <td>{working(game, d.id) ? t("browser-consoles-2.normal") : t("browser-consoles-2.inaccessible")}</td><td />
            </tr>
          ))}
          {c.datastores.map((x) => (
            <tr key={x.deviceId}>
              <td>{nodeName(game, x.deviceId)}</td><td>{PROTOCOL[x.protocol]}</td><td className="num">{datastoreGbit(game, x)} Gbit/s</td>
              <td className="num">{gb(datastoreUsed(game, x.deviceId))}</td><td className="num">{gb(datastoreCapacity(game, x.deviceId))}</td>
              <td>{x.readyAt > game.hour ? t("browser-consoles-2.mounting") : working(game, x.deviceId) ? t("browser-consoles-2.normal") : t("browser-consoles-2.inaccessible")}</td>
              <td><button className="cx-btn" onClick={() => act(detachDatastore, c.id, x.deviceId)}>{t("browser-consoles-2.unmount")}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {c.datastores.length < DATASTORES_MAX && free.length > 0 && (
        <div className="cx-inline">
          <label className="cx-field">{t("browser-consoles-2.server")}
            <select value={server} onChange={(e) => setPick(e.target.value)}>
              {free.map((d) => <option key={d.id} value={d.id}>{nodeName(game, d.id)}</option>)}
            </select>
          </label>
          <label className="cx-field">{t("browser-consoles-2.protocol")}
            <select value={protocol} onChange={(e) => setProtocol(e.target.value as DatastoreProtocol)}>
              {protocols.map((x) => <option key={x} value={x}>{x === "fc" ? `${PROTOCOL.fc}, ${euro(FC_HBA_PRICE * c.nodes.length)}` : PROTOCOL[x]}</option>)}
            </select>
          </label>
          <button className="cx-btn primary" onClick={() => act(attachDatastore, c.id, server, protocol)}>{t("browser-consoles-2.newDatastore")}</button>
        </div>
      )}
    </>
  );
}

export function VmWhere(p: PanelProps) {
  const era = eraAt(ERAS, p.game), { game, c, f } = p, year = yearOf(game.hour);
  const open = parseCreate("vmwhere", p.path), [sel, setSel] = useState<Sel>(open?.screen === "create" ? { kind: "new" } : open?.screen === "packages" ? { kind: "plans" } : ALL), [tab, setTab] = useState("Summary");
  const [byOrder, setByOrder] = useState(open?.screen === "create" && !!open.order);
  const tabNames: Record<string, string> = { Summary: t("browser-consoles-2.summary"), Monitor: t("browser-consoles-2.monitor"), Configure: t("browser-consoles-2.configure"), Snapshots: t("browser-consoles-2.snapshots"), Hosts: t("browser-consoles-2.hosts"), Datastores: t("browser-consoles-2.datastores"), Networks: t("browser-consoles-2.networks"), Licensing: t("vw.licensing"), DRS: t("vw.drs"), Alarms: t("vw.alarm.alarms"), Pools: t("vw.pool.pools") };
  const { vms, dialog } = useVms(game, c, f), sw = useSoftware(game, c, f), nv = useNewVm(game, c, open?.screen === "create" ? open.order : undefined);
  if (!p.signedIn) return (
    <div className="cx vsw vsw-login" data-era={era}>
      <LoginForm className="vsw-card" onLogin={p.login} button={t("browser-consoles-2.logIn")}>
        <div className="vsw-brand">VMwhere <b>vSphear</b>{era === "early" ? ` ${t("browser-consoles-2.client")}` : ` ${t("browser-consoles-2.webClient")}`}</div>
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  const pick = (s: Sel, tb = "Summary") => { setSel(s); setTab(tb); };
  const vm = sel.kind === "vm" ? vms.find((v) => v.id === sel.id) : undefined, node = sel.kind === "node" ? sel.id : null;
  const nodes = c.nodes.map((n) => game.devices.find((d) => d.id === n.deviceId)!).filter(Boolean);
  const tabs = vm ? ["Summary", "Monitor", "Configure", ...(vm.w.deviceId ? ["Snapshots"] : [])] : ["Summary", "Monitor", "Configure", ...(node ? [] : ["Hosts"]), "Datastores", "Networks", ...(node ? [] : ["DRS", "Alarms", "Pools"]), "Licensing"];
  const shown = tabs.includes(tab) ? tab : "Summary", facts = vm && vmFacts(game, vm);
  const app = nv.suite ? suiteSoftware(year).find((x) => x.id === nv.suite) : undefined, appOs = app && serverOsById(app.os[0]);
  const finish = () => { if (byOrder) { if (nv.submit()) setSel(ALL); return; } const id = nv.create(); if (id) pick({ kind: "vm", id }); };
  const list = vms.filter((v) => !node || v.w.deviceId === node), alarms = clusterSummary(game, c.id).alarms;
  return (
    <div className="cx cx-hv vsw" data-era={era}>
      <header className="vsw-top">
        <span className="vsw-brand">VMwhere <b>vSphear</b>{era === "early" ? ` ${t("browser-consoles-2.client")}` : ""}</span>
        <span className="cx-host">{p.host}</span>
        <button className="vsw-link" onClick={p.logout}>{t("browser-consoles-2.logOutCap")}</button>
      </header>
      {era === "early" && (
        <div className="vsw-menu"><span>{t("browser-consoles-2.file")}</span><span>{t("browser-consoles-2.edit")}</span><span>{t("browser-consoles-2.view")}</span><span>{t("browser-consoles-2.inventory")}</span><span>{t("browser-consoles-2.administration")}</span><span>{t("browser-consoles-2.help")}</span></div>
      )}
      <div className="vsw-bar">
        {f.create && <button onClick={() => setSel({ kind: "new" })}><i aria-hidden>✚</i>{t("browser-consoles-2.newVm")}</button>}
        {vm && <Toolbar actions={vm.actions} labels={labels()} className="cx-toolbar vsw-tools" />}
      </div>
      <div className="cx-hv-body">
        <aside className="cx-hv-tree vsw-tree">
          <div className="vsw-tree-h">{t("browser-consoles-2.hostsAndClusters")}</div>
          <ul>
            <li><button aria-pressed={sel.kind === "all"} onClick={() => pick(ALL)}><i>▥</i>{c.name}<Badge alarms={alarms} /></button>
              <ul>
                {nodes.map((d) => (
                  <li key={d.id}>
                    <button aria-pressed={node === d.id} onClick={() => pick({ kind: "node", id: d.id })}><i>▦</i>{d.hostname ?? d.name}<Badge alarms={alarms.filter((a) => a.on.id === d.id)} /></button>
                    <ul>
                      {vms.filter((v) => v.w.deviceId === d.id).map((v) => (
                        <li key={v.id}><button aria-pressed={vm?.id === v.id} data-state={v.w.template ? "template" : v.st} onClick={() => pick({ kind: "vm", id: v.id })}><i>{v.w.template ? "⧉" : v.st === "running" ? "▶" : "▫"}</i>{v.name}<Badge alarms={alarms.filter((a) => a.on.id === v.id)} /></button></li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </li>
          </ul>
          <button className="vsw-classes" aria-pressed={sel.kind === "plans"} onClick={() => pick({ kind: "plans" })}><i>▤</i>{t("pkg.vswClasses")}</button>
        </aside>
        <section className="vsw-content">
          <div className="vsw-title">{sel.kind === "plans" ? t("pkg.vswClasses") : vm ? vm.name : node ? nodes.find((d) => d.id === node)?.hostname : c.name}</div>
          <nav className="cx-hv-tabs vsw-tabs" hidden={sel.kind === "plans"}>{tabs.map((tb) => <button key={tb} aria-pressed={tb === shown} onClick={() => setTab(tb)}>{tabNames[tb]}</button>)}</nav>
          <main className="cx-hv-main">
            {sel.kind === "plans" && <PackagesScreen game={game} c={c} />}
            {vm && vm.panel}
            {vm && facts && shown === "Summary" && <VmSummary game={game} v={vm} era={era} />}
            {vm && shown === "Monitor" && <VmMonitor game={game} v={vm} />}
            {vm && shown === "Snapshots" && <Snapshots v={vm} />}
            {vm && facts && shown === "Configure" && (
              <>
                <Facts facts={[{ ...facts.cpu, label: "CPU" }, facts.memory, { ...facts.disk, label: t("browser-consoles-2.hardDisk1") }, { label: t("browser-consoles-2.datastore"), value: vm.storage }, { ...facts.media, label: t("browser-consoles-2.cdDvdDrive1") }, { label: t("browser-consoles-2.networkAdapter1"), value: t("browser-consoles-2.vmNetwork") }, facts.backup]} />
                <MediaMenu game={game} v={vm} label={t("browser-consoles-2.cdDvdIso")} none={t("browser-consoles-2.clientDevice")} />
              </>
            )}
            {!vm && sel.kind !== "plans" && shown === "Summary" && (
              <>
                {!node && <AppSuiteTile c={c} className="cx-suite vsw-suite" />}
                <ClusterSummaryView game={game} c={c} node={node} vms={list} pick={pick} />
              </>
            )}
            {!vm && sel.kind !== "plans" && shown === "Monitor" && <NodeList game={game} c={{ ...c, nodes: c.nodes.filter((n) => !node || n.deviceId === node) }} f={{ ...f, cluster: false }} />}
            {!vm && sel.kind !== "plans" && shown === "Configure" && (
              <>
                <Facts facts={sw.facts} />
                <Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>
                {sw.panel}
                {f.backups && <Backups game={game} c={c} title={<h4 className="cx-h">{t("browser-consoles-2.dataProtection")}</h4>} />}
              </>
            )}
            {!vm && sel.kind !== "plans" && shown === "Hosts" && <NodeList game={game} c={c} f={f} />}
            {!vm && sel.kind !== "plans" && shown === "Licensing" && <Licensing game={game} c={c} />}
            {!vm && sel.kind !== "plans" && shown === "DRS" && <DrsPage game={game} c={c} />}
            {!vm && sel.kind !== "plans" && shown === "Alarms" && <AlarmsPage game={game} c={c} />}
            {!vm && sel.kind !== "plans" && shown === "Pools" && <PoolsPage game={game} c={c} />}
            {!vm && sel.kind !== "plans" && shown === "Datastores" && <Datastores game={game} c={c} />}
            {!vm && sel.kind !== "plans" && shown === "Networks" && <Facts facts={[{ label: t("browser-consoles-2.vmNetwork"), value: "vSwitch0" }, { label: t("browser-consoles-2.managementNetwork"), value: "vSwitch0" }]} />}
          </main>
        </section>
      </div>
      <TaskLog game={game} c={c} vms={vms} title={t("browser-consoles-2.recentTasks")} className="cx-tasks vsw-tasks" />
      {sel.kind === "new" && (
        <div className="cx-wiz-back">
          <Wizard title={t("browser-consoles-2.newVm")} className="vsw-wiz" finish={t("browser-consoles-2.finish")} onCancel={() => setSel(ALL)} onFinish={finish} steps={[
            { id: "type", label: t("browser-consoles-2.selCreationType"), body: (
              <div className="vsw-radios">
                <label className="cx-check"><input type="radio" name="vsw-type" checked={!nv.suite && !byOrder} onChange={() => { nv.setSuite(null); setByOrder(false); }} />{t("browser-consoles-2.createNewVm")}</label>
                <label className="cx-check"><input type="radio" name="vsw-type" checked={byOrder} onChange={() => { nv.setSuite(null); setByOrder(true); }} />{t("pkg.vswCustomerOrder")}</label>
                {byOrder && <div className="vsw-order">{nv.orderFields}</div>}
                {c.appSuite && <label className="cx-check"><input type="radio" name="vsw-type" checked={!!nv.suite && !byOrder} onChange={() => { setByOrder(false); nv.setSuite(suiteSoftware(year)[0]?.id ?? null); }} />{t("browser-consoles-2.deployAppSuite")}</label>}
              </div>
            ) },
            ...(nv.suite ? [{ id: "app", label: t("browser-consoles-2.selAppliance"), body: (
              <table className="cx-table">
                <thead><tr><th /><th>{t("browser-consoles-2.appliance")}</th><th>{t("browser-consoles-2.guestOs")}</th></tr></thead>
                <tbody>
                  {suiteSoftware(year).map((x) => (
                    <tr key={x.id} onClick={() => nv.setSuite(x.id)}>
                      <td><input type="radio" name="vsw-app" checked={nv.suite === x.id} onChange={() => nv.setSuite(x.id)} /></td><td>{x.console}</td><td>{serverOsById(x.os[0]).name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) }] : [{ id: "name", label: t("browser-consoles-2.selNameFolder"), body: <Facts facts={[{ label: t("browser-consoles-2.location"), value: c.name }]} /> }]),
            { id: "compute", label: t("browser-consoles-2.selCompute"), body: <Facts facts={[{ label: t("browser-consoles-2.cluster"), value: c.name }, { label: t("browser-consoles-2.hosts"), value: String(nodes.length), num: true }]} /> },
            { id: "storage", label: t("browser-consoles-2.selStorage"), body: <Facts facts={storageFacts(game, c, nv.size)} /> },
            { id: "hardware", label: t("browser-consoles-2.customizeHardware"), body: (
              <>
                <SizeFields size={nv.size} set={nv.setSize} labels={["CPU", t("browser-consoles-2.memoryGbComma"), t("browser-consoles-2.newHardDiskGb")]} />
                {!nv.suite && nv.isoPick(t("browser-consoles-2.newCdDvd"), t("browser-consoles-2.clientDevice"))}
              </>
            ) },
            { id: "ready", label: t("browser-consoles-2.readyToComplete"), body: <Facts facts={[
              { label: t("browser-consoles-2.cluster"), value: c.name },
              ...(app && appOs ? [{ label: t("browser-consoles-2.appliance"), value: app.console }, { label: t("browser-consoles-2.guestOs"), value: appOs.name }] : [{ label: t("browser-consoles-2.cdDvdDrive2"), value: nv.isoLabel ?? t("browser-consoles-2.clientDevice"), num: !!nv.isoLabel }]),
              { label: "CPU", value: String(nv.size.vcpu), num: true }, { label: t("browser-consoles-2.memory"), value: `${nv.size.ramGb} GB`, num: true }, { label: t("browser-consoles-2.hardDisk2"), value: `${nv.size.diskGb} GB`, num: true },
              ...(appOs?.id === "windoors" ? [{ label: t("browser-consoles-2.windoorsServerLicence"), value: windoorsLicence(year) }] : []),
            ]} /> },
          ]} />
        </div>
      )}
      {dialog}
    </div>
  );
}
