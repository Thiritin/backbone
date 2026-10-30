import { LogOut } from "lucide-react";
import { Actions, erasFrom, eraAt, Facts, LoginForm, RowLines, usePanelTab, useRows, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import { tenants } from "../services";
import "./openveepeen.css";

// docs/design/software.md, section 10: the orange and grey admin with a left menu until 2017, then dark with orange cards.
const ERAS = erasFrom(2005, 2017);

export function OpenVeePeeN(p: PanelProps) {
  const era = eraAt(ERAS, p.game), [tab, setTab] = usePanelTab(p.f);
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f), ts = tenants(p.game, p.c);
  const logo = <div className="ov-logo">OpenVeePeeN <span>Access Server</span></div>;
  if (!p.signedIn) return (
    <div className="cx ov ov-login" data-era={era}>
      <LoginForm className="ov-card" onLogin={p.login} button="Sign In">{logo}<div className="cx-host">{p.host}</div></LoginForm>
    </div>
  );
  const users = ts.reduce((n, t) => n + (t.running ? t.users : 0), 0);
  const nav: [string, Tab, string][] = [["Status", "objects", "Status Overview"], ["Configuration", "software", "Software Updates"]];
  const userOf = (id: string) => ts.find((t) => t.id === id);
  return (
    <div className="cx ov" data-era={era}>
      <header className="ov-top">{logo}<span className="cx-host">{p.host}</span><button className="ov-out" onClick={p.logout}><LogOut size={14} aria-hidden />Logout</button></header>
      <div className="ov-body">
        <aside className="ov-side">
          {nav.map(([group, id, label]) => <div key={id}><h3>{group}</h3><button aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button></div>)}
        </aside>
        <main className="ov-main">
          <h1>{nav.find(([, id]) => id === tab)?.[2]}</h1>
          {tab === "objects" && (era === "early"
            ? <>
              <Facts facts={[{ label: "VPN Server", value: rows.length ? "On" : "Off" }, { label: "Current users", value: String(users), num: true }]} />
              <table className="cx-table">
                <thead><tr><th>Gateway</th><th>Account</th><th>Users</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={5} className="cx-empty">Nothing here yet.</td></tr>}
                  {rows.map((r) => (
                    <RowLines key={r.id} r={r} span={5}>
                      <td><b>{r.name}</b></td><td>{userOf(r.id)?.customer}</td><td className="num">{userOf(r.id)?.users}</td>
                      <td><span className={`cx-state ${r.tone}`}>{r.state}</span></td><td><Actions actions={r.actions} className="cx-acts" /></td>
                    </RowLines>
                  ))}
                </tbody>
              </table>
            </>
            : <div className="ov-cards">
              <section className="ov-card ov-sum"><b className="num">{users}</b><span>Current users</span></section>
              {rows.map((r) => (
                <section key={r.id} className="ov-card">
                  <h2>{r.name}<span className={`cx-state ${r.tone}`}>{r.state}</span></h2>
                  <p>{userOf(r.id)?.customer}, {userOf(r.id)?.users} users</p>
                  <Actions actions={r.actions} className="cx-acts" />{r.panel}
                </section>
              ))}
            </div>)}
          {tab === "software" && <><Facts facts={sw.facts} /><Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>{sw.panel}</>}
        </main>
      </div>
    </div>
  );
}
