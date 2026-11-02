import { LogOut } from "lucide-react";
import { useState } from "react";
import type { GameState } from "../../../../../sim/50-state";
import { companyDomain } from "../../../../../sim/30-customers/domains";
import { Actions, Facts, LoginForm, useSoftware, type PanelProps } from "../PanelBase";
import { useReadoutPages } from "../Readouts";
import { checkLabel, checkTone } from "../ServiceReadouts";
import { mailChecks } from "../../../../../sim/80-business/readouts";
import { Blacklist, Relays } from "./Blacklist";
import { CustomerQuotas } from "./Quotas";
import { address, aliasRows, CreateAlias, CreateMailbox, DeleteMailbox, EditMailbox, messagesOf, ownServer, quotaOf, rolesOf, ServerLines, usedMb, type OwnServer } from "../mail-admin/forms";
import { usePageAct } from "../../pageAct";
import "../mail-admin/mail-admin.css";
import { MailQueue } from "./MailQueue";
import { t } from "../../../../../i18n/en";
import "./mailpig.css";

// docs/design/software.md, section 10: one look, the dark mail admin with a pink accent and tabs.
const TABS = ["Mailboxes", "Aliases", "Domains", "Queue", "Blacklist", "Configuration"] as const;
const TAB_LABELS: Record<(typeof TABS)[number], string> = { Mailboxes: t("browser-consoles-1.mpMailboxes"), Aliases: t("browser-consoles-1.mpAliases"), Domains: t("browser-consoles-1.mpDomains"), Queue: t("browser-consoles-1.mpQueue"), Blacklist: t("netsvc.blacklist"), Configuration: t("browser-consoles-1.mpConfiguration") };

export function Mailpig(p: PanelProps) {
  const [tab, setTab] = useState<string>("Mailboxes"), sw = useSoftware(p.game, p.c, p.f), pages = useReadoutPages(p.game, p.c, p.f);
  const logo = <span className="mp-logo">mail<b>pig</b></span>;
  if (!p.signedIn) return (
    <div className="cx mp mp-login">
      <LoginForm className="mp-card" onLogin={p.login} button={t("browser-consoles-1.login")}>{logo}<div className="cx-host">{p.host}</div></LoginForm>
    </div>
  );
  const server = ownServer(p.game, p.c.id), domain = server?.domain ?? companyDomain(p.game);
  return (
    <div className="cx mp">
      <header className="mp-top">{logo}<span className="cx-host">{p.host}</span><button className="mp-out" onClick={p.logout}><LogOut size={14} aria-hidden />{t("browser-consoles-1.logout")}</button></header>
      <main className="mp-main">
        <nav className="mp-tabs">{TABS.map((x) => <button key={x} aria-pressed={tab === x} onClick={() => setTab(x)}>{TAB_LABELS[x]}</button>)}{pages.map((g) => <button key={g.id} aria-pressed={tab === g.id} onClick={() => setTab(g.id)}>{g.label}</button>)}</nav>
        <section className="mp-pane">
          {tab === "Mailboxes" && <><CustomerQuotas game={p.game} clusterId={p.c.id} />{server && <Mailboxes game={p.game} server={server} />}</>}
          {tab === "Aliases" && server && <Aliases server={server} />}
          {tab === "Domains" && <table className="cx-table">
            <thead><tr><th>{t("browser-consoles-1.domain")}</th><th>{t("browser-consoles-1.mpMailboxes")}</th><th>{t("browser-consoles-1.mpAliases")}</th><th>{t("readouts.mail.spf")}</th><th>{t("readouts.mail.dkim")}</th><th>{t("readouts.mail.dmarc")}</th><th>{t("browser-consoles-1.mpActive")}</th></tr></thead>
            <tbody><tr><td><b>{domain}</b></td><td className="num">{server?.boxes.length ?? 0}</td><td className="num">{server ? aliasRows(server).length : 0}</td>{(["spf", "dkim", "dmarc"] as const).map((k) => { const v = mailChecks(p.game, domain)[k]; return <td key={k}><span className={`cx-state ${checkTone(v)}`}>{checkLabel(v)}</span></td>; })}<td><span className="cx-state ok">{t("browser-consoles-1.yes")}</span></td></tr></tbody>
          </table>}
          {tab === "Domains" && <Relays game={p.game} clusterId={p.c.id} />}
          {tab === "Queue" && <MailQueue game={p.game} clusterId={p.c.id} />}
          {pages.filter((g) => g.id === tab).map((g) => <div key={g.id}>{g.body}</div>)}
          {tab === "Blacklist" && <Blacklist game={p.game} clusterId={p.c.id} />}
          {tab === "Configuration" && <><ServerLines game={p.game} back={p.c} className="cx-table cx-facts" /><Facts facts={sw.facts} /><Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>{sw.panel}</>}
        </section>
      </main>
    </div>
  );
}

// Mailboxes on real accounts: Add mailbox, Edit with the password reset, and Delete with what it removes.
function Mailboxes({ game, server }: { game: GameState; server: OwnServer }) {
  const [form, setForm] = useState<string | null>(null), [msg, setMsg] = useState<string | null>(null);
  const done = (m: string | null) => { setMsg(m); setForm(null); };
  const box = server.boxes.find((b) => `edit:${b.id}` === form || `delete:${b.id}` === form);
  return (
    <>
      <div className="cx-tools"><button className="cx-btn primary" onClick={() => { setMsg(null); setForm("add"); }}>{t("mailserver.mp.addMailbox")}</button>{msg && <span className="cx-note">{msg}</span>}</div>
      {form === "add" && <CreateMailbox game={game} server={server} title={t("mailserver.mp.addMailbox")} button={t("mailserver.mp.add")} done={done} />}
      {box && form?.startsWith("edit:") && <EditMailbox key={box.id} game={game} box={box} title={address(box)} done={done} />}
      {box && form?.startsWith("delete:") && <DeleteMailbox game={game} box={box} done={done} />}
      <table className="cx-table">
        <thead><tr><th>{t("browser-consoles-1.mpUsername")}</th><th>{t("mailserver.adm.name")}</th><th>{t("browser-consoles-1.mpQuota")}</th><th>{t("mailserver.adm.used")}</th><th>{t("browser-consoles-1.mpMessages")}</th><th>{t("mailserver.adm.receives")}</th><th /></tr></thead>
        <tbody>{server.boxes.map((b) => <tr key={b.id}><td><b>{address(b)}</b></td><td>{b.title}</td><td className="num">{quotaOf(game, b)}</td><td className="num">{usedMb(b)}</td><td className="num">{messagesOf(game, b)}</td><td>{rolesOf(game, b)}</td>
          <td><button className="cx-btn" onClick={() => { setMsg(null); setForm(`edit:${b.id}`); }}>{t("mailserver.mp.edit")}</button> <button className="cx-btn danger" onClick={() => { setMsg(null); setForm(`delete:${b.id}`); }}>{t("mailserver.mp.remove")}</button></td></tr>)}</tbody>
      </table>
    </>
  );
}

// Aliases: address and where it goes; @domain is the catch-all.
function Aliases({ server }: { server: OwnServer }) {
  const act = usePageAct(), [adding, setAdding] = useState(false), [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <div className="cx-tools"><button className="cx-btn primary" onClick={() => { setMsg(null); setAdding(true); }}>{t("mailserver.mp.addAlias")}</button>{msg && <span className="cx-note">{msg}</span>}</div>
      {adding && <CreateAlias server={server} title={t("mailserver.mp.addAlias")} hint={t("mailserver.mp.catchAllHint", { domain: server.domain })} button={t("mailserver.mp.add")} done={(m) => { setMsg(m); setAdding(false); }} />}
      <table className="cx-table">
        <thead><tr><th>{t("mailserver.mp.alias")}</th><th>{t("mailserver.mp.goto")}</th><th /></tr></thead>
        <tbody>{aliasRows(server).map((r) => <tr key={r.key}><td><b>{r.from.startsWith("*@") ? r.from.slice(1) : r.from}</b></td><td>{r.to}</td><td>{r.remove && <button className="cx-btn danger" onClick={() => r.remove!(act)}>{t("mailserver.mp.remove")}</button>}</td></tr>)}</tbody>
      </table>
    </>
  );
}
