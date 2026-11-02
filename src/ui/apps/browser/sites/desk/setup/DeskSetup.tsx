import { useState, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { sampleConfig } from "../../../../../../sim/10-catalog/archives";
import { deskById } from "../../../../../../sim/10-catalog/desks";
import type { GameState } from "../../../../../../sim/50-state";
import { requirementsOf } from "../../../../../../sim/60-infra/shop-files";
import { webspaceOf } from "../../../../../../sim/60-infra/webspace";
import type { Page } from "../../../../../../sim/80-business/browser";
import { deskPath } from "../../../../../../sim/80-business/deskroutes";
import { deskStepError, runDeskInstaller, type DeskInstallForm, type DeskInstallStep } from "../../../../../../sim/90-actions/desk-setup";
import type { ActionResult } from "../../../../../../sim/90-actions/hardware";
import { useStore } from "../../../../../store";
import "../../portal/setup/setup.css";
import "./desk-setup.css";

type SetupPage = Extract<Page, { kind: "deskSetup" }>;
interface Props { game: GameState; page: SetupPage; host: string; go: (url: string) => void }

const errorText = (r: ActionResult | null) => (r && !r.ok ? t(r.error, r.params) : null);
const EMPTY: DeskInstallForm = { helpdesk: "", deskEmail: "", first: "", last: "", email: "", user: "", pass: "", dbHost: "localhost", dbName: "", dbUser: "", dbPass: "" };

// A desk's own pages before it runs from a folder: its web installer, the page that sends there, and the database error.
export function DeskSetup({ game, page, host, go }: Props) {
  const url = `${host}${page.base}`, name = deskById(page.id)!.name;
  if (page.screen === "installer") return page.id === "ostickit" ? <OstInstaller game={game} page={page} url={url} go={go} /> : <FsInstaller game={game} page={page} url={url} go={go} />;
  const installer = page.id === "ostickit" ? "/setup/" : "/install";
  return (
    <Frame id={page.id} title={name}>
      {page.screen === "notInstalled" ? <>
        <p>{t("desk-setup.notInstalled", { name })}</p>
        <p><a href="#" onClick={(e) => { e.preventDefault(); go(url + installer); }}>{t("shop-setup.runInstaller")}</a></p>
      </> : <p className="ss-error">{t(`desk-setup.dbError.${page.id}`)}</p>}
    </Frame>
  );
}

function Frame({ id, title, children, steps }: { id: string; title: string; children: ReactNode; steps?: ReactNode }) {
  return (
    <div className={`ss ss-${id}`}>
      <header className="ss-head"><span className="ss-mark">{t(`desk-setup.${id}.installer`)}</span></header>
      <div className="ss-body">
        {steps}
        <main className="ss-main">
          <h1>{title}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}

const Field = ({ label, value, set, type = "text", disabled }: { label: string; value: string; set?: (v: string) => void; type?: string; disabled?: boolean }) => (
  <label className="ss-field"><span>{label}</span><input type={type} value={value} disabled={disabled} autoComplete="off" onChange={(e) => set?.(e.target.value)} /></label>
);

// The installer's form state and the check each step runs before it moves on.
function useInstaller(game: GameState, page: SetupPage) {
  const attempt = useStore((s) => s.attempt), [f, setF] = useState<DeskInstallForm>(EMPTY), [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null), [step, setStep] = useState(0);
  const set = (k: keyof DeskInstallForm) => (value: string) => setF({ ...f, [k]: value });
  const check = (k: DeskInstallStep) => deskStepError(game, page.ws, page.folder, k, f);
  const next = (r: ActionResult | null) => { const e = errorText(r); setError(e); if (!e) setStep(step + 1); };
  const install = () => {
    if (f.pass !== confirm) return setError(t("shop-setup.mismatch"));
    next(attempt(runDeskInstaller, page.ws, page.folder, { ...f, user: page.id === "freescoot" ? f.email : f.user }));
  };
  const ws = webspaceOf(game, page.ws), h = game.desk?.hosting, here = h?.kind === "self" && h.ws === page.ws && h.folder === page.folder;
  return { f, set, confirm, setConfirm, error, step, check, next, install, ws, here };
}

// OsTickit's installer at setup/: prerequisites, the config file, one form for the helpdesk, the admin and the database,
// then the congratulations page with what to do about the config file and the setup folder.
function OstInstaller({ game, page, url, go }: { game: GameState; page: SetupPage; url: string; go: (url: string) => void }) {
  const x = useInstaller(game, page);
  if (!x.ws) return null;
  const reqs = requirementsOf(game, x.ws, page.folder, page.id, page.version), php = reqs.find((r) => r.key === "php")!;
  const configErr = x.step === 1 ? x.check("config") : null;
  if (x.here) {
    return (
      <Frame id={page.id} title={t("desk-setup.ost.done")}>
        <p role="status">{t("desk-setup.ost.doneText")}</p>
        <h3>{t("desk-setup.ost.perm")}</h3>
        <p className="ss-warn">{t("desk-setup.ost.permText")} <code>chmod 0644 include/ost-config.php</code></p>
        <h3>{t("desk-setup.ost.setupDir")}</h3>
        <p className="ss-warn">{t("desk-setup.ost.setupDirText")} <code>setup/</code></p>
        <table className="ss-table"><tbody>
          <tr><th>{t("desk-setup.ost.url")}</th><td><a href="#" onClick={(e) => { e.preventDefault(); go(`${url}/`); }}>{`http://${url}/`}</a></td></tr>
          <tr><th>{t("desk-setup.ost.scp")}</th><td><a href="#" onClick={(e) => { e.preventDefault(); go(url + deskPath("ostickit", "scp")); }}>{`http://${url}/scp/`}</a></td></tr>
        </tbody></table>
      </Frame>
    );
  }
  if (x.step === 0) {
    return (
      <Frame id={page.id} title={t("desk-setup.ost.welcome")}>
        <h3>{t("desk-setup.ost.prereq")}</h3>
        <table className="ss-table"><tbody>
          <tr><th>{t("desk-setup.ost.php", { need: php.params.need })}</th><td className="num">{php.params.have}</td><td className={php.ok ? "ss-ok" : "ss-bad"}>{php.ok ? t("shop-setup.req.ok") : t("shop-setup.req.failed")}</td></tr>
          <tr><th>{t("desk-setup.ost.mysqli")}</th><td /><td className="ss-ok">{t("shop-setup.req.ok")}</td></tr>
        </tbody></table>
        {x.error && <p className="ss-error" role="alert">{x.error}</p>}
        <button type="button" className="ss-btn" onClick={() => x.next(x.check("requirements"))}>{t("shop-setup.continue")}</button>
      </Frame>
    );
  }
  if (configErr && !configErr.ok) {
    const missing = configErr.error === "desk-setup.ost.configMissing";
    return (
      <Frame id={page.id} title={t(missing ? "desk-setup.ost.configMissingTitle" : "desk-setup.ost.configLockedTitle")}>
        <p className="ss-error">{t(configErr.error, configErr.params)}</p>
        {missing ? <p><code>{`include/${sampleConfig(page.version)}`}</code> → <code>include/ost-config.php</code></p> : <p><code>chmod 0666 include/ost-config.php</code></p>}
        <button type="button" className="ss-btn" onClick={() => x.next(x.check("config"))}>{t("desk-setup.ost.doneContinue")}</button>
      </Frame>
    );
  }
  return (
    <Frame id={page.id} title={t("desk-setup.ost.basic")}>
      <form className="ss-main-form" onSubmit={(e) => { e.preventDefault(); x.install(); }}>
        <h3>{t("desk-setup.ost.system")}</h3>
        <Field label={t("desk-setup.ost.helpdesk")} value={x.f.helpdesk} set={x.set("helpdesk")} />
        <Field label={t("desk-setup.ost.deskEmail")} value={x.f.deskEmail} set={x.set("deskEmail")} type="email" />
        <h3>{t("desk-setup.ost.admin")}</h3>
        <Field label={t("shop-setup.first")} value={x.f.first} set={x.set("first")} />
        <Field label={t("shop-setup.last")} value={x.f.last} set={x.set("last")} />
        <Field label={t("shop-setup.email")} value={x.f.email} set={x.set("email")} type="email" />
        <Field label={t("shop-setup.user")} value={x.f.user} set={x.set("user")} />
        <Field label={t("shop-setup.pass")} value={x.f.pass} set={x.set("pass")} type="password" />
        <Field label={t("desk-setup.retype")} value={x.confirm} set={x.setConfirm} type="password" />
        <h3>{t("desk-setup.ost.database")}</h3>
        <Field label={t("desk-setup.ost.prefix")} value="ost_" disabled />
        <Field label={t("desk-setup.ost.dbHost")} value={x.f.dbHost} set={x.set("dbHost")} />
        <Field label={t("desk-setup.ost.dbName")} value={x.f.dbName} set={x.set("dbName")} />
        <Field label={t("desk-setup.ost.dbUser")} value={x.f.dbUser} set={x.set("dbUser")} />
        <Field label={t("desk-setup.ost.dbPass")} value={x.f.dbPass} set={x.set("dbPass")} type="password" />
        {x.error && <p className="ss-error" role="alert">{x.error}</p>}
        <button type="submit" className="ss-btn">{t("desk-setup.ost.install")}</button>
      </form>
    </Frame>
  );
}

const FS_STEPS = ["welcome", "requirements", "permissions", "environment", "admin", "finished"] as const;
const FS_EXTENSIONS = ["OpenSSL", "PDO", "Mbstring", "Tokenizer", "XML", "IMAP", "GD", "fileinfo", "ZIP", "iconv", "cURL"];
const FS_FOLDERS = ["storage/framework/", "storage/logs/", "bootstrap/cache/"];

// FreeScoot's installer at /install: welcome, server requirements, folder permissions, the database, the admin, finished.
function FsInstaller({ game, page, url, go }: { game: GameState; page: SetupPage; url: string; go: (url: string) => void }) {
  const x = useInstaller(game, page);
  if (!x.ws) return null;
  const at = x.here ? FS_STEPS.length - 1 : x.step, k = FS_STEPS[at];
  const php = requirementsOf(game, x.ws, page.folder, page.id, page.version).find((r) => r.key === "php")!;
  const row = (label: string, value: string, good = true) => <tr key={label}><th>{label}</th><td className="num">{value}</td><td className={good ? "ss-ok" : "ss-bad"}>{good ? "✓" : "✗"}</td></tr>;
  const steps = <ol className="ss-steps">{FS_STEPS.map((s, n) => <li key={s} className={n === at ? "on" : n < at ? "past" : ""}>{t(`desk-setup.fs.${s}`)}</li>)}</ol>;
  const body = () => {
    switch (k) {
      case "welcome": return <><p>{t("desk-setup.fs.welcomeText")}</p><button type="button" className="ss-btn" onClick={() => x.next(null)}>{t("desk-setup.fs.checkRequirements")}</button></>;
      case "requirements": return <>
        <table className="ss-table"><tbody>{row(`PHP ${php.params.need}+`, php.params.have, php.ok)}{FS_EXTENSIONS.map((e) => row(e, ""))}</tbody></table>
        <button type="button" className="ss-btn" onClick={() => x.next(x.check("requirements"))}>{t("desk-setup.fs.checkPermissions")}</button>
      </>;
      case "permissions": return <>
        <table className="ss-table"><tbody>{FS_FOLDERS.map((f) => row(f, "775"))}</tbody></table>
        <button type="button" className="ss-btn" onClick={() => x.next(null)}>{t("desk-setup.fs.configure")}</button>
      </>;
      case "environment": return <>
        <Field label={t("desk-setup.fs.appUrl")} value={`http://${url}`} disabled />
        <Field label={t("desk-setup.fs.dbHost")} value={x.f.dbHost} set={x.set("dbHost")} />
        <Field label={t("desk-setup.fs.dbPort")} value="3306" disabled />
        <Field label={t("desk-setup.fs.dbName")} value={x.f.dbName} set={x.set("dbName")} />
        <Field label={t("desk-setup.fs.dbUser")} value={x.f.dbUser} set={x.set("dbUser")} />
        <Field label={t("desk-setup.fs.dbPass")} value={x.f.dbPass} set={x.set("dbPass")} type="password" />
        <button type="button" className="ss-btn" onClick={() => x.next(x.check("db"))}>{t("desk-setup.fs.setup")}</button>
      </>;
      case "admin": return <>
        <Field label={t("shop-setup.email")} value={x.f.email} set={x.set("email")} type="email" />
        <Field label={t("shop-setup.first")} value={x.f.first} set={x.set("first")} />
        <Field label={t("shop-setup.last")} value={x.f.last} set={x.set("last")} />
        <Field label={t("shop-setup.pass")} value={x.f.pass} set={x.set("pass")} type="password" />
        <Field label={t("desk-setup.retype")} value={x.confirm} set={x.setConfirm} type="password" />
        <button type="button" className="ss-btn" onClick={x.install}>{t("desk-setup.fs.install")}</button>
      </>;
      default: return <>
        <p role="status">{t("desk-setup.fs.finishedText")}</p>
        <button type="button" className="ss-btn" onClick={() => go(url + deskPath("freescoot", "login"))}>{t("desk-setup.fs.login")}</button>
      </>;
    }
  };
  return (
    <Frame id={page.id} title={t(`desk-setup.fs.${k}`)} steps={steps}>
      {body()}
      {x.error && <p className="ss-error" role="alert">{x.error}</p>}
    </Frame>
  );
}
