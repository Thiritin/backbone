import { useState } from "react";
import { useStore } from "../../../../store";
import { ALL, MediaMenu, NodeList, osText, SizeFields, TaskLog, Toolbar, UsageBars, useNewVm, useVms, vmFacts, Wizard, type Sel, type Vm } from "../HypervisorBase";
import { Actions, Backups, erasFrom, eraAt, Facts, LoginForm, useSoftware, type PanelProps } from "../PanelBase";
import "./proxmocks.css";

// docs/design/software.md, section 9: the grey ExtJS manager from 2008, the flat white one with the orange mark from 2015.
const ERAS = erasFrom(2008, 2015);
const vmid = (v: Vm) => 100 + Number(v.id.replace(/\D/g, "") || 0);

export function Proxmocks(p: PanelProps) {
  const era = eraAt(ERAS, p.game), { game, c, f } = p, openConsole = useStore((s) => s.openConsole);
  const [sel, setSel] = useState<Sel>(ALL), [tab, setTab] = useState("Summary");
  const { vms, dialog } = useVms(game, c, f), sw = useSoftware(game, c, f), nv = useNewVm(game, c);
  if (!p.signedIn) return (
    <div className="cx pmx pmx-login" data-era={era}>
      <LoginForm className="pmx-card" onLogin={p.login} button="Login">
        <div className="pmx-card-h">Proxmocks VE Login</div>
        <div className="cx-host">{p.host}</div>
        <label className="cx-field">Realm<select defaultValue="pam"><option value="pam">Lunix PAM standard authentication</option><option value="pve">Proxmocks VE authentication server</option></select></label>
      </LoginForm>
    </div>
  );
  const pick = (s: Sel, t = "Summary") => { setSel(s); setTab(t); };
  const vm = sel.kind === "vm" ? vms.find((v) => v.id === sel.id) : undefined;
  const node = sel.kind === "node" ? sel.id : null;
  const tabs = vm ? ["Summary", "Console", "Hardware", "Options", "Backup"]
    : node ? ["Summary", "Updates"] : ["Summary", ...(f.cluster ? ["Cluster"] : []), ...(f.backups ? ["Backup"] : [])];
  const shown = tabs.includes(tab) ? tab : "Summary";
  const nodes = c.nodes.map((n) => game.devices.find((d) => d.id === n.deviceId)!).filter(Boolean);
  const title = vm ? `Virtual Machine ${vmid(vm)} (${vm.name}) on node '${vm.node}'` : node ? `Node '${nodes.find((d) => d.id === node)?.hostname ?? ""}'` : "Datacenter";
  const finish = () => { const id = nv.create(); if (id) pick({ kind: "vm", id }); };
  const facts = vm && vmFacts(game, vm);
  return (
    <div className="cx cx-hv pmx" data-era={era}>
      <header className="pmx-top">
        <span className="pmx-logo"><b>PROXMOCKS</b> Virtual Environment</span>
        <span className="pmx-ver num">{c.version}</span>
        <span className="cx-host">{p.host}</span>
        {f.create && <button className="pmx-create" onClick={() => setSel({ kind: "new" })}>Create VM</button>}
        <button className="pmx-out" onClick={p.logout}>Logout</button>
      </header>
      <div className="cx-hv-body">
        <aside className="cx-hv-tree pmx-tree">
          <div className="pmx-view">Server View</div>
          <ul>
            <li><button aria-pressed={sel.kind === "all"} onClick={() => pick(ALL)}><i>▤</i>Datacenter</button>
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
        </aside>
        <section className="pmx-content">
          <div className="pmx-bar">
            <span className="pmx-title">{title}</span>
            {vm && <Toolbar actions={vm.actions} className="cx-toolbar pmx-tools" />}
          </div>
          <div className="pmx-pane">
            <nav className="pmx-tabs">{tabs.map((t) => <button key={t} aria-pressed={t === shown} onClick={() => setTab(t)}>{t}</button>)}</nav>
            <main className="cx-hv-main">
              {vm && vm.panel}
              {vm && facts && shown === "Summary" && (
                <>
                  <Facts facts={[facts.status, facts.node, facts.ip, facts.os]} />
                  <UsageBars v={vm} labels={["CPU usage", "Memory usage", "Bootdisk size"]} />
                </>
              )}
              {vm && shown === "Console" && <div className="pmx-console"><button className="cx-btn primary" disabled={!vm.own} onClick={() => openConsole(vm.id)}>&gt;_ Console</button></div>}
              {vm && facts && shown === "Hardware" && (
                <>
                  <Facts facts={[facts.memory, facts.cpu, { ...facts.disk, label: "Hard Disk (scsi0)" }, { ...facts.media, label: "CD/DVD Drive (ide2)" }, { label: "Network Device (net0)", value: "virtio, bridge=vmbr0" }]} />
                  <MediaMenu game={game} v={vm} label="CD/DVD Drive (ide2)" none="Do not use any media" />
                </>
              )}
              {vm && shown === "Options" && <Facts facts={[{ label: "Name", value: vm.name }, { label: "OS Type", value: vm.own ? osText(vm.w) : vm.sub }, { label: "Boot Order", value: vm.media ? "ide2, scsi0" : "scsi0" }]} />}
              {vm && facts && shown === "Backup" && <Facts facts={[facts.backup]} />}
              {!vm && shown === "Summary" && (
                <>
                  <NodeList game={game} c={c} f={{ ...f, cluster: false }} className="cx-table" />
                  <table className="cx-table">
                    <thead><tr><th>ID</th><th>Name</th><th>Node</th><th>Status</th><th>CPU</th><th>Memory</th></tr></thead>
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
              {!vm && shown === "Backup" && <Backups game={game} c={c} />}
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
      <TaskLog game={game} c={c} vms={vms} title="Tasks" className="cx-tasks pmx-tasks" />
      {sel.kind === "new" && (
        <div className="cx-wiz-back">
          <Wizard title="Create: Virtual Machine" numbered className="cx-wiz-tabs pmx-wiz" finish="Finish" onCancel={() => setSel(ALL)} onFinish={finish} steps={[
            { id: "general", label: "General", body: <Facts facts={[{ label: "Node", value: nodes.length === 1 ? nodes[0].hostname ?? nodes[0].name : "Any" }, { label: "Resource Pool", value: c.name }]} /> },
            { id: "os", label: "OS", body: nv.isoPick("ISO image") },
            { id: "disk", label: "Hard Disk", body: <SizeFields size={nv.size} set={nv.setSize} only="diskGb" labels={["", "", "Disk size (GiB)"]} /> },
            { id: "cpu", label: "CPU", body: <SizeFields size={nv.size} set={nv.setSize} only="vcpu" labels={["Cores", "", ""]} /> },
            { id: "memory", label: "Memory", body: <SizeFields size={nv.size} set={nv.setSize} only="ramGb" labels={["", "Memory (GiB)", ""]} /> },
            { id: "network", label: "Network", body: <Facts facts={[{ label: "Bridge", value: "vmbr0" }, { label: "Model", value: "VirtIO (paravirtualized)" }]} /> },
            { id: "confirm", label: "Confirm", body: <Facts facts={[{ label: "cores", value: String(nv.size.vcpu), num: true }, { label: "memory", value: `${nv.size.ramGb} GiB`, num: true }, { label: "scsi0", value: `${nv.size.diskGb} GiB`, num: true }, { label: "ide2", value: nv.isoLabel ?? "none", num: true }]} /> },
          ]} />
        </div>
      )}
      {dialog}
    </div>
  );
}
