import { LogOut } from "lucide-react";
import { useState } from "react";
import { companyDomain } from "../../../../../sim/30-customers/domains";
import { Actions, Facts, LoginForm, useSoftware, type PanelProps } from "../PanelBase";
import { hash, mailboxes } from "../services";
import { Blacklist, Relays } from "./Blacklist";
import { MailQueue } from "./MailQueue";
import { t } from "../../../../../i18n/en";
import "./mailpig.css";

// docs/design/software.md, section 10: one look, the dark mail admin with a pink accent and tabs.
const TABS = ["Mailboxes", "Domains", "Queue", "Blacklist", "Configuration"] as const;
const TAB_LABELS: Record<(typeof TABS)[number], string> = { Mailboxes: t("browser-consoles-1.mpMailboxes"), Domains: t("browser-consoles-1.mpDomains"), Queue: t("browser-consoles-1.mpQueue"), Blacklist: t("netsvc.blacklist"), Configuration: t("browser-consoles-1.mpConfiguration") };

export function Mailpig(p: PanelProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Mailboxes"), sw = useSoftware(p.game, p.c, p.f);
  const logo = <span className="mp-logo">mail<b>pig</b></span>;
  if (!p.signedIn) return (
    <div className="cx mp mp-login">
      <LoginForm className="mp-card" onLogin={p.login} button={t("browser-consoles-1.login")}>{logo}<div className="cx-host">{p.host}</div></LoginForm>
    </div>
  );
  const boxes = mailboxes(p.game), domain = companyDomain(p.game);
  return (
    <div className="cx mp">
      <header className="mp-top">{logo}<span className="cx-host">{p.host}</span><button className="mp-out" onClick={p.logout}><LogOut size={14} aria-hidden />{t("browser-consoles-1.logout")}</button></header>
      <main className="mp-main">
        <nav className="mp-tabs">{TABS.map((x) => <button key={x} aria-pressed={tab === x} onClick={() => setTab(x)}>{TAB_LABELS[x]}</button>)}</nav>
        <section className="mp-pane">
          {tab === "Mailboxes" && <table className="cx-table">
            <thead><tr><th>{t("browser-consoles-1.mpUsername")}</th><th>{t("browser-consoles-1.mpQuota")}</th><th>{t("browser-consoles-1.mpMessages")}</th><th>{t("browser-consoles-1.mpActive")}</th></tr></thead>
            <tbody>{boxes.map((b) => <tr key={b}><td><b>{b}</b></td><td className="num">{t("browser-consoles-1.mpQuotaOf", { n: (hash(b) % 900) + 40 })}</td><td className="num">{hash(`${b}m`) % 4000}</td><td><span className="cx-state ok">{t("browser-consoles-1.yes")}</span></td></tr>)}</tbody>
          </table>}
          {tab === "Domains" && <table className="cx-table">
            <thead><tr><th>{t("browser-consoles-1.domain")}</th><th>{t("browser-consoles-1.mpMailboxes")}</th><th>{t("browser-consoles-1.mpAliases")}</th><th>{t("browser-consoles-1.mpActive")}</th></tr></thead>
            <tbody><tr><td><b>{domain}</b></td><td className="num">{boxes.length}</td><td className="num">2</td><td><span className="cx-state ok">{t("browser-consoles-1.yes")}</span></td></tr></tbody>
          </table>}
          {tab === "Domains" && <Relays game={p.game} clusterId={p.c.id} />}
          {tab === "Queue" && <MailQueue game={p.game} clusterId={p.c.id} />}
          {tab === "Blacklist" && <Blacklist game={p.game} clusterId={p.c.id} />}
          {tab === "Configuration" && <><Facts facts={sw.facts} /><Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>{sw.panel}</>}
        </section>
      </main>
    </div>
  );
}
