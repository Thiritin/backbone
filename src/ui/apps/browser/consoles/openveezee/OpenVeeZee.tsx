import { useState } from "react";
import type { GameState } from "../../../../../sim/50-state";
import { vmStats } from "../../../../../sim/60-infra/stats";
import { nodeUsage } from "../../../../../sim/60-infra/usage";
import { mountableImages } from "../../../../../sim/90-actions/media";
import { ram } from "../../../hw";
import { Chart } from "../Chart";
import { AlarmList, isoName, MediaMenu, ResourceBars, SizeFields, summaryOf, TaskLog, useNewVm, useVms, type Vm } from "../HypervisorBase";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { Actions, Backups, Bar, erasFrom, eraAt, Facts, LoginForm, useSoftware, type PanelAction, type PanelProps } from "../PanelBase";
import "./openveezee.css";
import { t } from "../../../../../i18n/en";

// docs/design/software.md, section 9: the green-banded PHP admin from 2005, the same pages under a dark top bar from 2016.
const ERAS = erasFrom(2005, 2016);
const ctid = (v: Vm) => 100 + Number(v.id.replace(/\D/g, "") || 0);
type Page = "dashboard" | "servers" | "vservers" | "create" | "users" | "requests" | "ips" | { node: string } | { ct: string };
const labels = (): Record<string, string> => ({ start: t("browser-consoles-2.start"), stop: t("browser-consoles-2.stop"), reset: t("browser-consoles-2.restart"), console: t("browser-consoles-2.console"), resize: t("browser-consoles-2.changeSettings"), delete: t("browser-consoles-2.delete") });
const ORDER = ["start", "stop", "reset", "reinstall", "console", "resize", "restore", "recover", "migrate", "delete"];
const gb = (x: number) => `${+x.toFixed(2)} GB`;
const template = (v: Vm) => (v.media ? isoName(v.media).replace(/\.iso$/, "") : v.own ? v.os : v.sub);

function Badge({ v }: { v: Vm }) {
  return <span className={`ovz-badge ${v.tone}`}>{v.st === t("browser-consoles-2.running") ? t("browser-consoles-2.running") : v.st === t("browser-consoles-2.stopped") ? t("browser-consoles-2.stopped") : v.state}</span>;
}

function VsTable({ vms, open }: { vms: Vm[]; open: (id: string) => void }) {
  return (
    <table className="cx-table ovz-table">
      <thead><tr><th>ID</th><th>{t("browser-consoles-2.hostname")}</th><th>{t("browser-consoles-2.ipAddress")}</th><th>{t("browser-consoles-2.osTemplate")}</th><th>{t("browser-consoles-2.server")}</th><th>{t("browser-consoles-2.status")}</th><th>RAM</th><th>{t("browser-consoles-2.disk")}</th></tr></thead>
      <tbody>
        {vms.length === 0 && <tr><td colSpan={8} className="cx-empty">{t("browser-consoles-2.noVirtualServers")}</td></tr>}
        {vms.map((v) => (
          <tr key={v.id}>
            <td className="num"><button className="ovz-a" onClick={() => open(v.id)}>{ctid(v)}</button></td>
            <td>{v.name}</td><td className="num">{v.ip}</td><td>{template(v)}</td><td>{v.node}</td><td><Badge v={v} /></td>
            <td className="num">{v.w.ramGb} GB</td><td className="num">{v.w.diskGb} GB</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// A physical server: its CPU, memory and disk, the OS templates it holds and the virtual servers on it.
export function HostPage({ game, c, id, vms, open, create }: { game: GameState; c: Cluster; id: string; vms: Vm[]; open: (id: string) => void; create?: () => void }) {
  const d = game.devices.find((x) => x.id === id), mine = vms.filter((v) => v.w.deviceId === id), health = summaryOf(game, c, id);
  return (
    <>
      <h2>{t("browser-consoles-2.physicalServerName", { name: d?.hostname ?? d?.name ?? "" })}</h2>
      <fieldset className="ovz-box"><legend>{t("browser-consoles-2.statistics")}</legend>
        <ResourceBars use={health.use} labels={["CPU", t("browser-consoles-2.memory"), t("browser-consoles-2.disk")]} />
      </fieldset>
      {health.alarms.length > 0 && <fieldset className="ovz-box"><legend>{t("browser-consoles-2.alerts")}</legend><AlarmList game={game} c={c} alarms={health.alarms} className="cx-table ovz-table" /></fieldset>}
      <fieldset className="ovz-box"><legend>{t("browser-consoles-2.osTemplates")}</legend>
        <table className="cx-table ovz-table">
          <thead><tr><th>{t("browser-consoles-2.name")}</th><th>{t("browser-consoles-2.virtualServers")}</th></tr></thead>
          <tbody>
            {mountableImages(game).length === 0 && <tr><td colSpan={2} className="cx-empty">No OS templates</td></tr>}
            {mountableImages(game).map((o) => <tr key={o}><td>{isoName(o).replace(/\.iso$/, "")}</td><td className="num">{mine.filter((v) => v.media === o).length}</td></tr>)}
          </tbody>
        </table>
      </fieldset>
      <fieldset className="ovz-box"><legend>{t("browser-consoles-2.virtualServers")}</legend>
        <VsTable vms={mine} open={open} />
        {create && <div className="cx-tools"><button className="ovz-btn" onClick={create}>{t("browser-consoles-2.createVirtualServer")}</button></div>}
      </fieldset>
    </>
  );
}

// A container: its properties, its resources with the beancounters, and the bevelled action buttons.
export function CtPage({ game, v, host }: { game: GameState; v: Vm; host: string }) {
  const [reinstall, setReinstall] = useState(false), st = vmStats(game, v.id)!, now = st.now, w = v.w;
  const domain = /^[\d.]+$/.test(host) ? "localdomain" : host.split(".").slice(1).join(".") || host, ns = v.ip ? v.ip.replace(/\.\d+$/, ".1") : "";
  const props: [string, string][] = [
    ["ID", String(ctid(v))], [t("browser-consoles-2.hostname"), w.hostname ?? v.name], [t("browser-consoles-2.ipAddress"), v.ip], [t("browser-consoles-2.osTemplate"), template(v)], [t("browser-consoles-2.server"), v.node],
    [t("browser-consoles-2.status"), v.state], [t("browser-consoles-2.startOnBoot"), t("browser-consoles-2.yes")], [t("browser-consoles-2.nameserver"), ns], [t("browser-consoles-2.searchDomain"), domain], ["User", "admin"],
  ];
  const half = Math.ceil(props.length / 2), pairs = props.slice(0, half).map((a, i) => [a, props[half + i]] as const);
  const usedDisk = now.disk * w.diskGb, usedRam = now.ram * w.ramGb, cpuPct = Math.round(now.cpu * w.vcpu * 100);
  const ubc: [string, string, string, string][] = [
    ["Diskspace", gb(usedDisk), gb(w.diskGb * 1.1), gb(w.diskGb)],
    ["Diskinodes", String(Math.round(usedDisk * 20000)), String(Math.round(w.diskGb * 220000)), String(w.diskGb * 200000)],
    ["RAM", `${Math.round(usedRam * 1024)} MB`, `${w.ramGb * 1024} MB`, `${w.ramGb * 1024} MB`],
    ["CPU units", String(w.vcpu * 1000), String(w.vcpu * 1000), String(w.vcpu * 1000)],
    [t("browser-consoles-2.cpuLimit"), `${cpuPct}%`, `${w.vcpu * 100}%`, "-"],
  ];
  const bars: [string, [number, number], string][] = [
    ["CPU", [now.cpu, 1], t("browser-consoles-2.of", { used: `${cpuPct}%`, total: `${w.vcpu * 100}%` })], [t("browser-consoles-2.memory"), [now.ram, 1], t("browser-consoles-2.of", { used: `${Math.round(usedRam * 1024)} MB`, total: `${w.ramGb * 1024} MB` })],
    [t("browser-consoles-2.disk"), [now.disk, 1], t("browser-consoles-2.of", { used: gb(usedDisk), total: gb(w.diskGb) })],
  ];
  const actions: PanelAction[] = [...v.actions.map((a) => ({ ...a, label: labels()[a.id] ?? a.label })), ...(v.own ? [{ id: "reinstall", label: t("browser-consoles-2.reinstall"), run: () => setReinstall(!reinstall) }] : [])]
    .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  return (
    <>
      <h2>{t("browser-consoles-2.virtualServerId", { id: ctid(v) })} <Badge v={v} /></h2>
      <table className="cx-table ovz-table ovz-props"><tbody>
        {pairs.map(([[a, x], b]) => <tr key={a}><th>{a}</th><td className="num">{x}</td>{b ? <><th>{b[0]}</th><td className="num">{b[1]}</td></> : <><th /><td /></>}</tr>)}
      </tbody></table>
      <fieldset className="ovz-box"><legend>{t("browser-consoles-2.resources")}</legend>
        <div className="cx-hv-bars">{bars.map(([l, use, txt]) => <span key={l} style={{ display: "contents" }}><span>{l}</span><Bar use={use} /><span className="num">{txt}</span></span>)}</div>
        <table className="cx-table ovz-table">
          <thead><tr><th>{t("browser-consoles-2.resource")}</th><th>{t("browser-consoles-2.current")}</th><th>{t("browser-consoles-2.limit")}</th><th>{t("browser-consoles-2.barrier")}</th></tr></thead>
          <tbody>{ubc.map(([n, ...cols]) => <tr key={n}><td>{n}</td>{cols.map((x, i) => <td key={i} className="num">{x}</td>)}</tr>)}</tbody>
        </table>
        <Chart className="ovz-chart" kind="bars" title={t("browser-consoles-2.cpuUsage24h")} values={st.ring.map((x) => x.cpu)} end={game.hour} />
      </fieldset>
      <Actions actions={actions} className="cx-tools ovz-acts" />
      {reinstall && <MediaMenu game={game} v={v} label={t("browser-consoles-2.osTemplate")} none={t("browser-consoles-2.none")} />}
      {v.panel}
    </>
  );
}

export function OpenVeeZee(p: PanelProps) {
  const era = eraAt(ERAS, p.game), { game, c, f } = p, [page, setPage] = useState<Page>("dashboard");
  const { vms, dialog } = useVms(game, c, f), sw = useSoftware(game, c, f), nv = useNewVm(game, c), health = summaryOf(game, c, null);
  if (!p.signedIn) return (
    <div className="cx ovz ovz-login" data-era={era}>
      <LoginForm className="ovz-card" onLogin={p.login} button={t("browser-consoles-2.logIn")}>
        <div className="ovz-logo">OpenVeeZee Web Panel</div>
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  const ct = typeof page === "object" && "ct" in page ? vms.find((v) => v.id === page.ct) : undefined;
  const node = typeof page === "object" && "node" in page ? page.node : null;
  const open = (id: string) => setPage({ ct: id }), toCreate = f.create ? () => setPage("create") : undefined;
  const create = () => { const id = nv.create(); if (id) setPage({ ct: id }); };
  const nodes = c.nodes.map((n) => game.devices.find((d) => d.id === n.deviceId)!).filter(Boolean);
  const is = (x: Page) => page === x || (x === "vservers" && (!!ct || page === "create")) || (x === "servers" && !!node);
  const menu: [Page, string, string][] = [["dashboard", "⌂", t("browser-consoles-2.dashboard")], ["servers", "▦", t("browser-consoles-2.physicalServers")], ["vservers", "▣", t("browser-consoles-2.virtualServers")], ["users", "☺", t("browser-consoles-2.users")], ["requests", "✉", t("browser-consoles-2.requests")], ["ips", "⌖", t("browser-consoles-2.ipAddresses")]];
  return (
    <div className="cx cx-hv ovz" data-era={era}>
      <header className="ovz-top">
        <span className="ovz-logo">OpenVeeZee Web Panel</span><span className="cx-host">{p.host}</span>
        <span className="ovz-user">admin</span><button className="ovz-out" onClick={p.logout}>{t("browser-consoles-2.logout")}</button>
      </header>
      <div className="cx-hv-body">
        <nav className="ovz-menu">
          {menu.map(([id, icon, label]) => (
            <div key={label}>
              <button aria-pressed={is(id)} onClick={() => setPage(id)}><i aria-hidden>{icon}</i>{label}</button>
              {id === "servers" && nodes.map((d) => <button key={d.id} className="ovz-sub" aria-pressed={node === d.id} onClick={() => setPage({ node: d.id })}>{d.hostname ?? d.name}</button>)}
            </div>
          ))}
        </nav>
        <main className="cx-hv-main ovz-main">
          {page === "dashboard" && (
            <>
              <h2>{t("browser-consoles-2.dashboard")}</h2>
              <Facts className="cx-table cx-facts ovz-table" facts={[
                { label: t("browser-consoles-2.physicalServers"), value: String(nodes.length), num: true }, { label: t("browser-consoles-2.virtualServers"), value: String(vms.length), num: true },
                { label: t("browser-consoles-2.running2"), value: String(vms.filter((v) => v.st === t("browser-consoles-2.running")).length), num: true }, ...sw.facts,
              ]} />
              <Actions actions={sw.actions} className="cx-tools ovz-acts">{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>
              {sw.panel}
              <fieldset className="ovz-box"><legend>{t("browser-consoles-2.resources")}</legend>
                <ResourceBars use={health.use} labels={["CPU", t("browser-consoles-2.memory"), t("browser-consoles-2.disk")]} />
              </fieldset>
              {health.alarms.length > 0 && <fieldset className="ovz-box"><legend>{t("browser-consoles-2.alerts")}</legend><AlarmList game={game} c={c} alarms={health.alarms} className="cx-table ovz-table" /></fieldset>}
              {f.backups && <Backups game={game} c={c} />}
            </>
          )}
          {page === "servers" && (
            <>
              <h2>{t("browser-consoles-2.physicalServers")}</h2>
              <table className="cx-table ovz-table">
                <thead><tr><th>{t("browser-consoles-2.host")}</th><th>{t("browser-consoles-2.virtualServers")}</th><th>CPU</th><th>{t("browser-consoles-2.memory")}</th></tr></thead>
                <tbody>
                  {nodes.map((d) => {
                    const u = nodeUsage(game, d.id);
                    return (
                      <tr key={d.id}>
                        <td><button className="ovz-a" onClick={() => setPage({ node: d.id })}>{d.hostname ?? d.name}</button></td>
                        <td className="num">{vms.filter((v) => v.w.deviceId === d.id).length}</td>
                        <td className="num">{t("browser-consoles-2.of", { used: +u.used.vcpu.toFixed(2), total: u.physical.vcpu })}</td><td className="num">{t("browser-consoles-2.of", { used: ram(+u.used.ramGb.toFixed(1)), total: ram(u.physical.ramGb) })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
          {node && <HostPage game={game} c={c} id={node} vms={vms} open={open} create={toCreate} />}
          {page === "vservers" && (
            <>
              <h2>{t("browser-consoles-2.virtualServers")}</h2>
              <VsTable vms={vms} open={open} />
              {toCreate && <div className="cx-tools"><button className="ovz-btn" onClick={toCreate}>{t("browser-consoles-2.createVirtualServer")}</button></div>}
            </>
          )}
          {ct && <CtPage game={game} v={ct} host={p.host} />}
          {page === "create" && (
            <form className="ovz-form" onSubmit={(e) => { e.preventDefault(); create(); }}>
              <h2>{t("browser-consoles-2.createVirtualServer")}</h2>
              <Facts className="cx-table cx-facts ovz-table" facts={[{ label: "ID", value: "auto", num: true }, { label: t("browser-consoles-2.server"), value: c.name }]} />
              {nv.isoPick(t("browser-consoles-2.osTemplate"), t("browser-consoles-2.none"))}
              <SizeFields size={nv.size} set={nv.setSize} labels={[t("browser-consoles-2.cpuLimit"), t("browser-consoles-2.ramGb"), t("browser-consoles-2.diskQuotaGb")]} />
              <div className="cx-tools"><button className="ovz-btn" type="submit">{t("browser-consoles-2.create")}</button></div>
            </form>
          )}
          {page === "users" && (
            <>
              <h2>{t("browser-consoles-2.users")}</h2>
              <table className="cx-table ovz-table">
                <thead><tr><th>{t("browser-consoles-2.login")}</th><th>{t("browser-consoles-2.role")}</th><th>{t("browser-consoles-2.virtualServers")}</th></tr></thead>
                <tbody><tr><td>admin</td><td>{t("browser-consoles-2.administrator")}</td><td className="num">{vms.length}</td></tr></tbody>
              </table>
            </>
          )}
          {page === "requests" && (
            <>
              <h2>{t("browser-consoles-2.requests")}</h2>
              <table className="cx-table ovz-table">
                <thead><tr><th>{t("browser-consoles-2.subject")}</th><th>{t("browser-consoles-2.user")}</th><th>{t("browser-consoles-2.status")}</th></tr></thead>
                <tbody><tr><td colSpan={3} className="cx-empty">{t("browser-consoles-2.noRequests")}</td></tr></tbody>
              </table>
            </>
          )}
          {page === "ips" && (
            <>
              <h2>{t("browser-consoles-2.ipAddresses")}</h2>
              <table className="cx-table ovz-table">
                <thead><tr><th>{t("browser-consoles-2.ipAddress")}</th><th>{t("browser-consoles-2.virtualServer")}</th><th>{t("browser-consoles-2.server")}</th></tr></thead>
                <tbody>
                  {vms.filter((v) => v.ip).length === 0 && <tr><td colSpan={3} className="cx-empty">{t("browser-consoles-2.noIpAddresses")}</td></tr>}
                  {vms.filter((v) => v.ip).map((v) => <tr key={v.id}><td className="num">{v.ip}</td><td><button className="ovz-a" onClick={() => open(v.id)}>{ctid(v)} ({v.name})</button></td><td>{v.node}</td></tr>)}
                </tbody>
              </table>
            </>
          )}
        </main>
      </div>
      <TaskLog game={game} c={c} vms={vms} title={t("browser-consoles-2.events")} className="cx-tasks ovz-tasks" />
      {dialog}
    </div>
  );
}
