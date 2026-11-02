import { useState, type ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { shopById, type ShopId } from "../../../../../../sim/10-catalog/shops";
import type { GameState } from "../../../../../../sim/50-state";
import { isLicensed } from "../../../../../../sim/60-infra/licence";
import { EMAIL_LOGIN, newerRelease, requirementsOf } from "../../../../../../sim/60-infra/shop-files";
import { webspaceOf } from "../../../../../../sim/60-infra/webspace";
import type { Page } from "../../../../../../sim/80-business/browser";
import { portalPath } from "../../../../../../sim/80-business/portal";
import type { ActionResult } from "../../../../../../sim/90-actions/hardware";
import { installerStepError, runShopInstaller, runShopUpgrade, type InstallForm } from "../../../../../../sim/90-actions/shop-setup";
import { useStore } from "../../../../../store";
import "./setup.css";

type SetupPage = Extract<Page, { kind: "shopSetup" }>;
interface Props { game: GameState; page: SetupPage; host: string; path: string; go: (url: string) => void }

const STEPS = ["licence", "requirements", "config", "admin", "done"] as const;
const errorText = (r: ActionResult | null) => (r && !r.ok ? t(r.error, r.params) : null);

// A shop's own pages outside a running install: its web installer and upgrade script under /install/, the note to run the
// installer, and the error pages of a shop whose files and install disagree.
export function ShopSetup({ game, page, host, go }: Props) {
  const name = shopById(page.id).name, url = `${host}${page.base}`;
  if (page.screen === "installer") return <Installer game={game} page={page} url={url} go={go} />;
  return (
    <Frame id={page.id} title={page.screen === "maintenance" ? t("shop-setup.maintenance") : name}>
      {page.screen === "notInstalled" && <>
        <p>{t("shop-setup.notInstalled", { name })}</p>
        <p><a href="#" onClick={(e) => { e.preventDefault(); go(`${url}/install/`); }}>{t("shop-setup.runInstaller")}</a></p>
      </>}
      {page.screen === "maintenance" && <p>{t("shop-setup.maintenance.text")}</p>}
      {page.screen === "dbError" && <p className="ss-error">{t("shop-setup.dbError")}</p>}
    </Frame>
  );
}

function Frame({ id, title, children, steps }: { id: ShopId; title: string; children: ReactNode; steps?: ReactNode }) {
  return (
    <div className={`ss ss-${id}`}>
      <header className="ss-head"><span className="ss-mark">{shopById(id).name}</span></header>
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

function Installer({ game, page, url, go }: { game: GameState; page: SetupPage; url: string; go: (url: string) => void }) {
  const attempt = useStore((s) => s.attempt), v = shopById(page.id), [step, setStep] = useState(0), [agreed, setAgreed] = useState(false);
  const [f, setF] = useState<InstallForm>({ key: "", dbHost: "localhost", dbName: "", dbUser: "", dbPass: "", first: "", last: "", email: "", user: "", pass: "" });
  const [confirm, setConfirm] = useState(""), [error, setError] = useState<string | null>(null), [upgraded, setUpgraded] = useState<string | null>(null);
  const ws = webspaceOf(game, page.ws), i = game.shop.install, here = i?.ws === page.ws && i.folder === page.folder;
  if (!ws) return null;
  const admin = () => go(`${url}${portalPath(page.id, "admin")}`);
  // The installed shop's install folder runs its upgrade script.
  if (here && STEPS[step] !== "done") {
    const newer = newerRelease(page.id, page.version, i.version);
    return (
      <Frame id={page.id} title={upgraded ? t("shop-setup.version", { version: upgraded }) : newer ? t("shop-setup.upgrade.title", { from: i.version, to: page.version }) : t("shop-setup.title", { name: v.name })}>
        {upgraded ? <p role="status">{t("shop-setup.upgrade.done", { version: upgraded })}</p>
          : !newer ? <p className="ss-error">{t("shop-setup.upgrade.current", { version: i.version })}</p>
          : <form onSubmit={(e) => { e.preventDefault(); const r = attempt(runShopUpgrade, f.key || undefined); setError(errorText(r)); if (r.ok) setUpgraded(page.version); }}>
            {isLicensed(page.id) && <Field label={t("shop-setup.key")} value={f.key ?? ""} set={(key) => setF({ ...f, key })} />}
            {error && <p className="ss-error" role="alert">{error}</p>}
            <button type="submit" className="ss-btn">{t("shop-setup.upgrade.run")}</button>
          </form>}
        {upgraded && <p><a href="#" onClick={(e) => { e.preventDefault(); admin(); }}>{t("shop-setup.done.admin")}</a></p>}
      </Frame>
    );
  }
  const set = (k: keyof InstallForm) => (value: string) => setF({ ...f, [k]: value });
  // Each step checks what the real installer checks there before it moves on.
  const next = (check: () => ActionResult | null) => {
    const e = errorText(check());
    setError(e);
    if (!e) setStep(step + 1);
  };
  const stepError = (k: "requirements" | "licence" | "db") => installerStepError(game, page.ws, page.folder, k, f);
  const install = () => {
    if (f.pass !== confirm) return setError(t("shop-setup.mismatch"));
    next(() => attempt(runShopInstaller, page.ws, page.folder, { ...f, key: f.key || undefined, user: EMAIL_LOGIN.includes(page.id) ? f.email : f.user }));
  };
  const reqs = requirementsOf(game, ws, page.folder, page.id, page.version);
  const steps = <ol className="ss-steps">{STEPS.map((k, n) => <li key={k} className={n === step ? "on" : n < step ? "past" : ""}>{t(`shop-setup.step.${k}`)}</li>)}</ol>;
  const body = () => {
    switch (STEPS[step]) {
      case "licence": return <>
        <div className="ss-eula">{t("shop-setup.eula", { name: v.name, maker: v.maker })}</div>
        <label className="ss-check"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /> {t("shop-setup.agree")}</label>
        <button type="button" className="ss-btn" disabled={!agreed} onClick={() => next(() => null)}>{t("shop-setup.continue")}</button>
      </>;
      case "requirements": return <>
        <table className="ss-table"><tbody>
          {reqs.map((r) => <tr key={r.key}><th>{t(`shop-setup.req.${r.key}`)}</th><td className="num">{r.key === "php" ? r.params.have : ""}</td><td className={r.ok ? "ss-ok" : "ss-bad"}>{r.ok ? t("shop-setup.req.ok") : t("shop-setup.req.failed")}</td></tr>)}
          <tr><th>{t("shop-setup.req.mysql")}</th><td /><td className="ss-ok">{t("shop-setup.req.ok")}</td></tr>
        </tbody></table>
        <button type="button" className="ss-btn" onClick={() => next(() => stepError("requirements"))}>{t("shop-setup.continue")}</button>
      </>;
      case "config": return <>
        {isLicensed(page.id) && <Field label={t("shop-setup.key")} value={f.key ?? ""} set={set("key")} />}
        <Field label={t("shop-setup.dbHost")} value={f.dbHost} set={set("dbHost")} />
        <Field label={t("shop-setup.dbName")} value={f.dbName} set={set("dbName")} />
        <Field label={t("shop-setup.dbUser")} value={f.dbUser} set={set("dbUser")} />
        <Field label={t("shop-setup.dbPass")} value={f.dbPass} set={set("dbPass")} type="password" />
        <button type="button" className="ss-btn" onClick={() => next(() => stepError("licence") ?? stepError("db"))}>{t("shop-setup.continue")}</button>
      </>;
      case "admin": return <>
        <Field label={t("shop-setup.first")} value={f.first} set={set("first")} />
        <Field label={t("shop-setup.last")} value={f.last} set={set("last")} />
        <Field label={t("shop-setup.email")} value={f.email} set={set("email")} type="email" />
        {!EMAIL_LOGIN.includes(page.id) && <Field label={t("shop-setup.user")} value={f.user} set={set("user")} />}
        <Field label={t("shop-setup.pass")} value={f.pass} set={set("pass")} type="password" />
        <Field label={t("shop-setup.confirm")} value={confirm} set={setConfirm} type="password" />
        <button type="button" className="ss-btn" onClick={install}>{t("shop-setup.install")}</button>
      </>;
      default: return <>
        <p role="status">{t("shop-setup.done")}</p>
        <p className="ss-warn">{t("shop-setup.done.delete", { folder: `/home/${ws.account}/${page.folder}` })}</p>
        <p><a href="#" onClick={(e) => { e.preventDefault(); admin(); }}>{t("shop-setup.done.admin")}</a></p>
      </>;
    }
  };
  return (
    <Frame id={page.id} title={t(`shop-setup.step.${STEPS[step]}`)} steps={steps}>
      {body()}
      {error && <p className="ss-error" role="alert">{error}</p>}
    </Frame>
  );
}

const Field = ({ label, value, set, type = "text" }: { label: string; value: string; set: (v: string) => void; type?: string }) => (
  <label className="ss-field"><span>{label}</span><input type={type} value={value} autoComplete="off" onChange={(e) => set(e.target.value)} /></label>
);
