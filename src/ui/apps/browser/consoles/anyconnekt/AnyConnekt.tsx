import { Home, LogOut, Settings, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Actions, erasFrom, eraAt, Facts, LoginForm, RowLines, usePanelTab, useRows, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import { tenants } from "../services";
import "./anyconnekt.css";

// docs/design/software.md, section 10: the blue device-manager tabs until 2016, then flat white and teal.
const ERAS = erasFrom(2005, 2016);

export function AnyConnekt(p: PanelProps) {
  const era = eraAt(ERAS, p.game), [tab, setTab] = usePanelTab(p.f);
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f), ts = tenants(p.game, p.c);
  const logo = <span className="sy-logo"><i aria-hidden>{"|||.|||."}</i>SYSKO <b>AnyConnekt</b></span>;
  if (!p.signedIn) return (
    <div className="cx sy sy-login" data-era={era}>
      <LoginForm className="sy-card" onLogin={p.login} button="Login">{logo}<div className="cx-host">{p.host}</div></LoginForm>
    </div>
  );
  const sessions = ts.reduce((n, t) => n + (t.running ? t.users : 0), 0);
  const nav: [Tab, string, LucideIcon][] = [["objects", "Home", Home], ["software", "Configuration", Settings]];
  const box = (title: string, body: ReactNode) => <section className="sy-box"><h2>{title}</h2>{body}</section>;
  return (
    <div className="cx sy" data-era={era}>
      <header className="sy-top">
        {logo}
        <nav>{nav.map(([id, label, Icon]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}><Icon size={era === "early" ? 22 : 15} aria-hidden />{label}</button>)}</nav>
        <span className="cx-host">{p.host}</span>
        <button className="sy-out" onClick={p.logout}><LogOut size={14} aria-hidden />Logout</button>
      </header>
      <main className="sy-main">
        {tab === "objects" && <>
          {box("Device Information", <Facts facts={[{ label: "Software", value: `AnyConnekt ${p.c.version}`, num: true }, { label: "VPN sessions", value: String(sessions), num: true }, { label: "Gateways", value: String(rows.length), num: true }]} />)}
          {box("VPN Gateways", (
            <table className="cx-table">
              <thead><tr><th>Gateway</th><th>Account</th><th>Licensed users</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={5} className="cx-empty">Nothing here yet.</td></tr>}
                {rows.map((r) => {
                  const t = ts.find((x) => x.id === r.id);
                  return (
                    <RowLines key={r.id} r={r} span={5}>
                      <td><b>{r.name}</b></td><td>{t?.customer}</td><td className="num">{t?.users}</td>
                      <td><span className={`cx-state ${r.tone}`}>{r.state}</span></td><td><Actions actions={r.actions} className="cx-acts" /></td>
                    </RowLines>
                  );
                })}
              </tbody>
            </table>
          ))}
        </>}
        {tab === "software" && box("Software Updates", <><Facts facts={sw.facts} /><Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>{sw.panel}</>)}
      </main>
    </div>
  );
}
