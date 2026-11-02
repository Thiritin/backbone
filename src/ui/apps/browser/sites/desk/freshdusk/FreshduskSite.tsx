import type { ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { dateOf, yearOf } from "../../../../../../sim/00-core/time";
import { deskPath, type DeskArgs, type DeskPage } from "../../../../../../sim/80-business/deskroutes";
import { FreshduskMark } from "../../../../../art/mailmarks";
import { useSessionState } from "../../../../../session";
import type { DeskSiteProps } from "../DeskSite";
import { AdminPage } from "./Admin";
import { AgentPage } from "./Agent";
import { Portal } from "./Portal";
import "./freshdusk.css";

export type FdPage = DeskPage<"freshdusk">;
// The 2011 first look with its tabs, the flat blue helpdesk with the properties sidebar from 2014, and Mint from 2019.
export type Look = "classic" | "flat" | "mint";
export interface FdProps extends DeskSiteProps {
  look: Look;
  year: number;
  nav: (page: FdPage, args?: DeskArgs) => void;
}

const PORTAL: FdPage[] = ["portal", "portalNew", "portalTickets", "portalTicket", "solutions", "solution", "login"];

export const lookOf = (year: number): Look => (year < 2014 ? "classic" : year < 2019 ? "flat" : "mint");
export const when = (hour: number): string => dateOf(hour).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
// Mint moved the ticket page to /a/tickets.
export const openTicket = (p: FdProps, ref: string | undefined) => p.nav(p.look === "mint" ? "ticketMint" : "ticket", { n: ref ?? "" });

// The hosted Freshdusk: the support portal at /support, the helpdesk for agents and its Admin, in the look of the calendar
// year, because the vendor moves every account at once.
export function FreshduskSite(p: DeskSiteProps) {
  const [agent, setAgent] = useSessionState("desk.agent", false);
  const year = yearOf(p.game.hour), look = lookOf(year);
  const props: FdProps = { ...p, look, year, nav: (page, args) => p.go(p.host + deskPath("freshdusk", page, args)) };
  const page = p.route.page as FdPage, cls = `fd fd-${look}`;
  if (page === "login" || (!PORTAL.includes(page) && !agent)) {
    return <div className={`${cls} fd-login`}><Login {...props} onLogin={() => { setAgent(true); if (page === "login") props.nav("dashboard"); }} /></div>;
  }
  if (PORTAL.includes(page)) return <div className={`${cls} fd-portal`}><Portal {...props} /></div>;
  const body = page === "admin" || page === "adminScreen" ? <AdminPage {...props} /> : <AgentPage {...props} />;
  const logout = () => { setAgent(false); props.nav("login"); };
  if (look === "mint") {
    return (
      <div className={`${cls} fd-agent`}>
        <Sidebar {...props} />
        <div className="fd-main">
          <header className="fd-top"><h1>{title(props)}</h1><a onClick={() => props.nav("portal")}>{t("fd.portal")}</a><a onClick={logout}>{t("fd.logout")}</a></header>
          <div className="fd-body">{body}</div>
        </div>
      </div>
    );
  }
  return (
    <div className={`${cls} fd-agent`}>
      <TopBar {...props} onLogout={logout} />
      <div className="fd-body">{body}</div>
    </div>
  );
}

function Login({ game, nav, onLogin }: FdProps & { onLogin: () => void }) {
  return (
    <form className="fd-signin" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
      <FreshduskMark />
      <h2>{t("fd.login.title", { company: game.company.name })}</h2>
      <label><span>{t("fd.email")}</span><input name="email" type="email" defaultValue={`admin@${game.company.domain}`} autoComplete="off" /></label>
      <label><span>{t("fd.login.password")}</span><input name="password" type="password" defaultValue="password" autoComplete="off" /></label>
      <button type="submit" className="fd-btn primary">{t("fd.login.submit")}</button>
      <a onClick={() => nav("portal")}>{t("fd.portal")}</a>
    </form>
  );
}

// Which tab a page belongs to.
const TABS: [string, FdPage, FdPage[]][] = [
  ["fd.nav.dashboard", "dashboard", ["dashboard"]],
  ["fd.nav.tickets", "tickets", ["tickets", "view", "ticket", "ticketMint", "newTicket"]],
  ["fd.nav.customers", "contacts", ["contacts", "companies"]],
  ["fd.nav.solutions", "agentSolutions", ["agentSolutions"]],
  ["fd.nav.reports", "reports", ["reports"]],
  ["fd.nav.admin", "admin", ["admin", "adminScreen"]],
];
const tabLabel = (look: Look, key: string) => t(look === "mint" && key === "fd.nav.customers" ? "fd.nav.contacts" : key);
const title = (p: FdProps) => tabLabel(p.look, TABS.find(([, , pages]) => pages.includes(p.route.page as FdPage))?.[0] ?? "fd.nav.dashboard");

function TopBar(p: FdProps & { onLogout: () => void }) {
  return (
    <header className="fd-bar">
      <a className="fd-brand" onClick={() => p.nav("dashboard")}><FreshduskMark /> <span>{p.game.company.name}</span></a>
      <nav>{TABS.map(([key, target, pages]) => <a key={key} className={pages.includes(p.route.page as FdPage) ? "active" : ""} onClick={() => p.nav(target)}>{tabLabel(p.look, key)}</a>)}</nav>
      <p className="fd-user"><a onClick={() => p.nav("portal")}>{t("fd.portal")}</a>{" | "}<a onClick={p.onLogout}>{t("fd.logout")}</a></p>
    </header>
  );
}

// Mint's dark sidebar with one icon per module.
function Sidebar(p: FdProps) {
  return (
    <nav className="fd-side">
      <a className="fd-side-logo" onClick={() => p.nav("dashboard")} aria-label={t("fd.nav.dashboard")}><FreshduskMark /></a>
      {TABS.map(([key, target, pages], i) => {
        const label = tabLabel(p.look, key);
        return <a key={key} className={pages.includes(p.route.page as FdPage) ? "active" : ""} title={label} aria-label={label} onClick={() => p.nav(target)}>{ICONS[i]}</a>;
      })}
    </nav>
  );
}

const icon = (d: string) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const ICONS = [
  icon("M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"),
  icon("M3 7a2 2 0 012-2h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4zM15 5v14"),
  icon("M12 11a4 4 0 100-8 4 4 0 000 8zM4 21v-1a8 8 0 0116 0v1"),
  icon("M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16M8 7h7"),
  icon("M4 20V10M10 20V4M16 20v-7M22 20H2"),
  icon("M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-1-3-2 .2-1.3-1.3L17 5l-3-1-1 2h-2L10 4 7 5l.3 1.9L6 8.2 4 8l-1 3 2 1v1.6L3 15l1 3 2-.2 1.3 1.3L7 21l3 1 1-2h2l1 2 3-1-.3-1.9 1.3-1.3 2 .2 1-3-2-1z"),
];

export const Panel = ({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) => (
  <section className="fd-panel"><header><h2>{title}</h2>{actions}</header>{children}</section>
);
