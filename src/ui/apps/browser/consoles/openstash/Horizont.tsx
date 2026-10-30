import { useState } from "react";
import { yearOf } from "../../../../../sim/00-core/time";
import type { Resources } from "../../../../../sim/10-catalog/products";
import { mountableImages } from "../../../../../sim/90-actions/media";
import { useStore } from "../../../../store";
import { isoName, MediaMenu, NodeList, TaskLog, tasks, Toolbar, UsageBars, useNewVm, useVms, vmFacts, Wizard } from "../HypervisorBase";
import { Actions, Backups, erasFrom, eraAt, Facts, LoginForm, useSoftware, type PanelProps } from "../PanelBase";
import "./horizont.css";

// docs/design/software.md, section 9: the purple dashboard from 2010, the dark-sidebar one with the red mark from 2016.
const ERAS = erasFrom(2010, 2016);
const FLAVORS: [string, Resources][] = [
  ["m1.tiny", { vcpu: 1, ramGb: 1, diskGb: 10 }], ["m1.small", { vcpu: 1, ramGb: 2, diskGb: 20 }], ["m1.medium", { vcpu: 2, ramGb: 4, diskGb: 40 }],
  ["m1.large", { vcpu: 4, ramGb: 8, diskGb: 80 }], ["m1.xlarge", { vcpu: 8, ramGb: 16, diskGb: 160 }],
];
const same = (a: Resources, b: Resources) => a.vcpu === b.vcpu && a.ramGb === b.ramGb && a.diskGb === b.diskGb;
const flavorOf = (r: Resources) => FLAVORS.find(([, x]) => same(x, r))?.[0] ?? `custom ${r.vcpu}/${r.ramGb}/${r.diskGb}`;
type Page = "overview" | "instances" | "images" | "keys" | "hypervisors" | "system" | { vm: string; tab: "Overview" | "Log" | "Console" };

export function Horizont(p: PanelProps) {
  const era = eraAt(ERAS, p.game), { game, c, f } = p, openConsole = useStore((s) => s.openConsole), year = yearOf(game.hour);
  const [page, setPage] = useState<Page>("instances"), [launching, setLaunching] = useState(false);
  const { vms, dialog } = useVms(game, c, f), sw = useSoftware(game, c, f), nv = useNewVm(game, c);
  if (!p.signedIn) return (
    <div className="cx hz hz-login" data-era={era}>
      <LoginForm className="hz-card" onLogin={p.login} button="Connect">
        <div className="hz-logo">openstash</div>
        <div className="cx-host">{p.host}</div>
        <label className="cx-field">Domain<input defaultValue="default" autoComplete="off" /></label>
      </LoginForm>
    </div>
  );
  const vm = typeof page === "object" ? vms.find((v) => v.id === page.vm) : undefined, facts = vm && vmFacts(game, vm);
  const finish = () => { const id = nv.create(); if (id) { setLaunching(false); setPage({ vm: id, tab: "Overview" }); } };
  const nav: [string, [Page, string][]][] = [
    ["Project", [["overview", "Overview"], ["instances", "Instances"], ["images", "Images"], ["keys", "Key Pairs"]]],
    ["Admin", [["hypervisors", "Hypervisors"], ["system", "System Information"]]],
  ];
  const used = vms.reduce((n, v) => ({ vcpu: n.vcpu + v.w.vcpu, ramGb: n.ramGb + v.w.ramGb, diskGb: n.diskGb + v.w.diskGb }), { vcpu: 0, ramGb: 0, diskGb: 0 });
  return (
    <div className="cx cx-hv hz" data-era={era}>
      <header className="hz-top"><span className="hz-logo">openstash</span><span className="hz-proj">admin</span><span className="cx-host">{p.host}</span><button className="hz-out" onClick={p.logout}>Sign Out</button></header>
      <div className="cx-hv-body">
        <nav className="hz-side">
          {nav.map(([group, items]) => (
            <section key={group}>
              <h3>{group}</h3>
              {group === "Project" && <h4>Compute</h4>}
              {items.map(([id, label]) => <button key={label} aria-pressed={page === id || (id === "instances" && !!vm)} onClick={() => setPage(id)}>{label}</button>)}
            </section>
          ))}
        </nav>
        <main className="cx-hv-main hz-main">
          {page === "overview" && (
            <>
              <h1>Overview</h1>
              <Facts facts={[{ label: "Instances", value: String(vms.length), num: true }, { label: "VCPUs", value: String(used.vcpu), num: true }, { label: "RAM", value: `${used.ramGb} GB`, num: true }, { label: "Volume Storage", value: `${used.diskGb} GB`, num: true }]} />
              <TaskLog game={game} c={c} vms={vms} title="Recent Events" className="cx-tasks hz-tasks" />
            </>
          )}
          {page === "instances" && (
            <>
              <div className="cx-hv-head"><h1>Instances</h1>{f.create && <button className="cx-btn primary" onClick={() => setLaunching(true)}>Launch Instance</button>}</div>
              <table className="cx-table hz-table">
                <thead><tr><th>Instance Name</th><th>Image Name</th><th>IP Address</th><th>Flavor</th><th>Status</th><th>Power State</th></tr></thead>
                <tbody>
                  {vms.length === 0 && <tr><td colSpan={6} className="cx-empty">No items to display.</td></tr>}
                  {vms.map((v) => (
                    <tr key={v.id}>
                      <td><button className="hz-a" onClick={() => setPage({ vm: v.id, tab: "Overview" })}>{v.name}</button>{v.sub && <span className="cx-sub">{v.sub}</span>}</td>
                      <td>{v.media ? isoName(v.media, year) : "-"}</td><td className="num">{v.ip}</td><td className="num">{flavorOf(v.w)}</td>
                      <td><span className={`cx-state ${v.tone}`}>{v.tone === "bad" ? "Error" : "Active"}</span></td><td>{v.st === "stopped" ? "Shutdown" : v.state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {vm && facts && typeof page === "object" && (
            <>
              <div className="cx-hv-head"><h1>{vm.name}</h1><Toolbar actions={vm.actions} className="cx-toolbar hz-tools" labels={{ start: "Start Instance", stop: "Shut Off Instance", reset: "Hard Reboot Instance", resize: "Resize Instance", migrate: "Live Migrate Instance", delete: "Delete Instance", console: "Console" }} /></div>
              {vm.panel}
              <nav className="cx-hv-tabs hz-tabs">{(["Overview", "Log", "Console"] as const).map((t) => <button key={t} aria-pressed={page.tab === t} onClick={() => setPage({ vm: vm.id, tab: t })}>{t}</button>)}</nav>
              {page.tab === "Overview" && (
                <>
                  <h4 className="cx-h">Info</h4>
                  <Facts facts={[{ label: "Name", value: vm.name }, { label: "ID", value: vm.id, num: true }, facts.status, { label: "Availability Zone", value: "nova" }, { ...facts.node, label: "Host" }]} />
                  <h4 className="cx-h">Specs</h4>
                  <Facts facts={[{ label: "Flavor", value: flavorOf(vm.w), num: true }, facts.memory, { ...facts.cpu, label: "VCPUs" }, { ...facts.disk, label: "Disk" }]} />
                  <h4 className="cx-h">IP Addresses</h4>
                  <Facts facts={[{ ...facts.ip, label: "private" }]} />
                  <UsageBars v={vm} />
                  <MediaMenu game={game} v={vm} label="Rescue image" none="None" />
                </>
              )}
              {page.tab === "Log" && <pre className="hz-log">{tasks(game, c, [vm]).map((t) => `${t.text}: ${t.status}`).join("\n") || `${vm.name}: ${vm.state}`}</pre>}
              {page.tab === "Console" && <div className="hz-console"><button className="cx-btn primary" disabled={!vm.own} onClick={() => openConsole(vm.id)}>Open console</button></div>}
            </>
          )}
          {page === "images" && (
            <>
              <h1>Images</h1>
              <table className="cx-table hz-table">
                <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Format</th></tr></thead>
                <tbody>
                  {mountableImages(game).length === 0 && <tr><td colSpan={4} className="cx-empty">No items to display.</td></tr>}
                  {mountableImages(game).map((o) => <tr key={o.id}><td>{isoName(o.id, year)}</td><td>Image</td><td>Active</td><td>ISO</td></tr>)}
                </tbody>
              </table>
            </>
          )}
          {page === "keys" && (<><h1>Key Pairs</h1><table className="cx-table hz-table"><thead><tr><th>Key Pair Name</th><th>Fingerprint</th></tr></thead><tbody><tr><td colSpan={2} className="cx-empty">No items to display.</td></tr></tbody></table></>)}
          {page === "hypervisors" && (<><h1>All Hypervisors</h1><NodeList game={game} c={c} f={f} className="cx-table hz-table" /></>)}
          {page === "system" && (
            <>
              <h1>System Information</h1>
              <Facts facts={sw.facts} />
              <Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>
              {sw.panel}
              {f.backups && <Backups game={game} c={c} />}
            </>
          )}
        </main>
      </div>
      {launching && (
        <div className="cx-wiz-back">
          <Wizard title="Launch Instance" className="hz-wiz" finish="Launch Instance" onCancel={() => setLaunching(false)} onFinish={finish} steps={[
            { id: "details", label: "Details", body: <Facts facts={[{ label: "Project", value: "admin" }, { label: "Availability Zone", value: "nova" }, { label: "Count", value: "1", num: true }]} /> },
            { id: "source", label: "Source", body: nv.isoPick("Image", "None") },
            { id: "flavor", label: "Flavor", body: (
              <table className="cx-table hz-table">
                <thead><tr><th /><th>Name</th><th>VCPUs</th><th>RAM</th><th>Root Disk</th></tr></thead>
                <tbody>
                  {FLAVORS.map(([name, r]) => (
                    <tr key={name} onClick={() => nv.setSize(r)}>
                      <td><input type="radio" name="hz-flavor" checked={same(nv.size, r)} onChange={() => nv.setSize(r)} /></td><td>{name}</td><td className="num">{r.vcpu}</td><td className="num">{r.ramGb} GB</td><td className="num">{r.diskGb} GB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) },
            { id: "net", label: "Networks", body: <Facts facts={[{ label: "Network", value: "private" }, { label: "Subnet", value: "private-subnet" }]} /> },
          ]} />
        </div>
      )}
      {dialog}
    </div>
  );
}
