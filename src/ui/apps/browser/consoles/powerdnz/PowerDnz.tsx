import { LogOut } from "lucide-react";
import { Actions, erasFrom, eraAt, Facts, LoginForm, RowLines, usePanelTab, useRows, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import { tenants } from "../services";
import "./powerdnz.css";

// docs/design/software.md, section 10: white with an orange bar and one zone table until 2016, then a dark header and cards.
const ERAS = erasFrom(2005, 2016);

export function PowerDnz(p: PanelProps) {
  const era = eraAt(ERAS, p.game), [tab, setTab] = usePanelTab(p.f);
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f), ts = tenants(p.game, p.c);
  if (!p.signedIn) return (
    <div className="cx pd pd-login" data-era={era}>
      <LoginForm className="pd-card" onLogin={p.login} button="Log in"><div className="pd-logo">PowerDNZ <b>Admin</b></div><div className="cx-host">{p.host}</div></LoginForm>
    </div>
  );
  const zones = ts.reduce((n, t) => n + t.zones.length, 0);
  const nav: [Tab, string][] = [["objects", "Zones"], ["software", "Server"]];
  return (
    <div className="cx pd" data-era={era}>
      <header className="pd-top">
        <span className="pd-logo">PowerDNZ <b>Admin</b></span>
        <nav>{nav.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav>
        <span className="cx-host">{p.host}</span>
        <button className="pd-out" onClick={p.logout}><LogOut size={14} aria-hidden />Log out</button>
      </header>
      <main className="pd-main">
        {tab === "objects" && <>
          {era === "late" && <div className="pd-stats">{([["Zones", zones], ["Accounts", ts.length], ["Version", p.c.version]] as const).map(([l, v]) => <div key={l} className="pd-stat"><b className="num">{v}</b><span>{l}</span></div>)}</div>}
          <section className="pd-box">
            <h2>Zones</h2>
            <table className="cx-table">
              <thead><tr><th>Name</th><th>Type</th><th>Account</th><th>Server</th><th>Status</th><th /></tr></thead>
              <tbody>
                {zones === 0 && <tr><td colSpan={6} className="cx-empty">Nothing here yet.</td></tr>}
                {rows.flatMap((r) => { const t = ts.find((x) => x.id === r.id); return (t?.zones ?? []).map((z, i) => (
                  <RowLines key={`${r.id}${z}`} r={i === 0 ? r : { ...r, panel: null }} span={6}>
                    <td><b>{z}</b></td><td>Native</td><td>{t?.customer}</td><td>{r.name}</td>
                    <td><span className={`cx-state ${r.tone}`}>{r.state}</span></td>
                    <td>{i === 0 && <Actions actions={r.actions} className="cx-acts" />}</td>
                  </RowLines>
                )); })}
              </tbody>
            </table>
          </section>
        </>}
        {tab === "software" && <section className="pd-box"><h2>Server</h2><Facts facts={sw.facts} /><Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>{sw.panel}</section>}
      </main>
    </div>
  );
}
