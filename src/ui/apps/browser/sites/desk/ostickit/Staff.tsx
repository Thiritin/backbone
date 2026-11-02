import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { deskHas, STATUS_LABELS } from "../../../../../../sim/10-catalog/desks";
import { priorityOf, type Priority } from "../../../../../../sim/40-support/desk";
import { deskReport } from "../../../../../../sim/40-support/desk-reports";
import { OWNER, PRIORITIES } from "../../../../../../sim/40-support/desk-work";
import type { Ticket } from "../../../../../../sim/40-support/tickets";
import { addNote, markSpam, setDepartment, setPriority } from "../../../../../../sim/90-actions/desk";
import { assignTicket } from "../../../../../../sim/90-actions/support";
import { useStore } from "../../../../../store";
import { ReplyPanel } from "../headless/ReplyPanel";
import { useDeskTickets, useDeskViews, type DeskView } from "../headless/useDeskTickets";
import { useTicketPane } from "../headless/useTicketPane";
import { Kb, Thread, topicOf } from "./Client";
import { Section, Sub, when, type OstPage, type OstProps } from "./OsTickitSite";

// The queues OsTickit shows under Tickets, in its order, and the desk view each one is.
const QUEUES: [string, DeskView][] = [["open", "open"], ["answered", "waiting"], ["mine", "mine"], ["overdue", "overdue"], ["closed", "closed"]];
const PRIORITY: Record<Priority, string> = { low: "low", normal: "normal", high: "high", urgent: "emergency" };

export function StaffPage(p: OstProps) {
  const page = p.route.page as OstPage;
  if (page === "staffTicket") return <TicketView {...p} />;
  if (page === "dashboard") return <Dashboard {...p} />;
  if (page === "users") return <Users {...p} />;
  if (page === "tasks") return <Section title={t("ost.tab.tasks")}><p className="ost-empty">{t("ost.noResults")}</p></Section>;
  if (page === "staffKb") return <Section title={t("ost.tab.kb")}><Kb game={p.game} nav={p.nav} /></Section>;
  if (page === "profile") return <Section title={t(p.modern ? "ost.profile" : "ost.preferences")}><table className="ost-info"><tbody><tr><th>{t("ost.name")}</th><td>{t("ost.you")}</td></tr><tr><th>{t("ost.username")}</th><td>admin</td></tr></tbody></table></Section>;
  return <Queue {...p} />;
}

function Queue(p: OstProps) {
  const { game, nav, route } = p;
  const view = (QUEUES.find(([id]) => id === route.args.view)?.[1] ?? "open") as DeskView;
  const counts = useDeskViews(game), list = useDeskTickets(game, view);
  const count = (v: DeskView) => counts.find((c) => c.id === v)?.count ?? 0;
  return (
    <>
      <Sub items={QUEUES.map(([id, v]) => [v === "closed" ? t(`ost.queue.${id}`) : t("ost.queue.count", { name: t(`ost.queue.${id}`), n: count(v) }), () => nav("queue", { view: id }), v === view])} />
      <Section title={t("ost.queueTitle", { name: t(`ost.queue.${QUEUES.find(([, v]) => v === view)![0]}`) })}>
        <table className="ost-list">
          <thead><tr><th>{t("ost.ticket")}</th><th>{t(p.modern ? "ost.lastUpdated" : "ost.date")}</th><th>{t("ost.subject")}</th><th>{t("ost.from")}</th><th>{t("ost.priority")}</th><th>{t("ost.assignedTo")}</th></tr></thead>
          <tbody>
            {list.map((tk) => <Row key={tk.id} {...p} tk={tk} />)}
            {!list.length && <tr><td colSpan={6} className="ost-empty">{t("ost.noResults")}</td></tr>}
          </tbody>
        </table>
      </Section>
    </>
  );
}

function Row({ game, nav, modern, tk }: OstProps & { tk: Ticket }) {
  const m = useTicketPane(game, tk), pr = priorityOf(game, tk);
  return (
    <tr className={tk.dueAt < game.hour && tk.status === "open" ? "overdue" : ""}>
      <td><a onClick={() => nav("staffTicket", { n: tk.ref ?? "" })}>{tk.ref}</a></td>
      <td>{when(modern ? tk.updatedAt : tk.createdAt)}</td>
      <td><a onClick={() => nav("staffTicket", { n: tk.ref ?? "" })}>{m.subject}</a></td>
      <td>{m.customer?.name ?? m.sender?.from ?? ""}</td>
      <td className={`pri-${PRIORITY[pr]}`}>{t(`ost.priority.${PRIORITY[pr]}`)}</td>
      <td>{assigneeName(game, tk) ?? ""}</td>
    </tr>
  );
}

function Dashboard({ game }: OstProps) {
  const r = deskReport(game, game.hour - 30 * 24, game.hour + 1);
  const pct = r.slaHit === null ? "" : r.slaHit.toLocaleString(LOCALE, { style: "percent" });
  return (
    <Section title={t("ost.activity")}>
      <table className="ost-list">
        <thead><tr><th>{t("ost.period")}</th><th>{t("ost.opened")}</th><th>{t("ost.status.resolved")}</th><th>{t("ost.firstResponse")}</th><th>{t("ost.slaHit")}</th></tr></thead>
        <tbody><tr><td>{t("ost.last30")}</td><td>{r.created}</td><td>{r.solved}</td><td>{r.firstResponse === null ? "" : t("ost.hours", { n: r.firstResponse.toLocaleString(LOCALE, { maximumFractionDigits: 1 }) })}</td><td>{pct}</td></tr></tbody>
      </table>
    </Section>
  );
}

function Users({ game }: OstProps) {
  const people = game.customers.filter((c) => c.churnedAt === null);
  return (
    <Section title={t("ost.tab.users")}>
      <table className="ost-list">
        <thead><tr><th>{t("ost.name")}</th><th>{t("ost.client.email")}</th><th>{t("ost.tickets")}</th></tr></thead>
        <tbody>{people.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.address.email}</td><td>{game.tickets.filter((x) => x.customerId === c.id && x.ref).length}</td></tr>)}</tbody>
      </table>
    </Section>
  );
}

const assigneeName = (s: OstProps["game"], tk: Ticket): string | null =>
  tk.assignee === OWNER ? t("ost.you") : s.staff.find((e) => e.id === tk.assignee)?.name ?? null;

type Tab = "reply" | "note" | "transfer" | "assign";

function TicketView(p: OstProps) {
  const { game, nav, route } = p;
  const act = useStore((s) => s.act);
  const [tab, setTab] = useState<Tab>("reply");
  const tk = game.tickets.find((x) => x.ref === route.args.n && game.desk);
  if (!tk) return <Section title={t("ost.ticket")}><p className="ost-error">{t("ost.noTicket")}</p></Section>;
  const m = useTicketPane(game, tk), pr = priorityOf(game, tk), open = tk.status !== "closed" && tk.status !== "resolved";
  const depts = game.desk!.departments, dept = depts.find((d) => d.id === tk.deptId)?.name ?? "";
  const tabs: [Tab, string][] = [["reply", "ost.postReply"], ["note", "ost.postNote"], ["transfer", "ost.transfer"], ["assign", "ost.assign"]];
  return (
    <section className="ost-page">
      <div className="ost-ticket-head">
        <h2><a onClick={() => nav("staffTicket", { n: tk.ref ?? "" })}>{t("ost.ticketNo", { n: tk.ref ?? "" })}</a></h2>
        {open && <button className="ost-btn alt" onClick={() => act(markSpam, tk.id)}>{t("ost.banEmail")}</button>}
      </div>
      <table className="ost-info">
        <tbody>
          <tr><th>{t("ost.status")}</th><td>{t(`ost.status.${STATUS_LABELS.ostickit[tk.outcome === "spam" ? "spam" : tk.status]}`)}</td><th>{t("ost.name")}</th><td>{m.customer?.name ?? ""}</td></tr>
          <tr><th>{t("ost.priority")}</th><td>
            <select aria-label={t("ost.priority")} value={pr} disabled={!open} onChange={(e) => act(setPriority, tk.id, e.target.value as Priority)}>
              {[...PRIORITIES].reverse().map((x) => <option key={x} value={x}>{t(`ost.priority.${PRIORITY[x]}`)}</option>)}
            </select>
          </td><th>{t("ost.client.email")}</th><td>{game.customers.find((c) => c.id === tk.customerId)?.address.email ?? m.sender?.from ?? ""}</td></tr>
          <tr><th>{t("ost.department")}</th><td>{dept}</td><th>{t("ost.source")}</th><td>{t(tk.via === "web" ? "ost.source.web" : "ost.source.email")}</td></tr>
          <tr><th>{t("ost.created")}</th><td>{when(m.opened)}</td><th>{t("ost.helpTopic")}</th><td>{t(`ost.topic.${topicOf(tk.kind)}`)}</td></tr>
          <tr><th>{t("ost.assignedTo")}</th><td>{assigneeName(game, tk) ?? t("ost.unassigned")}</td><th>{t("ost.dueDate")}</th><td className={m.due?.tone ?? ""}>{open ? when(tk.dueAt) : ""}</td></tr>
        </tbody>
      </table>
      <h2 className="ost-subject">{m.subject}</h2>
      <Thread items={m.items} notes />
      {open && (
        <>
          <nav className="ost-ttabs">{tabs.map(([id, key]) => <a key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{t(key)}</a>)}</nav>
          <div className="ost-tabbody">
            {tab === "reply" && <Reply {...p} tk={tk} />}
            {tab === "note" && <Note tk={tk} />}
            {tab === "transfer" && (
              <Pick label={t("ost.department")} empty={t("ost.selectDept")} submit={t("ost.transferBtn")} options={depts.filter((d) => d.id !== tk.deptId).map((d) => [d.id, d.name])} run={(id) => act(setDepartment, tk.id, id)} />
            )}
            {tab === "assign" && (
              <Pick label={t("ost.assignee")} empty={t("ost.selectAgent")} submit={t("ost.assignBtn")} options={[[OWNER, t("ost.you")], ...game.staff.filter((e) => e.role === "support").map((e): [string, string] => [e.id, e.name])]} run={(id) => act(assignTicket, tk.id, id || null)} />
            )}
          </div>
        </>
      )}
    </section>
  );
}

// Post Reply: a canned response, the status the ticket takes, and the ticket's own actions.
function Reply({ game, tk }: OstProps & { tk: Ticket }) {
  const [canned, setCanned] = useState(""), [status, setStatus] = useState("open"), [code, setCode] = useState("");
  return (
    <ReplyPanel
      game={game}
      ticket={tk}
      previews={deskHas(game, "templates")}
      frame={(b) => <div className="ost-reply">{b}</div>}
      templates={(m, h) => (
        <form onSubmit={(e) => {
          e.preventDefault();
          if (canned) h.reply(canned);
          if (status === "resolved") h.resolve(); else if (status === "closed") h.close();
          setCanned("");
        }}>
          <label><span>{t("ost.response")}</span>
            <select aria-label={t("ost.canned")} value={canned} onChange={(e) => setCanned(e.target.value)} disabled={m.locked}>
              <option value="">{t("ost.selectCanned")}</option>
              {m.templates!.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
            </select>
          </label>
          <textarea readOnly rows={5} aria-label={t("ost.response")} value={m.templates!.find((x) => x.id === canned)?.preview ?? ""} />
          <label><span>{t("ost.ticketStatus")}</span>
            <select aria-label={t("ost.ticketStatus")} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="open">{t("ost.status.open")}</option>
              {m.resolve && <option value="resolved">{t("ost.status.resolved")}</option>}
              {m.close !== null && <option value="closed">{t("ost.status.closed")}</option>}
            </select>
          </label>
          <p className="ost-buttons"><button type="submit" className="ost-btn" disabled={m.locked || (!canned && status === "open")}>{t("ost.postReply")}</button></p>
        </form>
      )}
      offers={(m, h) => (
        <div className="ost-actions">
          <h4>{t("support.retentionOffers")}</h4>
          {m.offers!.map((o) => <button key={o.id} className="ost-btn alt" disabled={m.locked} onClick={() => h.retain(o.id)}>{o.title} ({o.value}, {o.oddsLabel})</button>)}
        </div>
      )}
      transfer={(m, h) => (
        <form className="ost-actions" onSubmit={(e) => { e.preventDefault(); h.transfer(code); }}>
          <input aria-label={t("registrarForm.authCode")} placeholder={t("registrarForm.authCode")} value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="ost-btn" disabled={m.locked || !code.trim()}>{t("support.sendCode")}</button>
          <button type="button" className="ost-btn alt" disabled={m.locked} onClick={() => h.transfer(null)}>{t("support.refuseTransfer")}</button>
        </form>
      )}
      buttons={(m, h) => (m.actions.length || m.answers.length || (!m.templates && (m.resolve || m.close !== null))) ? (
        <div className="ost-actions">
          {m.actions.map((a) => <button key={a.id} className="ost-btn alt" disabled={a.disabled} onClick={() => h.action(a.id)}>{a.label}{a.amount !== null && ` (${a.amount})`}</button>)}
          {m.answers.map((a) => <button key={a.id} className={a.primary ? "ost-btn" : "ost-btn alt"} disabled={a.disabled} onClick={() => h.answer(a.id)}>{a.label}</button>)}
          {!m.templates && m.close !== null && <button className="ost-btn alt" disabled={m.locked} onClick={h.close}>{m.close}</button>}
          {!m.templates && m.resolve && <button className="ost-btn" disabled={m.locked} onClick={h.resolve}>{t("support.resolve")}</button>}
        </div>
      ) : null}
    />
  );
}

function Note({ tk }: { tk: Ticket }) {
  const act = useStore((s) => s.act);
  const [text, setText] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (act(addNote, tk.id, text).ok) setText(""); }}>
      <label><span>{t("ost.internalNote")}</span><textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} /></label>
      <p className="ost-buttons"><button type="submit" className="ost-btn" disabled={!text.trim()}>{t("ost.postNoteBtn")}</button></p>
    </form>
  );
}

function Pick({ label, empty, submit, options, run }: { label: string; empty: string; submit: string; options: [string, string][]; run: (id: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(v); setV(""); }}>
      <label><span>{label}</span>
        <select aria-label={label} value={v} onChange={(e) => setV(e.target.value)}>
          <option value="">{empty}</option>
          {options.map(([id, name]) => <option key={id || "none"} value={id}>{name}</option>)}
        </select>
      </label>
      <p className="ost-buttons"><button type="submit" className="ost-btn">{submit}</button></p>
    </form>
  );
}
