import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { STATUS_LABELS } from "../../../../../../sim/10-catalog/desks";
import { companyDomain } from "../../../../../../sim/30-customers/domains";
import type { TicketKind } from "../../../../../../sim/40-support/tickets";
import { kbArticles } from "../../../../../../sim/80-business/website";
import { lookupTicket, submitWebTicket } from "../../../../../../sim/90-actions/desk";
import { OsTickitMark } from "../../../../../art/mailmarks";
import { useStore } from "../../../../../store";
import { KB_STEPS } from "../../companyCopy";
import { useTicketPane } from "../headless/useTicketPane";
import { when, type OstPage, type OstProps } from "./OsTickitSite";

// The help topics a customer picks on the form, and the kind of request each one opens.
export const HELP_TOPICS: { id: string; kind: TicketKind; dept: string }[] = [
  { id: "general", kind: "howTo", dept: "support" },
  { id: "problem", kind: "outage", dept: "support" },
  { id: "billing", kind: "billing", dept: "support" },
];

// The customer side: home, the new ticket form, the status check and the knowledge base.
export function ClientPage(p: OstProps) {
  const { game, nav, route } = p;
  const page = route.page as OstPage;
  const links: [string, OstPage][] = [["ost.client.home", "home"], ["ost.client.kb", "kb"], ["ost.client.open", "open"], ["ost.client.status", "status"]];
  let body;
  if (page === "open") body = <OpenTicket {...p} />;
  else if (page === "status" || page === "ticket") body = <Status {...p} />;
  else if (page === "kb" || page === "kbCategory") body = <Kb {...p} />;
  else if (page === "kbFaq") body = <Faq {...p} />;
  else body = <Home {...p} />;
  return (
    <>
      <header className="ost-chead">
        <a className="ost-logo" onClick={() => nav("home")}><OsTickitMark /> <span>{game.company.name}</span></a>
        <p className="ost-welcome">{t("ost.client.guest")} | <a onClick={() => nav("login")}>{t("ost.client.signIn")}</a></p>
      </header>
      <nav className="ost-cnav">{links.map(([key, target]) => <a key={key} className={target === page ? "active" : ""} onClick={() => nav(target)}>{t(key)}</a>)}</nav>
      <main className="ost-cbody">{body}</main>
      <footer className="ost-foot">{t("ost.client.footer", { company: game.company.name })}</footer>
    </>
  );
}

function Home({ nav }: OstProps) {
  return (
    <>
      <h1>{t("ost.client.welcome")}</h1>
      <div className="ost-front">
        <button className="ost-btn ost-big" onClick={() => nav("open")}>{t("ost.client.open")}</button>
        <button className="ost-btn ost-big alt" onClick={() => nav("status")}>{t("ost.client.status")}</button>
      </div>
    </>
  );
}

function OpenTicket({ game, nav }: OstProps) {
  const act = useStore((s) => s.attempt);
  const [error, setError] = useState<string | null>(null), [done, setDone] = useState<string | null>(null);
  if (done) {
    const tk = game.tickets.find((x) => x.id === done);
    return <><h1>{t("ost.client.created")}</h1><p className="ost-notice">{t("ost.client.createdText", { n: tk?.ref ?? "" })}</p><a onClick={() => nav("home")}>{t("ost.client.home")}</a></>;
  }
  return (
    <form className="ost-form" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget), topic = HELP_TOPICS.find((x) => x.id === f.get("topicId"));
      if (!topic) return setError(t("ost.client.topicRequired"));
      const r = act(submitWebTicket, String(f.get("email") ?? ""), topic.kind);
      if (r.ok) setDone(r.id ?? null); else setError(t(r.error, r.params));
    }}>
      <h1>{t("ost.client.open")}</h1>
      <p>{t("ost.client.openLead")}</p>
      {error && <p className="ost-error">{error}</p>}
      <h3>{t("ost.client.contact")}</h3>
      <label><span>{t("ost.client.email")}</span><input name="email" type="email" required /></label>
      <label><span>{t("ost.client.fullName")}</span><input name="name" /></label>
      <h3>{t("ost.helpTopic")}</h3>
      <label><span>{t("ost.helpTopic")}</span>
        <select name="topicId" defaultValue="">
          <option value="">{t("ost.client.selectTopic")}</option>
          {HELP_TOPICS.map((x) => <option key={x.id} value={x.id}>{t(`ost.topic.${x.id}`)}</option>)}
        </select>
      </label>
      <h3>{t("ost.client.details")}</h3>
      <label><span>{t("ost.client.summary")}</span><input name="subject" /></label>
      <textarea name="message" rows={6} aria-label={t("ost.client.message")} />
      <p className="ost-buttons">
        <button type="submit" className="ost-btn">{t("ost.client.create")}</button>
        <button type="reset" className="ost-btn alt">{t("ost.reset")}</button>
        <button type="button" className="ost-btn alt" onClick={() => nav("home")}>{t("ost.cancel")}</button>
      </p>
    </form>
  );
}

function Status(p: OstProps) {
  const { game, modern } = p;
  const act = useStore((s) => s.attempt);
  const [error, setError] = useState<string | null>(null), [found, setFound] = useState<string | null>(null);
  const tk = found ? game.tickets.find((x) => x.id === found) : undefined;
  if (tk) return <ClientTicket {...p} id={tk.id} />;
  return (
    <form className="ost-form" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget), r = act(lookupTicket, String(f.get("lemail") ?? ""), String(f.get("lticket") ?? ""));
      if (r.ok) setFound(r.id ?? null); else setError(t(r.error, r.params));
    }}>
      <h1>{t("ost.client.status")}</h1>
      <p>{t("ost.client.statusLead")}</p>
      {error && <p className="ost-error">{error}</p>}
      <label><span>{t("ost.client.email")}</span><input name="lemail" type="email" required /></label>
      <label><span>{t("ost.client.number")}</span><input name="lticket" required /></label>
      <p className="ost-buttons"><button type="submit" className="ost-btn">{t(modern ? "ost.client.accessLink" : "ost.client.viewStatus")}</button></p>
    </form>
  );
}

function ClientTicket({ game, id }: OstProps & { id: string }) {
  const tk = game.tickets.find((x) => x.id === id)!, m = useTicketPane(game, tk);
  const dept = game.desk?.departments.find((d) => d.id === tk.deptId)?.name ?? "";
  return (
    <>
      <h1>{t("ost.ticketNo", { n: tk.ref ?? "" })}</h1>
      <table className="ost-info">
        <tbody>
          <tr><th>{t("ost.status")}</th><td>{t(`ost.status.${STATUS_LABELS.ostickit[tk.status]}`)}</td><th>{t("ost.client.name")}</th><td>{m.customer?.name ?? ""}</td></tr>
          <tr><th>{t("ost.department")}</th><td>{dept}</td><th>{t("ost.client.email")}</th><td>{game.customers.find((c) => c.id === tk.customerId)?.address.email ?? m.sender?.from ?? ""}</td></tr>
          <tr><th>{t("ost.created")}</th><td>{when(m.opened)}</td><th /><td /></tr>
        </tbody>
      </table>
      <h2 className="ost-subject">{m.subject}</h2>
      <Thread items={m.items} notes={false} />
    </>
  );
}

// The ticket thread: messages from the customer, responses from staff and, for staff only, internal notes.
export function Thread({ items, notes }: { items: ReturnType<typeof useTicketPane>["items"]; notes: boolean }) {
  return (
    <div className="ost-thread">
      {items.map((it, i) => {
        if (it.type === "event") return it.hour === null ? null : <p key={i} className="ost-event">{it.text} <span>{when(it.hour)}</span></p>;
        if (it.type === "note") return notes ? <Entry key={i} cls="note" who={it.by} hour={it.hour} text={it.text} /> : null;
        const msg = it.msg;
        return (
          <div key={i}>
            <Entry cls={msg.you ? "response" : "message"} who={msg.from} hour={msg.hour} text={msg.text} />
            {it.type === "reply" && it.followUp && <Entry cls="message" who={it.followUp.from} hour={it.followUp.hour} text={it.followUp.text} />}
          </div>
        );
      })}
    </div>
  );
}

const Entry = ({ cls, who, hour, text }: { cls: string; who: string; hour: number; text: string }) => (
  <div className={`ost-entry ${cls}`}><header><span>{when(hour)}</span><b>{who}</b></header><p>{text}</p></div>
);

export function Kb({ game, nav }: Pick<OstProps, "game" | "nav">) {
  return (
    <>
      <h1>{t("ost.client.kbTitle")}</h1>
      <ul className="ost-faqs">
        {kbArticles(game).map((a) => <li key={a.topic}><a onClick={() => nav("kbFaq", { id: a.topic })}>{t(`ticket.howTo.${a.topic}.subject`, {})}</a></li>)}
      </ul>
    </>
  );
}

function Faq({ game, route, nav }: OstProps) {
  const topic = route.args.id ?? "";
  if (!kbArticles(game).some((a) => a.topic === topic)) return <Kb game={game} nav={nav} />;
  return (
    <article>
      <a onClick={() => nav("kb")}>{t("ost.client.kb")}</a>
      <h1>{t(`ticket.howTo.${topic}.subject`, {})}</h1>
      <ol>{KB_STEPS[topic]?.(companyDomain(game)).map((x) => <li key={x}>{x}</li>)}</ol>
    </article>
  );
}

export const topicOf = (kind: TicketKind): string => HELP_TOPICS.find((x) => x.kind === kind)?.id ?? "general";
