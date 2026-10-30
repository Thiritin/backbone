import { Globe, LogOut, Network, Wrench, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Actions, erasFrom, eraAt, Facts, LoginForm, Nodes, RowsTable, Tiles, usePanelTab, useRows, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import "./pleskit.css";

// docs/design/software.md, section 10: the 8.x icon grids until 2015, then white with a dark sidebar and flat cards.
const ERAS = erasFrom(2005, 2015);

export function Pleskit(p: PanelProps) {
  const era = eraAt(ERAS, p.game), [tab, setTab] = usePanelTab(p.f);
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f);
  if (!p.signedIn) return (
    <div className="cx pk pk-login" data-era={era}>
      <LoginForm className="pk-card" onLogin={p.login} button="Log in">
        <div className="pk-logo">pleskit</div>
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  const nav: [Tab, string, LucideIcon][] = [
    ["objects", "Websites & Domains", Globe], ...(p.f.cluster ? [["nodes", "Nodes", Network] as [Tab, string, LucideIcon]] : []), ["software", "Tools & Settings", Wrench],
  ];
  const card = (title: string, body: ReactNode) => <section className="pk-box"><h2>{title}</h2>{body}</section>;
  return (
    <div className="cx pk" data-era={era}>
      <header className="pk-top">
        <span className="pk-logo">pleskit</span>
        <span className="cx-host">{p.host}</span>
        <button className="pk-out" onClick={p.logout}><LogOut size={14} aria-hidden />Log out</button>
      </header>
      <div className="pk-body">
        <aside className="pk-side">
          {era === "early" && <h3>General</h3>}
          {nav.map(([id, label, Icon]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}><Icon size={16} aria-hidden />{label}</button>)}
        </aside>
        <main className="pk-main">
          <h1>{nav.find(([id]) => id === tab)?.[1]}</h1>
          {tab === "objects" && card("Domains", <RowsTable rows={rows} name="Domain" />)}
          {tab === "nodes" && card("Nodes", <Nodes game={p.game} c={p.c} />)}
          {tab === "software" && (era === "early"
            ? <>{card("Tools", <>{sw.note && <p className="cx-note">{sw.note}</p>}<Tiles actions={sw.actions} /></>)}{sw.panel}{card("Server information", <Facts facts={sw.facts} />)}</>
            : <div className="pk-cards">
              {card("Server information", <Facts facts={sw.facts} />)}
              {card("Updates and server management", <><Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>{sw.panel}</>)}
            </div>)}
        </main>
      </div>
    </div>
  );
}
