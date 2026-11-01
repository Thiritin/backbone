import { useState } from "react";
import type { GameState } from "../../../../../sim/50-state";
import type { Resources } from "../../../../../sim/10-catalog/products";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { vmStats } from "../../../../../sim/60-infra/stats";
import { nodeUsage } from "../../../../../sim/60-infra/usage";
import { mountableImages } from "../../../../../sim/90-actions/media";
import { t } from "../../../../../i18n/en";
import { useStore } from "../../../../store";
import { bootLines } from "../../../console/lunix";
import { Chart, Donut, niceMax } from "../Chart";
import { AlarmList, ConsoleThumb, isoName, MediaMenu, NodeList, ResourceBars, summaryOf, TaskLog, tasks, Toolbar, useNewVm, useVms, vmFacts, Wizard, type Vm } from "../HypervisorBase";
import { Actions, Backups, erasFrom, eraAt, Facts, LoginForm, useSoftware, type PanelProps } from "../PanelBase";
import { parseCreate } from "../../../../../sim/80-business/consoles";
import { packagesOf } from "../../../../../sim/80-business/packages";
import { PackagesScreen } from "../PackageForms";
import { flavorCounts, FLAVORS, flavorOf as baseFlavorOf, same } from "./flavors";
import { FloatingIps, InstanceGroups, SecurityGroups, Volumes } from "./HorizontNetwork";
import { volumesOf } from "../../../../../sim/60-infra/horizont";
import "./horizont.css";
import { noAutofill } from "../../../../no-autofill";

// docs/design/software.md, section 9: the purple dashboard from 2010, the dark-sidebar one with the red mark from 2016.
const ERAS = erasFrom(2010, 2016);
const flavorOf = (r: Resources, c: Cluster) => FLAVORS.find(([, x]) => same(x, r))?.[0] ?? packagesOf(c).find((q) => same(q.spec, r))?.name ?? baseFlavorOf(r);
const QUOTA_INSTANCES = 10;

// The project Overview: the limit pies, then the day's usage summary and the usage per instance.
export function Overview({ game, c, vms }: { game: GameState; c: Cluster; vms: Vm[] }) {
  const cap = c.nodes.map((n) => nodeUsage(game, n.deviceId).physical).reduce((a, b) => ({ vcpu: a.vcpu + b.vcpu, ramGb: a.ramGb + b.ramGb, diskGb: a.diskGb + b.diskGb }), { vcpu: 0, ramGb: 0, diskGb: 0 });
  const used = vms.reduce((n, v) => ({ vcpu: n.vcpu + v.w.vcpu, ramGb: n.ramGb + v.w.ramGb, diskGb: n.diskGb + v.w.diskGb }), { vcpu: 0, ramGb: 0, diskGb: 0 });
  const rows = vms.map((v) => ({ v, st: vmStats(game, v.id)! })), sum = (f: (x: (typeof rows)[number]) => number) => Math.round(rows.reduce((n, x) => n + f(x), 0) * 100) / 100;
  return (
    <>
      <h1>{t("browser-consoles-1.hzOverview")}</h1>
      <h4 className="cx-h">{t("browser-consoles-1.hzLimitSummary")}</h4>
      <div className="hz-pies">
        <Donut label={t("browser-consoles-1.hzInstances")} used={vms.length} of={QUOTA_INSTANCES} text={t("browser-consoles-1.hzUsedOf", { a: vms.length, b: QUOTA_INSTANCES })} />
        <Donut label={t("browser-consoles-1.hzVcpus")} used={used.vcpu} of={cap.vcpu} text={t("browser-consoles-1.hzUsedOf", { a: used.vcpu, b: cap.vcpu })} />
        <Donut label={t("browser-consoles-1.hzRam")} used={used.ramGb} of={cap.ramGb} text={t("browser-consoles-1.hzUsedOf", { a: `${used.ramGb}GB`, b: `${cap.ramGb}GB` })} />
        <Donut label={t("browser-consoles-1.hzVolumeStorage")} used={used.diskGb} of={cap.diskGb} text={t("browser-consoles-1.hzUsedOf", { a: `${used.diskGb}GB`, b: `${cap.diskGb}GB` })} />
      </div>
      <AlarmList game={game} c={c} alarms={summaryOf(game, c, null).alarms} className="cx-table hz-table" />
      <h4 className="cx-h">{t("browser-consoles-1.hzUsageSummary")}</h4>
      <Facts facts={[
        { label: t("browser-consoles-1.hzActiveInstances"), value: String(vms.filter((v) => v.st === "running").length), num: true }, { label: t("browser-consoles-1.hzActiveRam"), value: `${used.ramGb}GB`, num: true },
        { label: t("browser-consoles-1.hzVcpuHours"), value: String(sum((x) => x.st.totals.vcpuHours)), num: true },
        { label: t("browser-consoles-1.hzGbHours"), value: String(sum((x) => x.st.totals.diskGbHours)), num: true },
        { label: t("browser-consoles-1.hzRamHours"), value: String(sum((x) => x.st.totals.ramGbHours * 1024)), num: true },
      ]} />
      <h4 className="cx-h">{t("browser-consoles-1.hzUsage")}</h4>
      <table className="cx-table hz-table">
        <thead><tr><th>{t("browser-consoles-1.hzInstanceName")}</th><th>{t("browser-consoles-1.hzVcpus")}</th><th>{t("browser-consoles-1.hzDisk")}</th><th>{t("browser-consoles-1.hzRam")}</th><th>{t("browser-consoles-1.hzTimeSinceCreated")}</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} className="cx-empty">{t("browser-consoles-1.hzNoItems")}</td></tr>}
          {rows.map(({ v, st }) => <tr key={v.id}><td>{v.name}</td><td className="num">{v.w.vcpu}</td><td className="num">{v.w.diskGb}GB</td><td className="num">{v.w.ramGb}GB</td><td className="num">{st.uptimeHours === null ? "-" : t("browser-consoles-1.hzDaysHours", { d: Math.floor(st.uptimeHours / 24), h: st.uptimeHours % 24 })}</td></tr>)}
        </tbody>
      </table>
    </>
  );
}

// The instance Overview tab: info, specs, addresses, security groups, metadata, volumes and the day's usage.
export function InstanceOverview({ game, c, v, flavor }: { game: GameState; c: Cluster; v: Vm; flavor: string }) {
  const facts = vmFacts(game, v), ring = vmStats(game, v.id)!.ring, net = ring.map((x) => x.netMbit), end = game.hour;
  return (
    <>
      <h4 className="cx-h">{t("browser-consoles-1.hzInfo")}</h4>
      <Facts facts={[{ label: t("browser-consoles-1.name"), value: v.name }, { label: "ID", value: v.id, num: true }, facts.status, { label: t("browser-consoles-1.hzAvailabilityZone"), value: "nova" }, { ...facts.node, label: t("browser-consoles-1.hzHost") }]} />
      <h4 className="cx-h">{t("browser-consoles-1.hzSpecs")}</h4>
      <Facts facts={[{ label: t("browser-consoles-1.hzFlavorName"), value: flavor, num: true }, { label: t("browser-consoles-1.hzRam"), value: `${v.w.ramGb}GB`, num: true }, { label: t("browser-consoles-1.hzVcpus"), value: `${v.w.vcpu} VCPU`, num: true }, { label: t("browser-consoles-1.hzDisk"), value: `${v.w.diskGb}GB`, num: true }]} />
      <h4 className="cx-h">{t("browser-consoles-1.hvIpAddresses")}</h4>
      <Facts facts={[{ label: t("browser-consoles-1.hzPrivate"), value: v.ip || "-", num: true }]} />
      <h4 className="cx-h">{t("browser-consoles-1.hzSecurityGroups")}</h4>
      <InstanceGroups c={c} v={v} />
      <h4 className="cx-h">{t("browser-consoles-1.hzMetadata")}</h4>
      <Facts facts={[{ label: t("browser-consoles-1.hzKeyName"), value: t("browser-consoles-1.none") }, { label: t("browser-consoles-1.hzImageName"), value: v.media ? isoName(v.media) : v.own ? v.os : "-" }]} />
      <h4 className="cx-h">{t("browser-consoles-1.hzVolumesAttached")}</h4>
      <Facts facts={volumesOf(c).filter((x) => x.attachedTo === v.id).map((x) => ({ label: x.name, value: `${x.gb}GB`, num: true })).concat(volumesOf(c).some((x) => x.attachedTo === v.id) ? [] : [{ label: t("browser-consoles-1.hzVolume"), value: t("browser-consoles-1.hzNoVolumes"), num: false }])} />
      <MediaMenu game={game} v={v} label={t("browser-consoles-1.hzRescueImage")} none={t("browser-consoles-1.none")} />
      <div className="cx-charts">
        <Chart className="hz-chart" kind="line" title="cpu_util" values={ring.map((x) => x.cpu)} end={end} />
        <Chart className="hz-chart" kind="line" title="memory.usage" values={ring.map((x) => x.ram)} end={end} />
        <Chart className="hz-chart" kind="line" title="network.incoming.bytes.rate" unit="Mbit/s" values={net} max={niceMax(net)} end={end} />
        <Chart className="hz-chart" kind="line" title="disk.usage" values={ring.map((x) => x.disk)} end={end} />
      </div>
    </>
  );
}

type Page = "overview" | "instances" | "floating" | "groups" | "volumes" | "images" | "keys" | "hypervisors" | "flavors" | "system" | { vm: string; tab: "Overview" | "Log" | "Console" };
const TAB_LABELS = { Overview: () => t("browser-consoles-1.hzOverview"), Log: () => t("browser-consoles-1.hzLog"), Console: () => t("browser-consoles-1.console") };

export function Horizont(p: PanelProps) {
  const era = eraAt(ERAS, p), { game, c, f } = p, openConsole = useStore((s) => s.openConsole);
  const link = parseCreate("openstash", p.path), [page, setPage] = useState<Page>(link?.screen === "packages" ? "flavors" : "instances"), [launching, setLaunching] = useState(link?.screen === "create");
  const { vms, dialog } = useVms(game, c, f), sw = useSoftware(game, c, f), nv = useNewVm(game, c, link?.screen === "create" ? link.order : undefined), health = summaryOf(game, c, null);
  if (!p.signedIn) return (
    <div className="cx hz hz-login" data-era={era}>
      <LoginForm className="hz-card" onLogin={p.login} button={t("browser-consoles-1.hvConnectBtn")}>
        <div className="hz-logo">openstash</div>
        <div className="cx-host">{p.host}</div>
        <label className="cx-field">{t("browser-consoles-1.domain")}<input defaultValue="default" {...noAutofill} /></label>
      </LoginForm>
    </div>
  );
  const vm = typeof page === "object" ? vms.find((v) => v.id === page.vm) : undefined, facts = vm && vmFacts(game, vm);
  const finish = () => { if (nv.ordered) { if (nv.submit()) { setLaunching(false); setPage("instances"); } return; } const id = nv.create(); if (id) { setLaunching(false); setPage({ vm: id, tab: "Overview" }); } };
  const nav: [string, string, [Page, string][]][] = [
    ["Project", t("browser-consoles-1.hzProject"), [["overview", t("browser-consoles-1.hzOverview")], ["instances", t("browser-consoles-1.hzInstances")], ["images", t("browser-consoles-1.hzImages")], ["keys", t("browser-consoles-1.hzKeyPairs")]]],
    ["Network", t("hzn.network"), [["floating", t("hzn.floatingIps")], ["groups", t("hzn.securityGroups")]]],
    ["Volumes", t("hzn.volumes"), [["volumes", t("hzn.volumes")]]],
    ["Admin", t("browser-consoles-1.hzAdmin"), [["hypervisors", t("browser-consoles-1.hzHypervisors")], ["flavors", t("readouts.flavors")], ["system", t("browser-consoles-1.hzSystemInfo")]]],
  ];
  return (
    <div className="cx cx-hv hz" data-era={era}>
      <header className="hz-top"><span className="hz-logo">openstash</span><span className="hz-proj">admin</span><span className="cx-host">{p.host}</span><button className="hz-out" onClick={p.logout}>{t("browser-consoles-1.hzSignOut")}</button></header>
      <div className="cx-hv-body">
        <nav className="hz-side">
          {nav.map(([group, groupLabel, items]) => (
            <section key={group}>
              <h3>{groupLabel}</h3>
              {group === "Project" && <h4>{t("browser-consoles-1.hzCompute")}</h4>}
              {items.map(([id, label]) => <button key={label} aria-pressed={page === id || (id === "instances" && !!vm)} onClick={() => setPage(id)}>{label}</button>)}
            </section>
          ))}
        </nav>
        <main className="cx-hv-main hz-main">
          {page === "overview" && (
            <>
              <Overview game={game} c={c} vms={vms} />
              <TaskLog game={game} c={c} vms={vms} title={t("browser-consoles-1.hzRecentEvents")} className="cx-tasks hz-tasks" />
            </>
          )}
          {page === "instances" && (
            <>
              <div className="cx-hv-head"><h1>{t("browser-consoles-1.hzInstances")}</h1>{f.create && <button className="cx-btn primary" onClick={() => setLaunching(true)}>{t("browser-consoles-1.hzLaunchInstance")}</button>}</div>
              <table className="cx-table hz-table">
                <thead><tr><th>{t("browser-consoles-1.hzInstanceName")}</th><th>{t("browser-consoles-1.hzImageName")}</th><th>{t("browser-consoles-1.ipAddress")}</th><th>{t("browser-consoles-1.hzFlavor")}</th><th>{t("browser-consoles-1.status")}</th><th>{t("browser-consoles-1.hzPowerState")}</th></tr></thead>
                <tbody>
                  {vms.length === 0 && <tr><td colSpan={6} className="cx-empty">{t("browser-consoles-1.hzNoItems")}</td></tr>}
                  {vms.map((v) => (
                    <tr key={v.id}>
                      <td><button className="hz-a" onClick={() => setPage({ vm: v.id, tab: "Overview" })}>{v.name}</button>{v.sub && <span className="cx-sub">{v.sub}</span>}</td>
                      <td>{v.media ? isoName(v.media) : "-"}</td><td className="num">{v.ip}</td><td className="num">{flavorOf(v.w, c)}</td>
                      <td><span className={`cx-state ${v.tone}`}>{v.tone === "bad" ? t("browser-consoles-1.error") : t("browser-consoles-1.active")}</span></td><td>{v.st === "stopped" ? t("browser-consoles-1.hzShutdown") : v.state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {vm && facts && typeof page === "object" && (
            <>
              <div className="cx-hv-head"><h1>{vm.name}</h1><Toolbar actions={vm.actions} className="cx-toolbar hz-tools" labels={{ start: t("browser-consoles-1.hzStartInstance"), stop: t("browser-consoles-1.hzShutOffInstance"), reset: t("browser-consoles-1.hzHardReboot"), resize: t("browser-consoles-1.hzResizeInstance"), migrate: t("browser-consoles-1.hzLiveMigrate"), delete: t("browser-consoles-1.hzDeleteInstance"), console: t("browser-consoles-1.console") }} /></div>
              {vm.panel}
              <nav className="cx-hv-tabs hz-tabs">{(["Overview", "Log", "Console"] as const).map((x) => <button key={x} aria-pressed={page.tab === x} onClick={() => setPage({ vm: vm.id, tab: x })}>{TAB_LABELS[x]()}</button>)}</nav>
              {page.tab === "Overview" && <InstanceOverview game={game} c={c} v={vm} flavor={flavorOf(vm.w, c)} />}
              {page.tab === "Log" && (
                <>
                  <h4 className="cx-h">{t("browser-consoles-1.hzConsoleLog")}</h4>
                  <pre className="hz-log">{(vm.w.os && vm.w.os.id !== "windoors" && vm.st !== "stopped" ? bootLines(game, vm.w, vm.w.os.version).map((l) => l.text) : tasks(game, c, [vm]).map((x) => `${x.text}: ${x.status}`)).join("\n")}</pre>
                </>
              )}
              {page.tab === "Console" && (
                <div className="hz-console">
                  <h4 className="cx-h">{t("browser-consoles-1.hzInstanceConsole")}</h4>
                  <ConsoleThumb game={game} v={vm} className="cx-thumb hz-thumb" />
                  <button className="cx-btn primary" disabled={!vm.own} onClick={() => openConsole(vm.id)}>{t("browser-consoles-1.hzOpenConsole")}</button>
                </div>
              )}
            </>
          )}
          {page === "floating" && <FloatingIps game={game} c={c} vms={vms} />}
          {page === "groups" && <SecurityGroups c={c} vms={vms} />}
          {page === "volumes" && <Volumes c={c} vms={vms} />}
          {page === "images" && (
            <>
              <h1>{t("browser-consoles-1.hzImages")}</h1>
              <table className="cx-table hz-table">
                <thead><tr><th>{t("browser-consoles-1.name")}</th><th>{t("browser-consoles-1.hzType")}</th><th>{t("browser-consoles-1.status")}</th><th>{t("browser-consoles-1.hzFormat")}</th></tr></thead>
                <tbody>
                  {mountableImages(game).length === 0 && <tr><td colSpan={4} className="cx-empty">{t("browser-consoles-1.hzNoItems")}</td></tr>}
                  {mountableImages(game).map((o) => <tr key={o}><td>{isoName(o)}</td><td>{t("browser-consoles-1.hzImage")}</td><td>{t("browser-consoles-1.active")}</td><td>ISO</td></tr>)}
                </tbody>
              </table>
            </>
          )}
          {page === "keys" && (<><h1>{t("browser-consoles-1.hzKeyPairs")}</h1><table className="cx-table hz-table"><thead><tr><th>{t("browser-consoles-1.hzKeyPairName")}</th><th>{t("browser-consoles-1.hzFingerprint")}</th></tr></thead><tbody><tr><td colSpan={2} className="cx-empty">{t("browser-consoles-1.hzNoItems")}</td></tr></tbody></table></>)}
          {page === "hypervisors" && (<>
            <h1>{t("browser-consoles-1.hzAllHypervisors")}</h1>
            <h4 className="cx-h">{t("browser-consoles-1.hzHypervisorSummary")}</h4>
            <ResourceBars use={health.use} labels={[t("browser-consoles-1.hzVcpuUsage"), t("browser-consoles-1.hzMemoryUsage"), t("browser-consoles-1.hzLocalDiskUsage")]} />
            <NodeList game={game} c={c} f={f} className="cx-table hz-table" />
            {health.alarms.length > 0 && <><h4 className="cx-h">{t("browser-consoles-1.hzAlarms")}</h4><AlarmList game={game} c={c} alarms={health.alarms} className="cx-table hz-table" /></>}
          </>)}
          {page === "flavors" && (<>
            <h1>{t("readouts.flavors")}</h1>
            <table className="cx-table hz-table">
              <thead><tr><th>{t("browser-consoles-1.name")}</th><th>{t("browser-consoles-1.hzVcpus")}</th><th>{t("browser-consoles-1.hzRam")}</th><th>{t("browser-consoles-1.hzRootDisk")}</th><th>{t("readouts.instances")}</th></tr></thead>
              <tbody>
                {flavorCounts(vms.map((v) => v.w)).map(({ name, r, n }) => <tr key={name}><td>{name}</td><td className="num">{r.vcpu}</td><td className="num">{r.ramGb} GB</td><td className="num">{r.diskGb} GB</td><td className="num">{n}</td></tr>)}
                <tr><td>{t("readouts.customFlavor")}</td><td /><td /><td /><td className="num">{vms.filter((v) => !FLAVORS.some(([, r]) => same(r, v.w))).length}</td></tr>
              </tbody>
            </table>
            <PackagesScreen game={game} c={c} />
          </>)}
          {page === "system" && (
            <>
              <h1>{t("browser-consoles-1.hzSystemInfo")}</h1>
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
          <Wizard title={t("browser-consoles-1.hzLaunchInstance")} className="hz-wiz" finish={t("browser-consoles-1.hzLaunchInstance")} onCancel={() => setLaunching(false)} onFinish={finish} steps={[
            { id: "details", label: t("browser-consoles-1.hzDetails"), body: <><div className="hz-order">{nv.orderFields}</div><Facts facts={[{ label: t("browser-consoles-1.hzProject"), value: "admin" }, { label: t("browser-consoles-1.hzAvailabilityZone"), value: "nova" }, { label: t("browser-consoles-1.hzCount"), value: "1", num: true }]} /></> },
            { id: "source", label: t("browser-consoles-1.hzSource"), body: nv.isoPick(t("browser-consoles-1.hzImage"), t("browser-consoles-1.none")) },
            { id: "flavor", label: t("browser-consoles-1.hzFlavor"), body: (
              <table className="cx-table hz-table">
                <thead><tr><th /><th>{t("browser-consoles-1.name")}</th><th>{t("browser-consoles-1.hzVcpus")}</th><th>{t("browser-consoles-1.hzRam")}</th><th>{t("browser-consoles-1.hzRootDisk")}</th></tr></thead>
                <tbody>
                  {FLAVORS.map(([name, r]) => (
                    <tr key={name} onClick={() => nv.setSize(r)}>
                      <td><input type="radio" name="hz-flavor" checked={same(nv.size, r)} onChange={() => nv.setSize(r)} /></td><td>{name}</td><td className="num">{r.vcpu}</td><td className="num">{r.ramGb} GB</td><td className="num">{r.diskGb} GB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) },
            { id: "net", label: t("browser-consoles-1.hzNetworks"), body: <Facts facts={[{ label: t("browser-consoles-1.hvNetwork"), value: "private" }, { label: t("browser-consoles-1.hzSubnet"), value: "private-subnet" }]} /> },
          ]} />
        </div>
      )}
      {dialog}
    </div>
  );
}
