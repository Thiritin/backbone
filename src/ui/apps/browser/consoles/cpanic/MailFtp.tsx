import { FolderUp, Forward, Mail, MessageSquareReply, ShieldBan, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useT } from "../look";
import { LOCALE } from "../../../../../i18n/lang";
import { yearOf } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import type { SpamFilter, Webspace } from "../../../../../sim/60-infra/webspace";
import { createFolder, createForwarder, createFtpAccount, createMailbox, deleteForwarder, deleteFtpAccount, deleteMailbox } from "../../../../../sim/90-actions/webspace";
import { createAutoresponder, deleteAutoresponder, setSpamFilter } from "../../../../../sim/90-actions/webspace-mail";
import { useStore } from "../../../../store";
import { usePageAct } from "../../pageAct";
import { Bar } from "../PanelBase";

// docs/design/web-hosting.md 4.3 and 4.4: cPanel's Email and FTP pages of one account.
export type MailFtpPage = "emailAccounts" | "forwarders" | "autoresponders" | "spam" | "ftpAccounts";
// cPanel 11 wrote "Auto Responders"; Paper Lantern renamed Apache SpamAssassin to Spam Filters in 2017.
export const mailFtpIcons = (year: number): [MailFtpPage, string, LucideIcon][] => [
  ["emailAccounts", "cpmail.accounts", Mail], ["forwarders", "cpmail.forwarders", Forward],
  ["autoresponders", year < 2014 ? "cpmail.autorespondersX3" : "cpmail.autoresponders", MessageSquareReply],
  ["spam", year < 2017 ? "cpmail.spamAssassin" : "cpmail.spamFilters", ShieldBan], ["ftpAccounts", "cpmail.ftp", FolderUp],
];
export const isMailFtpPage = (p: string | null): p is MailFtpPage => mailFtpIcons(0).some(([id]) => id === p);

const mb = (n: number) => n.toLocaleString(LOCALE, { maximumFractionDigits: 2 });
const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="cx-field"><span>{label}</span>{children}</label>;
const DomainPick = ({ ws, value, set, subs = true }: { ws: Webspace; value: string; set: (d: string) => void; subs?: boolean }) => (
  <select value={value} onChange={(e) => set(e.target.value)}>
    {Object.values(ws.domains).filter((d) => subs || d.kind !== "sub").map((d) => <option key={d.name}>{d.name}</option>)}
  </select>
);

export function MailFtp({ game, ws, page }: { game: GameState; ws: Webspace; page: MailFtpPage }) {
  const t = useT();
  const title = mailFtpIcons(yearOf(game.hour)).find(([id]) => id === page)![1];
  return (
    <>
      <h2>{t(title)}</h2>
      {page === "emailAccounts" && <Accounts ws={ws} />}
      {page === "forwarders" && <Forwarders ws={ws} />}
      {page === "autoresponders" && <Autoresponders ws={ws} />}
      {page === "spam" && <Spam ws={ws} />}
      {page === "ftpAccounts" && <Ftp ws={ws} />}
    </>
  );
}

function Accounts({ ws }: { ws: Webspace }) {
  const t = useT();
  const act = usePageAct(), openApp = useStore((s) => s.openApp);
  const [local, setLocal] = useState(""), [domain, setDomain] = useState(ws.domain), [pass, setPass] = useState(""), [again, setAgain] = useState(""), [quota, setQuota] = useState("250");
  const [mismatch, setMismatch] = useState(false);
  const create = () => {
    setMismatch(pass !== again);
    if (pass === again && act(createMailbox, ws.workloadId, local.trim().toLowerCase(), domain, pass, Number(quota)).ok) { setLocal(""); setPass(""); setAgain(""); }
  };
  return (
    <>
      <h3>{t("cpmail.addAccount")}</h3>
      <form className="cx-form" onSubmit={(e) => { e.preventDefault(); create(); }}>
        <div className="cx-inline"><Field label={t("cpmail.email")}><input value={local} onChange={(e) => setLocal(e.target.value)} /></Field><span>@</span><DomainPick ws={ws} value={domain} set={setDomain} /></div>
        <Field label={t("cpmail.password")}><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" /></Field>
        <Field label={t("cpmail.password2")}><input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" /></Field>
        {mismatch && <p className="cx-note bad">{t("cpmail.mismatch")}</p>}
        <Field label={t("cpmail.mailboxQuota")}><input type="number" min={1} value={quota} onChange={(e) => setQuota(e.target.value)} /></Field>
        <p><button className="cx-btn primary" type="submit">{t("cpmail.createAccount")}</button></p>
      </form>
      <table className="cx-table">
        <thead><tr><th>{t("cpmail.account")}</th><th>{t("cpmail.usage")}</th><th>{t("cpmail.actions")}</th></tr></thead>
        <tbody>
          {Object.values(ws.mailboxes).map((m) => (
            <tr key={m.address}>
              <td>{m.address}</td>
              <td><Bar use={[m.usedMb, m.quotaMb]} /> <span className="num">{t("cpmail.usageOf", { used: mb(m.usedMb), quota: mb(m.quotaMb), pct: Math.round((100 * m.usedMb) / m.quotaMb) })}</span></td>
              <td className="cx-acts">
                <button className="cx-btn" onClick={() => openApp("Browser", { kind: "url", id: `webmail.${m.address.split("@")[1]}/` })}>{t("cpmail.webmail")}</button>
                <button className="cx-btn" onClick={() => act(deleteMailbox, ws.workloadId, m.address)}>{t("cpmail.delete")}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Forwarders({ ws }: { ws: Webspace }) {
  const t = useT();
  const act = usePageAct();
  const [local, setLocal] = useState(""), [domain, setDomain] = useState(ws.domain), [to, setTo] = useState("");
  const rows = Object.values(ws.forwarders);
  return (
    <>
      <h3>{t("cpmail.addForwarder")}</h3>
      <form className="cx-form" onSubmit={(e) => { e.preventDefault(); if (act(createForwarder, ws.workloadId, local.trim().toLowerCase(), domain, to.trim().toLowerCase()).ok) { setLocal(""); setTo(""); } }}>
        <div className="cx-inline"><Field label={t("cpmail.addressToForward")}><input value={local} onChange={(e) => setLocal(e.target.value)} /></Field><span>@</span><DomainPick ws={ws} value={domain} set={setDomain} /></div>
        <Field label={t("cpmail.destination")}><input value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <p><button className="cx-btn primary" type="submit">{t("cpmail.addForwarder")}</button></p>
      </form>
      <table className="cx-table">
        <thead><tr><th>{t("cpmail.address")}</th><th>{t("cpmail.forwardTo")}</th><th>{t("cpmail.functions")}</th></tr></thead>
        <tbody>
          {!rows.length && <tr><td colSpan={3} className="cx-empty">{t("cpmail.noForwarders")}</td></tr>}
          {rows.map((f) => <tr key={f.from}><td>{f.from}</td><td>{f.to}</td><td className="cx-acts"><button className="cx-btn" onClick={() => act(deleteForwarder, ws.workloadId, f.from)}>{t("cpmail.delete")}</button></td></tr>)}
        </tbody>
      </table>
    </>
  );
}

function Autoresponders({ ws }: { ws: Webspace }) {
  const t = useT();
  const act = usePageAct();
  const [local, setLocal] = useState(""), [domain, setDomain] = useState(ws.domain), [from, setFrom] = useState(""), [subject, setSubject] = useState(""), [body, setBody] = useState(""), [interval, setGap] = useState("8");
  const rows = Object.values(ws.autoresponders);
  const create = () => {
    if (act(createAutoresponder, ws.workloadId, local.trim().toLowerCase(), domain, from, subject, body, Number(interval)).ok) { setLocal(""); setSubject(""); setBody(""); }
  };
  return (
    <>
      <h3>{t("cpmail.addAutoresponder")}</h3>
      <form className="cx-form" onSubmit={(e) => { e.preventDefault(); create(); }}>
        <Field label={t("cpmail.interval")}><input type="number" min={0} value={interval} onChange={(e) => setGap(e.target.value)} /></Field>
        <div className="cx-inline"><Field label={t("cpmail.email")}><input value={local} onChange={(e) => setLocal(e.target.value)} /></Field><span>@</span><DomainPick ws={ws} value={domain} set={setDomain} /></div>
        <Field label={t("cpmail.from")}><input value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label={t("cpmail.subject")}><input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label={t("cpmail.body")}><textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        <p><button className="cx-btn primary" type="submit">{t("cpmail.create")}</button></p>
      </form>
      <table className="cx-table">
        <thead><tr><th>{t("cpmail.email")}</th><th>{t("cpmail.subject")}</th><th>{t("cpmail.functions")}</th></tr></thead>
        <tbody>
          {!rows.length && <tr><td colSpan={3} className="cx-empty">{t("cpmail.noAutoresponders")}</td></tr>}
          {rows.map((a) => <tr key={a.address}><td>{a.address}</td><td>{a.subject}</td><td className="cx-acts"><button className="cx-btn" onClick={() => act(deleteAutoresponder, ws.workloadId, a.address)}>{t("cpmail.delete")}</button></td></tr>)}
        </tbody>
      </table>
    </>
  );
}

function Spam({ ws }: { ws: Webspace }) {
  const t = useT();
  const act = usePageAct(), [f, setF] = useState<SpamFilter>(ws.spam), [saved, setSaved] = useState(false);
  const toggle = (k: "on" | "spamBox" | "autoDelete", label: string) => (
    <label><input type="checkbox" checked={f[k]} disabled={k !== "on" && !f.on} onChange={(e) => { setSaved(false); setF({ ...f, [k]: e.target.checked }); }} /> {t(label)}</label>
  );
  return (
    <form className="cx-form" onSubmit={(e) => { e.preventDefault(); setSaved(act(setSpamFilter, ws.workloadId, f).ok); }}>
      {toggle("on", "cpmail.spamProcess")}
      {toggle("spamBox", "cpmail.spamBox")}
      {toggle("autoDelete", "cpmail.spamDelete")}
      <Field label={t("cpmail.spamScore")}>
        <select value={f.score} onChange={(e) => { setSaved(false); setF({ ...f, score: Number(e.target.value) }); }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </Field>
      <p><button className="cx-btn primary" type="submit">{t("cpmail.save")}</button>{saved && <span className="cx-note"> {t("cpmail.saved")}</span>}</p>
    </form>
  );
}

function Ftp({ ws }: { ws: Webspace }) {
  const t = useT();
  const act = usePageAct(), domains = Object.values(ws.domains).filter((d) => d.kind !== "sub");
  const [login, setLogin] = useState(""), [domain, setDomain] = useState(ws.domain), [pass, setPass] = useState(""), [again, setAgain] = useState("");
  const [dir, setDir] = useState<string | null>(null), [quota, setQuota] = useState("0"), [mismatch, setMismatch] = useState(false);
  const folder = (dir ?? `${ws.webroot}/${login.trim().toLowerCase()}`).replace(/^\/+|\/+$/g, "");
  const create = () => {
    setMismatch(pass !== again);
    if (pass !== again) return;
    // cPanel creates the home folder when it is missing.
    const parts = folder.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const path = parts.slice(0, i).join("/");
      if (!ws.files[path] && i > 1 && !act(createFolder, ws.workloadId, parts.slice(0, i - 1).join("/"), parts[i - 1]).ok) return;
    }
    if (act(createFtpAccount, ws.workloadId, login.trim().toLowerCase(), domain, pass, folder, Number(quota) || 0).ok) { setLogin(""); setPass(""); setAgain(""); setDir(null); }
  };
  const usedIn = (home: string) => Object.entries(ws.files).filter(([k]) => k.startsWith(`${home}/`)).reduce((n, [, x]) => n + x.mb, 0);
  return (
    <>
      <h3>{t("cpmail.addFtp")}</h3>
      <form className="cx-form" onSubmit={(e) => { e.preventDefault(); create(); }}>
        <div className="cx-inline"><Field label={t("cpmail.login")}><input value={login} onChange={(e) => setLogin(e.target.value)} /></Field><span>@</span>
          <select value={domain} onChange={(e) => setDomain(e.target.value)}>{domains.map((d) => <option key={d.name}>{d.name}</option>)}</select></div>
        <Field label={t("cpmail.password")}><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" /></Field>
        <Field label={t("cpmail.password2")}><input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" /></Field>
        {mismatch && <p className="cx-note bad">{t("cpmail.mismatch")}</p>}
        <Field label={t("cpmail.directory")}><span className="cx-inline"><span className="cx-note">{ws.home}/</span><input value={folder} onChange={(e) => setDir(e.target.value)} /></span></Field>
        <Field label={t("cpmail.quotaMb")}><input type="number" min={0} value={quota} onChange={(e) => setQuota(e.target.value)} /></Field>
        <p><button className="cx-btn primary" type="submit">{t("cpmail.createFtp")}</button></p>
      </form>
      <table className="cx-table">
        <thead><tr><th>{t("cpmail.login")}</th><th>{t("cpmail.path")}</th><th>{t("cpmail.ftpUsage")}</th><th>{t("cpmail.actions")}</th></tr></thead>
        <tbody>
          {Object.values(ws.ftp).map((a) => (
            <tr key={a.user}>
              <td>{a.user}</td><td>{ws.home}/{a.folder}</td>
              <td className="num">{a.quotaMb ? t("cpmail.ftpUsageOf", { used: mb(usedIn(a.folder)), quota: mb(a.quotaMb) }) : t("cpmail.ftpUsageUnlimited", { used: mb(usedIn(a.folder)) })}</td>
              <td className="cx-acts"><button className="cx-btn" onClick={() => act(deleteFtpAccount, ws.workloadId, a.user)}>{t("cpmail.delete")}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
