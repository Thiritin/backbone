import { useState } from "react";
import type { GameState } from "../../../../../sim/50-state";
import { panelLogin, panelMessages, type PanelMessage } from "../../../../../sim/60-infra/panel-mail";
import { readPanelMail, sendPanelMail } from "../../../../../sim/90-actions/panel-mail";
import { t } from "../../../../../i18n/en";
import { useSessionState } from "../../../../session";
import { useStore } from "../../../../store";
import { mailDate } from "../../../pear-mail/List";
import "./squarecube.css";

const Logo = () => <div className="scw-logo"><span className="scw-cube" aria-hidden="true" /><b>Square</b>cube<small>Webmail</small></div>;

// The Squarecube bundled with the panel, at webmail.<domain> and the panel's port 2096.
export function PanelWebmail({ game, domain }: { game: GameState; domain: string | null }) {
  const [login, setLogin] = useSessionState<[string, string] | null>(`panelmail.${domain ?? "panel"}`, null);
  if (login && panelLogin(game, login[0], login[1])) return <Shell game={game} login={login} out={() => setLogin(null)} />;
  return <Login domain={domain} signIn={(a, p) => setLogin([a, p])} game={game} />;
}

function Login({ game, domain, signIn }: { game: GameState; domain: string | null; signIn: (a: string, p: string) => void }) {
  const [name, setName] = useState(""), [pass, setPass] = useState(""), [error, setError] = useState<string | null>(null);
  const submit = () => (panelLogin(game, name, pass) ? signIn(name.trim().toLowerCase(), pass) : setError(t("panelmail.error.login")));
  return (
    <div className="scw scw-login">
      <Logo />
      {error && <div className="scw-message" role="alert">{error}</div>}
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <table>
          <tbody>
            <tr><th><label htmlFor="pw-user">{t("panelmail.address")}</label></th><td><input id="pw-user" value={name} placeholder={domain ? `@${domain}` : ""} onChange={(e) => setName(e.target.value)} autoComplete="off" /></td></tr>
            <tr><th><label htmlFor="pw-pass">{t("panelmail.password")}</label></th><td><input id="pw-pass" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" /></td></tr>
          </tbody>
        </table>
        <p><button type="submit">{t("panelmail.login")}</button></p>
      </form>
    </div>
  );
}

type View = "inbox" | "sent" | "compose";

function Shell({ game, login, out }: { game: GameState; login: [string, string]; out: () => void }) {
  const [address, password] = login, act = useStore((x) => x.act);
  const [view, setView] = useState<View>("inbox"), [open, setOpen] = useState<PanelMessage | null>(null);
  const [to, setTo] = useState(""), [subject, setSubject] = useState(""), [body, setBody] = useState(""), [error, setError] = useState<string | null>(null), [note, setNote] = useState<string | null>(null);
  const all = panelMessages(game, address), rows = all.filter((m) => m.folder === view);
  const unread = all.filter((m) => m.folder === "inbox" && !m.read).length;
  const go = (v: View) => { setView(v); setOpen(null); setError(null); setNote(null); };
  const show = (m: PanelMessage) => { setOpen(m); if (!m.read) act(readPanelMail, address, password, m.id); };
  const send = () => {
    const r = act(sendPanelMail, address, password, to, subject, body);
    if (r && !r.ok) return setError(t(r.error));
    setTo(""); setSubject(""); setBody(""); setNote(t("panelmail.sentOk")); setView("sent");
  };
  return (
    <div className="scw scw-shell">
      <header>
        <Logo />
        <nav>
          <a href="#inbox" aria-current={view === "inbox" ? "page" : undefined} onClick={(e) => { e.preventDefault(); go("inbox"); }}>{t("panelmail.inbox")}{unread > 0 && ` (${unread})`}</a>
          <a href="#sent" aria-current={view === "sent" ? "page" : undefined} onClick={(e) => { e.preventDefault(); go("sent"); }}>{t("panelmail.sent")}</a>
          <a href="#compose" aria-current={view === "compose" ? "page" : undefined} onClick={(e) => { e.preventDefault(); go("compose"); }}>{t("panelmail.compose")}</a>
          <a href="#logout" onClick={(e) => { e.preventDefault(); out(); }}>{t("panelmail.logout")} ({address})</a>
        </nav>
      </header>
      <section className="scw-mail" style={{ display: "block", padding: 10, overflow: "auto" }}>
        {note && <div className="scw-note" role="status">{note}</div>}
        {view === "compose" ? (
          <form className="scw-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
            {error && <div className="scw-message" role="alert">{error}</div>}
            <table><tbody>
              <tr><th><label htmlFor="pw-to">{t("panelmail.to")}</label></th><td><input id="pw-to" value={to} onChange={(e) => setTo(e.target.value)} /></td></tr>
              <tr><th><label htmlFor="pw-sub">{t("panelmail.subject")}</label></th><td><input id="pw-sub" value={subject} onChange={(e) => setSubject(e.target.value)} /></td></tr>
            </tbody></table>
            <textarea aria-label={t("panelmail.compose")} rows={10} value={body} onChange={(e) => setBody(e.target.value)} style={{ width: "100%" }} />
            <p><button type="submit">{t("panelmail.send")}</button></p>
          </form>
        ) : open ? (
          <div className="scw-reader">
            <p><button onClick={() => setOpen(null)}>{t("panelmail.back")}</button></p>
            <h3>{open.subject}</h3>
            <p>{t("panelmail.from")}: {open.from}<br />{t("panelmail.to")}: {open.to}<br />{t("panelmail.date")}: {mailDate(open.at)}</p>
            <pre style={{ whiteSpace: "pre-wrap" }}>{open.body}</pre>
          </div>
        ) : rows.length ? (
          <table className="scw-list">
            <thead><tr><th>{t("panelmail.subject")}</th><th>{t(view === "sent" ? "panelmail.to" : "panelmail.from")}</th><th>{t("panelmail.date")}</th></tr></thead>
            <tbody>{[...rows].reverse().map((m) => (
              <tr key={m.id} className={m.read ? "" : "unread"} onClick={() => show(m)} style={{ cursor: "pointer" }}>
                <td>{m.read ? m.subject : <b>{m.subject}</b>}</td><td>{view === "sent" ? m.to : m.from}</td><td>{mailDate(m.at)}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p>{t("panelmail.empty")}</p>}
      </section>
    </div>
  );
}
