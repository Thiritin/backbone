import { useState } from "react";
import { dateOf, yearOf } from "../../../../../sim/00-core/time";
import { phpAt } from "../../../../../sim/10-catalog/platforms";
import { foldersOf, listFolder, unread, view } from "../../../../../sim/42-mail/model";
import type { GameState } from "../../../../../sim/50-state";
import { controlPlaneUp, type Cluster } from "../../../../../sim/60-infra/cluster";
import { installedVersion, panelMachine } from "../../../../../sim/60-infra/licence";
import { familyOf } from "../../../../../sim/60-infra/vulns";
import { imapUp, mailClusterAt, webmailOf, webmailSignIn } from "../../../../../sim/80-business/webmail";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { useSessionState } from "../../../../session";
import { offerLogin, savedLogin } from "../../../../vault";
import type { PanelProps } from "../PanelBase";
import { SetupMenu } from "./SetupMenu";
import "./squirrelmeal.css";

// docs/design/plans/webmail-server.md, section 3: plain HTML in two frames, no scripts.
export const versionOf = (game: GameState, c: Cluster): string => installedVersion(game, panelMachine(c) ?? "", familyOf(c) ?? "") ?? "";

const Logo = () => <div className="smw-logo"><span>Squirrel</span>Meal</div>;

export function SquirrelMeal(p: PanelProps) {
  const sub = (p.path ?? "/").replace(/^\/squirrelmeal/, "") || "/";
  const [account, setAccount] = useSessionState<string | null>(`webmail.${p.c.id}`, null);
  if (p.c.setupPending) return <SetupMenu game={p.game} c={p.c} />;
  if (sub.includes("configtest.php")) return <ConfigTest game={p.game} c={p.c} host={p.host} />;
  if (account && p.game.mail.accounts.some((a) => a.id === account)) return <Frames game={p.game} account={account} out={() => setAccount(null)} />;
  return <Login game={p.game} c={p.c} host={p.host} signIn={setAccount} />;
}

function Login({ game, c, host, signIn }: { game: GameState; c: Cluster; host: string; signIn: (account: string) => void }) {
  const addresses = game.mail.accounts.filter((a) => game.mail.tenants.some((x) => x.id === a.tenant && x.clusterId === c.backend)).map((a) => `${a.local}@${a.domain}`);
  const site = addresses.map((a) => `mail:${a}`).find((k) => game.logins[k]) ?? "mail:";
  const [saved] = useState(() => savedLogin(game, site, 2));
  const [name, setName] = useState(saved[0]), [pass, setPass] = useState(saved[1]), [error, setError] = useState<string | null>(null);
  const cfg = webmailOf(game, c);
  const submit = () => {
    const r = webmailSignIn(game, c, name, pass);
    if (!r.ok) return setError(r.error === "refused" ? t("mailserver.login.refused", { host: cfg.imapHost }) : t("mailserver.login.bad"));
    const a = game.mail.accounts.find((x) => x.id === r.account)!;
    offerLogin(game, `mail:${a.local}@${a.domain}`, host, [name, pass]);
    signIn(r.account);
  };
  if (error) return (
    <div className="smw smw-error">
      <table><tbody><tr><th>{t("mailserver.login.error")}</th></tr><tr><td>{error.split("\n").map((l) => <p key={l}>{l}</p>)}<a href="#login" onClick={(e) => { e.preventDefault(); setError(null); }}>{t("mailserver.login.back")}</a></td></tr></tbody></table>
    </div>
  );
  return (
    <div className="smw smw-login">
      <Logo />
      <p className="smw-ver">{t("mailserver.login.version", { version: versionOf(game, c) })}<br />{t("mailserver.login.team")}</p>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <table>
          <tbody>
            <tr><th colSpan={2}>{t("mailserver.login.title", { org: cfg.productName })}</th></tr>
            <tr><td className="r">{t("mailserver.login.name")}</td><td><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></td></tr>
            <tr><td className="r">{t("mailserver.login.password")}</td><td><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" /></td></tr>
            <tr><td colSpan={2} className="c"><button type="submit">{t("mailserver.login.button")}</button></td></tr>
          </tbody>
        </table>
      </form>
    </div>
  );
}

function Frames({ game, account, out }: { game: GameState; account: string; out: () => void }) {
  const [folder, setFolder] = useState("inbox");
  const folders = foldersOf(game, account), msgs = listFolder(game, account, folder), name = folders.find((f) => f.id === folder)?.name ?? "";
  const time = (min: number) => dateOf(Math.floor(min / 60)).toLocaleString(LOCALE, { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });
  const a = game.mail.accounts.find((x) => x.id === account)!;
  return (
    <div className="smw smw-frames">
      <nav className="smw-left">
        <b>{t("mailserver.frame.folders")}</b>
        <small>{t("mailserver.frame.refreshed", { time: time(game.hour * 60) })}</small>
        <ul>{folders.map((f) => { const n = unread(game, account, f.id); return <li key={f.id}><a href={`#${f.id}`} onClick={(e) => { e.preventDefault(); setFolder(f.id); }}>{n ? <b>{`${f.name} (${n})`}</b> : f.name}</a></li>; })}</ul>
      </nav>
      <main className="smw-right">
        <div className="smw-bar"><span>{t("mailserver.frame.current", { folder: name })}</span><a href="#out" onClick={(e) => { e.preventDefault(); out(); }}>{t("mailserver.frame.signOut")}</a></div>
        <div className="smw-who">{`${a.local}@${a.domain}`}</div>
        <div className="smw-bar">{t("mailserver.frame.viewing", { from: msgs.length ? 1 : 0, to: Math.min(15, msgs.length), total: msgs.length })}</div>
        <table className="smw-list">
          <thead><tr><th>{t("mailserver.frame.from")}</th><th>{t("mailserver.frame.date")}</th><th>{t("mailserver.frame.subject")}</th></tr></thead>
          <tbody>{msgs.slice(0, 15).map((m) => { const v = view(game, m); return <tr key={m.id} className={m.read ? "" : "unseen"}><td>{v.fromName || v.fromAddress}</td><td>{time(m.at)}</td><td>{v.subject}</td></tr>; })}</tbody>
        </table>
      </main>
    </div>
  );
}

// src/configtest.php: what the front end checks before anyone signs in.
function ConfigTest({ game, c, host }: { game: GameState; c: Cluster; host: string }) {
  const cfg = webmailOf(game, c), imap = imapUp(game, c);
  const smtp = mailClusterAt(game, c, cfg.smtpHost), smtpOk = !!smtp && [25, 587].includes(cfg.smtpPort) && controlPlaneUp(game, smtp);
  const lines: [string, boolean][] = [
    [t("mailserver.test.version", { version: versionOf(game, c) }), true],
    [t("mailserver.test.php", { version: phpAt(yearOf(game.hour)) }), true],
    [t("mailserver.test.paths"), true],
    [t("mailserver.test.baseUrl", { url: `https://${host}/squirrelmeal/src` }), true],
    [smtpOk ? t("mailserver.test.smtpOk", { host: cfg.smtpHost }) : t("mailserver.test.smtpFail", { host: cfg.smtpHost, port: cfg.smtpPort }), smtpOk],
    [imap ? t("mailserver.test.imapOk") : t("mailserver.test.imapFail", { host: cfg.imapHost, port: cfg.imapPort }), imap],
  ];
  return (
    <div className="smw smw-test">
      <h1>{t("mailserver.test.title")}</h1>
      <ul>{lines.map(([l, ok]) => <li key={l} className={ok ? "" : "fail"}>{l}</li>)}</ul>
      {imap && smtpOk && <p><b>{t("mailserver.test.fine")}</b></p>}
    </div>
  );
}
