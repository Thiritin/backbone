import { LogOut, Search } from "lucide-react";
import { useState } from "react";
import { Backups, erasFrom, eraAt, Facts, LoginForm, Nodes, RowsTable, Tiles, usePanelTab, useRows, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import "./cpanic.css";

// docs/design/software.md, section 10: the x3 manager until 2014, then the flat one with grouped sections.
const ERAS = erasFrom(2005, 2014);

export function CPanic(p: PanelProps) {
  const era = eraAt(ERAS, p.game), [tab, setTab] = usePanelTab(p.f), [q, setQ] = useState("");
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f);
  if (!p.signedIn) return (
    <div className="cx cp cp-login" data-era={era}>
      <LoginForm className="cp-card" onLogin={p.login} button="Log in">
        <div className="cp-logo">cPanic<small>WebHost Manager</small></div>
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  const menu: [string, [Tab, string][]][] = [
    ["Account Information", [["objects", "List Accounts"]]],
    ...(p.f.cluster ? [["Clusters", [["nodes", "Cluster Status"]]] as [string, [Tab, string][]]] : []),
    ["Server Configuration", [["software", "Software and Updates"]]],
  ];
  const title = menu.flatMap(([, items]) => items).find(([id]) => id === tab)?.[1];
  return (
    <div className="cx cp" data-era={era}>
      <header className="cp-top">
        <span className="cp-logo">cPanic<small>WebHost Manager</small></span>
        <span className="cx-host">{p.host}</span>
        <button className="cp-out" onClick={p.logout}><LogOut size={14} aria-hidden />Log out</button>
      </header>
      <div className="cp-body">
        <aside className="cp-menu">
          <label className="cp-find"><Search size={13} aria-hidden /><input placeholder="Find" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          {menu.map(([group, items]) => {
            const shown = items.filter(([, label]) => label.toLowerCase().includes(q.toLowerCase()));
            return shown.length > 0 && (
              <section key={group}>
                <h3>{group}</h3>
                {shown.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}
              </section>
            );
          })}
        </aside>
        <main className="cp-main">
          <h1>{title}</h1>
          {tab === "objects" && <RowsTable rows={rows} name="Domain" />}
          {tab === "nodes" && <Nodes game={p.game} c={p.c} />}
          {tab === "software" && (
            <>
              <h2>Server Information</h2>
              <Facts facts={sw.facts} />
              <h2>Software</h2>
              {sw.note && <p className="cx-note">{sw.note}</p>}
              <Tiles actions={sw.actions} />
              {sw.panel}{p.f.backups && <Backups game={p.game} c={p.c} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
