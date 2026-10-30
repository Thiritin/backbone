import { ChevronRight, Folder, LogOut } from "lucide-react";
import { Actions, Backups, erasFrom, eraAt, Facts, LoginForm, Nodes, RowsTable, usePanelTab, useRows, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import "./freepanel.css";

// docs/design/software.md, section 10: a blue category tree with grey module tables until 2016, then white and flat.
const ERAS = erasFrom(2005, 2016);

export function FreePanel(p: PanelProps) {
  const era = eraAt(ERAS, p.game), [tab, setTab] = usePanelTab(p.f);
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f);
  if (!p.signedIn) return (
    <div className="cx fp fp-login" data-era={era}>
      <LoginForm className="fp-card" onLogin={p.login} button="Sign in">
        <div className="fp-logo">FreePanel</div>
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  const tree: [string, [Tab, string][]][] = [
    ["Servers", [["objects", "Web spaces"]]],
    ...(p.f.cluster ? [["Cluster", [["nodes", "Nodes"]]] as [string, [Tab, string][]]] : []),
    ["System", [["software", "Software and updates"]]],
  ];
  const title = tree.flatMap(([, items]) => items).find(([id]) => id === tab)?.[1];
  return (
    <div className="cx fp" data-era={era}>
      <aside className="fp-tree">
        <div className="fp-logo">FreePanel</div>
        <div className="fp-host">{p.host}</div>
        {tree.map(([cat, items]) => (
          <section key={cat}>
            <h3><Folder size={13} aria-hidden />{cat}</h3>
            {items.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}><ChevronRight size={12} aria-hidden />{label}</button>)}
          </section>
        ))}
        <button className="fp-out" onClick={p.logout}><LogOut size={13} aria-hidden />Logout</button>
      </aside>
      <main className="fp-main">
        <h1>{title}</h1>
        {tab === "objects" && <RowsTable rows={rows} name="Domain" />}
        {tab === "nodes" && <Nodes game={p.game} c={p.c} />}
        {tab === "software" && (
          <>
            <Facts facts={sw.facts} />
            <Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>
            {sw.panel}{p.f.backups && <Backups game={p.game} c={p.c} />}
          </>
        )}
      </main>
    </div>
  );
}
