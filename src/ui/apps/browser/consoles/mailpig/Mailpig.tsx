import { LogOut } from "lucide-react";
import { useState } from "react";
import { companyDomain } from "../../../../../sim/30-customers/domains";
import { Actions, Facts, LoginForm, useSoftware, type PanelProps } from "../PanelBase";
import { hash, mailboxes } from "../services";
import "./mailpig.css";

// docs/design/software.md, section 10: one look, the dark mail admin with a pink accent and tabs.
const TABS = ["Mailboxes", "Domains", "Queue", "Configuration"] as const;

export function Mailpig(p: PanelProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Mailboxes"), sw = useSoftware(p.game, p.c, p.f);
  const logo = <span className="mp-logo">mail<b>pig</b></span>;
  if (!p.signedIn) return (
    <div className="cx mp mp-login">
      <LoginForm className="mp-card" onLogin={p.login} button="Login">{logo}<div className="cx-host">{p.host}</div></LoginForm>
    </div>
  );
  const boxes = mailboxes(p.game), domain = companyDomain(p.game);
  return (
    <div className="cx mp">
      <header className="mp-top">{logo}<span className="cx-host">{p.host}</span><button className="mp-out" onClick={p.logout}><LogOut size={14} aria-hidden />Logout</button></header>
      <main className="mp-main">
        <nav className="mp-tabs">{TABS.map((t) => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}</nav>
        <section className="mp-pane">
          {tab === "Mailboxes" && <table className="cx-table">
            <thead><tr><th>Username</th><th>Quota</th><th>Messages</th><th>Active</th></tr></thead>
            <tbody>{boxes.map((b) => <tr key={b}><td><b>{b}</b></td><td className="num">{(hash(b) % 900) + 40} MiB of 2 GiB</td><td className="num">{hash(`${b}m`) % 4000}</td><td><span className="cx-state ok">Yes</span></td></tr>)}</tbody>
          </table>}
          {tab === "Domains" && <table className="cx-table">
            <thead><tr><th>Domain</th><th>Mailboxes</th><th>Aliases</th><th>Active</th></tr></thead>
            <tbody><tr><td><b>{domain}</b></td><td className="num">{boxes.length}</td><td className="num">2</td><td><span className="cx-state ok">Yes</span></td></tr></tbody>
          </table>}
          {tab === "Queue" && <p className="cx-empty">The queue is empty.</p>}
          {tab === "Configuration" && <><Facts facts={sw.facts} /><Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>{sw.panel}</>}
        </section>
      </main>
    </div>
  );
}
