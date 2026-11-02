import { useState, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { yearOf } from "../../../../../../sim/00-core/time";
import { mailServersOf } from "../../../../../../sim/10-catalog/mail-providers";
import { deskById } from "../../../../../../sim/10-catalog/desks";
import { channelsOf } from "../../../../../../sim/40-support/desk-channels";
import type { DeskChannel } from "../../../../../../sim/42-mail/types";
import type { GameState } from "../../../../../../sim/50-state";
import { addDeskChannel, removeDeskChannel, setDeskChannel, testDeskChannel } from "../../../../../../sim/90-actions/desk";
import { useStore } from "../../../../../store";
import { accountOf, emailOf, mailboxOf, mid, nameOf, Panel, when, type FsPage, type FsProps } from "./FreeScootSite";

export function ManagePage(p: FsProps) {
  const page = p.route.page as FsPage;
  const box = (body: ReactNode) => <MailboxSettings {...p}>{body}</MailboxSettings>;
  let body;
  if (page === "mailboxSettings") body = box(<EditMailbox {...p} />);
  else if (page === "connection") body = box(<Connection {...p} />);
  else if (page === "autoReply") body = box(<AutoReply {...p} />);
  else if (page === "permissions") body = box(<Permissions {...p} />);
  else if (page === "users") body = <Users {...p} />;
  else if (page === "modules") body = <Modules />;
  else if (page === "logs") body = <Logs {...p} />;
  else if (page === "system") body = <System {...p} />;
  else if (page === "settings") body = <Settings {...p} />;
  else body = <Mailboxes {...p} />;
  return <><ManageNav {...p} />{body}</>;
}

// The Manage menu: each entry, its page and the pages it stays lit on.
const MENU: [string, FsPage, FsPage[]][] = [
  ["fs.manage.settings", "settings", []],
  ["fs.manage.mailboxes", "mailboxes", ["mailboxSettings", "connection", "autoReply", "permissions"]],
  ["fs.manage.users", "users", []],
  ["fs.manage.modules", "modules", []],
  ["fs.manage.logs", "logs", []],
  ["fs.manage.system", "system", []],
];
function ManageNav({ route, nav }: FsProps) {
  const page = route.page as FsPage;
  const args = (target: FsPage) => (target === "settings" ? { section: "general" } : target === "logs" ? { log: "fetch" } : {});
  return <nav className="fs-sub">{MENU.map(([key, target, also]) => <a key={key} className={target === page || also.includes(page) ? "active" : ""} onClick={() => nav(target, args(target))}>{t(key)}</a>)}</nav>;
}

function Settings({ game, host }: FsProps) {
  const rows: [string, string][] = [["fs.settings.company", game.company.name], ["fs.settings.url", `http://${host}/`], ["fs.settings.timezone", "UTC"]];
  return <Panel title={t("fs.settings.general")}><Info rows={rows} /></Panel>;
}

const Info = ({ rows }: { rows: [string, ReactNode][] }) => (
  <table className="fs-info"><tbody>{rows.map(([k, v]) => <tr key={k}><th>{t(k)}</th><td>{v}</td></tr>)}</tbody></table>
);

const fetchStatus = (ch: DeskChannel) => (ch.error ? <span className="fs-error">{t(ch.error)}</span> : t("fs.active"));

function Mailboxes({ game, nav }: FsProps) {
  const act = useStore((s) => s.act), boxes = channelsOf(game);
  const free = game.mail.accounts.filter((a) => a.closedAt === null && !game.mail.channels.some((c) => c.accountId === a.id));
  const [pick, setPick] = useState(""), [error, setError] = useState<string | null>(null);
  return (
    <Panel title={t("fs.manage.mailboxes")}>
      <table className="fs-table">
        <thead><tr><th>{t("fs.col.name")}</th><th>{t("fs.email")}</th><th>{t("fs.fetching")}</th></tr></thead>
        <tbody>{boxes.map((ch) => (
          <tr key={ch.id} onClick={() => nav("mailboxSettings", { id: mid(ch) })}><td><a>{nameOf(game, ch)}</a></td><td>{emailOf(game, ch)}</td><td>{fetchStatus(ch)}</td></tr>
        ))}</tbody>
      </table>
      <form className="fs-form" onSubmit={(e) => { e.preventDefault(); const r = act(addDeskChannel, pick); setError(r.ok ? null : r.error ?? null); if (r.ok) { setPick(""); nav("connection", { id: r.id!.replace(/^ch/, ""), section: "incoming" }); } }}>
        <h2>{t("fs.newMailbox")}</h2>
        <label><span>{t("fs.email")}</span>
          <select aria-label={t("fs.newMailbox")} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="" />
            {free.map((a) => <option key={a.id} value={a.id}>{`${a.local}@${a.domain}`}</option>)}
          </select>
        </label>
        <p><button className="fs-btn primary" disabled={!pick}>{t("fs.createMailbox")}</button></p>
        {error && <p className="fs-error">{t(error)}</p>}
      </form>
    </Panel>
  );
}

// A mailbox's settings: the left menu and the screen it picks.
function MailboxSettings(p: FsProps & { children: ReactNode }) {
  const { game, route, nav } = p, ch = mailboxOf(game, route.args.id);
  if (!ch) return <Panel title={t("fs.mailboxSettings")}><p className="fs-error">{t("fs.noMailbox")}</p></Panel>;
  const id = mid(ch), page = route.page as FsPage;
  const items: [string, FsPage, Record<string, string>][] = [
    ["fs.editMailbox", "mailboxSettings", { id }], ["fs.connection", "connection", { id, section: "incoming" }],
    ["fs.permissions", "permissions", { id }], ["fs.autoReply", "autoReply", { id }],
  ];
  return (
    <div className="fs-settings">
      <aside className="fs-side">
        <h3>{nameOf(game, ch)}</h3>
        <ul>{items.map(([key, target, args]) => <li key={key} className={target === page ? "active" : ""}><a onClick={() => nav(target, args)}>{t(key)}</a></li>)}</ul>
      </aside>
      <div className="fs-settings-body">{p.children}</div>
    </div>
  );
}

function EditMailbox({ game, route, nav }: FsProps) {
  const act = useStore((s) => s.act), ch = mailboxOf(game, route.args.id)!;
  return (
    <Panel title={t("fs.editMailbox")}>
      <Info rows={[["fs.mailboxName", nameOf(game, ch)], ["fs.email", emailOf(game, ch)]]} />
      <p><button type="button" className="fs-btn danger" onClick={() => { if (act(removeDeskChannel, ch.id).ok) nav("mailboxes"); }}>{t("fs.deleteMailbox")}</button></p>
    </Panel>
  );
}

const INTERVALS = [1, 2, 4, 6, 12, 24];

function Connection({ game, route, nav }: FsProps) {
  const act = useStore((s) => s.act), ch = mailboxOf(game, route.args.id)!, id = mid(ch);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const a = accountOf(game, ch), tenant = a && game.mail.tenants.find((x) => x.id === a.tenant);
  const servers = tenant ? mailServersOf(tenant.host, tenant.domain, yearOf(game.hour)) : null;
  const outgoing = route.args.section === "outgoing", server = servers?.[outgoing ? "smtp" : ch.mode === "pop" ? "pop" : "imap"];
  const set = (patch: Partial<DeskChannel>) => { const r = act(setDeskChannel, ch.id, patch); setResult(r.ok ? null : { ok: false, text: t(r.error ?? "") }); };
  const tabs = (
    <nav className="fs-tabs">
      <a className={outgoing ? "active" : ""} onClick={() => nav("connection", { id, section: "outgoing" })}>{t("fs.sending")}</a>
      <a className={outgoing ? "" : "active"} onClick={() => nav("connection", { id, section: "incoming" })}>{t("fs.fetchingEmails")}</a>
    </nav>
  );
  const serverRows: [string, ReactNode][] = [["fs.server", server?.host ?? ""], ["fs.port", server ? String(server.port) : ""], ["fs.username", emailOf(game, ch)], ["fs.encryption", server?.ssl ? "SSL" : t("fs.none")]];
  if (outgoing) return <Panel title={t("fs.connection")}>{tabs}<Info rows={[["fs.sendMethod", "SMTP"], ...serverRows]} /></Panel>;
  return (
    <Panel title={t("fs.connection")}>
      {tabs}
      <Info rows={serverRows} />
      <div className="fs-form">
        <label><span>{t("fs.protocol")}</span>
          <select aria-label={t("fs.protocol")} value={ch.mode} onChange={(e) => set({ mode: e.target.value as DeskChannel["mode"], after: "keep" })}>
            {(["imap", "pop"] as const).map((m) => <option key={m} value={m}>{t(`fs.protocol.${m}`)}</option>)}
          </select>
        </label>
        <label><span>{t("fs.interval")}</span>
          <select aria-label={t("fs.interval")} value={ch.every} onChange={(e) => set({ every: Number(e.target.value) })}>
            {INTERVALS.map((h) => <option key={h} value={h}>{(h * 60).toLocaleString(LOCALE)}</option>)}
          </select>
        </label>
        <label><span>{t("fs.fetching")}</span><b>{fetchStatus(ch)}</b></label>
        <p><button type="button" className="fs-btn" onClick={() => { const r = act(testDeskChannel, ch.id); setResult(r.ok ? { ok: true, text: t("fs.fetched", { n: Number(r.id) }) } : { ok: false, text: t(r.error ?? "") }); }}>{t("fs.checkConnection")}</button></p>
        {result && <p className={result.ok ? "fs-ok" : "fs-error"}>{result.text}</p>}
      </div>
    </Panel>
  );
}

function AutoReply({ game, route }: FsProps) {
  const act = useStore((s) => s.act), ch = mailboxOf(game, route.args.id)!;
  return (
    <Panel title={t("fs.autoReply")}>
      <label className="fs-check"><input type="checkbox" checked={ch.autoReply} onChange={(e) => act(setDeskChannel, ch.id, { autoReply: e.target.checked })} /> {t("fs.enableAutoReply")}</label>
    </Panel>
  );
}

// Every user works every mailbox; administrators are listed with them.
function Permissions({ game }: FsProps) {
  return (
    <Panel title={t("fs.permissions")}>
      <h3>{t("fs.withAccess")}</h3>
      <ul className="fs-users">{users(game).map((u) => <li key={u.email}><b>{u.name}</b> <span className="fs-muted">{t(`fs.role.${u.role}`)}</span></li>)}</ul>
    </Panel>
  );
}

const users = (s: GameState) => [
  { name: t("support.you"), email: `admin@${s.company.domain}`, role: "admin" },
  ...s.staff.filter((e) => e.role === "support").map((e) => ({ name: e.name, email: `${e.name.split(" ")[0].toLowerCase()}@${s.company.domain}`, role: "user" })),
];

function Users({ game }: FsProps) {
  return (
    <Panel title={t("fs.manage.users")}>
      <table className="fs-table">
        <thead><tr><th>{t("fs.col.name")}</th><th>{t("fs.email")}</th><th>{t("fs.role")}</th><th>{t("fs.col.status")}</th></tr></thead>
        <tbody>{users(game).map((u) => <tr key={u.email}><td>{u.name}</td><td>{u.email}</td><td>{t(`fs.role.${u.role}`)}</td><td>{t("fs.active")}</td></tr>)}</tbody>
      </table>
    </Panel>
  );
}

// The paid modules of the real product; none is on sale in the game yet.
export const MODULES = ["savedReplies", "reports", "workflows", "satisfaction", "chat", "portal", "kb"] as const;

function Modules() {
  return (
    <Panel title={t("fs.manage.modules")}>
      <h2>{t("fs.modules.installed")}</h2>
      <p className="fs-muted">{t("fs.none")}</p>
      <h2>{t("fs.modules.directory")}</h2>
      <div className="fs-cards">
        {MODULES.map((m) => (
          <article key={m} className="fs-card">
            <h3>{t(`fs.module.${m}`)}</h3>
            <p>{t(`fs.module.${m}.text`)}</p>
            <p className="fs-muted">{t("fs.modules.notInstalled")}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}

export interface FetchEntry { hour: number; ch: DeskChannel; n: number; error: string | null }

// The fetches the schedule ran, newest first: each IMAP or POP3 mailbox at every interval since it was added, with the
// conversations that came in since the fetch before. The last fetch carries the mailbox's current error.
export function fetchLog(s: GameState, limit = 30): FetchEntry[] {
  const rows: FetchEntry[] = [];
  for (const ch of channelsOf(s)) {
    if (ch.mode === "forward") continue;
    const every = Math.max(1, ch.every), mine = s.tickets.filter((tk) => tk.channelId === ch.id && tk.via === "email");
    for (let h = s.hour - (s.hour % every), i = 0; h >= ch.since && i < limit; h -= every, i++) {
      const from = h - every < ch.since ? -Infinity : h - every;
      rows.push({ hour: h, ch, n: mine.filter((tk) => tk.createdAt > from && tk.createdAt <= h).length, error: i === 0 ? ch.error : null });
    }
  }
  return rows.sort((a, b) => b.hour - a.hour).slice(0, limit);
}

function Logs({ game }: FsProps) {
  const rows = fetchLog(game);
  return (
    <Panel title={t("fs.manage.logs")}>
      <h2>{t("fs.fetchingEmails")}</h2>
      <table className="fs-table">
        <thead><tr><th>{t("fs.col.date")}</th><th>{t("fs.nav.mailbox")}</th><th>{t("fs.col.message")}</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={`${r.ch.id}-${r.hour}`}><td>{when(r.hour)}</td><td>{emailOf(game, r.ch)}</td><td>{r.error ? <span className="fs-error">{t(r.error)}</span> : t("fs.fetched", { n: r.n })}</td></tr>
        ))}</tbody>
      </table>
      {!rows.length && <p className="fs-muted">{t("fs.logEmpty")}</p>}
    </Panel>
  );
}

function System({ game, version }: FsProps) {
  const year = yearOf(game.hour), latest = [...(deskById("freescoot")?.releases ?? [])].reverse().find((r) => r.year <= year)?.version ?? version;
  const last = fetchLog(game, 1)[0];
  return (
    <Panel title={t("fs.manage.system")}>
      <Info rows={[["fs.system.version", version], ["fs.system.latest", latest], ["fs.system.jobs", last ? t("fs.system.lastRun", { time: when(last.hour) }) : ""]]} />
      <p className={latest === version ? "fs-ok" : "fs-muted"}>{t(latest === version ? "fs.system.upToDate" : "fs.system.updates")}</p>
    </Panel>
  );
}
