import { useState } from "react";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { vmStats } from "../../../../../sim/60-infra/stats";
import { useStore } from "../../../../store";
import { Chart, niceMax } from "../Chart";
import { AlarmList, ALL, MediaMenu, NodeList, osText, ResourceBars, summaryOf, SizeFields, TaskLog, Toolbar, useNewVm, useVms, vmFacts, Wizard, type Sel, type Vm } from "../HypervisorBase";
import { Actions, erasFrom, eraAt, Facts, LoginForm, useSoftware, type PanelProps } from "../PanelBase";
import "./proxmocks.css";
import { t } from "../../../../../i18n/en";
import { parseCreate } from "../../../../../sim/80-business/consoles";
import { PackagesScreen } from "../PackageForms";
import { JobsPanel, PointsPanel } from "../backup/Jobs";

// docs/design/software.md, section 9: the grey ExtJS manager from 2008, the flat white one with the orange mark from 2015.
const ERAS = erasFrom(2008, 2015);
const vmid = (v: Vm) => 100 + Number(v.id.replace(/\D/g, "") || 0);
const gib = (gb: number) => `${+gb.toFixed(2)} GiB`;

// The Summary tab: the status box, then the graphs stacked under the timeframe pick.
export function VmSummary({ game, c, v }: { game: GameState; c: Cluster; v: Vm }) {
  const [range, setRange] = useState("day"), st = vmStats(game, v.id)!, ring = range === "hour" ? st.ring.slice(-1) : st.ring, slots = range === "hour" ? 1 : undefined;
  const w = v.w, now = st.now, end = game.hour, net = ring.map((x) => x.netMbit);
  return (
    <>
      <section className="pmx-panel">
        <h4>{t("browser-consoles-2.status")}</h4>
        <table className="pmx-status"><tbody>
          <tr><th>{t("browser-consoles-2.status")}</th><td>{v.st === "stopped" ? t("browser-consoles-2.stopped") : v.st === "running" ? t("browser-consoles-2.running") : v.state}</td></tr>
          <tr><th>{t("browser-consoles-2.haState")}</th><td>{c.ha.failover ? t("browser-consoles-2.started") : t("browser-consoles-2.none")}</td></tr>
          <tr><th>{t("browser-consoles-2.node")}</th><td>{v.node}</td></tr>
          <tr><th>{t("browser-consoles-2.cpuUsage")}</th><td className="num">{t("browser-consoles-2.cpuOfCpus", { pct: (now.cpu * 100).toFixed(2), cpus: w.vcpu })}</td></tr>
          <tr><th>{t("browser-consoles-2.memoryUsage")}</th><td className="num">{(now.ram * 100).toFixed(2)}% ({t("browser-consoles-2.of", { used: gib(now.ram * w.ramGb), total: gib(w.ramGb) })})</td></tr>
          <tr><th>{t("browser-consoles-2.bootdiskSize")}</th><td className="num">{gib(w.diskGb)}</td></tr>
          <tr><th>{t("browser-consoles-2.ips")}</th><td className="num">{v.ip || t("browser-consoles-2.noNetworkInfo")}</td></tr>
        </tbody></table>
      </section>
      <div className="pmx-range">
        <select value={range} onChange={(e) => setRange(e.target.value)} aria-label={t("browser-consoles-2.timeframe")}>
          <option value="hour">{t("browser-consoles-2.hourAverage")}</option><option value="day">{t("browser-consoles-2.dayAverage")}</option>
        </select>
      </div>
      <Chart className="pmx-graph" kind="area" title={t("browser-consoles-2.chartCpu")} values={ring.map((x) => x.cpu)} end={end} slots={slots} />
      <Chart className="pmx-graph" kind="area" title={t("browser-consoles-2.chartMemory")} unit="GiB" values={ring.map((x) => x.ram * w.ramGb)} max={niceMax([w.ramGb])} end={end} slots={slots} />
      <Chart className="pmx-graph" kind="area" title={t("browser-consoles-2.networkTraffic")} unit="Mbit/s" values={net} max={niceMax(net)} end={end} slots={slots} />
      <Chart className="pmx-graph" kind="area" title={t("browser-consoles-2.diskUsage")} values={ring.map((x) => x.disk)} end={end} slots={slots} />
    </>
  );
}

export function Proxmocks(p: PanelProps) {
  const era = eraAt(ERAS, p.game), { game, c, f } = p, openConsole = useStore((s) => s.openConsole);
  const open = parseCreate("proxmocks", p.path), [sel, setSel] = useState<Sel>(open?.screen === "create" ? { kind: "new" } : open?.screen === "packages" ? { kind: "plans" } : ALL), [tab, setTab] = useState("Summary");
  const tabNames: Record<string, string> = { Summary: t("browser-consoles-2.summary"), Console: t("browser-consoles-2.console"), Hardware: t("browser-consoles-2.hardware"), Options: t("browser-consoles-2.options"), Backup: t("browser-consoles-2.backup"), Updates: t("browser-consoles-2.updates"), Cluster: t("browser-consoles-2.cluster") };
  const { vms, dialog } = useVms(game, c, f), sw = useSoftware(game, c, f), nv = useNewVm(game, c, open?.screen === "create" ? open.order : undefined);
  if (!p.signedIn) return (
    <div className="cx pmx pmx-login" data-era={era}>
      <LoginForm className="pmx-card" onLogin={p.login} button={t("browser-consoles-2.login")}>
        <div className="pmx-card-h">Proxmocks VE Login</div>
        <div className="cx-host">{p.host}</div>
        <label className="cx-field">{t("browser-consoles-2.realm")}<select defaultValue="pam"><option value="pam">{t("browser-consoles-2.pamAuth")}</option><option value="pve">{t("browser-consoles-2.pveAuth")}</option></select></label>
      </LoginForm>
    </div>
  );
  const pick = (s: Sel, tb = "Summary") => { setSel(s); setTab(tb); };
  const vm = sel.kind === "vm" ? vms.find((v) => v.id === sel.id) : undefined;
  const node = sel.kind === "node" ? sel.id : null;
  const tabs = vm ? ["Summary", "Console", "Hardware", "Options", "Backup"]
    : node ? ["Summary", "Updates"] : ["Summary", ...(f.cluster ? ["Cluster"] : []), ...(f.backups ? ["Backup"] : [])];
  const shown = tabs.includes(tab) ? tab : "Summary";
  const nodes = c.nodes.map((n) => game.devices.find((d) => d.id === n.deviceId)!).filter(Boolean);
  const title = sel.kind === "plans" ? t("pkg.pmxPlans") : vm ? t("browser-consoles-2.vmTitle", { id: vmid(vm), name: vm.name, node: vm.node }) : node ? t("browser-consoles-2.nodeTitle", { name: nodes.find((d) => d.id === node)?.hostname ?? "" }) : t("browser-consoles-2.datacenter");
  const finish = () => { if (nv.ordered) { if (nv.submit()) setSel(ALL); return; } const id = nv.create(); if (id) pick({ kind: "vm", id }); };
  const facts = vm && vmFacts(game, vm), health = summaryOf(game, c, node);
  return (
    <div className="cx cx-hv pmx" data-era={era}>
      <header className="pmx-top">
        <span className="pmx-logo"><b>PROXMOCKS</b> {t("browser-consoles-2.virtualEnvironment")}</span>
        <span className="pmx-ver num">{c.version}</span>
        <span className="cx-host">{p.host}</span>
        {f.create && <button className="pmx-create" onClick={() => setSel({ kind: "new" })}>{t("browser-consoles-2.createVm")}</button>}
        <button className="pmx-out" onClick={p.logout}>{t("browser-consoles-2.logout")}</button>
      </header>
      <div className="cx-hv-body">
        <aside className="cx-hv-tree pmx-tree">
          <div className="pmx-view">{t("browser-consoles-2.serverView")}</div>
          <ul>
            <li><button aria-pressed={sel.kind === "all"} onClick={() => pick(ALL)}><i>▤</i>{t("browser-consoles-2.datacenter")}</button>
              <ul>
                {nodes.map((d) => (
                  <li key={d.id}>
                    <button aria-pressed={node === d.id} onClick={() => pick({ kind: "node", id: d.id })}><i>▦</i>{d.hostname ?? d.name}</button>
                    <ul>
                      {vms.filter((v) => v.w.deviceId === d.id).map((v) => (
                        <li key={v.id}><button aria-pressed={vm?.id === v.id} data-state={v.st} onClick={() => pick({ kind: "vm", id: v.id })}><i>{v.st === "running" ? "▣" : "□"}</i>{vmid(v)} ({v.name})</button></li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </li>
          </ul>
          <button className="pmx-plans" aria-pressed={sel.kind === "plans"} onClick={() => pick({ kind: "plans" })}><i>▤</i>{t("pkg.pmxPlans")}</button>
        </aside>
        <section className="pmx-content">
          <div className="pmx-bar">
            <span className="pmx-title">{title}</span>
            {vm && <Toolbar actions={vm.actions} className="cx-toolbar pmx-tools" />}
          </div>
          <div className="pmx-pane">
            <nav className="pmx-tabs" hidden={sel.kind === "plans"}>{tabs.map((tb) => <button key={tb} aria-pressed={tb === shown} onClick={() => setTab(tb)}>{tabNames[tb]}</button>)}</nav>
            <main className="cx-hv-main">
              {sel.kind === "plans" && <PackagesScreen game={game} c={c} />}
              {vm && vm.panel}
              {vm && shown === "Summary" && <VmSummary game={game} c={c} v={vm} />}
              {vm && shown === "Console" && <div className="pmx-console"><button className="cx-btn primary" disabled={!vm.own} onClick={() => openConsole(vm.id)}>&gt;_ {t("browser-consoles-2.console")}</button></div>}
              {vm && facts && shown === "Hardware" && (
                <>
                  <Facts facts={[facts.memory, facts.cpu, { ...facts.disk, label: t("browser-consoles-2.hardDiskScsi") }, { ...facts.media, label: t("browser-consoles-2.cdDvdDrive") }, { label: t("browser-consoles-2.networkDevice"), value: "virtio, bridge=vmbr0" }]} />
                  <MediaMenu game={game} v={vm} label={t("browser-consoles-2.cdDvdDrive")} none={t("browser-consoles-2.noMedia")} />
                </>
              )}
              {vm && shown === "Options" && <Facts facts={[{ label: t("browser-consoles-2.name"), value: vm.name }, { label: t("browser-consoles-2.osType"), value: vm.own ? osText(vm.w) : vm.sub }, { label: t("browser-consoles-2.bootOrder"), value: vm.media ? "ide2, scsi0" : "scsi0" }]} />}
              {vm && facts && shown === "Backup" && <><Facts facts={[facts.backup]} /><PointsPanel game={game} c={c} w={vm.w} /></>}
              {!vm && sel.kind !== "plans" && shown === "Summary" && (
                <>
                  <section className="pmx-panel">
                    <h4>{node ? t("browser-consoles-2.status") : t("browser-consoles-2.health")}</h4>
                    <ResourceBars use={health.use} labels={["CPU", t("browser-consoles-2.memory"), t("browser-consoles-2.storage")]} className="cx-hv-bars pmx-res" />
                    <AlarmList game={game} c={c} alarms={health.alarms} className="cx-table pmx-alarms" />
                  </section>
                  <NodeList game={game} c={c} f={{ ...f, cluster: false }} className="cx-table" />
                  <table className="cx-table">
                    <thead><tr><th>ID</th><th>{t("browser-consoles-2.name")}</th><th>{t("browser-consoles-2.node")}</th><th>{t("browser-consoles-2.status")}</th><th>CPU</th><th>{t("browser-consoles-2.memory")}</th></tr></thead>
                    <tbody>
                      {vms.filter((v) => !node || v.w.deviceId === node).map((v) => (
                        <tr key={v.id} onClick={() => pick({ kind: "vm", id: v.id })}>
                          <td className="num">{vmid(v)}</td><td><b>{v.name}</b>{v.sub && <span className="cx-sub">{v.sub}</span>}</td><td>{v.node}</td>
                          <td><span className={`cx-state ${v.tone}`}>{v.state}</span></td><td className="num">{v.w.vcpu}</td><td className="num">{v.w.ramGb} GB</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {!vm && shown === "Cluster" && <NodeList game={game} c={c} f={f} />}
              {!vm && shown === "Backup" && <JobsPanel game={game} source={c} skin="proxmocks" />}
              {node && shown === "Updates" && (
                <>
                  <Facts facts={sw.facts} />
                  <Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>
                </>
              )}
            </main>
          </div>
        </section>
      </div>
      <TaskLog game={game} c={c} vms={vms} title={t("browser-consoles-2.tasks")} className="cx-tasks pmx-tasks" />
      {sel.kind === "new" && (
        <div className="cx-wiz-back">
          <Wizard title={t("browser-consoles-2.createVm")} numbered className="cx-wiz-tabs pmx-wiz" finish={t("browser-consoles-2.finish")} onCancel={() => setSel(ALL)} onFinish={finish} steps={[
            { id: "general", label: t("browser-consoles-2.general"), body: <><div className="pmx-order">{nv.orderFields}</div><Facts facts={[{ label: t("browser-consoles-2.node"), value: nodes.length === 1 ? nodes[0].hostname ?? nodes[0].name : t("browser-consoles-2.any") }, { label: t("browser-consoles-2.resourcePool"), value: c.name }]} /></> },
            { id: "os", label: t("browser-consoles-2.os"), body: nv.isoPick(t("browser-consoles-2.isoImage")) },
            { id: "disk", label: t("browser-consoles-2.hardDisk"), body: <SizeFields size={nv.size} set={nv.setSize} only="diskGb" labels={["", "", t("browser-consoles-2.diskSizeGib")]} /> },
            { id: "cpu", label: "CPU", body: <SizeFields size={nv.size} set={nv.setSize} only="vcpu" labels={[t("browser-consoles-2.cores"), "", ""]} /> },
            { id: "memory", label: t("browser-consoles-2.memory"), body: <SizeFields size={nv.size} set={nv.setSize} only="ramGb" labels={["", t("browser-consoles-2.memoryGib"), ""]} /> },
            { id: "network", label: t("browser-consoles-2.network"), body: <Facts facts={[{ label: t("browser-consoles-2.bridge"), value: "vmbr0" }, { label: t("browser-consoles-2.model"), value: "VirtIO (paravirtualized)" }]} /> },
            { id: "confirm", label: t("browser-consoles-2.confirm"), body: <Facts facts={[{ label: "cores", value: String(nv.size.vcpu), num: true }, { label: "memory", value: `${nv.size.ramGb} GiB`, num: true }, { label: "scsi0", value: `${nv.size.diskGb} GiB`, num: true }, { label: "ide2", value: nv.isoLabel ?? "none", num: true }]} /> },
          ]} />
        </div>
      )}
      {dialog}
    </div>
  );
}
