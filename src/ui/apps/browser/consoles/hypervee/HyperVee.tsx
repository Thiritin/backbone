import { useState } from "react";
import { yearOf } from "../../../../../sim/00-core/time";
import { useStore } from "../../../../store";
import type { GameState } from "../../../../../sim/50-state";
import { vmStats } from "../../../../../sim/60-infra/stats";
import { Chart } from "../Chart";
import { AlarmList, ConsoleThumb, MediaMenu, NodeList, ResourceBars, SizeFields, summaryOf, TaskLog, useNewVm, useVms, vmFacts, Wizard, type Vm } from "../HypervisorBase";
import { Actions, Backups, erasFrom, eraAt, Facts, LoginForm, useSoftware, type PanelAction, type PanelProps } from "../PanelBase";
import "./hypervee.css";

// docs/design/software.md, section 9: the glossy MMC from 2008, the same MMC with flat chrome from 2012.
const ERAS = erasFrom(2008, 2012);
const LABELS: Record<string, string> = { start: "Start", stop: "Shut Down...", reset: "Reset", restore: "Restore", recover: "Recover", migrate: "Move...", resize: "Settings...", console: "Connect...", delete: "Delete..." };
type Page = { kind: "list"; node: string | null } | { kind: "cluster" } | { kind: "settings"; id: string } | { kind: "new" } | { kind: "server" };
const SETTINGS = ["BIOS", "Memory", "Processor", "DVD Drive", "Network Adapter", "Name", "Checkpoints"] as const;

function ActionsPane({ title, actions }: { title: string; actions: (PanelAction | false)[] }) {
  return (
    <section className="hv-acts">
      <h4>{title}</h4>
      {actions.filter((a): a is PanelAction => !!a).map((a) => <button key={a.id} className={a.tone ?? ""} onClick={a.run}>{LABELS[a.id] ?? a.label}</button>)}
    </section>
  );
}

const mb = (gb: number) => `${Math.round(gb * 1024)} MB`;
const uptime = (h: number | null) => (h === null ? "00:00:00" : `${h >= 24 ? `${Math.floor(h / 24)}.` : ""}${String(h % 24).padStart(2, "0")}:00:00`);
const TABS = ["Summary", "Memory", "Networking", "Replication"] as const;

// The details pane under the VM list: the tabs Summary, Memory, Networking and Replication.
export function VmDetails({ game, v, generations }: { game: GameState; v: Vm; generations: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Summary"), st = vmStats(game, v.id)!, w = v.w, on = v.st === "running";
  const row = (k: string, val: string) => <tr key={k}><th>{k}:</th><td>{val}</td></tr>;
  return (
    <>
      {tab === "Summary" && (
        <div className="hv-sum">
          <ConsoleThumb game={game} v={v} className="cx-thumb hv-thumb" />
          <table className="hv-kv"><tbody>
            {row("Name", v.name)}
            {generations && row("Generation", "1")}
            {row("Uptime", uptime(st.uptimeHours))}
            {row("Heartbeat", on && w.os ? "OK" : "No Contact")}
            {row("Assigned Memory", on ? mb(w.ramGb) : "")}
            {row("Memory Demand", on ? mb(st.now.ram * w.ramGb) : "")}
            {row("Status", v.tone === "bad" ? v.state : "Operating normally")}
            {row("IP Addresses", v.ip)}
          </tbody></table>
          <Chart className="hv-chart" kind="line" title="CPU Usage" now={`${Math.round(st.now.cpu * 100)} %`} values={st.ring.map((x) => x.cpu)} end={game.hour} />
        </div>
      )}
      {tab === "Memory" && (
        <div className="hv-sum">
          <table className="hv-kv"><tbody>
            {row("Startup Memory", mb(w.ramGb))}{row("Dynamic Memory", "Disabled")}
            {row("Assigned Memory", on ? mb(w.ramGb) : "")}{row("Memory Demand", on ? mb(st.now.ram * w.ramGb) : "")}{row("Memory Status", on ? "OK" : "")}
          </tbody></table>
          <Chart className="hv-chart" kind="line" title="Memory Demand" now={on ? mb(st.now.ram * w.ramGb) : ""} values={st.ring.map((x) => x.ram)} end={game.hour} />
        </div>
      )}
      {tab === "Networking" && (
        <table className="cx-table"><thead><tr><th>Adapter</th><th>Connected To</th><th>IP Addresses</th><th>Status</th></tr></thead>
          <tbody><tr><td>Network Adapter</td><td>External Network</td><td className="num">{v.ip}</td><td>{on ? "OK" : ""}</td></tr></tbody></table>
      )}
      {tab === "Replication" && <table className="hv-kv"><tbody>{row("Replication State", "Not enabled")}</tbody></table>}
      <nav className="hv-dtabs">{TABS.map((x) => <button key={x} aria-pressed={x === tab} onClick={() => setTab(x)}>{x}</button>)}</nav>
    </>
  );
}

export function HyperVee(p: PanelProps) {
  const era = eraAt(ERAS, p.game), { game, c, f } = p, openConsole = useStore((s) => s.openConsole);
  const [page, setPage] = useState<Page>({ kind: "list", node: null }), [selId, setSelId] = useState<string | null>(null);
  const [part, setPart] = useState<(typeof SETTINGS)[number]>("Memory"), [gen, setGen] = useState(1);
  const { vms, dialog } = useVms(game, c, f), sw = useSoftware(game, c, f), nv = useNewVm(game, c);
  if (!p.signedIn) return (
    <div className="cx hv hv-login" data-era={era}>
      <LoginForm className="hv-card" onLogin={p.login} button="Connect">
        <div className="hv-card-h">Connect to Server</div>
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  const nodes = c.nodes.map((n) => game.devices.find((d) => d.id === n.deviceId)!).filter(Boolean);
  const vm: Vm | undefined = vms.find((v) => v.id === (page.kind === "settings" ? page.id : selId));
  const list = vms.filter((v) => page.kind !== "list" || !page.node || v.w.deviceId === page.node);
  const generations = yearOf(game.hour) >= 2012;
  const finish = () => { const id = nv.create(); if (id) { setSelId(id); setPage({ kind: "list", node: null }); } };
  const facts = vm && vmFacts(game, vm), health = summaryOf(game, c, page.kind === "list" ? page.node : null), cluster = summaryOf(game, c, null);
  const vmActions = vm ? vm.actions.map((a) => (a.id === "resize" ? { ...a, run: () => setPage({ kind: "settings", id: vm.id }) } : a)) : [];
  return (
    <div className="cx cx-hv hv" data-era={era}>
      <header className="hv-top"><span className="hv-title">HyperVee Manager</span><span className="cx-host">{p.host}</span><button className="hv-out" onClick={p.logout}>Disconnect</button></header>
      <div className="hv-menu"><span>File</span><span>Action</span><span>View</span><span>Help</span></div>
      <div className="cx-hv-body">
        <aside className="cx-hv-tree hv-tree">
          <ul>
            <li><button aria-pressed={page.kind === "list" && !page.node} onClick={() => setPage({ kind: "list", node: null })}><i>⧉</i>HyperVee Manager</button>
              <ul>{nodes.map((d) => <li key={d.id}><button aria-pressed={page.kind === "list" && page.node === d.id} onClick={() => setPage({ kind: "list", node: d.id })}><i>▦</i>{(d.hostname ?? d.name).toUpperCase()}</button></li>)}</ul>
            </li>
            {f.cluster && <li><button aria-pressed={page.kind === "cluster"} onClick={() => setPage({ kind: "cluster" })}><i>⛁</i>Failover Cluster Manager</button></li>}
          </ul>
        </aside>
        <main className="hv-mid">
          {page.kind === "list" && (
            <>
              <h4 className="hv-h">Virtual Machines</h4>
              <div className="hv-list">
                <table className="cx-table">
                  <thead><tr><th>Name</th><th>State</th><th>CPU Usage</th><th>Assigned Memory</th><th>Status</th></tr></thead>
                  <tbody>
                    {list.length === 0 && <tr><td colSpan={5} className="cx-empty">No virtual machines were found on this server.</td></tr>}
                    {list.map((v) => (
                      <tr key={v.id} aria-selected={v.id === selId} onClick={() => setSelId(v.id)}>
                        <td>{v.name}</td><td>{v.st === "stopped" ? "Off" : v.state}</td><td className="num">{Math.round((v.use.vcpu / Math.max(1, v.w.vcpu)) * 100)} %</td>
                        <td className="num">{v.st === "stopped" ? "" : `${Math.round(v.w.ramGb * 1024)} MB`}</td><td>{v.sub}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h4 className="hv-h">Resources</h4>
              <div className="hv-details">
                <ResourceBars use={health.use} labels={["Processors", "Memory", "Storage"]} />
                <AlarmList game={game} c={c} alarms={health.alarms} className="cx-table hv-events" />
              </div>
              <h4 className="hv-h">{vm ? vm.name : "Details"}</h4>
              <div className="hv-details">
                {vm ? <>{vm.panel}<VmDetails game={game} v={vm} generations={generations} /></> : <span className="cx-empty">No item selected.</span>}
              </div>
            </>
          )}
          {page.kind === "server" && (
            <>
              <h4 className="hv-h">HyperVee Settings</h4>
              <div className="hv-details">
                <Facts facts={sw.facts} />
                <Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>
                {sw.panel}
                {f.backups && <Backups game={game} c={c} />}
              </div>
            </>
          )}
          {page.kind === "cluster" && (
            <>
              <h4 className="hv-h">Nodes</h4><div className="hv-details"><NodeList game={game} c={c} f={f} /></div>
              <h4 className="hv-h">Cluster Events ({cluster.alarms.length})</h4>
              <div className="hv-details"><ResourceBars use={cluster.use} labels={["Processors", "Memory", "Storage"]} /><AlarmList game={game} c={c} alarms={cluster.alarms} className="cx-table hv-events" /></div>
            </>
          )}
          {page.kind === "settings" && vm && facts && (
            <div className="hv-settings">
              <h4 className="hv-h">Settings for {vm.name}</h4>
              <div className="hv-settings-body">
                <ul className="hv-parts">
                  <li className="hv-group">Hardware</li>
                  {SETTINGS.slice(0, 5).map((x) => <li key={x}><button aria-pressed={part === x} onClick={() => setPart(x)}>{x}</button></li>)}
                  <li className="hv-group">Management</li>
                  {SETTINGS.slice(5).map((x) => <li key={x}><button aria-pressed={part === x} onClick={() => setPart(x)}>{x}</button></li>)}
                </ul>
                <div className="hv-form">
                  <b>{part}</b>
                  {part === "BIOS" && <Facts facts={[{ label: "Startup order", value: vm.media ? "CD, IDE, Network" : "IDE, CD, Network" }]} />}
                  {(part === "Memory" || part === "Processor") && vm.panel}
                  {part === "Memory" && <Facts facts={[{ label: "Startup RAM", value: `${Math.round(vm.w.ramGb * 1024)} MB`, num: true }]} />}
                  {part === "Processor" && <Facts facts={[{ label: "Number of virtual processors", value: String(vm.w.vcpu), num: true }]} />}
                  {(part === "Memory" || part === "Processor") && vm.actions.some((a) => a.id === "resize") && !vm.panel && <button className="cx-btn" onClick={vm.actions.find((a) => a.id === "resize")!.run}>Change</button>}
                  {part === "DVD Drive" && (
                    <>
                      <Facts facts={[{ label: "Controller", value: "IDE Controller 1" }, { ...facts.media, label: "Image file" }]} />
                      <MediaMenu game={game} v={vm} label="Image file" none="None" />
                    </>
                  )}
                  {part === "Network Adapter" && <Facts facts={[{ label: "Virtual switch", value: "External Network" }]} />}
                  {part === "Name" && <Facts facts={[{ label: "Name", value: vm.name }]} />}
                  {part === "Checkpoints" && <Facts facts={[{ label: "Last backup", value: facts.backup.value }]} />}
                </div>
              </div>
              <div className="cx-tools"><button className="cx-btn primary" onClick={() => setPage({ kind: "list", node: null })}>OK</button></div>
            </div>
          )}
        </main>
        <aside className="hv-side">
          <ActionsPane title={page.kind === "list" && page.node ? (nodes.find((d) => d.id === page.node)?.hostname ?? "").toUpperCase() : "HyperVee Manager"} actions={[
            f.create && { id: "create", label: "New, Virtual Machine...", run: () => setPage({ kind: "new" }) },
            { id: "settings", label: "HyperVee Settings...", run: () => setPage({ kind: "server" }) },
          ]} />
          {vm && <ActionsPane title={vm.name} actions={[...vmActions.filter((a) => a.id !== "console"), vm.own && { id: "console", label: "Connect...", run: () => openConsole(vm.id) }]} />}
        </aside>
      </div>
      <TaskLog game={game} c={c} vms={vms} title="Recent Tasks" className="cx-tasks hv-tasks" />
      {page.kind === "new" && (
        <div className="cx-wiz-back">
          <Wizard title="New Virtual Machine Wizard" className="hv-wiz" finish="Finish" onCancel={() => setPage({ kind: "list", node: null })} onFinish={finish} steps={[
            { id: "name", label: "Specify Name and Location", body: <Facts facts={[{ label: "Location", value: "C:\\ProgramData\\HyperVee\\" }]} /> },
            ...(generations ? [{ id: "gen", label: "Specify Generation", body: (
              <div className="hv-radios">
                {[1, 2].map((g) => <label key={g} className="cx-check"><input type="radio" name="hv-gen" checked={gen === g} onChange={() => setGen(g)} />Generation {g}</label>)}
              </div>
            ) }] : []),
            { id: "memory", label: "Assign Memory", body: <SizeFields size={nv.size} set={nv.setSize} only="ramGb" labels={["", "Startup memory, GB", ""]} /> },
            { id: "net", label: "Configure Networking", body: <Facts facts={[{ label: "Connection", value: "External Network" }]} /> },
            { id: "vhd", label: "Connect Virtual Hard Disk", body: <SizeFields size={nv.size} set={nv.setSize} only="diskGb" labels={["", "", "Size, GB"]} /> },
            { id: "install", label: "Installation Options", body: nv.isoPick("Install an operating system from a bootable image file", "Install an operating system later") },
            { id: "summary", label: "Summary", body: <Facts facts={[
              ...(generations ? [{ label: "Generation", value: `Generation ${gen}` }] : []),
              { label: "Memory", value: `${Math.round(nv.size.ramGb * 1024)} MB`, num: true }, { label: "Network", value: "External Network" },
              { label: "Hard Disk", value: `${nv.size.diskGb} GB`, num: true }, { label: "Operating System", value: nv.isoLabel ?? "Will be installed at a later time", num: !!nv.isoLabel },
            ]} /> },
          ]} />
        </div>
      )}
      {dialog}
    </div>
  );
}
