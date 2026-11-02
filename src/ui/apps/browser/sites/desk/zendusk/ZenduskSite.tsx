import { useEffect, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { dateOf, yearOf } from "../../../../../../sim/00-core/time";
import { deskPath, type DeskArgs, type DeskPage } from "../../../../../../sim/80-business/deskroutes";
import { ZenduskMark } from "../../../../../art/mailmarks";
import { useSessionState } from "../../../../../session";
import type { DeskSiteProps } from "../DeskSite";
import { AdminPage } from "./Admin";
import { AgentPage } from "./Agent";
import { HelpCenter } from "./HelpCenter";
import "./zendusk.css";

export type ZdPage = DeskPage<"zendusk">;
// classic until the 2012 relaunch, then the tabbed agent interface, then the agent workspace with its context panel.
export type Look = "classic" | "lotus" | "workspace";
export interface ZdProps extends DeskSiteProps {
  look: Look;
  year: number;
  nav: (page: ZdPage, args?: DeskArgs) => void;
}

const AGENT: ZdPage[] = ["agent", "view", "ticket", "users", "organizations", "reporting", "search", "start", "admin", "adminScreen"];

export const lookOf = (year: number): Look => (year < 2012 ? "classic" : year < 2019 ? "lotus" : "workspace");
export const when = (hour: number): string => dateOf(hour).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

// The hosted Zendusk: the Help Center (the web portal before 2013), the agent interface at /agent and its Admin, in the look
// of the calendar year, because the vendor upgrades every account at once.
export function ZenduskSite(p: DeskSiteProps) {
  const [agent, setAgent] = useSessionState("desk.agent", false);
  const [tabs, setTabs] = useSessionState<string[]>("zd.tabs", []);
  const year = yearOf(p.game.hour), look = lookOf(year);
  const props: ZdProps = { ...p, look, year, nav: (page, args) => p.go(p.host + deskPath("zendusk", page, args)) };
  const page = p.route.page as ZdPage, n = page === "ticket" ? p.route.args.n ?? "" : "";
  useEffect(() => { if (n && look !== "classic" && !tabs.includes(n)) setTabs([...tabs, n]); }, [n, look, tabs, setTabs]);
  const cls = `zd zd-${look}`;
  if (page === "signIn" || (AGENT.includes(page) && !agent)) {
    return <div className={`${cls} zd-login`}><SignIn {...props} onLogin={() => { setAgent(true); if (page === "signIn") props.nav("agent"); }} /></div>;
  }
  if (!AGENT.includes(page)) return <div className={`${cls} zd-hc`}><HelpCenter {...props} /></div>;
  const admin = page === "admin" || page === "adminScreen";
  const shell = { ...props, tabs, close: (ref: string) => setTabs(tabs.filter((x) => x !== ref)), onLogout: () => { setAgent(false); props.nav("signIn"); } };
  return (
    <div className={`${cls} zd-agent`}>
      {look === "classic" ? <ClassicBar {...shell} /> : <Rail {...shell} />}
      <div className="zd-main">
        {look !== "classic" && <TopBar {...shell} />}
        <div className="zd-body">{admin ? <AdminPage {...props} /> : <AgentPage {...props} />}</div>
      </div>
    </div>
  );
}

function SignIn({ game, nav, onLogin }: ZdProps & { onLogin: () => void }) {
  return (
    <form className="zd-signin" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
      <ZenduskMark />
      <h2>{t("zd.signIn.title", { company: game.company.name })}</h2>
      <label><span>{t("zd.email")}</span><input name="email" type="email" defaultValue={`admin@${game.company.domain}`} autoComplete="off" /></label>
      <label><span>{t("zd.signIn.password")}</span><input name="password" type="password" defaultValue="password" autoComplete="off" /></label>
      <button type="submit" className="zd-btn primary">{t("zd.signIn.submit")}</button>
      <a onClick={() => nav("hc")}>{t("zd.helpCenter")}</a>
    </form>
  );
}

interface Shell extends ZdProps { tabs: string[]; close: (ref: string) => void; onLogout: () => void }

// The classic interface: one bar with the account name and the tabs Home, Views, Users, Reporting, Manage, Settings and Account.
function ClassicBar(p: Shell) {
  const page = p.route.page as ZdPage, section = p.route.args.section ?? "";
  const tabs: [string, () => void, boolean][] = [
    [t("zd.nav.home"), () => p.nav("agent"), page === "agent" || page === "start"],
    [t("zd.nav.views"), () => p.nav("view", { view: "your-unsolved" }), page === "view" || page === "ticket"],
    [t("zd.nav.users"), () => p.nav("users"), page === "users" || page === "organizations"],
    [t("zd.nav.reporting"), () => p.nav("reporting"), page === "reporting"],
    [t("zd.nav.manage"), () => p.nav("adminScreen", { section: "macros" }), MANAGE.includes(section)],
    [t("zd.nav.settings"), () => p.nav("adminScreen", { section: "email" }), SETTINGS.includes(section)],
    [t("zd.nav.account"), () => p.nav("admin"), page === "admin" || section === "subscription"],
  ];
  return (
    <header className="zd-cbar">
      <a className="zd-brand" onClick={() => p.nav("agent")}><ZenduskMark /> <span>{p.game.company.name}</span></a>
      <nav>{tabs.map(([label, run, on]) => <a key={label} className={on ? "active" : ""} onClick={run}>{label}</a>)}</nav>
      <p className="zd-user">
        <a onClick={() => p.nav("search")}>{t("zd.search")}</a>{" | "}<a onClick={() => p.nav("hc")}>{t("zd.webPortal")}</a>{" | "}<a onClick={p.onLogout}>{t("zd.signOut")}</a>
      </p>
    </header>
  );
}

// Business rules and people live under Manage, channels and branding under Settings.
export const MANAGE = ["macros", "views", "triggers", "automations", "sla", "people", "groups"];
export const SETTINGS = ["email", "branding"];

// The left rail of the tabbed interface: Home, Views, Customers, Reporting and Admin.
function Rail(p: Shell) {
  const page = p.route.page as ZdPage;
  const items: [string, keyof typeof ICONS, () => void, boolean][] = [
    [t("zd.nav.home"), "home", () => p.nav("agent"), page === "agent" || page === "start"],
    [t("zd.nav.views"), "views", () => p.nav("view", { view: "your-unsolved" }), page === "view"],
    [t("zd.nav.customers"), "users", () => p.nav("users"), page === "users" || page === "organizations"],
    [t("zd.nav.reporting"), "reporting", () => p.nav("reporting"), page === "reporting"],
    [t(p.look === "workspace" ? "zd.nav.adminCenter" : "zd.nav.admin"), "admin", () => p.nav("admin"), page === "admin" || page === "adminScreen"],
  ];
  return (
    <nav className="zd-rail">
      <a className="zd-rail-logo" onClick={() => p.nav("agent")} aria-label={t("zd.nav.home")}><ZenduskMark /></a>
      {items.map(([label, icon, run, on]) => <a key={label} className={on ? "active" : ""} title={label} aria-label={label} onClick={run}>{ICONS[icon]}</a>)}
    </nav>
  );
}

// The top bar: one tab per open ticket, search and the user menu.
function TopBar(p: Shell) {
  const open = p.route.page === "ticket" ? p.route.args.n : null;
  return (
    <header className="zd-top">
      <div className="zd-tabs">
        {p.tabs.map((ref) => {
          const tk = p.game.tickets.find((x) => x.ref === ref);
          return (
            <span key={ref} className={ref === open ? "zd-tab active" : "zd-tab"}>
              <a onClick={() => p.nav("ticket", { n: ref })}>{tk ? `#${ref}` : ref}</a>
              <button type="button" aria-label={t("zd.closeTab")} onClick={() => { p.close(ref); if (ref === open) p.nav("view", { view: "your-unsolved" }); }}>×</button>
            </span>
          );
        })}
      </div>
      <a className={p.route.page === "search" ? "active" : ""} onClick={() => p.nav("search")}>{t("zd.search")}</a>
      <a onClick={() => p.nav("hc")}>{t("zd.helpCenter")}</a>
      <a onClick={p.onLogout}>{t("zd.signOut")}</a>
    </header>
  );
}

const icon = (d: string) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const ICONS = {
  home: icon("M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10"),
  views: icon("M4 6h16M4 12h16M4 18h16"),
  users: icon("M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0114 0v1M17 11a3 3 0 100-6M22 21v-1a5 5 0 00-4-4.9"),
  reporting: icon("M4 20V10M10 20V4M16 20v-7M22 20H2"),
  admin: icon("M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"),
};

export const Panel = ({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) => (
  <section className="zd-panel"><header><h2>{title}</h2>{actions}</header>{children}</section>
);
