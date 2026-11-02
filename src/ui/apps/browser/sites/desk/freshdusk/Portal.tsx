import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { companyDomain } from "../../../../../../sim/30-customers/domains";
import type { Ticket, TicketKind } from "../../../../../../sim/40-support/tickets";
import { kbArticles } from "../../../../../../sim/80-business/website";
import { Suggested, suggested } from "../headless/AiPage";
import { lookupTicket, submitWebTicket } from "../../../../../../sim/90-actions/desk";
import { FreshduskMark } from "../../../../../art/mailmarks";
import { useStore } from "../../../../../store";
import { KB_STEPS } from "../../companyCopy";
import { useTicketPane } from "../headless/useTicketPane";
import { when, type FdPage, type FdProps } from "./FreshduskSite";

// The ticket types a customer picks from, and the kind of request each one opens.
const TYPES: { id: string; kind: TicketKind }[] = [{ id: "question", kind: "howTo" }, { id: "incident", kind: "outage" }, { id: "billing", kind: "billing" }];

const title = (topic: string) => t(`ticket.howTo.${topic}.subject`, {});
// What a customer sees: Open and Pending are both still being processed.
const portalStatus = (tk: Ticket) => (tk.status === "resolved" ? "resolved" : tk.status === "closed" ? "closed" : tk.status === "waiting" ? "awaiting" : "processing");

// The customer support portal: Home, Solutions and Tickets.
export function Portal(p: FdProps) {
  const { game, nav, route } = p;
  const page = route.page as FdPage;
  let body;
  if (page === "portalNew") body = <NewTicket {...p} />;
  else if (page === "portalTickets" || page === "portalTicket") body = <Status {...p} />;
  else if (page === "solution") body = <Article {...p} />;
  else if (page === "solutions") body = <Articles {...p} />;
  else body = <Home {...p} />;
  const tabs: [string, FdPage, FdPage[]][] = [
    ["fd.p.home", "portal", ["portal"]], ["fd.nav.solutions", "solutions", ["solutions", "solution"]], ["fd.p.tickets", "portalTickets", ["portalTickets", "portalTicket", "portalNew"]],
  ];
  return (
    <>
      <header className="fd-phead">
        <a className="fd-brand" onClick={() => nav("portal")}><FreshduskMark /> <span>{game.company.name}</span></a>
        <a className="fd-plogin" onClick={() => nav("login")}>{t("fd.p.login")}</a>
        <nav>{tabs.map(([key, target, pages]) => <a key={key} className={pages.includes(page) ? "active" : ""} onClick={() => nav(target)}>{t(key)}</a>)}</nav>
      </header>
      <main className="fd-pbody">{body}</main>
      <footer className="fd-pfoot">{t("fd.p.powered")}</footer>
    </>
  );
}

function Home(p: FdProps) {
  const [q, setQ] = useState(""), needle = q.trim().toLowerCase();
  const hits = kbArticles(p.game).filter((a) => needle && title(a.topic).toLowerCase().includes(needle));
  return (
    <>
      <section className="fd-hero">
        <h1>{p.look === "classic" ? t("fd.p.welcome", { company: p.game.company.name }) : t("fd.p.help")}</h1>
        <input type="search" aria-label={t("fd.p.search")} placeholder={t("fd.p.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        {needle && <ul className="fd-hits">{hits.map((a) => <li key={a.topic}><a onClick={() => p.nav("solution", { id: a.topic })}>{title(a.topic)}</a></li>)}{!hits.length && <li>{t("fd.none")}</li>}</ul>}
      </section>
      <p className="fd-pactions">
        <a className="fd-btn primary" onClick={() => p.nav("portalNew")}>{t("fd.p.newTicket")}</a>
        <a className="fd-btn" onClick={() => p.nav("portalTickets")}>{t("fd.p.checkStatus")}</a>
      </p>
      <Articles {...p} />
    </>
  );
}

function Articles({ game, nav }: FdProps) {
  return (
    <section className="fd-cat">
      <h2>{t("fd.solutions.general")}</h2>
      <ul>{kbArticles(game).map((a) => <li key={a.topic}><a onClick={() => nav("solution", { id: a.topic })}>{title(a.topic)}</a></li>)}</ul>
    </section>
  );
}

function Article(p: FdProps) {
  const topic = p.route.args.id ?? "";
  if (!kbArticles(p.game).some((a) => a.topic === topic)) return <Articles {...p} />;
  return (
    <article className="fd-article">
      <a onClick={() => p.nav("solutions")}>{t("fd.solutions.general")}</a>
      <h1>{title(topic)}</h1>
      <ol>{KB_STEPS[topic]?.(companyDomain(p.game)).map((x) => <li key={x}>{x}</li>)}</ol>
    </article>
  );
}

function NewTicket({ game, nav }: FdProps) {
  const act = useStore((s) => s.attempt);
  const [error, setError] = useState<string | null>(null), [done, setDone] = useState<string | null>(null), [subject, setSubject] = useState("");
  if (done) {
    const tk = game.tickets.find((x) => x.id === done);
    return <><h1>{t("fd.p.sent")}</h1><p className="fd-notice">{t("fd.p.sentText", { n: tk?.ref ?? "" })}</p><a onClick={() => nav("portal")}>{t("fd.p.home")}</a></>;
  }
  return (
    <form className="fd-form" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget), type = TYPES.find((x) => x.id === f.get("type"));
      if (!type) return setError(t("fd.p.typeRequired"));
      const r = act(submitWebTicket, String(f.get("email") ?? ""), type.kind);
      if (r.ok) setDone(r.id ?? null); else setError(t(r.error, r.params));
    }}>
      <h1>{t("fd.p.newTicket")}</h1>
      {error && <p className="fd-error">{error}</p>}
      <label><span>{t("fd.p.requester")}</span><input name="email" type="email" required /></label>
      <label><span>{t("fd.col.subject")}</span><input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
      <Suggested topics={suggested(game, subject)} brand="fd" open={(id) => nav("solution", { id })} />
      <label><span>{t("fd.type")}</span>
        <select name="type" defaultValue=""><option value="">-</option>{TYPES.map((x) => <option key={x.id} value={x.id}>{t(`fd.type.${x.id}`)}</option>)}</select>
      </label>
      <label><span>{t("fd.p.description")}</span><textarea name="description" rows={6} /></label>
      <button type="submit" className="fd-btn primary">{t("fd.p.submit")}</button>
    </form>
  );
}

function Status(p: FdProps) {
  const act = useStore((s) => s.attempt);
  const [error, setError] = useState<string | null>(null), [found, setFound] = useState<string | null>(null);
  const tk = found ? p.game.tickets.find((x) => x.id === found) : undefined;
  if (tk) return <View {...p} tk={tk} />;
  return (
    <form className="fd-form" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget), r = act(lookupTicket, String(f.get("email") ?? ""), String(f.get("n") ?? "").replace(/^#/, ""));
      if (r.ok) setFound(r.id ?? null); else setError(t(r.error, r.params));
    }}>
      <h1>{t("fd.p.checkStatus")}</h1>
      {error && <p className="fd-error">{error}</p>}
      <label><span>{t("fd.p.email")}</span><input name="email" type="email" required /></label>
      <label><span>{t("fd.p.ticketNo")}</span><input name="n" required defaultValue={p.route.args.n ?? ""} /></label>
      <button type="submit" className="fd-btn primary">{t("fd.p.view")}</button>
    </form>
  );
}

function View({ game, tk }: FdProps & { tk: Ticket }) {
  const m = useTicketPane(game, tk), status = portalStatus(tk);
  return (
    <div className="fd-request">
      <h1>{m.subject}</h1>
      <p className="fd-meta"><span className={`fd-status ${status}`}>{t(`fd.p.status.${status}`)}</span> <span>{t("fd.p.ticketRef", { n: tk.ref ?? "" })}</span> <span>{when(m.opened)}</span></p>
      {m.items.map((it, i) => (it.type === "opening" || it.type === "reply" || it.type === "msg"
        ? <div key={i} className={`fd-note ${it.msg.you ? "agent" : ""}`}><header><b>{it.msg.from}</b><time>{when(it.msg.hour)}</time></header><p>{it.msg.text}</p></div>
        : null))}
    </div>
  );
}
