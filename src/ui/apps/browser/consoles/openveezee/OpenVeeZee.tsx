import { useState } from "react";
import { yearOf } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import { vmStats } from "../../../../../sim/60-infra/stats";
import { nodeUsage } from "../../../../../sim/60-infra/usage";
import { mountableImages } from "../../../../../sim/90-actions/media";
import { ram } from "../../../hw";
import { Chart } from "../Chart";
import { isoName, MediaMenu, SizeFields, TaskLog, useNewVm, useVms, type Vm } from "../HypervisorBase";
import { Actions, Backups, Bar, erasFrom, eraAt, Facts, LoginForm, useSoftware, type PanelAction, type PanelProps } from "../PanelBase";
import "./openveezee.css";

// docs/design/software.md, section 9: the green-banded PHP admin from 2005, the same pages under a dark top bar from 2016.
const ERAS = erasFrom(2005, 2016);
const ctid = (v: Vm) => 100 + Number(v.id.replace(/\D/g, "") || 0);
type Page = "dashboard" | "servers" | "vservers" | "create" | "users" | "requests" | "ips" | { node: string } | { ct: string };
const LABELS: Record<string, string> = { start: "Start", stop: "Stop", reset: "Restart", console: "Console", resize: "Change settings", delete: "Delete" };
const ORDER = ["start", "stop", "reset", "reinstall", "console", "resize", "restore", "recover", "migrate", "delete"];
const gb = (x: number) => `${+x.toFixed(2)} GB`;
const template = (v: Vm, year: number) => (v.media ? isoName(v.media, year).replace(/\.iso$/, "") : v.own ? v.os : v.sub);

function Badge({ v }: { v: Vm }) {
  return <span className={`ovz-badge ${v.tone}`}>{v.st === "running" ? "running" : v.st === "stopped" ? "stopped" : v.state}</span>;
}

function VsTable({ vms, open, year }: { vms: Vm[]; open: (id: string) => void; year: number }) {
  return (
    <table className="cx-table ovz-table">
      <thead><tr><th>ID</th><th>Hostname</th><th>IP address</th><th>OS template</th><th>Server</th><th>Status</th><th>RAM</th><th>Disk</th></tr></thead>
      <tbody>
        {vms.length === 0 && <tr><td colSpan={8} className="cx-empty">No virtual servers</td></tr>}
        {vms.map((v) => (
          <tr key={v.id}>
            <td className="num"><button className="ovz-a" onClick={() => open(v.id)}>{ctid(v)}</button></td>
            <td>{v.name}</td><td className="num">{v.ip}</td><td>{template(v, year)}</td><td>{v.node}</td><td><Badge v={v} /></td>
            <td className="num">{v.w.ramGb} GB</td><td className="num">{v.w.diskGb} GB</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// A physical server: its CPU, memory and disk, the OS templates it holds and the virtual servers on it.
export function HostPage({ game, id, vms, open, create }: { game: GameState; id: string; vms: Vm[]; open: (id: string) => void; create?: () => void }) {
  const d = game.devices.find((x) => x.id === id), u = nodeUsage(game, id), year = yearOf(game.hour), mine = vms.filter((v) => v.w.deviceId === id);
  const rows: [string, [number, number], string][] = [
    ["CPU", [u.used.vcpu, u.physical.vcpu], `${+u.used.vcpu.toFixed(2)} of ${u.physical.vcpu} cores`],
    ["Memory", [u.used.ramGb, u.physical.ramGb], `${ram(+u.used.ramGb.toFixed(1))} of ${ram(u.physical.ramGb)}`],
    ["Disk", [u.used.diskGb, u.physical.diskGb], `${Math.round(u.used.diskGb)} GB of ${u.physical.diskGb} GB`],
  ];
  return (
    <>
      <h2>Physical server {d?.hostname ?? d?.name}</h2>
      <fieldset className="ovz-box"><legend>Statistics</legend>
        <div className="cx-hv-bars">{rows.map(([l, use, t]) => <span key={l} style={{ display: "contents" }}><span>{l}</span><Bar use={use} /><span className="num">{t}</span></span>)}</div>
      </fieldset>
      <fieldset className="ovz-box"><legend>OS templates</legend>
        <table className="cx-table ovz-table">
          <thead><tr><th>Name</th><th>Virtual servers</th></tr></thead>
          <tbody>
            {mountableImages(game).length === 0 && <tr><td colSpan={2} className="cx-empty">No OS templates</td></tr>}
            {mountableImages(game).map((o) => <tr key={o.id}><td>{isoName(o.id, year).replace(/\.iso$/, "")}</td><td className="num">{mine.filter((v) => v.media === o.id).length}</td></tr>)}
          </tbody>
        </table>
      </fieldset>
      <fieldset className="ovz-box"><legend>Virtual servers</legend>
        <VsTable vms={mine} open={open} year={year} />
        {create && <div className="cx-tools"><button className="ovz-btn" onClick={create}>Create virtual server</button></div>}
      </fieldset>
    </>
  );
}

// A container: its properties, its resources with the beancounters, and the bevelled action buttons.
export function CtPage({ game, v, host }: { game: GameState; v: Vm; host: string }) {
  const [reinstall, setReinstall] = useState(false), st = vmStats(game, v.id)!, now = st.now, w = v.w, year = yearOf(game.hour);
  const domain = /^[\d.]+$/.test(host) ? "localdomain" : host.split(".").slice(1).join(".") || host, ns = v.ip ? v.ip.replace(/\.\d+$/, ".1") : "";
  const props: [string, string][] = [
    ["ID", String(ctid(v))], ["Hostname", w.hostname ?? v.name], ["IP address", v.ip], ["OS template", template(v, year)], ["Server", v.node],
    ["Status", v.state], ["Start on boot", "yes"], ["Nameserver", ns], ["Search domain", domain], ["User", "admin"],
  ];
  const half = Math.ceil(props.length / 2), pairs = props.slice(0, half).map((a, i) => [a, props[half + i]] as const);
  const usedDisk = now.disk * w.diskGb, usedRam = now.ram * w.ramGb, cpuPct = Math.round(now.cpu * w.vcpu * 100);
  const ubc: [string, string, string, string][] = [
    ["Diskspace", gb(usedDisk), gb(w.diskGb * 1.1), gb(w.diskGb)],
    ["Diskinodes", String(Math.round(usedDisk * 20000)), String(Math.round(w.diskGb * 220000)), String(w.diskGb * 200000)],
    ["RAM", `${Math.round(usedRam * 1024)} MB`, `${w.ramGb * 1024} MB`, `${w.ramGb * 1024} MB`],
    ["CPU units", String(w.vcpu * 1000), String(w.vcpu * 1000), String(w.vcpu * 1000)],
    ["CPU limit", `${cpuPct}%`, `${w.vcpu * 100}%`, "-"],
  ];
  const bars: [string, [number, number], string][] = [
    ["CPU", [now.cpu, 1], `${cpuPct}% of ${w.vcpu * 100}%`], ["Memory", [now.ram, 1], `${Math.round(usedRam * 1024)} MB of ${w.ramGb * 1024} MB`],
    ["Disk", [now.disk, 1], `${gb(usedDisk)} of ${gb(w.diskGb)}`],
  ];
  const actions: PanelAction[] = [...v.actions.map((a) => ({ ...a, label: LABELS[a.id] ?? a.label })), ...(v.own ? [{ id: "reinstall", label: "Reinstall", run: () => setReinstall(!reinstall) }] : [])]
    .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  return (
    <>
      <h2>Virtual server {ctid(v)} <Badge v={v} /></h2>
      <table className="cx-table ovz-table ovz-props"><tbody>
        {pairs.map(([[a, x], b]) => <tr key={a}><th>{a}</th><td className="num">{x}</td>{b ? <><th>{b[0]}</th><td className="num">{b[1]}</td></> : <><th /><td /></>}</tr>)}
      </tbody></table>
      <fieldset className="ovz-box"><legend>Resources</legend>
        <div className="cx-hv-bars">{bars.map(([l, use, t]) => <span key={l} style={{ display: "contents" }}><span>{l}</span><Bar use={use} /><span className="num">{t}</span></span>)}</div>
        <table className="cx-table ovz-table">
          <thead><tr><th>Resource</th><th>Current</th><th>Limit</th><th>Barrier</th></tr></thead>
          <tbody>{ubc.map(([n, ...cols]) => <tr key={n}><td>{n}</td>{cols.map((x, i) => <td key={i} className="num">{x}</td>)}</tr>)}</tbody>
        </table>
        <Chart className="ovz-chart" kind="bars" title="CPU usage, last 24 hours" values={st.ring.map((x) => x.cpu)} end={game.hour} />
      </fieldset>
      <Actions actions={actions} className="cx-tools ovz-acts" />
      {reinstall && <MediaMenu game={game} v={v} label="OS template" none="None" />}
      {v.panel}
    </>
  );
}

export function OpenVeeZee(p: PanelProps) {
  const era = eraAt(ERAS, p.game), { game, c, f } = p, [page, setPage] = useState<Page>("dashboard"), year = yearOf(game.hour);
  const { vms, dialog } = useVms(game, c, f), sw = useSoftware(game, c, f), nv = useNewVm(game, c);
  if (!p.signedIn) return (
    <div className="cx ovz ovz-login" data-era={era}>
      <LoginForm className="ovz-card" onLogin={p.login} button="Log in">
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
  const menu: [Page, string, string][] = [["dashboard", "⌂", "Dashboard"], ["servers", "▦", "Physical servers"], ["vservers", "▣", "Virtual servers"], ["users", "☺", "Users"], ["requests", "✉", "Requests"], ["ips", "⌖", "IP addresses"]];
  return (
    <div className="cx cx-hv ovz" data-era={era}>
      <header className="ovz-top">
        <span className="ovz-logo">OpenVeeZee Web Panel</span><span className="cx-host">{p.host}</span>
        <span className="ovz-user">admin</span><button className="ovz-out" onClick={p.logout}>Logout</button>
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
              <h2>Dashboard</h2>
              <Facts className="cx-table cx-facts ovz-table" facts={[
                { label: "Physical servers", value: String(nodes.length), num: true }, { label: "Virtual servers", value: String(vms.length), num: true },
                { label: "Running", value: String(vms.filter((v) => v.st === "running").length), num: true }, ...sw.facts,
              ]} />
              <Actions actions={sw.actions} className="cx-tools ovz-acts">{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>
              {sw.panel}
              {f.backups && <Backups game={game} c={c} />}
            </>
          )}
          {page === "servers" && (
            <>
              <h2>Physical servers</h2>
              <table className="cx-table ovz-table">
                <thead><tr><th>Host</th><th>Virtual servers</th><th>CPU</th><th>Memory</th></tr></thead>
                <tbody>
                  {nodes.map((d) => {
                    const u = nodeUsage(game, d.id);
                    return (
                      <tr key={d.id}>
                        <td><button className="ovz-a" onClick={() => setPage({ node: d.id })}>{d.hostname ?? d.name}</button></td>
                        <td className="num">{vms.filter((v) => v.w.deviceId === d.id).length}</td>
                        <td className="num">{+u.used.vcpu.toFixed(2)} of {u.physical.vcpu}</td><td className="num">{ram(+u.used.ramGb.toFixed(1))} of {ram(u.physical.ramGb)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
          {node && <HostPage game={game} id={node} vms={vms} open={open} create={toCreate} />}
          {page === "vservers" && (
            <>
              <h2>Virtual servers</h2>
              <VsTable vms={vms} open={open} year={year} />
              {toCreate && <div className="cx-tools"><button className="ovz-btn" onClick={toCreate}>Create virtual server</button></div>}
            </>
          )}
          {ct && <CtPage game={game} v={ct} host={p.host} />}
          {page === "create" && (
            <form className="ovz-form" onSubmit={(e) => { e.preventDefault(); create(); }}>
              <h2>Create virtual server</h2>
              <Facts className="cx-table cx-facts ovz-table" facts={[{ label: "ID", value: "auto", num: true }, { label: "Server", value: c.name }]} />
              {nv.isoPick("OS template", "None")}
              <SizeFields size={nv.size} set={nv.setSize} labels={["CPU limit", "RAM, GB", "Disk quota, GB"]} />
              <div className="cx-tools"><button className="ovz-btn" type="submit">Create</button></div>
            </form>
          )}
          {page === "users" && (
            <>
              <h2>Users</h2>
              <table className="cx-table ovz-table">
                <thead><tr><th>Login</th><th>Role</th><th>Virtual servers</th></tr></thead>
                <tbody><tr><td>admin</td><td>Administrator</td><td className="num">{vms.length}</td></tr></tbody>
              </table>
            </>
          )}
          {page === "requests" && (
            <>
              <h2>Requests</h2>
              <table className="cx-table ovz-table">
                <thead><tr><th>Subject</th><th>User</th><th>Status</th></tr></thead>
                <tbody><tr><td colSpan={3} className="cx-empty">No requests</td></tr></tbody>
              </table>
            </>
          )}
          {page === "ips" && (
            <>
              <h2>IP addresses</h2>
              <table className="cx-table ovz-table">
                <thead><tr><th>IP address</th><th>Virtual server</th><th>Server</th></tr></thead>
                <tbody>
                  {vms.filter((v) => v.ip).length === 0 && <tr><td colSpan={3} className="cx-empty">No IP addresses</td></tr>}
                  {vms.filter((v) => v.ip).map((v) => <tr key={v.id}><td className="num">{v.ip}</td><td><button className="ovz-a" onClick={() => open(v.id)}>{ctid(v)} ({v.name})</button></td><td>{v.node}</td></tr>)}
                </tbody>
              </table>
            </>
          )}
        </main>
      </div>
      <TaskLog game={game} c={c} vms={vms} title="Events" className="cx-tasks ovz-tasks" />
      {dialog}
    </div>
  );
}
