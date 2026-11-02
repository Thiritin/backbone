import { useEffect, useState, type ReactNode } from "react";
import { yearOf } from "../../../../../sim/00-core/time";
import { phpAt } from "../../../../../sim/10-catalog/platforms";
import { foldersOf, listFolder, unread } from "../../../../../sim/42-mail/model";
import type { GameState } from "../../../../../sim/50-state";
import { controlPlaneUp, type Cluster } from "../../../../../sim/60-infra/cluster";
import { installedVersion, panelMachine } from "../../../../../sim/60-infra/licence";
import { familyOf } from "../../../../../sim/60-infra/vulns";
import { confValue, imapUp, mailClusterAt, subscribed, webmailOf, webmailPref, webmailSignIn, webmailUser } from "../../../../../sim/80-business/webmail";
import { runLocalFilters } from "../../../../../sim/90-actions/webmail";
import { emptyFolder } from "../../../../../sim/90-actions/mailmsg";
import { t } from "../../../../../i18n/en";
import { useSessionState } from "../../../../session";
import { useStore } from "../../../../store";
import { offerLogin, savedLogin } from "../../../../vault";
import type { PanelProps } from "../PanelBase";
import { Compose, Link, List, Read, Search, when, type Ctx, type Screen } from "./Mailbox";
import { Addresses, Folders, Options } from "./Options";
import "./squirrelmeal.css";

// docs/design/plans/webmail-server.md, section 3: plain HTML in two frames, no scripts.
export const versionOf = (game: GameState, c: Cluster): string => installedVersion(game, panelMachine(c) ?? "", familyOf(c) ?? "") ?? "";

const Logo = () => <div className="smw-logo"><span>Squirrel</span>Meal</div>;

export function SquirrelMeal(p: PanelProps) {
  const sub = (p.path ?? "/").replace(/^\/squirrelmeal/, "") || "/";
  const [account, setAccount] = useSessionState<string | null>(`webmail.${p.c.id}`, null);
  if (p.c.setupPending) return <ErrorBox text={t("mailserver.noConfig")} />;
  if (sub.includes("configtest.php")) return <ConfigTest game={p.game} c={p.c} host={p.host} />;
  if (account && p.game.mail.accounts.some((a) => a.id === account)) return <Frames game={p.game} c={p.c} account={account} out={() => setAccount(null)} />;
  return <Login game={p.game} c={p.c} host={p.host} signIn={setAccount} />;
}

function ErrorBox({ text, back }: { text: string; back?: () => void }) {
  return (
    <div className="smw smw-error">
      <table><tbody><tr><th>{t("mailserver.login.error")}</th></tr><tr><td>{text.split("\n").map((l) => <p key={l}>{l}</p>)}{back && <a href="#login" onClick={(e) => { e.preventDefault(); back(); }}>{t("mailserver.login.back")}</a>}</td></tr></tbody></table>
    </div>
  );
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
  if (error) return <ErrorBox text={error} back={() => setError(null)} />;
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

// The frameset: the folder tree on the left, everything else on the right.
function Frames({ game, c, account, out }: { game: GameState; c: Cluster; account: string; out: () => void }) {
  const act = useStore((x) => x.act);
  const [folder, setFolder] = useState("inbox"), [screen, go] = useState<Screen>({ k: "list" }), [shut, setShut] = useState<string[]>([]);
  const filters = webmailOf(game, c).plugins.includes("filters");
  const check = () => { if (filters) act(runLocalFilters, c.id, account); };
  useEffect(() => { if (folder === "inbox" && screen.k === "list") check(); }, [folder, screen.k]);
  const folders = foldersOf(game, account).filter((f) => subscribed(game, account, f.id)), name = folders.find((f) => f.id === folder)?.name ?? "";
  const open = (id: string) => { setFolder(id); go({ k: "list" }); };
  const ctx: Ctx = { game, c, account, folder, act, go, open };
  const a = game.mail.accounts.find((x) => x.id === account)!;
  const tree = (parent: string | null, depth: number): ReactNode[] => folders.filter((f) => f.parent === parent).flatMap((f) => {
    const n = unread(game, account, f.id), kids = folders.some((x) => x.parent === f.id), closed = shut.includes(f.id);
    return [
      <li key={f.id} style={{ paddingLeft: depth * 12 }}>
        {kids && <Link on={() => setShut(closed ? shut.filter((x) => x !== f.id) : [...shut, f.id])}>{closed ? "+" : "-"}</Link>}{kids && " "}
        <Link on={() => open(f.id)}>{n ? <b>{`${f.name} (${n})`}</b> : f.name}</Link>
        {f.id === "trash" && listFolder(game, account, "trash").length > 0 && <> <small>(<Link on={() => act(emptyFolder, account, "trash")}>{t("mailserver.sm.purge")}</Link>)</small></>}
      </li>,
      ...(closed ? [] : tree(f.id, depth + 1)),
    ];
  });
  const menu = ([["compose", { k: "compose", seed: {} }], ["addresses", { k: "addresses" }], ["folders", { k: "folders" }], ["options", { k: "options", page: "" }], ["search", { k: "search" }]] as const);
  return (
    <div className={`smw smw-frames smw-theme-${webmailPref(webmailUser(game, c.id, account), "theme")}`}>
      <nav className="smw-left">
        <b>{t("mailserver.frame.folders")}</b>
        <small>{t("mailserver.frame.refreshed", { time: when(game.hour * 60 + game.minute) })}</small>
        <small>(<Link on={check}>{t("mailserver.sm.checkMail")}</Link>)</small>
        <ul>{tree(null, 0)}</ul>
      </nav>
      <main className="smw-right">
        <div className="smw-bar"><span>{t("mailserver.frame.current", { folder: name })}</span><Link on={out}>{t("mailserver.frame.signOut")}</Link></div>
        <div className="smw-bar smw-menu"><span>{menu.map(([k, s]) => <Link key={k} on={() => go(s)}>{t(`mailserver.sm.${k}`)}</Link>)}</span><span className="smw-who">{`${a.local}@${a.domain}`}</span></div>
        {screen.k === "read" ? <Read ctx={ctx} id={screen.id} />
          : screen.k === "compose" ? <Compose key={JSON.stringify(screen.seed)} ctx={ctx} seed={screen.seed} />
          : screen.k === "options" ? <Options key={screen.page} ctx={ctx} page={screen.page} />
          : screen.k === "folders" ? <Folders ctx={ctx} />
          : screen.k === "addresses" ? <Addresses ctx={ctx} />
          : screen.k === "search" ? <Search ctx={ctx} />
          : <List key={folder} ctx={ctx} />}
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
    [t("mailserver.test.config", { version: "1.4.0" }), true],
    [t("mailserver.test.paths", { data: confValue(cfg, "data_dir"), attach: confValue(cfg, "attachment_dir") }), true],
    [t("mailserver.test.plugins", { list: cfg.plugins.map((x) => t(`mailserver.plugin.${x}`)).join(", ") || "-" }), true],
    [t("mailserver.test.baseUrl", { url: `https://${host}/squirrelmeal/src` }), true],
    [t("mailserver.test.lang", { lang: confValue(cfg, "squirrelmail_default_language"), charset: confValue(cfg, "default_charset") }), true],
    [smtpOk ? t("mailserver.test.smtpOk", { host: cfg.smtpHost }) : t("mailserver.test.smtpFail", { host: cfg.smtpHost, port: cfg.smtpPort }), smtpOk],
    [imap ? t("mailserver.test.imapOk", { host: cfg.imapHost, port: cfg.imapPort, type: confValue(cfg, "imap_server_type") }) : t("mailserver.test.imapFail", { host: cfg.imapHost, port: cfg.imapPort }), imap],
  ];
  return (
    <div className="smw smw-test">
      <h1>{t("mailserver.test.title")}</h1>
      <ul>{lines.map(([l, ok]) => <li key={l} className={ok ? "" : "fail"}>{l}</li>)}</ul>
      {imap && smtpOk && <p><b>{t("mailserver.test.fine")}</b></p>}
    </div>
  );
}
