import { useState } from "react";
import { MediaMenu, NodeList, SizeFields, TaskLog, useNewVm, useVms, vmFacts, type Vm } from "../HypervisorBase";
import { Actions, Backups, erasFrom, eraAt, Facts, LoginForm, useSoftware, type PanelProps } from "../PanelBase";
import "./openveezee.css";

// docs/design/software.md, section 9: the grey and blue PHP admin from 2005, the same pages under a dark top bar from 2016.
const ERAS = erasFrom(2005, 2016);
const ctid = (v: Vm) => 100 + Number(v.id.replace(/\D/g, "") || 0);
type Page = "list" | "create" | "node" | "updates" | { ct: string };

export function OpenVeeZee(p: PanelProps) {
  const era = eraAt(ERAS, p.game), { game, c, f } = p, [page, setPage] = useState<Page>("list");
  const { vms, dialog } = useVms(game, c, f), sw = useSoftware(game, c, f), nv = useNewVm(game, c);
  if (!p.signedIn) return (
    <div className="cx ovz ovz-login" data-era={era}>
      <LoginForm className="ovz-card" onLogin={p.login} button="Log in">
        <div className="ovz-logo">OpenVeeZee Web Panel</div>
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  const ct = typeof page === "object" ? vms.find((v) => v.id === page.ct) : undefined, facts = ct && vmFacts(game, ct);
  const create = () => { const id = nv.create(); if (id) setPage({ ct: id }); };
  const menu: [Page, string][] = [["list", "Containers"], ...(f.create ? [["create", "Create container"] as [Page, string]] : []), ["node", "Hardware node"], ["updates", "Updates"]];
  return (
    <div className="cx cx-hv ovz" data-era={era}>
      <header className="ovz-top"><span className="ovz-logo">OpenVeeZee Web Panel</span><span className="cx-host">{p.host}</span><button className="ovz-btn" onClick={p.logout}>Log out</button></header>
      <div className="cx-hv-body">
        <nav className="ovz-menu">
          {menu.map(([id, label]) => <button key={label} aria-pressed={page === id || (id === "list" && !!ct)} onClick={() => setPage(id)}>{label}</button>)}
        </nav>
        <main className="cx-hv-main ovz-main">
          {page === "list" && (
            <>
              <h2>Containers</h2>
              <table className="cx-table ovz-table">
                <thead><tr><th>CTID</th><th>Hostname</th><th>IP address</th><th>Status</th><th>RAM</th><th>Disk</th></tr></thead>
                <tbody>
                  {vms.length === 0 && <tr><td colSpan={6} className="cx-empty">No containers</td></tr>}
                  {vms.map((v) => (
                    <tr key={v.id}>
                      <td className="num"><button className="ovz-a" onClick={() => setPage({ ct: v.id })}>{ctid(v)}</button></td>
                      <td>{v.name}</td><td className="num">{v.ip}</td><td><span className={`cx-state ${v.tone}`}>{v.state}</span></td>
                      <td className="num">{v.w.ramGb} GB</td><td className="num">{v.w.diskGb} GB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {ct && facts && (
            <>
              <h2>Container {ctid(ct)}</h2>
              <Facts className="cx-table cx-facts ovz-table" facts={[
                { label: "CTID", value: String(ctid(ct)), num: true }, { label: "Hostname", value: ct.name }, facts.ip,
                { label: "OS template", value: ct.own ? ct.os : ct.sub }, facts.status, { ...facts.node, label: "Hardware node" },
                { label: "CPU limit", value: `${ct.w.vcpu}`, num: true }, { label: "RAM limit", value: facts.memory.value, num: true }, { label: "Disk quota", value: facts.disk.value, num: true },
                facts.media, facts.backup,
              ]} />
              <MediaMenu game={game} v={ct} label="Mount ISO" none="None" />
              <Actions actions={ct.actions} className="cx-tools ovz-acts" />
              {ct.panel}
            </>
          )}
          {page === "create" && (
            <form className="ovz-form" onSubmit={(e) => { e.preventDefault(); create(); }}>
              <h2>Create container</h2>
              <Facts className="cx-table cx-facts ovz-table" facts={[{ label: "CTID", value: "auto", num: true }, { label: "Hardware node", value: c.name }]} />
              {nv.isoPick("OS template", "None")}
              <SizeFields size={nv.size} set={nv.setSize} labels={["CPU limit", "RAM, GB", "Disk quota, GB"]} />
              <div className="cx-tools"><button className="ovz-btn" type="submit">Create</button></div>
            </form>
          )}
          {page === "node" && (<><h2>Hardware node</h2><NodeList game={game} c={c} f={f} className="cx-table ovz-table" /></>)}
          {page === "updates" && (
            <>
              <h2>Updates</h2>
              <Facts className="cx-table cx-facts ovz-table" facts={sw.facts} />
              <Actions actions={sw.actions} className="cx-tools ovz-acts">{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>
              {sw.panel}
              {f.backups && <Backups game={game} c={c} />}
            </>
          )}
        </main>
      </div>
      <TaskLog game={game} c={c} vms={vms} title="Events" className="cx-tasks ovz-tasks" />
      {dialog}
    </div>
  );
}
