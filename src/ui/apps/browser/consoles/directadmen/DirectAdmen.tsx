import { Search } from "lucide-react";
import { useState } from "react";
import { erasFrom, eraAt, LoginForm, Nodes, RowsTable, usePanelTab, useRows, useSoftware, type PanelProps } from "../PanelBase";
import "./directadmen.css";

// docs/design/software.md, section 10: the enhanced skin's three link columns until 2018, then a dark bar, cards and a search.
const ERAS = erasFrom(2005, 2018);

// The software tab is the home page: server manager links, tools and server facts side by side.
export function DirectAdmen(p: PanelProps) {
  const era = eraAt(ERAS, p.game), [tab, setTab] = usePanelTab(p.f, "software"), [q, setQ] = useState("");
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f);
  if (!p.signedIn) return (
    <div className="cx da da-login" data-era={era}>
      <LoginForm className="da-card" onLogin={p.login} button="Login">
        <div className="da-logo">DirectAdmen</div>
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  const shown = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  const crumb = tab === "objects" ? "Web spaces" : tab === "nodes" ? "Nodes" : null;
  return (
    <div className="cx da" data-era={era}>
      <header className="da-top">
        <span className="da-logo">DirectAdmen</span>
        <span className="da-level">Admin Level</span>
        {era === "late" && (
          <label className="da-search"><Search size={14} aria-hidden />
            <input placeholder="Search" value={q} onChange={(e) => { setQ(e.target.value); setTab("objects"); }} />
          </label>
        )}
        <span className="cx-host">{p.host}</span>
        <button className="da-link" onClick={p.logout}>Logout</button>
      </header>
      <main className="da-main">
        <nav className="da-crumb"><button className="da-link" onClick={() => setTab("software")}>Home</button>{crumb && <> » {crumb}</>}</nav>
        {tab === "objects" && <RowsTable rows={shown} name="Domain" />}
        {tab === "nodes" && <Nodes game={p.game} c={p.c} />}
        {tab === "software" && (
          <>
            <div className="da-cols">
              <section>
                <h2>Server Manager</h2>
                <button className="da-link" onClick={() => setTab("objects")}>Show all web spaces</button>
                {p.f.cluster && <button className="da-link" onClick={() => setTab("nodes")}>Nodes</button>}
              </section>
              <section>
                <h2>Server Tools</h2>
                {sw.note && <span className="cx-note">{sw.note}</span>}
                {sw.actions.map((a) => <button key={a.id} className={`da-link ${a.tone ?? ""}`} onClick={a.run}>{a.label}</button>)}
              </section>
              <section>
                <h2>Server Info</h2>
                <dl>{sw.facts.map((x) => <div key={x.label}><dt>{x.label}</dt><dd className={x.num ? "num" : undefined}>{x.value}</dd></div>)}</dl>
              </section>
            </div>
            {sw.panel}
          </>
        )}
      </main>
    </div>
  );
}
