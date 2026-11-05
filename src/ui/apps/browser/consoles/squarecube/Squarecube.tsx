import { useState, type ReactNode } from "react";
import { yearOf } from "../../../../../sim/00-core/time";
import { phpAt } from "../../../../../sim/10-catalog/platforms";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { imapUp, mailClusterAt, webmailOf, webmailSignIn, SQUARECUBE_DSN } from "../../../../../sim/80-business/webmail";
import { configureWebmail, disableWebmailInstaller } from "../../../../../sim/90-actions/mail-server";
import { t } from "../../../../../i18n/en";
import { useSessionState } from "../../../../session";
import { useStore } from "../../../../store";
import { offerLogin, savedLogin } from "../../../../vault";
import type { PanelProps } from "../PanelBase";
import { versionOf } from "../squirrelmeal/SquirrelMeal";
import { Compose, Mailbox, type Draft } from "./Mail";
import { AddressBook, Settings } from "./Settings";
import "./squarecube.css";

// docs/design/plans/webmail-server.md, section 4: Squarecube in the Classic skin of 0.1 to 0.7.
const Logo = () => <div className="scw-logo"><span className="scw-cube" aria-hidden="true" /><b>Square</b>cube<small>Webmail</small></div>;

export function Squarecube(p: PanelProps) {
  const sub = (p.path ?? "/").replace(/^\/squarecube/, "") || "/";
  const [account, setAccount] = useSessionState<string | null>(`webmail.${p.c.id}`, null);
  if (/^\/installer(\/|$)/.test(sub)) return <Installer game={p.game} c={p.c} />;
  if (p.c.setupPending) return <div className="scw scw-error"><h3>{t("mailserver.sc.unavailable")}</h3><p>{t("mailserver.sc.noConfig")}</p></div>;
  if (account && p.game.mail.accounts.some((a) => a.id === account)) return <Shell game={p.game} c={p.c} account={account} out={() => setAccount(null)} />;
  return <Login game={p.game} c={p.c} host={p.host} signIn={setAccount} />;
}

const Check = ({ label, ok }: { label: ReactNode; ok: boolean }) => (
  <li>{label}: <span className={ok ? "ok" : "fail"}>{t(ok ? "mailserver.sc.ok" : "mailserver.sc.notOk")}</span></li>
);

// The installer wizard: the environment check, the config form and the config test with the last step.
function Installer({ game, c }: { game: GameState; c: Cluster }) {
  const act = useStore((x) => x.act), cfg = webmailOf(game, c);
  const [step, setStep] = useSessionState(`inst.sc.${c.id}.step`, c.setupPending ? 1 : 3), [saved, setSaved] = useSessionState(`inst.sc.${c.id}.saved`, false);
  const [form, setForm] = useSessionState(`inst.sc.${c.id}.form`, { productName: cfg.productName, dsn: cfg.conf.db_dsnw ?? SQUARECUBE_DSN, imapHost: cfg.imapHost, imapPort: String(cfg.imapPort), smtpHost: cfg.smtpHost, smtpPort: String(cfg.smtpPort) });
  if (!cfg.installerOpen) return <div className="scw scw-installer"><h1>{t("mailserver.sc.installer")}</h1><p className="fail">{t("mailserver.sc.disabled")}</p></div>;
  const field = (label: string, key: keyof typeof form) => (
    <tr><th><label htmlFor={`sc-${key}`}>{label}</label></th><td><input id={`sc-${key}`} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></td></tr>
  );
  const create = () => {
    const r = act(configureWebmail, c.id, {
      productName: form.productName.trim() || cfg.productName, imapHost: form.imapHost, imapPort: Number(form.imapPort), smtpHost: form.smtpHost,
      smtpPort: Number(form.smtpPort), conf: { ...cfg.conf, db_dsnw: form.dsn.trim() },
    });
    setSaved(r.ok);
  };
  return (
    <div className="scw scw-installer">
      <h1>{t("mailserver.sc.installer")}</h1>
      <ol className="steps">{[1, 2, 3].map((n) => <li key={n} className={n === step ? "on" : ""}>{t(`mailserver.sc.step${n}`)}</li>)}</ol>
      {step === 1 && (
        <>
          <h3>{t("mailserver.sc.checkPhp")}</h3><ul><Check label={`PHP ${phpAt(yearOf(game.hour))}`} ok /></ul>
          <h3>{t("mailserver.sc.checkExt")}</h3><ul>{["PCRE", "Session", "Sockets", "IMAP"].map((x) => <Check key={x} label={x} ok />)}</ul>
          <h3>{t("mailserver.sc.checkDb")}</h3><ul><Check label="MySQL" ok /></ul>
          <button onClick={() => setStep(2)}>{t("mailserver.sc.next")}</button>
        </>
      )}
      {step === 2 && (
        <form onSubmit={(e) => { e.preventDefault(); create(); }}>
          <fieldset><legend>{t("mailserver.sc.general")}</legend><table><tbody>{field("product_name", "productName")}</tbody></table></fieldset>
          <fieldset><legend>{t("mailserver.sc.database")}</legend><table><tbody>{field("db_dsnw", "dsn")}</tbody></table></fieldset>
          <fieldset><legend>{t("mailserver.sc.imap")}</legend><table><tbody>{field("default_host", "imapHost")}{field("default_port", "imapPort")}</tbody></table></fieldset>
          <fieldset><legend>{t("mailserver.sc.smtp")}</legend><table><tbody>{field("smtp_server", "smtpHost")}{field("smtp_port", "smtpPort")}</tbody></table></fieldset>
          {saved ? <><p className="ok">{t("mailserver.sc.created")}</p><button type="button" onClick={() => setStep(3)}>{t("mailserver.sc.continue")}</button></> : <button type="submit">{t("mailserver.sc.create")}</button>}
        </form>
      )}
      {step === 3 && (
        <>
          <h3>{t("mailserver.sc.checkConfig")}</h3><ul><Check label="main.inc.php" ok={!c.setupPending} /><Check label="db.inc.php" ok={!c.setupPending} /></ul>
          <h3>{t("mailserver.sc.checkDsn")}</h3><ul><Check label="DSN (write)" ok={!!cfg.conf.db_dsnw} /></ul>
          <h3>{t("mailserver.sc.testSmtp")}</h3><ul><Check label={`${cfg.smtpHost}:${cfg.smtpPort}`} ok={!!mailClusterAt(game, c, cfg.smtpHost)} /></ul>
          <h3>{t("mailserver.sc.testImap")}</h3><ul><Check label={`${cfg.imapHost}:${cfg.imapPort}`} ok={imapUp(game, c)} /></ul>
          <button onClick={() => setStep(2)}>{t("mailserver.sc.step2")}</button>{" "}
          <button disabled={c.setupPending} onClick={() => act(disableWebmailInstaller, c.id)}>{t("mailserver.sc.disable")}</button>
        </>
      )}
    </div>
  );
}

function Login({ game, c, host, signIn }: { game: GameState; c: Cluster; host: string; signIn: (account: string) => void }) {
  const addresses = game.mail.accounts.filter((a) => game.mail.tenants.some((x) => x.id === a.tenant && x.clusterId === c.backend)).map((a) => `${a.local}@${a.domain}`);
  const site = addresses.map((a) => `mail:${a}`).find((k) => game.logins[k]) ?? "mail:";
  const [saved] = useState(() => savedLogin(game, site, 2));
  const [name, setName] = useState(saved[0]), [pass, setPass] = useState(saved[1]), [error, setError] = useState<string | null>(null);
  const product = webmailOf(game, c).productName;
  const submit = () => {
    const r = webmailSignIn(game, c, name, pass);
    if (!r.ok) return setError(t(r.error === "refused" ? "mailserver.sc.storageFailed" : "mailserver.sc.loginFailed"));
    const a = game.mail.accounts.find((x) => x.id === r.account)!;
    offerLogin(game, `mail:${a.local}@${a.domain}`, host, [name, pass]);
    signIn(r.account);
  };
  return (
    <div className="scw scw-login">
      <Logo />
      {error && <div className="scw-message" role="alert">{error}</div>}
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <h2>{t("mailserver.sc.welcome", { product })}</h2>
        <table>
          <tbody>
            <tr><th><label htmlFor="sc-user">{t("mailserver.sc.username")}</label></th><td><input id="sc-user" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></td></tr>
            <tr><th><label htmlFor="sc-pass">{t("mailserver.sc.password")}</label></th><td><input id="sc-pass" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" /></td></tr>
          </tbody>
        </table>
        <p><button type="submit">{t("mailserver.sc.login")}</button></p>
      </form>
    </div>
  );
}

type Task = "mail" | "abook" | "settings";

// The Classic frame: the logo and the task bar over the mailbox, the address book or the settings.
function Shell({ game, c, account, out }: { game: GameState; c: Cluster; account: string; out: () => void }) {
  const [task, setTask] = useState<Task>("mail"), [draft, setDraft] = useState<Partial<Draft> | null>(null);
  const ctx = { game, c, account, version: versionOf(game, c) };
  const compose = (d: Partial<Draft>) => { setDraft(d); setTask("mail"); };
  const go = (x: Task) => { if (!draft || window.confirm(t("mailserver.sc.notSent"))) { setDraft(null); setTask(x); } };
  return (
    <div className="scw scw-shell">
      <header>
        <Logo />
        <nav>
          {(["mail", "abook", "settings"] as const).map((x) => (
            <a key={x} href={`#${x}`} aria-current={x === task ? "page" : undefined} onClick={(e) => { e.preventDefault(); go(x); }}>{t(`mailserver.sc.${x}`)}</a>
          ))}
          <a href="#logout" onClick={(e) => { e.preventDefault(); out(); }}>{t("mailserver.sc.logout")}</a>
        </nav>
      </header>
      {task === "mail" && (draft ? <Compose key={JSON.stringify(draft)} ctx={ctx} initial={draft} close={() => setDraft(null)} /> : <Mailbox ctx={ctx} compose={compose} />)}
      {task === "abook" && <AddressBook ctx={ctx} compose={compose} />}
      {task === "settings" && <Settings ctx={ctx} />}
    </div>
  );
}
