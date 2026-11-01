import { useState } from "react";
import { dateOf, yearOf } from "../../../../../sim/00-core/time";
import { SNAPSHOTS_MAX } from "../../../../../sim/10-catalog/platforms";
import { deleteSnapshot, revertSnapshot, takeSnapshot } from "../../../../../sim/90-actions/snapshots";
import { t } from "../../../../../i18n/en";
import { useStore } from "../../../../store";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { vmStats } from "../../../../../sim/60-infra/stats";
import { integrationServices } from "../../../../../sim/80-business/readouts";
import { Chart } from "../Chart";
import { AlarmList, ConsoleThumb, MediaMenu, NodeList, ResourceBars, SizeFields, summaryOf, TaskLog, useNewVm, useVms, vmFacts, Wizard, type Vm } from "../HypervisorBase";
import { Actions, Backups, erasFrom, eraAt, Facts, LoginForm, useSoftware, type PanelAction, type PanelProps } from "../PanelBase";
import { parseCreate } from "../../../../../sim/80-business/consoles";
import { PackagesScreen } from "../PackageForms";
import { Replica } from "./Replica";
import { Switches } from "./Switches";
import { setVmSwitch } from "../../../../../sim/90-actions/vswitch";
import { switchOf, switchesOf, vswitchBlocks } from "../../../../../sim/60-infra/vswitch";
import "./hypervee.css";

// docs/design/software.md, section 9: the glossy MMC from 2008, the same MMC with flat chrome from 2012.
const ERAS = erasFrom(2008, 2012);
const LABELS: Record<string, string> = { start: t("browser-consoles-1.hvStart"), stop: t("browser-consoles-1.hvShutDown"), reset: t("browser-consoles-1.hvReset"), restore: t("browser-consoles-1.hvRestore"), recover: t("browser-consoles-1.hvRecover"), migrate: t("browser-consoles-1.hvMove"), resize: t("browser-consoles-1.hvSettingsDots"), console: t("browser-consoles-1.hvConnect"), delete: t("browser-consoles-1.hvDelete") };
type Page = { kind: "list"; node: string | null } | { kind: "cluster" } | { kind: "settings"; id: string } | { kind: "new" } | { kind: "server" } | { kind: "profiles" } | { kind: "switches" };
const SETTINGS = ["BIOS", "Memory", "Processor", "DVD Drive", "Network Adapter", "Name", "Checkpoints", "Integration Services"] as const;
const SETTING_LABELS: Record<(typeof SETTINGS)[number], string> = { BIOS: t("browser-consoles-1.hvBios"), Memory: t("browser-consoles-1.memory"), Processor: t("browser-consoles-1.hvProcessor"), "DVD Drive": t("browser-consoles-1.hvDvdDrive"), "Network Adapter": t("browser-consoles-1.hvNetworkAdapter"), Name: t("browser-consoles-1.name"), Checkpoints: t("browser-consoles-1.hvCheckpoints"), "Integration Services": t("readouts.is.title") };

function ActionsPane({ title, actions }: { title: string; actions: (PanelAction | false)[] }) {
  return (
    <section className="hv-acts">
      <h4>{title}</h4>
      {actions.filter((a): a is PanelAction => !!a).map((a) => <button key={a.id} className={a.tone ?? ""} onClick={a.run}>{LABELS[a.id] ?? a.label}</button>)}
    </section>
  );
}

const integrationText = (game: GameState, c: Cluster, v: Vm) => { const x = integrationServices(game, c, v.w); return x.version === "off" ? "" : x.version === "update" ? t("readouts.is.update") : String(x.guest); };
// The automatic checkpoint name: the VM's name and the time it was taken.
const checkpointName = (name: string, at: number) => {
  const d = dateOf(at), p = (n: number) => String(n).padStart(2, "0");
  return `${name} - (${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} - ${p(d.getUTCHours())}:00:00)`;
};

// The Checkpoints pane under the VM list and in the VM's settings: take, apply and delete.
function Checkpoints({ v }: { v: Vm }) {
  const act = useStore((s) => s.act), list = v.w.snapshots ?? [];
  return (
    <>
      <table className="cx-table">
        <thead><tr><th>{t("browser-consoles-1.name")}</th><th /></tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={2} className="cx-empty">{t("readouts.checkpoints.none")}</td></tr>}
          {list.map((x) => (
            <tr key={x.id}>
              <td>{checkpointName(v.name, x.at)}</td>
              <td><button className="cx-btn" onClick={() => act(revertSnapshot, v.id, x.id)}>{t("readouts.checkpoints.apply")}</button>{" "}<button className="cx-btn" onClick={() => act(deleteSnapshot, v.id, x.id)}>{t("readouts.checkpoints.delete")}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length < SNAPSHOTS_MAX && <div className="cx-inline"><button className="cx-btn primary" onClick={() => act(takeSnapshot, v.id)}>{t("readouts.checkpoints.create")}</button></div>}
    </>
  );
}

const mb = (gb: number) => `${Math.round(gb * 1024)} MB`;
const uptime = (h: number | null) => (h === null ? "00:00:00" : `${h >= 24 ? `${Math.floor(h / 24)}.` : ""}${String(h % 24).padStart(2, "0")}:00:00`);
const TABS = ["Summary", "Memory", "Networking", "Replication"] as const;
const TAB_LABELS: Record<(typeof TABS)[number], string> = { Summary: t("browser-consoles-1.hvSummary"), Memory: t("browser-consoles-1.memory"), Networking: t("browser-consoles-1.hvNetworking"), Replication: t("browser-consoles-1.hvReplication") };

// The details pane under the VM list: the tabs Summary, Memory, Networking and Replication.
export function VmDetails({ game, v, generations, c }: { game: GameState; v: Vm; generations: boolean; c?: Cluster }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Summary"), st = vmStats(game, v.id)!, w = v.w, on = v.st === "running";
  const row = (k: string, val: string) => <tr key={k}><th>{k}:</th><td>{val}</td></tr>;
  return (
    <>
      {tab === "Summary" && (
        <div className="hv-sum">
          <ConsoleThumb game={game} v={v} className="cx-thumb hv-thumb" />
          <table className="hv-kv"><tbody>
            {row(t("browser-consoles-1.name"), v.name)}
            {generations && row(t("browser-consoles-1.hvGeneration"), "1")}
            {row(t("browser-consoles-1.hvUptime"), uptime(st.uptimeHours))}
            {row(t("browser-consoles-1.hvHeartbeat"), on && w.os ? t("browser-consoles-1.ok") : t("browser-consoles-1.hvNoContact"))}
            {row(t("browser-consoles-1.hvAssignedMemory"), on ? mb(w.ramGb) : "")}
            {row(t("browser-consoles-1.hvMemoryDemand"), on ? mb(st.now.ram * w.ramGb) : "")}
            {row(t("browser-consoles-1.status"), v.tone === "bad" ? v.state : t("browser-consoles-1.hvOperatingNormally"))}
            {row(t("browser-consoles-1.hvIpAddresses"), v.ip)}
          </tbody></table>
          <Chart className="hv-chart" kind="line" title={t("browser-consoles-1.hvCpuUsage")} now={`${Math.round(st.now.cpu * 100)} %`} values={st.ring.map((x) => x.cpu)} end={game.hour} />
        </div>
      )}
      {tab === "Memory" && (
        <div className="hv-sum">
          <table className="hv-kv"><tbody>
            {row(t("browser-consoles-1.hvStartupMemory"), mb(w.ramGb))}{row(t("browser-consoles-1.hvDynamicMemory"), t("browser-consoles-1.hvDisabled"))}
            {row(t("browser-consoles-1.hvAssignedMemory"), on ? mb(w.ramGb) : "")}{row(t("browser-consoles-1.hvMemoryDemand"), on ? mb(st.now.ram * w.ramGb) : "")}{row(t("browser-consoles-1.hvMemoryStatus"), on ? t("browser-consoles-1.ok") : "")}
          </tbody></table>
          <Chart className="hv-chart" kind="line" title={t("browser-consoles-1.hvMemoryDemand")} now={on ? mb(st.now.ram * w.ramGb) : ""} values={st.ring.map((x) => x.ram)} end={game.hour} />
        </div>
      )}
      {tab === "Networking" && (
        <table className="cx-table"><thead><tr><th>{t("browser-consoles-1.hvAdapter")}</th><th>{t("browser-consoles-1.hvConnectedTo")}</th><th>{t("browser-consoles-1.hvIpAddresses")}</th><th>{t("browser-consoles-1.status")}</th></tr></thead>
          <tbody><tr><td>{t("browser-consoles-1.hvNetworkAdapter")}</td><td>{c ? switchOf(c, w).name : t("browser-consoles-1.hvExternalNetwork")}</td><td className="num">{v.ip}</td><td>{on ? t("browser-consoles-1.ok") : ""}</td></tr></tbody></table>
      )}
      {tab === "Replication" && (c && w.deviceId ? <Replica game={game} c={c} w={w} /> : <table className="hv-kv"><tbody>{row(t("browser-consoles-1.hvReplicationState"), t("browser-consoles-1.hvNotEnabled"))}</tbody></table>)}
      <nav className="hv-dtabs">{TABS.map((x) => <button key={x} aria-pressed={x === tab} onClick={() => setTab(x)}>{TAB_LABELS[x]}</button>)}</nav>
    </>
  );
}

export function HyperVee(p: PanelProps) {
  const era = eraAt(ERAS, p), { game, c, f } = p, openConsole = useStore((s) => s.openConsole), act = useStore((s) => s.act);
  const open = parseCreate("hypervee", p.path);
  const [page, setPage] = useState<Page>(open?.screen === "create" ? { kind: "new" } : open?.screen === "packages" ? { kind: "profiles" } : { kind: "list", node: null }), [selId, setSelId] = useState<string | null>(null);
  const [part, setPart] = useState<(typeof SETTINGS)[number]>("Memory"), [gen, setGen] = useState(1);
  const { vms, dialog } = useVms(game, c, f), sw = useSoftware(game, c, f), nv = useNewVm(game, c, open?.screen === "create" ? open.order : undefined);
  if (!p.signedIn) return (
    <div className="cx hv hv-login" data-era={era}>
      <LoginForm className="hv-card" onLogin={p.login} button={t("browser-consoles-1.hvConnectBtn")}>
        <div className="hv-card-h">{t("browser-consoles-1.hvConnectToServer")}</div>
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  const nodes = c.nodes.map((n) => game.devices.find((d) => d.id === n.deviceId)!).filter(Boolean);
  const vm: Vm | undefined = vms.find((v) => v.id === (page.kind === "settings" ? page.id : selId));
  const list = vms.filter((v) => page.kind !== "list" || !page.node || v.w.deviceId === page.node);
  const generations = yearOf(game.hour) >= 2012;
  const finish = () => { if (nv.ordered) { if (nv.submit()) setPage({ kind: "list", node: null }); return; } const id = nv.create(); if (id) { setSelId(id); setPage({ kind: "list", node: null }); } };
  const facts = vm && vmFacts(game, vm), health = summaryOf(game, c, page.kind === "list" ? page.node : null), cluster = summaryOf(game, c, null);
  const vmActions = vm ? vm.actions.map((a) => (a.id === "resize" ? { ...a, run: () => setPage({ kind: "settings", id: vm.id }) } : a)) : [];
  return (
    <div className="cx cx-hv hv" data-era={era}>
      <header className="hv-top"><span className="hv-title">{t("browser-consoles-1.hvManager")}</span><span className="cx-host">{p.host}</span><button className="hv-out" onClick={p.logout}>{t("browser-consoles-1.hvDisconnect")}</button></header>
      <div className="hv-menu"><span>{t("browser-consoles-1.hvFile")}</span><span>{t("browser-consoles-1.hvAction")}</span><span>{t("browser-consoles-1.hvView")}</span><span>{t("browser-consoles-1.hvHelp")}</span></div>
      <div className="cx-hv-body">
        <aside className="cx-hv-tree hv-tree">
          <ul>
            <li><button aria-pressed={page.kind === "list" && !page.node} onClick={() => setPage({ kind: "list", node: null })}><i>⧉</i>{t("browser-consoles-1.hvManager")}</button>
              <ul>{nodes.map((d) => <li key={d.id}><button aria-pressed={page.kind === "list" && page.node === d.id} onClick={() => setPage({ kind: "list", node: d.id })}><i>▦</i>{(d.hostname ?? d.name).toUpperCase()}</button></li>)}</ul>
            </li>
            <li><button aria-pressed={page.kind === "profiles"} onClick={() => setPage({ kind: "profiles" })}><i>▤</i>{t("pkg.hvProfiles")}</button></li>
            {f.cluster && <li><button aria-pressed={page.kind === "cluster"} onClick={() => setPage({ kind: "cluster" })}><i>⛁</i>{t("browser-consoles-1.hvFailoverClusterManager")}</button></li>}
          </ul>
        </aside>
        <main className="hv-mid">
          {page.kind === "list" && (
            <>
              <h4 className="hv-h">{t("browser-consoles-1.hvVirtualMachines")}</h4>
              <div className="hv-list">
                <table className="cx-table">
                  <thead><tr><th>{t("browser-consoles-1.name")}</th><th>{t("browser-consoles-1.hvState")}</th><th>{t("browser-consoles-1.hvCpuUsage")}</th><th>{t("browser-consoles-1.hvAssignedMemory")}</th><th>{t("browser-consoles-1.status")}</th><th>{t("readouts.is.version")}</th></tr></thead>
                  <tbody>
                    {list.length === 0 && <tr><td colSpan={6} className="cx-empty">{t("browser-consoles-1.hvNoVms")}</td></tr>}
                    {list.map((v) => (
                      <tr key={v.id} aria-selected={v.id === selId} onClick={() => setSelId(v.id)}>
                        <td>{v.name}</td><td>{v.st === "stopped" ? t("browser-consoles-1.hvOff") : v.state}</td><td className="num">{Math.round((v.use.vcpu / Math.max(1, v.w.vcpu)) * 100)} %</td>
                        <td className="num">{v.st === "stopped" ? "" : `${Math.round(v.w.ramGb * 1024)} MB`}</td><td>{v.sub}</td><td>{integrationText(game, c, v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h4 className="hv-h">{t("browser-consoles-1.hvResources")}</h4>
              <div className="hv-details">
                <ResourceBars use={health.use} labels={[t("browser-consoles-1.hvProcessors"), t("browser-consoles-1.memory"), t("browser-consoles-1.hvStorage")]} />
                <AlarmList game={game} c={c} alarms={health.alarms} className="cx-table hv-events" />
              </div>
              <h4 className="hv-h">{vm ? vm.name : t("browser-consoles-1.hvDetails")}</h4>
              <div className="hv-details">
                {vm ? <>{vm.panel}<VmDetails game={game} v={vm} generations={generations} c={c} /></> : <span className="cx-empty">{t("browser-consoles-1.hvNoItem")}</span>}
              </div>
              {vm?.w.deviceId && <><h4 className="hv-h">{t("readouts.checkpoints.title")}</h4><div className="hv-details"><Checkpoints v={vm} /></div></>}
            </>
          )}
          {page.kind === "profiles" && (
            <>
              <h4 className="hv-h">{t("pkg.hvProfiles")}</h4>
              <div className="hv-details"><PackagesScreen game={game} c={c} /></div>
            </>
          )}
          {page.kind === "switches" && (
            <>
              <h4 className="hv-h">{t("hvx.switchTitle")}</h4>
              <Switches game={game} c={c} />
            </>
          )}
          {page.kind === "server" && (
            <>
              <h4 className="hv-h">{t("browser-consoles-1.hvSettings")}</h4>
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
              <h4 className="hv-h">{t("browser-consoles-1.hvNodes")}</h4><div className="hv-details"><NodeList game={game} c={c} f={f} /></div>
              <h4 className="hv-h">{t("browser-consoles-1.hvClusterEvents", { n: cluster.alarms.length })}</h4>
              <div className="hv-details"><ResourceBars use={cluster.use} labels={[t("browser-consoles-1.hvProcessors"), t("browser-consoles-1.memory"), t("browser-consoles-1.hvStorage")]} /><AlarmList game={game} c={c} alarms={cluster.alarms} className="cx-table hv-events" /></div>
            </>
          )}
          {page.kind === "settings" && vm && facts && (
            <div className="hv-settings">
              <h4 className="hv-h">{t("browser-consoles-1.hvSettingsFor", { name: vm.name })}</h4>
              <div className="hv-settings-body">
                <ul className="hv-parts">
                  <li className="hv-group">{t("browser-consoles-1.hvHardware")}</li>
                  {SETTINGS.slice(0, 5).map((x) => <li key={x}><button aria-pressed={part === x} onClick={() => setPart(x)}>{SETTING_LABELS[x]}</button></li>)}
                  <li className="hv-group">{t("browser-consoles-1.hvManagement")}</li>
                  {SETTINGS.slice(5).map((x) => <li key={x}><button aria-pressed={part === x} onClick={() => setPart(x)}>{SETTING_LABELS[x]}</button></li>)}
                </ul>
                <div className="hv-form">
                  <b>{SETTING_LABELS[part]}</b>
                  {part === "BIOS" && <Facts facts={[{ label: t("browser-consoles-1.hvStartupOrder"), value: vm.media ? t("browser-consoles-1.hvOrderCd") : t("browser-consoles-1.hvOrderIde") }]} />}
                  {(part === "Memory" || part === "Processor") && vm.panel}
                  {part === "Memory" && <Facts facts={[{ label: t("browser-consoles-1.hvStartupRam"), value: `${Math.round(vm.w.ramGb * 1024)} MB`, num: true }]} />}
                  {part === "Processor" && <Facts facts={[{ label: t("browser-consoles-1.hvVirtualProcessors"), value: String(vm.w.vcpu), num: true }]} />}
                  {(part === "Memory" || part === "Processor") && vm.actions.some((a) => a.id === "resize") && !vm.panel && <button className="cx-btn" onClick={vm.actions.find((a) => a.id === "resize")!.run}>{t("browser-consoles-1.hvChange")}</button>}
                  {part === "DVD Drive" && (
                    <>
                      <Facts facts={[{ label: t("browser-consoles-1.hvController"), value: t("browser-consoles-1.hvIdeController") }, { ...facts.media, label: t("browser-consoles-1.hvImageFile") }]} />
                      <MediaMenu game={game} v={vm} label={t("browser-consoles-1.hvImageFile")} none={t("browser-consoles-1.none")} />
                    </>
                  )}
                  {part === "Network Adapter" && (
                    <>
                      <label className="cx-field">{t("browser-consoles-1.hvVirtualSwitch")}
                        <select value={switchOf(c, vm.w).id} onChange={(e) => act(setVmSwitch, vm.id, e.target.value)}>{switchesOf(c).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                      </label>
                      {vswitchBlocks(game, c, vm.w) && <span className="cx-note">{t(switchOf(c, vm.w).type === "external" ? "hvx.adapterDown" : "hvx.noUplink")}</span>}
                    </>
                  )}
                  {part === "Name" && <Facts facts={[{ label: t("browser-consoles-1.name"), value: vm.name }]} />}
                  {part === "Integration Services" && <table className="cx-table"><tbody>{integrationServices(game, c, vm.w).services.map((x) => <tr key={x.key}><td>{t(`readouts.is.${x.key}`)}</td><td>{t(`readouts.is.${x.state}`)}</td></tr>)}</tbody></table>}
                  {part === "Checkpoints" && <><Facts facts={[{ label: t("browser-consoles-1.lastBackup"), value: facts.backup.value }]} />{vm.w.deviceId && <Checkpoints v={vm} />}</>}
                </div>
              </div>
              <div className="cx-tools"><button className="cx-btn primary" onClick={() => setPage({ kind: "list", node: null })}>{t("browser-consoles-1.ok")}</button></div>
            </div>
          )}
        </main>
        <aside className="hv-side">
          <ActionsPane title={page.kind === "list" && page.node ? (nodes.find((d) => d.id === page.node)?.hostname ?? "").toUpperCase() : t("browser-consoles-1.hvManager")} actions={[
            f.create && { id: "create", label: t("browser-consoles-1.hvNewVm"), run: () => setPage({ kind: "new" }) },
            { id: "settings", label: t("browser-consoles-1.hvSettingsDots2"), run: () => setPage({ kind: "server" }) },
            { id: "switches", label: t("hvx.switchManager"), run: () => setPage({ kind: "switches" }) },
          ]} />
          {vm && <ActionsPane title={vm.name} actions={[...vmActions.filter((a) => a.id !== "console"), vm.own && { id: "console", label: t("browser-consoles-1.hvConnect"), run: () => openConsole(vm.id) }]} />}
        </aside>
      </div>
      <TaskLog game={game} c={c} vms={vms} title={t("browser-consoles-1.hvRecentTasks")} className="cx-tasks hv-tasks" />
      {page.kind === "new" && (
        <div className="cx-wiz-back">
          <Wizard title={t("browser-consoles-1.hvNewVmWizard")} className="hv-wiz" finish={t("browser-consoles-1.hvFinish")} onCancel={() => setPage({ kind: "list", node: null })} onFinish={finish} steps={[
            { id: "name", label: t("browser-consoles-1.hvSpecifyName"), body: <><div className="hv-order">{nv.orderFields}</div><Facts facts={[{ label: t("browser-consoles-1.hvLocation"), value: "C:\\ProgramData\\HyperVee\\" }]} /></> },
            ...(generations ? [{ id: "gen", label: t("browser-consoles-1.hvSpecifyGeneration"), body: (
              <div className="hv-radios">
                {[1, 2].map((g) => <label key={g} className="cx-check"><input type="radio" name="hv-gen" checked={gen === g} onChange={() => setGen(g)} />{t("browser-consoles-1.hvGenerationN", { n: g })}</label>)}
              </div>
            ) }] : []),
            { id: "memory", label: t("browser-consoles-1.hvAssignMemory"), body: <SizeFields size={nv.size} set={nv.setSize} only="ramGb" labels={["", t("browser-consoles-1.hvStartupMemoryGb"), ""]} /> },
            { id: "net", label: t("browser-consoles-1.hvConfigureNetworking"), body: <Facts facts={[{ label: t("browser-consoles-1.hvConnection"), value: t("browser-consoles-1.hvExternalNetwork") }]} /> },
            { id: "vhd", label: t("browser-consoles-1.hvConnectVhd"), body: <SizeFields size={nv.size} set={nv.setSize} only="diskGb" labels={["", "", t("browser-consoles-1.hvSizeGb")]} /> },
            { id: "install", label: t("browser-consoles-1.hvInstallOptions"), body: nv.isoPick(t("browser-consoles-1.hvInstallNow"), t("browser-consoles-1.hvInstallLater")) },
            { id: "summary", label: t("browser-consoles-1.hvSummary"), body: <Facts facts={[
              ...(generations ? [{ label: t("browser-consoles-1.hvGeneration"), value: t("browser-consoles-1.hvGenerationN", { n: gen }) }] : []),
              { label: t("browser-consoles-1.memory"), value: `${Math.round(nv.size.ramGb * 1024)} MB`, num: true }, { label: t("browser-consoles-1.hvNetwork"), value: t("browser-consoles-1.hvExternalNetwork") },
              { label: t("browser-consoles-1.hvHardDisk"), value: `${nv.size.diskGb} GB`, num: true }, { label: t("browser-consoles-1.hvOperatingSystem"), value: nv.isoLabel ?? t("browser-consoles-1.hvInstalledLater"), num: !!nv.isoLabel },
            ]} /> },
          ]} />
        </div>
      )}
      {dialog}
    </div>
  );
}
