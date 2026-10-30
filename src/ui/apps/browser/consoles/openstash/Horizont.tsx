import { useState } from "react";
import { yearOf } from "../../../../../sim/00-core/time";
import type { Resources } from "../../../../../sim/10-catalog/products";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { vmStats } from "../../../../../sim/60-infra/stats";
import { nodeUsage } from "../../../../../sim/60-infra/usage";
import { mountableImages } from "../../../../../sim/90-actions/media";
import { useStore } from "../../../../store";
import { bootLines } from "../../../console/lunix";
import { Chart, Donut, niceMax } from "../Chart";
import { ConsoleThumb, isoName, MediaMenu, NodeList, TaskLog, tasks, Toolbar, useNewVm, useVms, vmFacts, Wizard, type Vm } from "../HypervisorBase";
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
const QUOTA_INSTANCES = 10;

// The project Overview: the limit pies, then the day's usage summary and the usage per instance.
export function Overview({ game, c, vms }: { game: GameState; c: Cluster; vms: Vm[] }) {
  const cap = c.nodes.map((n) => nodeUsage(game, n.deviceId).physical).reduce((a, b) => ({ vcpu: a.vcpu + b.vcpu, ramGb: a.ramGb + b.ramGb, diskGb: a.diskGb + b.diskGb }), { vcpu: 0, ramGb: 0, diskGb: 0 });
  const used = vms.reduce((n, v) => ({ vcpu: n.vcpu + v.w.vcpu, ramGb: n.ramGb + v.w.ramGb, diskGb: n.diskGb + v.w.diskGb }), { vcpu: 0, ramGb: 0, diskGb: 0 });
  const rows = vms.map((v) => ({ v, st: vmStats(game, v.id)! })), sum = (f: (x: (typeof rows)[number]) => number) => Math.round(rows.reduce((n, x) => n + f(x), 0) * 100) / 100;
  return (
    <>
      <h1>Overview</h1>
      <h4 className="cx-h">Limit Summary</h4>
      <div className="hz-pies">
        <Donut label="Instances" used={vms.length} of={QUOTA_INSTANCES} text={`Used ${vms.length} of ${QUOTA_INSTANCES}`} />
        <Donut label="VCPUs" used={used.vcpu} of={cap.vcpu} text={`Used ${used.vcpu} of ${cap.vcpu}`} />
        <Donut label="RAM" used={used.ramGb} of={cap.ramGb} text={`Used ${used.ramGb}GB of ${cap.ramGb}GB`} />
        <Donut label="Volume Storage" used={used.diskGb} of={cap.diskGb} text={`Used ${used.diskGb}GB of ${cap.diskGb}GB`} />
      </div>
      <h4 className="cx-h">Usage Summary</h4>
      <Facts facts={[
        { label: "Active Instances", value: String(vms.filter((v) => v.st === "running").length), num: true }, { label: "Active RAM", value: `${used.ramGb}GB`, num: true },
        { label: "This Period's VCPU-Hours", value: String(sum((x) => x.st.totals.vcpuHours)), num: true },
        { label: "This Period's GB-Hours", value: String(sum((x) => x.st.totals.diskGbHours)), num: true },
        { label: "This Period's RAM-Hours", value: String(sum((x) => x.st.totals.ramGbHours * 1024)), num: true },
      ]} />
      <h4 className="cx-h">Usage</h4>
      <table className="cx-table hz-table">
        <thead><tr><th>Instance Name</th><th>VCPUs</th><th>Disk</th><th>RAM</th><th>Time since created</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} className="cx-empty">No items to display.</td></tr>}
          {rows.map(({ v, st }) => <tr key={v.id}><td>{v.name}</td><td className="num">{v.w.vcpu}</td><td className="num">{v.w.diskGb}GB</td><td className="num">{v.w.ramGb}GB</td><td className="num">{st.uptimeHours === null ? "-" : `${Math.floor(st.uptimeHours / 24)} days, ${st.uptimeHours % 24} hours`}</td></tr>)}
        </tbody>
      </table>
    </>
  );
}

// The instance Overview tab: info, specs, addresses, security groups, metadata, volumes and the day's usage.
export function InstanceOverview({ game, v, flavor }: { game: GameState; v: Vm; flavor: string }) {
  const facts = vmFacts(game, v), ring = vmStats(game, v.id)!.ring, net = ring.map((x) => x.netMbit), end = game.hour;
  return (
    <>
      <h4 className="cx-h">Info</h4>
      <Facts facts={[{ label: "Name", value: v.name }, { label: "ID", value: v.id, num: true }, facts.status, { label: "Availability Zone", value: "nova" }, { ...facts.node, label: "Host" }]} />
      <h4 className="cx-h">Specs</h4>
      <Facts facts={[{ label: "Flavor Name", value: flavor, num: true }, { label: "RAM", value: `${v.w.ramGb}GB`, num: true }, { label: "VCPUs", value: `${v.w.vcpu} VCPU`, num: true }, { label: "Disk", value: `${v.w.diskGb}GB`, num: true }]} />
      <h4 className="cx-h">IP Addresses</h4>
      <Facts facts={[{ label: "Private", value: v.ip || "-", num: true }]} />
      <h4 className="cx-h">Security Groups</h4>
      <Facts facts={[{ label: "default", value: "ALLOW IPv4 to 0.0.0.0/0, ALLOW IPv4 from default" }]} />
      <h4 className="cx-h">Metadata</h4>
      <Facts facts={[{ label: "Key Name", value: "None" }, { label: "Image Name", value: v.media ? isoName(v.media, yearOf(game.hour)) : v.own ? v.os : "-" }]} />
      <h4 className="cx-h">Volumes Attached</h4>
      <Facts facts={[{ label: "Volume", value: "No volumes attached." }]} />
      <MediaMenu game={game} v={v} label="Rescue image" none="None" />
      <div className="cx-charts">
        <Chart className="hz-chart" kind="line" title="cpu_util" values={ring.map((x) => x.cpu)} end={end} />
        <Chart className="hz-chart" kind="line" title="memory.usage" values={ring.map((x) => x.ram)} end={end} />
        <Chart className="hz-chart" kind="line" title="network.incoming.bytes.rate" unit="Mbit/s" values={net} max={niceMax(net)} end={end} />
        <Chart className="hz-chart" kind="line" title="disk.usage" values={ring.map((x) => x.disk)} end={end} />
      </div>
    </>
  );
}

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
              <Overview game={game} c={c} vms={vms} />
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
              {page.tab === "Overview" && <InstanceOverview game={game} v={vm} flavor={flavorOf(vm.w)} />}
              {page.tab === "Log" && (
                <>
                  <h4 className="cx-h">Instance Console Log</h4>
                  <pre className="hz-log">{(vm.w.os && vm.w.os.id !== "windoors" && vm.st !== "stopped" ? bootLines(game, vm.w, vm.w.os.version).map((l) => l.text) : tasks(game, c, [vm]).map((x) => `${x.text}: ${x.status}`)).join("\n")}</pre>
                </>
              )}
              {page.tab === "Console" && (
                <div className="hz-console">
                  <h4 className="cx-h">Instance Console</h4>
                  <ConsoleThumb game={game} v={vm} className="cx-thumb hz-thumb" />
                  <button className="cx-btn primary" disabled={!vm.own} onClick={() => openConsole(vm.id)}>Open console</button>
                </div>
              )}
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
