import type { ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { dateOf } from "../../../../../../sim/00-core/time";
import { deskPath, type DeskArgs, type DeskPage } from "../../../../../../sim/80-business/deskroutes";
import { OsTickitMark } from "../../../../../art/mailmarks";
import { useSessionState } from "../../../../../session";
import type { DeskSiteProps } from "../DeskSite";
import { AdminPage } from "./Admin";
import { ClientPage } from "./Client";
import { StaffPage } from "./Staff";
import "./ostickit.css";

export type OstPage = DeskPage<"ostickit">;
export interface OstProps extends DeskSiteProps {
  version: string;
  // 1.10 and later draw the flat look and name staff Agents.
  modern: boolean;
  nav: (page: OstPage, args?: DeskArgs) => void;
}

const STAFF: OstPage[] = ["scp", "dashboard", "queue", "staffTicket", "newTicket", "tasks", "users", "staffKb", "directory", "profile"];
const ADMIN: OstPage[] = ["admin", "settings", "helpTopics", "filters", "slas", "pages", "emails", "email", "banlist", "templates", "diagnostic", "staff", "teams", "departments", "logs"];

export const minor = (version: string): number => Number(version.split(".")[1] ?? 0);
export const when = (hour: number): string => dateOf(hour).toLocaleString(LOCALE, { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });

// The self-hosted OsTickit: client portal, Staff Control Panel at /scp and its Admin Panel, in the installed version's look.
export function OsTickitSite(p: DeskSiteProps) {
  const [agent, setAgent] = useSessionState("desk.agent", false);
  const h = p.game.desk?.hosting, version = h?.kind === "self" ? h.version : "1.10";
  const props: OstProps = { ...p, version, modern: minor(version) >= 10, nav: (page, args) => p.go(p.host + deskPath("ostickit", page, args)) };
  const page = p.route.page as OstPage;
  const look = `ost ${props.modern ? "ost-110" : "ost-16"}`;
  if (page === "login" || ((STAFF.includes(page) || ADMIN.includes(page)) && !agent)) {
    return <div className={`${look} ost-scp`}><Login {...props} onLogin={() => { setAgent(true); if (page === "login") props.nav("scp"); }} /></div>;
  }
  if (STAFF.includes(page) || ADMIN.includes(page)) {
    const admin = ADMIN.includes(page);
    return (
      <div className={`${look} ost-scp`}>
        <ScpHeader {...props} admin={admin} onLogout={() => { setAgent(false); props.nav("login"); }} />
        {admin ? <AdminPage {...props} /> : <StaffPage {...props} />}
        <footer className="ost-foot">{t("ost.copyright", { version })}</footer>
      </div>
    );
  }
  return <div className={`${look} ost-client`}><ClientPage {...props} /></div>;
}

function Login({ game, nav, onLogin }: OstProps & { onLogin: () => void }) {
  return (
    <form className="ost-login" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
      <h1><a onClick={() => nav("home")}><OsTickitMark /> {game.company.name}</a></h1>
      <h3>{t("ost.login.title")}</h3>
      <input name="userid" aria-label={t("ost.login.username")} placeholder={t("ost.login.username")} defaultValue="admin" autoComplete="off" />
      <input name="passwd" type="password" aria-label={t("ost.login.password")} placeholder={t("ost.login.password")} defaultValue="password" autoComplete="off" />
      <button type="submit" className="ost-btn">{t("ost.login.submit")}</button>
    </form>
  );
}

// The Staff Control Panel header: logo, the welcome line with its links, then the tab row.
function ScpHeader(p: OstProps & { admin: boolean; onLogout: () => void }) {
  const { modern, version, nav, admin } = p;
  // Each tab: its label, its page and the other pages it stays lit on.
  const tabs: [string, OstPage, OstPage[]][] = admin
    ? (modern
      ? [["ost.admin.tab.dashboard", "logs", []], ["ost.admin.tab.settings", "settings", []], ["ost.admin.tab.manage", "helpTopics", ["filters", "slas", "pages"]],
        ["ost.admin.tab.emails", "emails", ["email", "banlist", "templates", "diagnostic"]], ["ost.admin.tab.agents", "staff", ["teams", "departments"]]]
      : [["ost.admin.tab.dashboard", "logs", []], ["ost.admin.tab.settings", "settings", ["slas"]], ["ost.admin.tab.emails", "emails", ["email", "banlist", "templates", "diagnostic"]],
        ["ost.admin.tab.helpTopics", "helpTopics", []], ["ost.admin.tab.staff", "staff", ["teams"]], ["ost.admin.tab.departments", "departments", []]])
    : [
      ["ost.tab.dashboard", "dashboard", []],
      ...(minor(version) >= 8 ? [["ost.tab.users", "users", []] as [string, OstPage, OstPage[]]] : []),
      ...(modern ? [["ost.tab.tasks", "tasks", []] as [string, OstPage, OstPage[]]] : []),
      ["ost.tab.tickets", "queue", ["staffTicket", "newTicket", "scp"]],
      ["ost.tab.kb", "staffKb", []],
    ];
  const page = p.route.page as OstPage;
  return (
    <header className="ost-head">
      <div className="ost-top">
        <a className="ost-logo" onClick={() => nav("scp")}><OsTickitMark /> <span>{t("ost.title.scp")}</span></a>
        <p className="ost-welcome">
          {t(modern ? "ost.welcome" : "ost.welcomeBack", { name: t("ost.you") })}
          {" | "}<a onClick={() => nav(admin ? "scp" : "admin")}>{t(admin ? (modern ? "ost.agentPanel" : "ost.staffPanel") : "ost.adminPanel")}</a>
          {" | "}<a onClick={() => nav("profile")}>{t(modern ? "ost.profile" : "ost.preferences")}</a>
          {" | "}<a onClick={p.onLogout}>{t("ost.logout")}</a>
        </p>
      </div>
      <nav className="ost-tabs">
        {tabs.map(([key, target, also]) => <a key={key} className={target === page || also.includes(page) ? "active" : ""} onClick={() => p.nav(target, target === "queue" ? { view: "open" } : target === "settings" ? { section: "system" } : {})}>{t(key)}</a>)}
      </nav>
    </header>
  );
}

export const Sub = ({ items }: { items: [string, () => void, boolean][] }) => (
  <nav className="ost-sub">{items.map(([label, run, on]) => <a key={label} className={on ? "active" : ""} onClick={run}>{label}</a>)}</nav>
);

export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="ost-page"><h2>{title}</h2>{children}</section>
);
