import { useState, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { dateOf } from "../../../../../../sim/00-core/time";
import { channelsOf } from "../../../../../../sim/40-support/desk-channels";
import { OWNER } from "../../../../../../sim/40-support/desk-work";
import { isFinal, type Ticket } from "../../../../../../sim/40-support/tickets";
import type { DeskChannel } from "../../../../../../sim/42-mail/types";
import type { GameState } from "../../../../../../sim/50-state";
import { deskPath, type DeskArgs, type DeskPage } from "../../../../../../sim/80-business/deskroutes";
import { FreeScootMark } from "../../../../../art/mailmarks";
import { deskSpace } from "../../../../../../sim/60-infra/desk-files";
import { deskLogin } from "../../../../../../sim/90-actions/desk-setup";
import { useSessionState } from "../../../../../session";
import { useStore } from "../../../../../store";
import { DeskForgot, DeskReset } from "../setup/DeskReset";
import type { DeskSiteProps } from "../DeskSite";
import { MailboxPage } from "./Mailbox";
import { ManagePage } from "./Manage";
import "./freescoot.css";

export type FsPage = DeskPage<"freescoot">;
export interface FsProps extends DeskSiteProps {
  version: string;
  nav: (page: FsPage, args?: DeskArgs) => void;
}

const MANAGE: FsPage[] = ["settings", "mailboxes", "mailboxSettings", "connection", "autoReply", "permissions", "users", "modules", "logs", "system"];

export const when = (hour: number): string => dateOf(hour).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

// A mailbox is a desk channel; its number in the address is the channel's.
export const mid = (ch: DeskChannel): string => ch.id.replace(/^ch/, "");
export const mailboxOf = (s: GameState, id: string | undefined): DeskChannel | undefined => channelsOf(s).find((c) => mid(c) === id);
export const accountOf = (s: GameState, ch: DeskChannel) => s.mail.accounts.find((a) => a.id === ch.accountId);
export const emailOf = (s: GameState, ch: DeskChannel): string => { const a = accountOf(s, ch); return a ? `${a.local}@${a.domain}` : ""; };
export const nameOf = (s: GameState, ch: DeskChannel): string => accountOf(s, ch)?.title || emailOf(s, ch);

export const FOLDERS = ["unassigned", "mine", "assigned", "closed", "spam"] as const;
export type Folder = (typeof FOLDERS)[number];
export const isSpam = (tk: Ticket) => tk.kind === "spam" || tk.outcome === "spam";
const IN_FOLDER: Record<Folder, (tk: Ticket) => boolean> = {
  unassigned: (tk) => !isSpam(tk) && !isFinal(tk) && !tk.assignee,
  mine: (tk) => !isSpam(tk) && !isFinal(tk) && tk.assignee === OWNER,
  assigned: (tk) => !isSpam(tk) && !isFinal(tk) && !!tk.assignee,
  closed: (tk) => !isSpam(tk) && isFinal(tk),
  spam: isSpam,
};
// A folder's conversations, latest activity first.
export const folderTickets = (s: GameState, ch: DeskChannel, f: Folder): Ticket[] =>
  s.tickets.filter((tk) => tk.channelId === ch.id && IN_FOLDER[f](tk)).sort((a, b) => b.updatedAt - a.updatedAt);

// The self-hosted FreeScoot: no customer side, so / is the login; agents work mailboxes and admins Manage.
export function FreeScootSite(p: DeskSiteProps) {
  const [agent, setAgent] = useSessionState("desk.agent", false);
  const h = p.game.desk?.hosting, version = h?.kind === "self" ? h.version : "1.8";
  const props: FsProps = { ...p, version, nav: (page, args) => p.go(p.host + deskPath("freescoot", page, args)) };
  const page = p.route.page as FsPage, cls = `fs ${Number(version.split(".")[1] ?? 0) >= 8 ? "fs-current" : "fs-classic"}`;
  const back = () => props.nav("login");
  if (page === "passwordEmail") return <div className={`${cls} fs-login`}><DeskForgot id="freescoot" onBack={back} /></div>;
  if (page === "passwordReset") return <div className={`${cls} fs-login`}><DeskReset id="freescoot" token={p.route.args.id ?? ""} onBack={back} /></div>;
  if (page === "login" || !agent) {
    return <div className={`${cls} fs-login`}><Login {...props} onLogin={() => { setAgent(true); if (page === "login") props.nav("dashboard"); }} /></div>;
  }
  return (
    <div className={cls}>
      <NavBar {...props} onLogout={() => { setAgent(false); props.nav("login"); }} />
      <div className="fs-body">{MANAGE.includes(page) ? <ManagePage {...props} /> : <MailboxPage {...props} />}</div>
      <footer className="fs-foot">{t("fs.footer", { version })}</footer>
    </div>
  );
}

// A desk installed into a web space checks the account its installer created; one from before keeps the filled-in form.
function Login({ game, nav, onLogin }: FsProps & { onLogin: () => void }) {
  const attempt = useStore((s) => s.attempt), [error, setError] = useState<string | null>(null), own = !!deskSpace(game);
  const submit = (form: HTMLFormElement) => {
    const d = new FormData(form), r = attempt(deskLogin, String(d.get("email") ?? ""), String(d.get("password") ?? ""));
    setError(r.ok ? null : t(r.error, r.params));
    if (r.ok) onLogin();
  };
  return (
    <form className="fs-signin" onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
      <FreeScootMark />
      <label><span>{t("fs.email")}</span><input name="email" type="email" defaultValue={own ? "" : `admin@${game.company.domain}`} autoComplete="off" /></label>
      {error && <p className="fs-error" role="alert">{error}</p>}
      <label><span>{t("fs.password")}</span><input name="password" type="password" defaultValue={own ? "" : "password"} autoComplete="off" /></label>
      <button type="submit" className="fs-btn primary">{t("fs.login")}</button>
      {own && <a className="fs-forgot" onClick={() => nav("passwordEmail")}>{t("desk-setup.freescoot.forgotLink")}</a>}
    </form>
  );
}

function NavBar(p: FsProps & { onLogout: () => void }) {
  const page = p.route.page as FsPage, first = channelsOf(p.game)[0];
  const item = (key: string, on: boolean, go: () => void) => <a className={on ? "active" : ""} onClick={go}>{t(key)}</a>;
  return (
    <header className="fs-bar">
      <a className="fs-brand" onClick={() => p.nav("dashboard")} aria-label={t("fs.nav.dashboard")}><FreeScootMark /></a>
      <nav>
        {item("fs.nav.dashboard", page === "dashboard", () => p.nav("dashboard"))}
        {first && item("fs.nav.mailbox", ["mailbox", "folder", "conversation"].includes(page), () => p.nav("mailbox", { id: mid(first) }))}
        {item("fs.nav.customers", page === "customers", () => p.nav("customers"))}
        {item("fs.nav.manage", MANAGE.includes(page), () => p.nav("mailboxes"))}
      </nav>
      <p className="fs-user">
        <a className={page === "search" ? "active" : ""} onClick={() => p.nav("search")}>{t("fs.nav.search")}</a>
        <a onClick={p.onLogout}>{t("fs.logout")}</a>
      </p>
    </header>
  );
}

export const Panel = ({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) => (
  <section className="fs-panel"><header><h1>{title}</h1>{actions}</header>{children}</section>
);
