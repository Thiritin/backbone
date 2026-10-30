import { Folder, FolderOpen, Gamepad2 } from "lucide-react";
import { useState } from "react";
import { Actions, Backups, erasFrom, eraAt, Facts, LoginForm, Nodes, RowsTable, usePanelTab, useRows, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import "./tcadmen.css";

// docs/design/software.md, section 10: grey and black with a tree of game servers until 2016, then dark grey and green.
const ERAS = erasFrom(2005, 2016);

export function TCAdmen(p: PanelProps) {
  const era = eraAt(ERAS, p.game), [tab, setTab] = usePanelTab(p.f), [pick, setPick] = useState<string | null>(null);
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f);
  if (!p.signedIn) return (
    <div className="cx tc tc-login" data-era={era}>
      <LoginForm className="tc-card" onLogin={p.login} button="Login">
        <div className="tc-logo">TCAdmen<small>Game Hosting Control Panel</small></div>
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  const menu: [Tab, string][] = [["objects", "Game Servers"], ...(p.f.cluster ? [["nodes", "Nodes"] as [Tab, string]] : []), ["software", "System Settings"]];
  const shown = rows.filter((r) => !pick || r.id === pick);
  const open = (id: string | null) => { setPick(id); setTab("objects"); };
  return (
    <div className="cx tc" data-era={era}>
      <header className="tc-top">
        <span className="tc-logo">TCAdmen<small>Game Hosting Control Panel</small></span>
        <span className="cx-host">{p.host}</span>
      </header>
      <nav className="tc-menu">
        {menu.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => (id === "objects" ? open(null) : setTab(id))}>{label}</button>)}
        <button onClick={p.logout}>Logout</button>
      </nav>
      <div className="tc-body">
        <aside className="tc-tree">
          <button aria-pressed={tab === "objects" && !pick} onClick={() => open(null)}>{tab === "objects" ? <FolderOpen size={14} aria-hidden /> : <Folder size={14} aria-hidden />}Game Servers</button>
          <ul>{rows.map((r) => <li key={r.id}><button aria-pressed={pick === r.id} onClick={() => open(r.id)}><Gamepad2 size={13} aria-hidden />{r.name}</button></li>)}</ul>
        </aside>
        <main className="tc-main">
          {tab === "objects" && <RowsTable rows={shown} name="Game Server" />}
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
    </div>
  );
}
