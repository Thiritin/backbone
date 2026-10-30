import { useState } from "react";
import { yearOf } from "../../../../../sim/00-core/time";
import { serverOsById } from "../../../../../sim/10-catalog/server-os";
import { euro } from "../../../../../sim/00-core/money";
import { modelById } from "../../../../../sim/10-catalog/hardware";
import { DATASTORE_FROM, DATASTORES_MAX, FC_HBA_PRICE, type DatastoreProtocol } from "../../../../../sim/10-catalog/platforms";
import { attachDatastore, datastoreBlock, detachDatastore } from "../../../../../sim/90-actions/datastores";
import { working } from "../../../../../sim/60-infra/status";
import { useStore } from "../../../../store";
import type { GameState } from "../../../../../sim/50-state";
import { vmStats } from "../../../../../sim/60-infra/stats";
import { clusterSummary, type Alarm, type Amount, type Amounts, type Severity } from "../../../../../sim/60-infra/alarms";
import { withDatastore, bookable, datastoreCapacity, datastoreGbit, datastoreUsed, nodeUsed, type Cluster, type NodeState } from "../../../../../sim/60-infra/cluster";
import { Chart, niceMax } from "../Chart";
import { nodeName, AlarmList, ALL, AMOUNT, amountText, AppSuiteTile, CapacityBar, SEV_GLYPH, summaryOf, worst, ConsoleThumb, isoName, MediaMenu, NodeList, SizeFields, suiteSoftware, TaskLog, Toolbar, useNewVm, useVms, vmFacts, windoorsLicence, Wizard, type Sel, type Vm } from "../HypervisorBase";
import { Actions, Backups, Bar, erasFrom, eraAt, Facts, LoginForm, useSoftware, type PanelProps } from "../PanelBase";
import type { Look } from "../../../../../sim/10-catalog/sites";
import type { Resources } from "../../../../../sim/10-catalog/products";
import "./vmwhere.css";

// docs/design/software.md, section 9: the grey and yellow fat client from 2005, the blue web client from 2015.
const ERAS = erasFrom(2005, 2015);
const LABELS = { start: "Power On", stop: "Shut Down Guest OS", reset: "Reset", migrate: "Migrate", storage: "Migrate Storage", resize: "Edit Settings", console: "Open Console", delete: "Delete from Disk", restore: "Restore", recover: "Recover" };

const MHZ = 2400;
const gb = (x: number) => `${+x.toFixed(2)} GB`;

// The Summary tab: the console thumbnail beside the guest facts, the usage meters on the right, the hardware and notes portlets.
export function VmSummary({ game, v, era }: { game: GameState; v: Vm; era: Look }) {
  const now = vmStats(game, v.id)!.now, w = v.w, compat = era === "early" ? "VMwhere 3.0 and later (VM version 4)" : "vSphear 6.0 and later (VM version 11)";
  const tools = v.own && w.os && v.st === "running" ? "Running, version current" : "Not running, not installed";
  const meters: [string, string, [number, number]][] = [
    ["CPU USAGE", `${Math.round(now.cpu * w.vcpu * MHZ)} MHz`, [now.cpu, 1]], ["MEMORY USAGE", gb(now.ram * w.ramGb), [now.ram, 1]], ["STORAGE USAGE", gb(now.disk * w.diskGb), [now.disk, 1]],
  ];
  return (
    <>
      <div className="vsw-summary">
        <div className="vsw-thumbbox">
          <ConsoleThumb game={game} v={v} className="cx-thumb vsw-thumb" />
          {v.own && <span className="vsw-launch">{era === "early" ? "Open Console" : "Launch Web Console"}</span>}
        </div>
        <table className="vsw-facts"><tbody>
          <tr><th>Guest OS</th><td>{v.own ? v.os : v.sub}</td></tr>
          <tr><th>Compatibility</th><td>{compat}</td></tr>
          <tr><th>VMwhere Tools</th><td>{tools}</td></tr>
          <tr><th>DNS Name</th><td>{w.hostname ?? v.name}</td></tr>
          <tr><th>IP Addresses</th><td className="num">{v.ip}</td></tr>
          <tr><th>Host</th><td>{v.node}</td></tr>
        </tbody></table>
        <div className="vsw-meters">
          {meters.map(([label, value, use]) => <div key={label}><small>{label}</small><b className="num">{value}</b><Bar use={use} /></div>)}
        </div>
      </div>
      <div className="vsw-portlets">
        <section className="vsw-portlet">
          <h4>VM Hardware</h4>
          <table><tbody>
            <tr><th>CPU</th><td className="num">{w.vcpu} CPU(s), {Math.round(now.cpu * w.vcpu * MHZ)} MHz used</td></tr>
            <tr><th>Memory</th><td className="num">{w.ramGb} GB, {gb(now.ram * w.ramGb)} memory active</td></tr>
            <tr><th>Hard disk 1</th><td className="num">{w.diskGb} GB</td></tr>
            <tr><th>Datastore</th><td>{v.storage}</td></tr>
            <tr><th>Network adapter 1</th><td>VM Network ({v.st === "running" ? "connected" : "disconnected"})</td></tr>
            <tr><th>CD/DVD drive 1</th><td>{v.media ? isoName(v.media, yearOf(game.hour)) : "Disconnected"}</td></tr>
            <tr><th>Compatibility</th><td>{compat}</td></tr>
          </tbody></table>
        </section>
        <section className="vsw-portlet"><h4>Notes</h4><p>{v.sub}</p></section>
      </div>
    </>
  );
}

// Monitor, Performance, Overview: the day's CPU, memory, network and disk as blue lines.
export function VmMonitor({ game, v }: { game: GameState; v: Vm }) {
  const ring = vmStats(game, v.id)!.ring, w = v.w, end = game.hour, net = ring.map((x) => x.netMbit), mhz = ring.map((x) => x.cpu * w.vcpu * MHZ);
  return (
    <>
      <h4 className="vsw-perf">Performance Chart, Overview <span>Period: Last day</span></h4>
      <div className="cx-charts">
        <Chart className="vsw-chart" kind="line" title="CPU (MHz)" unit="MHz" values={mhz} max={niceMax([w.vcpu * MHZ])} end={end} />
        <Chart className="vsw-chart" kind="line" title="Memory (%)" values={ring.map((x) => x.ram)} end={end} />
        <Chart className="vsw-chart" kind="line" title="Network (Mbps)" unit="Mbps" values={net} max={niceMax(net)} end={end} />
        <Chart className="vsw-chart" kind="line" title="Disk (%)" values={ring.map((x) => x.disk)} end={end} />
      </div>
    </>
  );
}

const HOST_STATE: Record<NodeState, string> = { active: "Connected", cordoned: "Connected, cordoned", draining: "Entering Maintenance Mode", maintenance: "Maintenance Mode" };
const STATUS: Record<Severity, [string, string]> = { critical: ["Alert", "bad"], warning: ["Warning", "warn"] };
const Status = ({ sev }: { sev: Severity | null }) => <span className={`cx-state ${sev ? STATUS[sev][1] : "ok"}`}>{sev ? STATUS[sev][0] : "Normal"}</span>;
const Use = ({ k, a }: { k: keyof Amounts; a: Amount }) => (
  <td><CapacityBar a={a} /><span className="cx-use num">{AMOUNT[k](a.allocated)} / {AMOUNT[k](a.capacity)}, {AMOUNT[k](a.used)} used</span></td>
);

// The cluster or host Summary tab: capacity like vSphere's resource meters, the host table, triggered alarms and every VM.
function ClusterSummaryView({ game, c, node, vms, pick }: { game: GameState; c: Cluster; node: string | null; vms: Vm[]; pick: (s: Sel) => void }) {
  const { sum, use, alarms } = summaryOf(game, c, node);
  const rows: [string, keyof Amounts][] = [["CPU", "vcpu"], ["MEMORY", "ramGb"], ["STORAGE", "diskGb"]];
  return (
    <>
      <div className="vsw-portlets">
        <section className="vsw-portlet">
          <h4>{node ? "Host Resources" : "Cluster Resources"}</h4>
          <div className="vsw-meters vsw-cap">
            {rows.map(([label, k]) => <div key={k}><small>{label}</small><b className="num">{amountText(k, use[k])}</b><CapacityBar a={use[k]} /></div>)}
          </div>
        </section>
        <section className="vsw-portlet">
          <h4>Triggered Alarms ({alarms.length})</h4>
          <AlarmList game={game} c={c} alarms={alarms} className="cx-table vsw-alarms" />
        </section>
      </div>
      {!node && (
        <table className="cx-table">
          <thead><tr><th>Host</th><th>State</th><th>Status</th><th>CPU</th><th>Memory</th><th>Storage</th><th>VMs</th></tr></thead>
          <tbody>
            {sum.hosts.map((h) => (
              <tr key={h.deviceId} onClick={() => pick({ kind: "node", id: h.deviceId })}>
                <td><b>{h.name}</b></td><td>{h.up ? HOST_STATE[h.state] : "Not Responding"}</td>
                <td><Status sev={worst(sum.alarms.filter((a) => a.on.id === h.deviceId))} /></td>
                <Use k="vcpu" a={h.use.vcpu} /><Use k="ramGb" a={h.use.ramGb} /><Use k="diskGb" a={h.use.diskGb} /><td className="num">{h.vms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <table className="cx-table">
        <thead><tr><th>Name</th><th>State</th><th>Status</th><th>Host</th><th>CPUs</th><th>Memory</th><th>Host Mem</th><th>Provisioned Space</th><th>Used Space</th><th>Host CPU</th></tr></thead>
        <tbody>
          {vms.map((v) => (
            <tr key={v.id} onClick={() => pick({ kind: "vm", id: v.id })}>
              <td><b>{v.name}</b>{v.sub && <span className="cx-sub">{v.sub}</span>}</td>
              <td>{v.st === "stopped" ? "Powered Off" : v.st === "running" ? "Powered On" : v.state}</td>
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
  return x ? [{ label: "Datastore", value: nodeName(game, x.deviceId) }, { label: "Type", value: PROTOCOL[x.protocol] }] : [{ label: "Datastore", value: "datastore1" }, { label: "Type", value: "VMFS" }];
};

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
        <thead><tr><th>Name</th><th>Type</th><th>Speed</th><th>Used</th><th>Capacity</th><th>Status</th><th /></tr></thead>
        <tbody>
          {c.nodes.map((n) => game.devices.find((d) => d.id === n.deviceId)).filter((d) => !!d).map((d) => (
            <tr key={d.id}>
              <td>datastore1 ({nodeName(game, d.id)})</td><td>VMFS</td><td>Local</td>
              <td className="num">{gb(nodeUsed(game, d.id).diskGb)}</td><td className="num">{gb(bookable(game, d).diskGb)}</td>
              <td>{working(game, d.id) ? "Normal" : "Inaccessible"}</td><td />
            </tr>
          ))}
          {c.datastores.map((x) => (
            <tr key={x.deviceId}>
              <td>{nodeName(game, x.deviceId)}</td><td>{PROTOCOL[x.protocol]}</td><td className="num">{datastoreGbit(game, x)} Gbit/s</td>
              <td className="num">{gb(datastoreUsed(game, x.deviceId))}</td><td className="num">{gb(datastoreCapacity(game, x.deviceId))}</td>
              <td>{x.readyAt > game.hour ? "Mounting" : working(game, x.deviceId) ? "Normal" : "Inaccessible"}</td>
              <td><button className="cx-btn" onClick={() => act(detachDatastore, c.id, x.deviceId)}>Unmount</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {c.datastores.length < DATASTORES_MAX && free.length > 0 && (
        <div className="cx-inline">
          <label className="cx-field">Server
            <select value={server} onChange={(e) => setPick(e.target.value)}>
              {free.map((d) => <option key={d.id} value={d.id}>{nodeName(game, d.id)}</option>)}
            </select>
          </label>
          <label className="cx-field">Protocol
            <select value={protocol} onChange={(e) => setProtocol(e.target.value as DatastoreProtocol)}>
              {protocols.map((x) => <option key={x} value={x}>{x === "fc" ? `${PROTOCOL.fc}, ${euro(FC_HBA_PRICE * c.nodes.length)}` : PROTOCOL[x]}</option>)}
            </select>
          </label>
          <button className="cx-btn primary" onClick={() => act(attachDatastore, c.id, server, protocol)}>New Datastore</button>
        </div>
      )}
    </>
  );
}

export function VmWhere(p: PanelProps) {
  const era = eraAt(ERAS, p.game), { game, c, f } = p, year = yearOf(game.hour);
  const [sel, setSel] = useState<Sel>(ALL), [tab, setTab] = useState("Summary");
  const { vms, dialog } = useVms(game, c, f), sw = useSoftware(game, c, f), nv = useNewVm(game, c);
  if (!p.signedIn) return (
    <div className="cx vsw vsw-login" data-era={era}>
      <LoginForm className="vsw-card" onLogin={p.login} button="Log in">
        <div className="vsw-brand">VMwhere <b>vSphear</b>{era === "early" ? " Client" : " Web Client"}</div>
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  const pick = (s: Sel, t = "Summary") => { setSel(s); setTab(t); };
  const vm = sel.kind === "vm" ? vms.find((v) => v.id === sel.id) : undefined, node = sel.kind === "node" ? sel.id : null;
  const nodes = c.nodes.map((n) => game.devices.find((d) => d.id === n.deviceId)!).filter(Boolean);
  const tabs = vm ? ["Summary", "Monitor", "Configure"] : ["Summary", "Monitor", "Configure", ...(node ? [] : ["Hosts"]), "Datastores", "Networks"];
  const shown = tabs.includes(tab) ? tab : "Summary", facts = vm && vmFacts(game, vm);
  const app = nv.suite ? suiteSoftware(year).find((x) => x.id === nv.suite) : undefined, appOs = app && serverOsById(app.os[0]);
  const finish = () => { const id = nv.create(); if (id) pick({ kind: "vm", id }); };
  const list = vms.filter((v) => !node || v.w.deviceId === node), alarms = clusterSummary(game, c.id).alarms;
  return (
    <div className="cx cx-hv vsw" data-era={era}>
      <header className="vsw-top">
        <span className="vsw-brand">VMwhere <b>vSphear</b>{era === "early" ? " Client" : ""}</span>
        <span className="cx-host">{p.host}</span>
        <button className="vsw-link" onClick={p.logout}>Log Out</button>
      </header>
      {era === "early" && (
        <div className="vsw-menu"><span>File</span><span>Edit</span><span>View</span><span>Inventory</span><span>Administration</span><span>Help</span></div>
      )}
      <div className="vsw-bar">
        {f.create && <button onClick={() => setSel({ kind: "new" })}><i aria-hidden>✚</i>New Virtual Machine</button>}
        {vm && <Toolbar actions={vm.actions} labels={LABELS} className="cx-toolbar vsw-tools" />}
      </div>
      <div className="cx-hv-body">
        <aside className="cx-hv-tree vsw-tree">
          <div className="vsw-tree-h">Hosts and Clusters</div>
          <ul>
            <li><button aria-pressed={sel.kind === "all"} onClick={() => pick(ALL)}><i>▥</i>{c.name}<Badge alarms={alarms} /></button>
              <ul>
                {nodes.map((d) => (
                  <li key={d.id}>
                    <button aria-pressed={node === d.id} onClick={() => pick({ kind: "node", id: d.id })}><i>▦</i>{d.hostname ?? d.name}<Badge alarms={alarms.filter((a) => a.on.id === d.id)} /></button>
                    <ul>
                      {vms.filter((v) => v.w.deviceId === d.id).map((v) => (
                        <li key={v.id}><button aria-pressed={vm?.id === v.id} data-state={v.st} onClick={() => pick({ kind: "vm", id: v.id })}><i>{v.st === "running" ? "▶" : "▫"}</i>{v.name}<Badge alarms={alarms.filter((a) => a.on.id === v.id)} /></button></li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </li>
          </ul>
        </aside>
        <section className="vsw-content">
          <div className="vsw-title">{vm ? vm.name : node ? nodes.find((d) => d.id === node)?.hostname : c.name}</div>
          <nav className="cx-hv-tabs vsw-tabs">{tabs.map((t) => <button key={t} aria-pressed={t === shown} onClick={() => setTab(t)}>{t}</button>)}</nav>
          <main className="cx-hv-main">
            {vm && vm.panel}
            {vm && facts && shown === "Summary" && <VmSummary game={game} v={vm} era={era} />}
            {vm && shown === "Monitor" && <VmMonitor game={game} v={vm} />}
            {vm && facts && shown === "Configure" && (
              <>
                <Facts facts={[{ ...facts.cpu, label: "CPU" }, facts.memory, { ...facts.disk, label: "Hard disk 1" }, { label: "Datastore", value: vm.storage }, { ...facts.media, label: "CD/DVD drive 1" }, { label: "Network adapter 1", value: "VM Network" }, facts.backup]} />
                <MediaMenu game={game} v={vm} label="CD/DVD drive 1, datastore ISO file" none="Client device" />
              </>
            )}
            {!vm && shown === "Summary" && (
              <>
                {!node && <AppSuiteTile c={c} className="cx-suite vsw-suite" />}
                <ClusterSummaryView game={game} c={c} node={node} vms={list} pick={pick} />
              </>
            )}
            {!vm && shown === "Monitor" && <NodeList game={game} c={{ ...c, nodes: c.nodes.filter((n) => !node || n.deviceId === node) }} f={{ ...f, cluster: false }} />}
            {!vm && shown === "Configure" && (
              <>
                <Facts facts={sw.facts} />
                <Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>
                {sw.panel}
                {f.backups && <Backups game={game} c={c} title={<h4 className="cx-h">vSphear Data Protection</h4>} />}
              </>
            )}
            {!vm && shown === "Hosts" && <NodeList game={game} c={c} f={f} />}
            {!vm && shown === "Datastores" && <Datastores game={game} c={c} />}
            {!vm && shown === "Networks" && <Facts facts={[{ label: "VM Network", value: "vSwitch0" }, { label: "Management Network", value: "vSwitch0" }]} />}
          </main>
        </section>
      </div>
      <TaskLog game={game} c={c} vms={vms} title="Recent Tasks" className="cx-tasks vsw-tasks" />
      {sel.kind === "new" && (
        <div className="cx-wiz-back">
          <Wizard title="New Virtual Machine" className="vsw-wiz" finish="Finish" onCancel={() => setSel(ALL)} onFinish={finish} steps={[
            { id: "type", label: "Select a creation type", body: (
              <div className="vsw-radios">
                <label className="cx-check"><input type="radio" name="vsw-type" checked={!nv.suite} onChange={() => nv.setSuite(null)} />Create a new virtual machine</label>
                {c.appSuite && <label className="cx-check"><input type="radio" name="vsw-type" checked={!!nv.suite} onChange={() => nv.setSuite(suiteSoftware(year)[0]?.id ?? null)} />Deploy from App Suite</label>}
              </div>
            ) },
            ...(nv.suite ? [{ id: "app", label: "Select an appliance", body: (
              <table className="cx-table">
                <thead><tr><th /><th>Appliance</th><th>Guest OS</th></tr></thead>
                <tbody>
                  {suiteSoftware(year).map((x) => (
                    <tr key={x.id} onClick={() => nv.setSuite(x.id)}>
                      <td><input type="radio" name="vsw-app" checked={nv.suite === x.id} onChange={() => nv.setSuite(x.id)} /></td><td>{x.console}</td><td>{serverOsById(x.os[0]).name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) }] : [{ id: "name", label: "Select a name and folder", body: <Facts facts={[{ label: "Location", value: c.name }]} /> }]),
            { id: "compute", label: "Select a compute resource", body: <Facts facts={[{ label: "Cluster", value: c.name }, { label: "Hosts", value: String(nodes.length), num: true }]} /> },
            { id: "storage", label: "Select storage", body: <Facts facts={storageFacts(game, c, nv.size)} /> },
            { id: "hardware", label: "Customize hardware", body: (
              <>
                <SizeFields size={nv.size} set={nv.setSize} labels={["CPU", "Memory, GB", "New Hard disk, GB"]} />
                {!nv.suite && nv.isoPick("New CD/DVD Drive", "Client device")}
              </>
            ) },
            { id: "ready", label: "Ready to complete", body: <Facts facts={[
              { label: "Cluster", value: c.name },
              ...(app && appOs ? [{ label: "Appliance", value: app.console }, { label: "Guest OS", value: appOs.name }] : [{ label: "CD/DVD drive", value: nv.isoLabel ?? "Client device", num: !!nv.isoLabel }]),
              { label: "CPU", value: String(nv.size.vcpu), num: true }, { label: "Memory", value: `${nv.size.ramGb} GB`, num: true }, { label: "Hard disk", value: `${nv.size.diskGb} GB`, num: true },
              ...(appOs?.id === "windoors" ? [{ label: "Windoors Server licence", value: windoorsLicence(year) }] : []),
            ]} /> },
          ]} />
        </div>
      )}
      {dialog}
    </div>
  );
}
