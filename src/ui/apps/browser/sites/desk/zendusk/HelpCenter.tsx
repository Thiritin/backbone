import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { STATUS_LABELS } from "../../../../../../sim/10-catalog/desks";
import { companyDomain } from "../../../../../../sim/30-customers/domains";
import type { TicketKind } from "../../../../../../sim/40-support/tickets";
import { kbArticles } from "../../../../../../sim/80-business/website";
import { lookupTicket, submitWebTicket } from "../../../../../../sim/90-actions/desk";
import { ZenduskMark } from "../../../../../art/mailmarks";
import { useStore } from "../../../../../store";
import { KB_STEPS } from "../../companyCopy";
import { useTicketPane } from "../headless/useTicketPane";
import { when, type ZdPage, type ZdProps } from "./ZenduskSite";

// The ticket forms a customer picks from, and the kind of request each one opens.
const FORMS: { id: string; kind: TicketKind }[] = [{ id: "question", kind: "howTo" }, { id: "problem", kind: "outage" }, { id: "billing", kind: "billing" }];

const title = (topic: string) => t(`ticket.howTo.${topic}.subject`, {});

// The customer side: the web portal until 2013, then the Help Center.
export function HelpCenter(p: ZdProps) {
  const { game, nav, route, year } = p;
  const page = route.page as ZdPage, hc = year >= 2013;
  let body;
  if (page === "hcNew") body = <NewRequest {...p} />;
  else if (page === "hcRequests" || page === "hcRequest") body = <Requests {...p} />;
  else if (page === "hcArticle") body = <Article {...p} />;
  else if (page === "hcCategory") body = <Articles {...p} />;
  else body = <Home {...p} />;
  const links: [string, ZdPage][] = hc
    ? [["zd.hc.submit", "hcNew"], ["zd.hc.activities", "hcRequests"]]
    : [["zd.hc.home", "hc"], ["zd.hc.submit", "hcNew"], ["zd.hc.existing", "hcRequests"], ["zd.hc.forums", "hcCategory"]];
  return (
    <>
      <header className="zd-hchead">
        <a className="zd-brand" onClick={() => nav("hc")}><ZenduskMark /> <span>{game.company.name}</span></a>
        <nav>
          {links.map(([key, target]) => <a key={key} className={target === page ? "active" : ""} onClick={() => nav(target, { id: "general" })}>{t(key)}</a>)}
          <a onClick={() => nav("signIn")}>{t("zd.hc.signIn")}</a>
        </nav>
      </header>
      <main className="zd-hcbody">{body}</main>
      <footer className="zd-hcfoot">{t(hc ? "zd.hc.powered" : "zd.hc.poweredPortal")}</footer>
    </>
  );
}

function Home(p: ZdProps) {
  const [q, setQ] = useState(""), hits = kbArticles(p.game).filter((a) => q.trim() && title(a.topic).toLowerCase().includes(q.trim().toLowerCase()));
  if (p.year < 2013) return <><h1>{t("zd.hc.welcome", { company: p.game.company.name })}</h1><Articles {...p} /></>;
  return (
    <>
      <section className="zd-hero">
        <input type="search" aria-label={t("zd.search")} placeholder={t("zd.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        {q.trim() && <ul className="zd-hits">{hits.map((a) => <li key={a.topic}><a onClick={() => p.nav("hcArticle", { id: a.topic })}>{title(a.topic)}</a></li>)}{!hits.length && <li>{t("zd.none")}</li>}</ul>}
      </section>
      <section className="zd-cats"><a onClick={() => p.nav("hcCategory", { id: "general" })}><b>{t("zd.hc.category")}</b><span>{t("zd.hc.articles", { n: kbArticles(p.game).length })}</span></a></section>
    </>
  );
}

function Articles({ game, nav, year }: ZdProps) {
  return (
    <>
      <h2>{t(year < 2013 ? "zd.hc.forums" : "zd.hc.category")}</h2>
      <ul className="zd-articles">{kbArticles(game).map((a) => <li key={a.topic}><a onClick={() => nav("hcArticle", { id: a.topic })}>{title(a.topic)}</a></li>)}</ul>
    </>
  );
}

function Article(p: ZdProps) {
  const topic = p.route.args.id ?? "";
  if (!kbArticles(p.game).some((a) => a.topic === topic)) return <Articles {...p} />;
  return (
    <article className="zd-article">
      <a onClick={() => p.nav("hcCategory", { id: "general" })}>{t(p.year < 2013 ? "zd.hc.forums" : "zd.hc.category")}</a>
      <h1>{title(topic)}</h1>
      <ol>{KB_STEPS[topic]?.(companyDomain(p.game)).map((x) => <li key={x}>{x}</li>)}</ol>
    </article>
  );
}

function NewRequest({ game, nav }: ZdProps) {
  const act = useStore((s) => s.attempt);
  const [error, setError] = useState<string | null>(null), [done, setDone] = useState<string | null>(null);
  if (done) {
    const tk = game.tickets.find((x) => x.id === done);
    return <><h1>{t("zd.hc.sent")}</h1><p className="zd-notice">{t("zd.hc.sentText", { n: tk?.ref ?? "" })}</p><a onClick={() => nav("hc")}>{t("zd.hc.home")}</a></>;
  }
  return (
    <form className="zd-form" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget), form = FORMS.find((x) => x.id === f.get("form"));
      if (!form) return setError(t("zd.hc.formRequired"));
      const r = act(submitWebTicket, String(f.get("email") ?? ""), form.kind);
      if (r.ok) setDone(r.id ?? null); else setError(t(r.error, r.params));
    }}>
      <h1>{t("zd.hc.submit")}</h1>
      {error && <p className="zd-error">{error}</p>}
      <label><span>{t("zd.hc.chooseForm")}</span>
        <select name="form" defaultValue=""><option value="">-</option>{FORMS.map((x) => <option key={x.id} value={x.id}>{t(`zd.hc.form.${x.id}`)}</option>)}</select>
      </label>
      <label><span>{t("zd.hc.yourEmail")}</span><input name="email" type="email" required /></label>
      <label><span>{t("zd.hc.subject")}</span><input name="subject" /></label>
      <label><span>{t("zd.hc.description")}</span><textarea name="description" rows={6} /></label>
      <button type="submit" className="zd-btn primary">{t("zd.submit")}</button>
    </form>
  );
}

function Requests(p: ZdProps) {
  const act = useStore((s) => s.attempt);
  const [error, setError] = useState<string | null>(null), [found, setFound] = useState<string | null>(null);
  const tk = found ? p.game.tickets.find((x) => x.id === found) : undefined;
  if (tk) return <Request {...p} id={tk.id} />;
  return (
    <form className="zd-form" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget), r = act(lookupTicket, String(f.get("email") ?? ""), String(f.get("n") ?? "").replace(/^#/, ""));
      if (r.ok) setFound(r.id ?? null); else setError(t(r.error, r.params));
    }}>
      <h1>{t(p.year >= 2013 ? "zd.hc.activities" : "zd.hc.existing")}</h1>
      {error && <p className="zd-error">{error}</p>}
      <label><span>{t("zd.hc.yourEmail")}</span><input name="email" type="email" required /></label>
      <label><span>{t("zd.hc.requestNo")}</span><input name="n" required defaultValue={p.route.args.n ?? ""} /></label>
      <button type="submit" className="zd-btn primary">{t("zd.hc.view")}</button>
    </form>
  );
}

function Request({ game, id }: ZdProps & { id: string }) {
  const tk = game.tickets.find((x) => x.id === id)!, m = useTicketPane(game, tk);
  const status = STATUS_LABELS.zendusk[tk.status === "escalated" ? "open" : tk.status];
  return (
    <div className="zd-request">
      <h1>{m.subject}</h1>
      <p className="zd-meta"><span className={`zd-status ${status}`}>{t(`zd.status.${status}`)}</span> <span>{t("zd.hc.requestRef", { n: tk.ref ?? "" })}</span> <span>{when(m.opened)}</span></p>
      {m.items.map((it, i) => (it.type === "opening" || it.type === "reply" || it.type === "msg"
        ? <div key={i} className={`zd-comment ${it.msg.you ? "agent" : ""}`}><header><b>{it.msg.from}</b><time>{when(it.msg.hour)}</time></header><p>{it.msg.text}</p></div>
        : null))}
    </div>
  );
}
