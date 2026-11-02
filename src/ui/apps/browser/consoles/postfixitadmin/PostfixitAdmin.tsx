import { useState, type ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import type { GameState } from "../../../../../sim/50-state";
import { controlPlaneUp, type Cluster } from "../../../../../sim/60-infra/cluster";
import { mailChecks } from "../../../../../sim/80-business/readouts";
import { finishPanelSetup } from "../../../../../sim/90-actions/licence";
import { addDefaultAliases } from "../../../../../sim/90-actions/mail-server";
import { noAutofill } from "../../../../no-autofill";
import { usePageAct } from "../../pageAct";
import { aliasRows, address, CreateAlias, CreateMailbox, DeleteMailbox, EditMailbox, messagesOf, ownServer, quotaOf, rolesOf, ServerLines, usedMb, type OwnServer } from "../mail-admin/forms";
import { Actions, Facts, LoginForm, useSoftware, type PanelProps } from "../PanelBase";
import { checkLabel } from "../ServiceReadouts";
import { versionOf } from "../squirrelmeal/SquirrelMeal";
import "../mail-admin/mail-admin.css";
import "./postfixitadmin.css";

// docs/design/plans/webmail-server.md, 5.2: a PHP page of plain tables, 2.x until 2015 and the Bootstrap menu of 3.x after.
type View = "overview" | "virtual" | "addMailbox" | "addAlias" | "server" | `edit:${string}` | `delete:${string}`;

export function PostfixitAdmin(p: PanelProps) {
  const late = Number(versionOf(p.game, p.c).split(".")[0]) >= 3, look = `pfa ${late ? "pfa-late" : "pfa-early"}`;
  const logo = <h1 className="pfa-logo">{t("mailserver.pfa.title")}</h1>;
  if (p.c.setupPending) return <div className={look}>{logo}<Setup c={p.c} host={p.host} /></div>;
  if (!p.signedIn) return (
    <div className={look}>
      <LoginForm className="pfa-card" onLogin={p.login} button={t("mailserver.pfa.login")}>{logo}</LoginForm>
    </div>
  );
  return <Admin {...p} look={look} late={late} logo={logo} />;
}

// setup.php: the setup password first, then the superadmin account, both prefilled.
function Setup({ c, host }: { c: Cluster; host: string }) {
  const act = usePageAct(), [step, setStep] = useState(0), pass = "setup-" + c.id;
  if (step === 0) return (
    <form className="pfa-setup" onSubmit={(e) => { e.preventDefault(); setStep(1); }}>
      <h2>{t("mailserver.pfa.setupTitle")}</h2>
      <h3>{t("mailserver.pfa.setupGenerate")}</h3>
      <label>{t("mailserver.pfa.setupPassword")}<input type="password" defaultValue={pass} {...noAutofill} /></label>
      <label>{t("mailserver.pfa.setupAgain")}<input type="password" defaultValue={pass} {...noAutofill} /></label>
      <button type="submit">{t("mailserver.pfa.setupHash")}</button>
    </form>
  );
  return (
    <form className="pfa-setup" onSubmit={(e) => { e.preventDefault(); act(finishPanelSetup, c.id); }}>
      <h2>{t("mailserver.pfa.superTitle")}</h2>
      <label>{t("mailserver.pfa.setupPassword")}<input type="password" defaultValue={pass} {...noAutofill} /></label>
      <label>{t("mailserver.pfa.admin")}<input defaultValue={`admin@${host}`} {...noAutofill} /></label>
      <label>{t("mailserver.adm.password")}<input type="password" defaultValue="correcthorse" {...noAutofill} /></label>
      <label>{t("mailserver.adm.again")}<input type="password" defaultValue="correcthorse" {...noAutofill} /></label>
      <button type="submit">{t("mailserver.pfa.addAdmin")}</button>
    </form>
  );
}

function Admin(p: PanelProps & { look: string; late: boolean; logo: ReactNode }) {
  const [view, setView] = useState<View>("overview"), [msg, setMsg] = useState<string | null>(null), sw = useSoftware(p.game, p.c, p.f);
  const back = p.game.clusters.find((x) => x.id === p.c.backend), server = ownServer(p.game, back?.id ?? null);
  const go = (v: View) => { setMsg(null); setView(v); };
  const done = (m: string | null) => { setMsg(m); setView("virtual"); };
  const menu: [View, string][] = [["overview", t("mailserver.pfa.domainList")], ["virtual", t("mailserver.pfa.virtualList")], ["addMailbox", t("mailserver.pfa.addMailbox")],
    ["addAlias", t(p.late ? "mailserver.pfa.addForward" : "mailserver.pfa.addAlias")], ["server", t("mailserver.pfa.server")]];
  const box = (id: string) => server?.boxes.find((b) => b.id === id);
  const target = view.includes(":") ? box(view.split(":")[1]) : undefined;
  return (
    <div className={p.look}>
      {p.logo}
      <nav className="pfa-menu">
        {menu.map(([v, label]) => <a key={v} href={`#${v}`} aria-current={view === v ? "page" : undefined} onClick={(e) => { e.preventDefault(); go(v); }}>{label}</a>)}
        <a href="#out" onClick={(e) => { e.preventDefault(); p.logout(); }}>{t("mailserver.pfa.logout")}</a>
      </nav>
      {msg && <p className="pfa-msg">{msg}</p>}
      {!server || !back || !controlPlaneUp(p.game, back) ? <p className="adm-error">{t("mailserver.pfa.noDb")}</p> : <>
        {view === "overview" && <Domains game={p.game} server={server} />}
        {view === "virtual" && <Virtual game={p.game} server={server} go={go} />}
        {view === "addMailbox" && <CreateMailbox game={p.game} server={server} title={t("mailserver.pfa.createMailbox")} button={t("mailserver.pfa.addMailbox")} welcome done={done} />}
        {view === "addAlias" && <CreateAlias server={server} title={t(p.late ? "mailserver.pfa.createForward" : "mailserver.pfa.createAlias")} hint={t("mailserver.pfa.catchAllHint")} button={t(p.late ? "mailserver.pfa.addForward" : "mailserver.pfa.addAlias")} done={done} />}
        {view.startsWith("edit:") && target && <EditMailbox key={target.id} game={p.game} box={target} title={t("mailserver.pfa.editMailbox")} done={done} />}
        {view.startsWith("delete:") && target && <DeleteMailbox game={p.game} box={target} done={done} />}
        {view === "server" && <><ServerLines game={p.game} back={back} className="pfa-table" /><Facts facts={sw.facts} /><Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>{sw.panel}</>}
      </>}
      <footer>{t("mailserver.pfa.footer", { host: p.host })}</footer>
    </div>
  );
}

function Domains({ game, server }: { game: GameState; server: OwnServer }) {
  const act = usePageAct(), checks = mailChecks(game, server.domain), admin = game.mail.accounts.find((a) => a.id === game.mail.primary && a.tenant === server.tenant) ?? server.boxes[0];
  const aliases = server.boxes.reduce((n, b) => n + b.aliases.length, 0) + (server.catchAll ? 1 : 0);
  return (
    <>
      <h3>{t("mailserver.pfa.domains")}</h3>
      <table className="pfa-table">
        <thead><tr><th>{t("mailserver.pfa.domain")}</th><th>{t("mailserver.pfa.aliases")}</th><th>{t("mailserver.pfa.mailboxes")}</th><th>{t("mailserver.adm.quota")}</th>
          <th>{t("readouts.mail.spf")}</th><th>{t("readouts.mail.dkim")}</th><th>{t("readouts.mail.dmarc")}</th><th>{t("mailserver.pfa.active")}</th></tr></thead>
        <tbody><tr><td>{server.domain}</td><td className="num">{aliases}</td><td className="num">{server.boxes.length}</td><td className="num">{server.boxes[0] ? quotaOf(game, server.boxes[0]) : ""}</td>
          {(["spf", "dkim", "dmarc"] as const).map((k) => <td key={k}>{checkLabel(checks[k])}</td>)}<td>{t("mailserver.pfa.yes")}</td></tr></tbody>
      </table>
      {admin && <p><button onClick={() => act(addDefaultAliases, admin.id)}>{t("mailserver.pfa.defaultAliases")}</button></p>}
    </>
  );
}

function Virtual({ game, server, go }: { game: GameState; server: OwnServer; go: (v: View) => void }) {
  const act = usePageAct(), link = (label: string, v: View) => <a href={`#${v}`} onClick={(e) => { e.preventDefault(); go(v); }}>{label}</a>;
  return (
    <>
      <h3>{t("mailserver.pfa.aliases")}</h3>
      <table className="pfa-table">
        <thead><tr><th>{t("mailserver.adm.from")}</th><th>{t("mailserver.adm.to")}</th><th>{t("mailserver.pfa.active")}</th><th /></tr></thead>
        <tbody>{aliasRows(server).map((r) => <tr key={r.key}><td>{r.from}</td><td>{r.to}</td><td>{t("mailserver.pfa.yes")}</td>
          <td>{r.remove && <a href="#del" onClick={(e) => { e.preventDefault(); r.remove!(act); }}>{t("mailserver.pfa.del")}</a>}</td></tr>)}</tbody>
      </table>
      <h3>{t("mailserver.pfa.mailboxes")}</h3>
      <table className="pfa-table">
        <thead><tr><th>{t("mailserver.adm.email")}</th><th>{t("mailserver.adm.name")}</th><th>{t("mailserver.adm.quota")}</th><th>{t("mailserver.adm.used")}</th><th>{t("mailserver.adm.messages")}</th><th>{t("mailserver.adm.receives")}</th><th>{t("mailserver.pfa.active")}</th><th /><th /></tr></thead>
        <tbody>{server.boxes.map((b) => <tr key={b.id}><td>{address(b)}</td><td>{b.title}</td><td className="num">{quotaOf(game, b)}</td><td className="num">{usedMb(b)}</td><td className="num">{messagesOf(game, b)}</td>
          <td>{rolesOf(game, b)}</td><td>{t("mailserver.pfa.yes")}</td><td>{link(t("mailserver.pfa.edit"), `edit:${b.id}`)}</td><td>{link(t("mailserver.pfa.del"), `delete:${b.id}`)}</td></tr>)}</tbody>
      </table>
    </>
  );
}
