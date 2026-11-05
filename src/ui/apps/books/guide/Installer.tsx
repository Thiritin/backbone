import { useEffect, useState, type ReactNode } from "react";
import { create } from "zustand";
import { yearOf } from "../../../../sim/00-core/time";
import { booksVendor, type BooksVendor } from "../../../../sim/10-catalog/bookkeeping";
import { booksKey, needsKey, setupOf } from "../../../../sim/80-business/books-guide";
import { acceptBooksLicence, activateBooks, createBooksCompany, enterBooksKey, installBooks } from "../../../../sim/90-actions/bookkeeping";
import { t } from "../../../../i18n/en";
import { useStore } from "../../../store";
import { CompanyForm } from "./CompanyForm";
import { installerLook } from "./looks";
import "./guide.css";

// The installer asked for from outside a component (the vendor page, the Finder); InstallerHost on the desktop shows it.
export const useInstaller = create<{ id: string | null }>(() => ({ id: null }));
export const openBooksInstaller = (id: string) => useInstaller.setState({ id });

export function InstallerHost() {
  const id = useInstaller((s) => s.id);
  return id ? <Installer id={id} onClose={() => useInstaller.setState({ id: null })} /> : null;
}

const norm = (x: string) => x.toUpperCase().replace(/[^A-Z0-9]/g, "");
// Seconds the copy bar takes; a bigger installer takes longer.
export const installSeconds = (v: BooksVendor): number => Math.max(2, Math.min(8, (v.setupMb ?? 40) / 25));

type Page = "welcome" | "licence" | "key" | "type" | "progress" | "finish";
const sequence = (v: BooksVendor): Page[] => ["welcome", "licence", ...(needsKey(v.id) ? ["key" as const] : []), "type", "progress", "finish"];
const SIGNUP = ["register", "confirm", "company", "plan"] as const;

// The setup of a bookkeeping program: a desktop one runs the installer's pages and installs when the bar is full, a web
// one runs the sign-up. Each page performs the matching action of the sim.
export function Installer({ id, onClose, inline = false }: { id: string; onClose: () => void; inline?: boolean }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const v = booksVendor(id);
  const [at, setAt] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [key, setKey] = useState("");
  const [folder, setFolder] = useState(`C:\\Programme\\${v?.program ?? ""}`);
  const [custom, setCustom] = useState(false);
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [launch, setLaunch] = useState(true);
  if (!v) return null;
  const look = installerLook(v, yearOf(game.hour));
  const web = look === "signup";
  const pages: string[] = web ? [...SIGNUP] : sequence(v);
  const page = pages[Math.min(at, pages.length - 1)];
  const fail = (r: { ok: boolean; error?: string; params?: Record<string, string | number> }) => { setErr(r.ok ? null : t(r.error ?? "error.booksSetupOrder", r.params)); return r.ok; };
  const next = () => { setErr(null); setAt(at + 1); };
  const u = setupOf(game);
  const p = { program: v.program };

  const start = () => {
    // The sim only takes a licence and a number once the program is installed, so they are entered as the bar starts.
    if (!fail(act(installBooks, v.id))) return;
    act(acceptBooksLicence);
    if (needsKey(v.id)) act(enterBooksKey, key);
    next();
  };
  const finish = () => { onClose(); if (launch) openApp("Books"); };

  let body: ReactNode, nextLabel = t("bkinst.next"), canNext = true, onNext: () => void = next, back = at > 0 && page !== "progress" && page !== "finish";
  switch (page) {
    case "welcome":
      body = <><h3>{t("bkinst.welcome.title", p)}</h3><p>{t("bkinst.welcome.text", p)}</p></>;
      break;
    case "licence":
      body = (
        <>
          <h3>{t("bkinst.licence.title")}</h3>
          <textarea className="bki-licence" readOnly value={t("bkinst.licence.text", p)} aria-label={t("bkinst.licence.title")} />
          <label className="bki-check"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />{t("bkinst.licence.accept")}</label>
        </>
      );
      canNext = accepted;
      break;
    case "key":
      body = (
        <>
          <h3>{t("bkinst.key.title")}</h3><p>{t("bkinst.key.text")}</p>
          <label className="bki-field">{t("bkinst.key.label")}<input className="num" value={key} onChange={(e) => setKey(e.target.value)} /></label>
        </>
      );
      canNext = key.trim() !== "";
      onNext = () => (norm(key) === norm(booksKey(game, v.id)) ? next() : setErr(t("error.booksKey")));
      break;
    case "type":
      body = (
        <>
          <h3>{t("bkinst.type.title")}</h3>
          <label className="bki-check"><input type="radio" name="bki-type" checked={!custom} onChange={() => setCustom(false)} />{t("bkinst.type.standard")}</label>
          <label className="bki-check"><input type="radio" name="bki-type" checked={custom} onChange={() => setCustom(true)} />{t("bkinst.type.custom")}</label>
          <label className="bki-field">{t("bkinst.type.folder")}<input className="num" value={folder} disabled={!custom} onChange={(e) => setFolder(e.target.value)} /></label>
        </>
      );
      nextLabel = t("bkinst.install");
      onNext = start;
      break;
    case "progress":
      body = <Progress v={v} done={next} />;
      back = false; canNext = false;
      break;
    case "finish":
      body = (
        <>
          <h3>{t("bkinst.finish.title")}</h3><p>{t("bkinst.finish.text", p)}</p>
          <label className="bki-check"><input type="checkbox" checked={launch} onChange={(e) => setLaunch(e.target.checked)} />{t("bkinst.finish.launch", p)}</label>
        </>
      );
      nextLabel = t("bkinst.finish"); onNext = finish; back = false;
      break;
    case "register":
      body = (
        <>
          <h3>{t("bkinst.register.title", p)}</h3>
          <label className="bki-field">{t("bkinst.register.email")}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="bki-field">{t("bkinst.register.password")}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        </>
      );
      nextLabel = t("bkinst.register.next"); canNext = email.includes("@") && password !== "";
      break;
    case "confirm":
      body = <><h3>{t("bkinst.confirm.title")}</h3><p>{t("bkinst.confirm.text")}</p></>;
      nextLabel = t("bkguide.do.confirm");
      onNext = () => { if (fail(act(activateBooks))) next(); };
      break;
    case "company":
      body = <><h3>{t("bkinst.company.title")}</h3><CompanyForm chart={v.id !== "sevdeck"} onCreate={(c) => { if (fail(act(createBooksCompany, c))) next(); }} /></>;
      nextLabel = t("bkinst.next"); canNext = u.company;
      break;
    default:
      body = <><h3>{t("bkinst.plan.title")}</h3><p>{t("bkinst.plan.text", { program: v.program, edition: v.editions.find((e) => e.id === game.books.edition)?.name ?? "" })}</p></>;
      nextLabel = t("bkinst.plan.finish"); onNext = onClose; back = false;
  }

  const wizard = (
    <section className={`bki bki-${look}${inline ? " bki-inline" : ""}`} role="dialog" aria-label={t("bkinst.title", p)} data-look={look} data-page={page}>
      <header className="bki-title"><span>{t("bkinst.title", p)}</span></header>
      <div className="bki-main">
        <aside className="bki-banner" aria-hidden><b>{v.program}</b><ol>{pages.map((x, i) => <li key={x} className={i === at ? "on" : i < at ? "past" : ""}>{t(`bkinst.page.${x}`)}</li>)}</ol></aside>
        <div className="bki-page">{body}{err && <p className="bki-err" role="alert">{err}</p>}</div>
      </div>
      <footer className="bki-foot">
        <button type="button" className="btn" disabled={!back} onClick={() => setAt(at - 1)}>{t("bkinst.back")}</button>
        <button type="button" className="btn primary" disabled={!canNext} onClick={onNext}>{nextLabel}</button>
        {!web && page !== "finish" && <button type="button" className="btn" disabled={page === "progress"} onClick={onClose}>{t("bkinst.cancel")}</button>}
      </footer>
    </section>
  );
  return inline ? wizard : <div className="bki-backdrop">{wizard}</div>;
}

// The copy bar fills over a few seconds, longer for a bigger installer.
function Progress({ v, done }: { v: BooksVendor; done: () => void }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const start = performance.now(), ms = installSeconds(v) * 1000;
    const timer = setInterval(() => setPct(Math.min(100, ((performance.now() - start) / ms) * 100)), 100);
    return () => clearInterval(timer);
  }, [v]);
  useEffect(() => { if (pct >= 100) done(); }, [pct >= 100]);
  return (
    <>
      <h3>{t("bkinst.progress.title")}</h3><p>{t("bkinst.progress.text", { program: v.program })}</p>
      <div className="bki-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}><i style={{ width: `${pct}%` }} /></div>
    </>
  );
}
