import { Cloud, Folder, LogOut } from "lucide-react";
import { disk } from "../../../hw";
import { Actions, Bar, erasFrom, eraAt, Facts, LoginForm, RowLines, usePanelTab, useRows, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import "./ownclod.css";

// docs/design/software.md, section 10: white with a blue top bar and a file list until 2016, then a dark blue bar and cards.
const ERAS = erasFrom(2010, 2016);

export function OwnClod(p: PanelProps) {
  const era = eraAt(ERAS, p.game), [tab, setTab] = usePanelTab(p.f);
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f);
  const logo = <span className="oc-logo"><Cloud size={22} aria-hidden />ownClod</span>;
  if (!p.signedIn) return (
    <div className="cx oc oc-login" data-era={era}>
      <LoginForm className="oc-card" onLogin={p.login} button="Log in">{logo}<div className="cx-host">{p.host}</div></LoginForm>
    </div>
  );
  const nav: [Tab, string][] = [["objects", "Files"], ["software", "Admin"]];
  return (
    <div className="cx oc" data-era={era}>
      <header className="oc-top">
        {logo}
        <nav>{nav.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav>
        <span className="cx-host">{p.host}</span>
        <button className="oc-out" onClick={p.logout}><LogOut size={14} aria-hidden />Log out</button>
      </header>
      <main className="oc-main">
        {tab === "objects" && (era === "early"
          ? <table className="cx-table oc-files">
            <thead><tr><th>Name</th><th>Size</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={4} className="cx-empty">Nothing here yet.</td></tr>}
              {rows.map((r) => (
                <RowLines key={r.id} r={r} span={4}>
                  <td><Folder size={16} aria-hidden className="oc-folder" /><b>{r.name}</b></td><td className="num">{disk(Math.round(r.disk[0]))}</td>
                  <td><span className={`cx-state ${r.tone}`}>{r.state}</span></td><td><Actions actions={r.actions} className="cx-acts" /></td>
                </RowLines>
              ))}
            </tbody>
          </table>
          : <div className="oc-grid">
            {rows.length === 0 && <p className="cx-empty">Nothing here yet.</p>}
            {rows.map((r) => (
              <section key={r.id} className="oc-tile">
                <Folder size={40} aria-hidden className="oc-folder" />
                <b>{r.name}</b>
                <span className={`cx-state ${r.tone}`}>{r.state}</span>
                <Bar use={r.disk} /><span className="cx-use num">{disk(Math.round(r.disk[0]))} of {disk(r.disk[1])}</span>
                <Actions actions={r.actions} className="cx-acts" />{r.panel}
              </section>
            ))}
          </div>)}
        {tab === "software" && <section className="oc-admin"><h2>Updates</h2><Facts facts={sw.facts} /><Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>{sw.panel}</section>}
      </main>
    </div>
  );
}
