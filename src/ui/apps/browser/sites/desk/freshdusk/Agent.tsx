import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { deskHas, STATUS_LABELS, type DeskStatus } from "../../../../../../sim/10-catalog/desks";
import { priorityOf, type Priority } from "../../../../../../sim/40-support/desk";
import { deskReport } from "../../../../../../sim/40-support/desk-reports";
import { held, inDesk, OWNER, PRIORITIES } from "../../../../../../sim/40-support/desk-work";
import { isFinal, type Ticket, type TicketKind } from "../../../../../../sim/40-support/tickets";
import type { GameState } from "../../../../../../sim/50-state";
import { kbArticles } from "../../../../../../sim/80-business/website";
import { addNote, markSpam, mergeTickets, setDepartment, setPriority } from "../../../../../../sim/90-actions/desk";
import { assignTicket, closeTicket, resolveTicket } from "../../../../../../sim/90-actions/support";
import { useStore } from "../../../../../store";
import { ReplyPanel, type ReplyHandlers } from "../headless/ReplyPanel";
import { useDeskTickets } from "../headless/useDeskTickets";
import { useTicketPane, type PaneItem } from "../headless/useTicketPane";
import { useTicketReplies, type ReplyModel } from "../headless/useTicketReplies";
import { openTicket, Panel, when, type FdProps } from "./FreshduskSite";

type Act = ReturnType<typeof useStore.getState>["act"];
const unresolved = (s: GameState) => [...useDeskTickets(s, "open"), ...useDeskTickets(s, "waiting"), ...useDeskTickets(s, "escalated")];
const urgent = (s: GameState, tk: Ticket) => { const p = priorityOf(s, tk); return p === "urgent" || p === "high"; };

// The default ticket views in Freshdusk's order, with the tickets each one lists.
export const VIEWS: [string, (s: GameState) => Ticket[]][] = [
  ["new-my-open", (s) => unresolved(s).filter((x) => x.status === "open" && (!x.assignee || x.assignee === OWNER))],
  ["my-open-pending", (s) => unresolved(s).filter((x) => x.assignee === OWNER)],
  ["my-overdue", (s) => useDeskTickets(s, "overdue").filter((x) => x.assignee === OWNER)],
  ["urgent-high", (s) => unresolved(s).filter((x) => urgent(s, x))],
  ["all-unresolved", unresolved],
  ["all", (s) => [...unresolved(s), ...useDeskTickets(s, "closed")]],
  ["spam", (s) => useDeskTickets(s, "spam")],
];

export const statusOf = (tk: Ticket): DeskStatus => (tk.kind === "spam" || tk.outcome === "spam" ? "spam" : tk.status === "open" && tk.unread && !tk.replies.length ? "new" : tk.status);
const Status = ({ tk }: { tk: Ticket }) => {
  const id = STATUS_LABELS.freshdusk[statusOf(tk)];
  return <span className={`fd-status ${id}`}>{t(`fd.status.${id}`)}</span>;
};
// The ticket type each kind is filed under; Billing is a custom type the account adds.
const TYPE: Partial<Record<TicketKind, string>> = { outage: "incident", abuse: "problem", billing: "billing", cancellation: "billing", refund: "billing" };
export const typeOf = (k: TicketKind) => TYPE[k] ?? "question";
export const agentName = (s: GameState, id: string | null): string => (id === OWNER ? t("support.you") : s.staff.find((e) => e.id === id)?.name ?? "");
const supportStaff = (s: GameState) => s.staff.filter((e) => e.role === "support");

// Scenario automations: several property changes in one click.
export const SCENARIOS: { id: string; actions: (s: GameState) => string[]; run: (act: Act, s: GameState, tk: Ticket) => void }[] = [
  {
    id: "escalate",
    actions: () => [t("fd.rule.setPriority", { name: t("fd.priority.urgent") }), t("fd.rule.setAgent", { name: t("support.you") })],
    run: (act, _s, tk) => { act(setPriority, tk.id, "urgent"); act(assignTicket, tk.id, OWNER); },
  },
  {
    id: "toGroup",
    actions: (s) => [t("fd.rule.setGroup", { name: s.desk?.departments[0]?.name ?? "" }), t("fd.rule.unassign")],
    run: (act, s, tk) => { const d = s.desk?.departments[0]; if (d) act(setDepartment, tk.id, d.id); act(assignTicket, tk.id, null); },
  },
];

export function AgentPage(p: FdProps) {
  const page = p.route.page;
  if (page === "ticket" || page === "ticketMint") return <TicketPage {...p} />;
  if (page === "tickets" || page === "view" || page === "newTicket") return <Tickets {...p} />;
  if (page === "contacts" || page === "companies") return <Contacts {...p} />;
  if (page === "agentSolutions") return <Solutions {...p} />;
  if (page === "reports") return <Reports {...p} />;
  return <Dashboard {...p} />;
}

function Dashboard(p: FdProps) {
  const { game } = p, all = unresolved(game), day = game.hour - (game.hour % 24) + 24;
  const tiles: [string, number, string][] = [
    ["fd.dash.unresolved", all.length, "all-unresolved"],
    ["fd.dash.overdue", useDeskTickets(game, "overdue").length, "all-unresolved"],
    ["fd.dash.dueToday", all.filter((x) => x.status === "open" && x.dueAt >= game.hour && x.dueAt < day).length, "all-unresolved"],
    ["fd.dash.open", all.filter((x) => x.status === "open").length, "all-unresolved"],
    ["fd.dash.onHold", all.filter((x) => x.status === "waiting").length, "all-unresolved"],
    ["fd.dash.unassigned", all.filter((x) => !x.assignee).length, "new-my-open"],
  ];
  const groups = game.desk?.departments ?? [];
  const groupOf = (tk: Ticket) => tk.deptId ?? groups[0]?.id;
  const recent = game.tickets.filter((x) => inDesk(x) && held(x) && x.ref).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  return (
    <>
      <Panel title={t("fd.dash.summary")}>
        <div className="fd-tiles">{tiles.map(([key, n, view]) => <a key={key} onClick={() => p.nav("view", { view })}><b>{n}</b><span>{t(key)}</span></a>)}</div>
      </Panel>
      <div className="fd-cols">
        <Panel title={t("fd.dash.byGroup")}>
          <table className="fd-table">
            <thead><tr><th>{t("fd.group")}</th><th>{t("fd.dash.open")}</th></tr></thead>
            <tbody>{groups.map((d) => <tr key={d.id}><td>{d.name}</td><td>{all.filter((x) => groupOf(x) === d.id).length}</td></tr>)}</tbody>
          </table>
        </Panel>
        <Panel title={t("fd.dash.activity")}>
          <ul className="fd-feed">
            {recent.map((tk) => <li key={tk.id}><a onClick={() => openTicket(p, tk.ref)}>#{tk.ref} {useTicketPane(game, tk).subject}</a> <Status tk={tk} /> <time>{when(tk.updatedAt)}</time></li>)}
            {!recent.length && <li className="fd-empty">{t("fd.none")}</li>}
          </ul>
        </Panel>
      </div>
    </>
  );
}

function Tickets(p: FdProps) {
  const fallback = p.route.page === "view" ? p.route.args.view : "new-my-open";
  const id = VIEWS.some(([v]) => v === fallback) ? fallback! : "new-my-open";
  const list = VIEWS.find(([v]) => v === id)![1](p.game);
  return (
    <div className="fd-views">
      <nav className="fd-viewlist">
        <h3>{t("fd.views")}</h3>
        {VIEWS.map(([v, get]) => <a key={v} className={v === id ? "active" : ""} onClick={() => p.nav("view", { view: v })}><span>{t(`fd.view.${v}`)}</span><b>{get(p.game).length}</b></a>)}
      </nav>
      <Panel title={t(`fd.view.${id}`)}><TicketList {...p} list={list} /></Panel>
    </div>
  );
}

// Tick tickets to Pick, Close, mark as Spam or Merge them at once.
function TicketList(p: FdProps & { list: Ticket[] }) {
  const { game, list, look } = p;
  const act = useStore((s) => s.act);
  const [picked, setPicked] = useState<string[]>([]);
  const sel = picked.filter((id) => list.some((x) => x.id === id));
  const each = (fn: (id: string) => void) => { sel.forEach(fn); setPicked([]); };
  const toggle = (id: string) => setPicked(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const sla = deskHas(game, "slaTimers");
  const bulk = (
    <p className="fd-bulk">
      <span>{t("fd.tickets", { n: list.length })}</span>
      <button type="button" className="fd-btn" disabled={!sel.length} onClick={() => each((id) => act(assignTicket, id, OWNER))}>{t("fd.pick")}</button>
      <button type="button" className="fd-btn" disabled={!sel.length} onClick={() => each((id) => act(closeTicket, id))}>{t("fd.close")}</button>
      <button type="button" className="fd-btn" disabled={!sel.length} onClick={() => each((id) => act(markSpam, id))}>{t("fd.spam")}</button>
      {deskHas(game, "merge") && <button type="button" className="fd-btn" disabled={sel.length < 2} onClick={() => { act(mergeTickets, sel[0], sel.slice(1)); setPicked([]); }}>{t("fd.merge")}</button>}
    </p>
  );
  if (look === "mint") {
    return (
      <>
        {bulk}
        <ul className="fd-cards">
          {list.map((tk) => <Card key={tk.id} {...p} tk={tk} sla={sla} on={sel.includes(tk.id)} toggle={() => toggle(tk.id)} />)}
          {!list.length && <li className="fd-empty">{t("fd.none")}</li>}
        </ul>
      </>
    );
  }
  return (
    <>
      {bulk}
      <table className="fd-table fd-list">
        <thead><tr><th /><th>{t("fd.col.subject")}</th><th>{t("fd.col.requester")}</th><th>{t("fd.col.status")}</th><th>{t("fd.col.priority")}</th><th>{t("fd.col.agent")}</th>{sla && <th>{t("fd.col.due")}</th>}</tr></thead>
        <tbody>
          {list.map((tk) => <Row key={tk.id} {...p} tk={tk} sla={sla} on={sel.includes(tk.id)} toggle={() => toggle(tk.id)} />)}
          {!list.length && <tr><td colSpan={sla ? 7 : 6} className="fd-empty">{t("fd.none")}</td></tr>}
        </tbody>
      </table>
    </>
  );
}

interface RowProps extends FdProps { tk: Ticket; sla: boolean; on: boolean; toggle: () => void }

function Row(p: RowProps) {
  const { game, tk } = p, m = useTicketPane(game, tk);
  return (
    <tr>
      <td><input type="checkbox" aria-label={`#${tk.ref}`} checked={p.on} onChange={p.toggle} /></td>
      <td><a onClick={() => openTicket(p, tk.ref)}>{m.subject}</a> <small>#{tk.ref}</small></td>
      <td>{m.customer?.name ?? m.sender?.from ?? ""}</td>
      <td><Status tk={tk} /></td>
      <td>{t(`fd.priority.${priorityOf(game, tk)}`)}</td>
      <td>{agentName(game, tk.assignee)}</td>
      {p.sla && <td>{m.due && <span className={`fd-sla ${m.due.tone}`}>{m.due.text}</span>}</td>}
    </tr>
  );
}

// Mint's card layout: subject and number, requester and age, then priority, agent and status on the right.
function Card(p: RowProps) {
  const { game, tk } = p, m = useTicketPane(game, tk);
  return (
    <li className={`fd-card pri-${priorityOf(game, tk)}`}>
      <input type="checkbox" aria-label={`#${tk.ref}`} checked={p.on} onChange={p.toggle} />
      <div>
        <a onClick={() => openTicket(p, tk.ref)}>{m.subject} <small>#{tk.ref}</small></a>
        <p>{m.customer?.name ?? m.sender?.from ?? ""} · {when(tk.createdAt)}{p.sla && m.due && <> · <span className={`fd-sla ${m.due.tone}`}>{m.due.text}</span></>}</p>
      </div>
      <dl>
        <dd>{t(`fd.priority.${priorityOf(game, tk)}`)}</dd>
        <dd>{agentName(game, tk.assignee) || t("fd.unassigned")}</dd>
        <dd><Status tk={tk} /></dd>
      </dl>
    </li>
  );
}

const Tabs = ({ route, nav, look }: FdProps) => (
  <nav className="fd-subtabs">
    <a className={route.page === "contacts" ? "active" : ""} onClick={() => nav("contacts")}>{t(look === "mint" ? "fd.nav.contacts" : "fd.contacts")}</a>
    <a className={route.page === "companies" ? "active" : ""} onClick={() => nav("companies")}>{t("fd.companies")}</a>
  </nav>
);

function Contacts(p: FdProps) {
  const { game } = p, people = p.route.page === "contacts" ? game.customers.filter((c) => c.churnedAt === null) : [];
  return (
    <Panel title={t(p.look === "mint" ? "fd.nav.contacts" : "fd.nav.customers")}>
      <Tabs {...p} />
      <table className="fd-table">
        <thead><tr><th>{t("fd.name")}</th><th>{t("fd.email")}</th><th>{t("fd.col.tickets")}</th></tr></thead>
        <tbody>
          {people.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.address.email}</td><td>{game.tickets.filter((x) => x.customerId === c.id && x.ref).length}</td></tr>)}
          {!people.length && <tr><td colSpan={3} className="fd-empty">{t("fd.none")}</td></tr>}
        </tbody>
      </table>
    </Panel>
  );
}

function Solutions({ game, nav }: FdProps) {
  return (
    <Panel title={t("fd.nav.solutions")}>
      <h3>{t("fd.solutions.general")}</h3>
      <table className="fd-table">
        <thead><tr><th>{t("fd.solutions.article")}</th><th>{t("fd.solutions.views")}</th></tr></thead>
        <tbody>{kbArticles(game).map((a) => <tr key={a.topic}><td><a onClick={() => nav("solution", { id: a.topic })}>{t(`ticket.howTo.${a.topic}.subject`, {})}</a></td><td>{a.reads}</td></tr>)}</tbody>
      </table>
    </Panel>
  );
}

function Reports({ game }: FdProps) {
  const r = deskReport(game, game.hour - 30 * 24, game.hour + 1), sla = deskHas(game, "slaTimers");
  const hours = (n: number | null) => (n === null ? "" : t("fd.hours", { n: n.toLocaleString(LOCALE, { maximumFractionDigits: 1 }) }));
  const rows: [string, string][] = [
    ["fd.report.received", String(r.created)], ["fd.report.resolved", String(r.solved)], ["fd.report.firstResponse", hours(r.firstResponse)],
    ...(sla ? [["fd.report.sla", r.slaHit === null ? "" : r.slaHit.toLocaleString(LOCALE, { style: "percent" })] as [string, string]] : []),
  ];
  return (
    <>
      <Panel title={t("fd.report.title")}><div className="fd-tiles">{rows.map(([k, v]) => <p key={k}><b>{v}</b><span>{t(k)}</span></p>)}</div></Panel>
      <Panel title={t("fd.report.agents")}>
        <table className="fd-table">
          <thead><tr><th>{t("fd.col.agent")}</th><th>{t("fd.report.replies")}</th></tr></thead>
          <tbody>{Object.entries(r.byAgent).map(([id, n]) => <tr key={id}><td>{agentName(game, id) || id}</td><td>{n}</td></tr>)}</tbody>
        </table>
      </Panel>
    </>
  );
}

type Mode = "reply" | "note" | null;

function TicketPage(p: FdProps) {
  const { game, route, look } = p;
  const act = useStore((s) => s.act);
  const [mode, setMode] = useState<Mode>(null);
  const tk = game.desk ? game.tickets.find((x) => x.ref === route.args.n && inDesk(x) && held(x)) : undefined;
  if (!tk) return <Panel title={t("fd.ticket")}><p className="fd-error">{t("fd.noTicket")}</p></Panel>;
  const m = useTicketPane(game, tk), r = useTicketReplies(game, tk), open = !isFinal(tk) && statusOf(tk) !== "spam";
  const customer = game.customers.find((c) => c.id === tk.customerId);
  const related = customer ? game.tickets.filter((x) => x.customerId === customer.id && x.id !== tk.id && x.ref && inDesk(x)) : [];
  const dups = deskHas(game, "merge") ? related.filter((x) => x.kind === tk.kind && !isFinal(x) && held(x)) : [];
  const sla = deskHas(game, "slaTimers") && open && m.due;
  const close = () => act(r.resolve ? resolveTicket : closeTicket, tk.id);
  const toolbar = open && (
    <nav className="fd-toolbar">
      <button type="button" className={mode === "reply" ? "fd-btn on" : "fd-btn"} onClick={() => setMode("reply")}>{t("fd.reply")}</button>
      <button type="button" className={mode === "note" ? "fd-btn on" : "fd-btn"} onClick={() => setMode("note")}>{t("fd.addNote")}</button>
      {dups.length > 0 && (
        <select aria-label={t("fd.merge")} value="" onChange={(e) => act(mergeTickets, tk.id, [e.target.value])}>
          <option value="">{t("fd.merge")}</option>
          {dups.map((x) => <option key={x.id} value={x.id}>#{x.ref}</option>)}
        </select>
      )}
      <button type="button" className="fd-btn" disabled={!r.resolve && r.close === null} onClick={close}>{t("fd.close")}</button>
      <button type="button" className="fd-btn" onClick={() => act(markSpam, tk.id)}>{t("fd.spam")}</button>
      <select aria-label={t("fd.scenarios")} value="" onChange={(e) => SCENARIOS.find((x) => x.id === e.target.value)?.run(act, game, tk)}>
        <option value="">{t("fd.scenarios")}</option>
        {SCENARIOS.map((x) => <option key={x.id} value={x.id}>{t(`fd.scenario.${x.id}`)}</option>)}
      </select>
    </nav>
  );
  return (
    <div className={look === "classic" ? "fd-ticket classic" : "fd-ticket"}>
      <article className="fd-conv">
        <header className="fd-thead">
          <h1>{m.subject}</h1>
          <p><Status tk={tk} /> <span>#{tk.ref}</span> <span>{t(tk.via === "web" ? "fd.source.portal" : "fd.source.email")}</span>
            {sla && <span className={`fd-sla ${m.due!.tone}`}>{m.due!.text}</span>}</p>
        </header>
        {toolbar}
        {look === "classic" && <Properties key={tk.id} {...p} tk={tk} r={r} open={open} />}
        <div className="fd-thread">{m.items.map((it, i) => <Item key={i} it={it} />)}</div>
        {open && mode === "reply" && <Composer {...p} tk={tk} />}
        {open && mode === "note" && <NoteBox tk={tk} done={() => setMode(null)} />}
      </article>
      <aside className="fd-aside">
        {look !== "classic" && <Properties key={tk.id} {...p} tk={tk} r={r} open={open} />}
        <section className="fd-requester">
          <h3>{t(look === "mint" ? "fd.contactDetails" : "fd.requesterInfo")}</h3>
          {m.customer ? <><b>{m.customer.name}</b><p>{customer?.address.email}</p><p>{m.customer.line}</p></> : <p>{m.sender?.from}</p>}
          <h4>{t("fd.recentTickets")}</h4>
          <ul>{related.map((x) => <li key={x.id}><a onClick={() => openTicket(p, x.ref)}>#{x.ref} {useTicketPane(game, x).subject}</a> <Status tk={x} /></li>)}</ul>
          {!related.length && <p className="fd-empty">{t("fd.none")}</p>}
        </section>
      </aside>
    </div>
  );
}

// Ticket properties: changes wait for Update, as in the product. Pending is set by a reply, the other states by the sidebar.
function Properties({ game, tk, r, open }: FdProps & { tk: Ticket; r: ReplyModel; open: boolean }) {
  const act = useStore((s) => s.act);
  const pri = priorityOf(game, tk), dept = tk.deptId ?? game.desk!.departments[0]?.id ?? "";
  const [form, setForm] = useState({ status: "", priority: "", group: "", agent: null as string | null });
  const cur = { status: form.status || tk.status, priority: form.priority || pri, group: form.group || dept, agent: form.agent ?? tk.assignee ?? "" };
  const statuses = [tk.status, ...(r.resolve ? ["resolved"] : []), ...(r.close !== null ? ["closed"] : [])].filter((x, i, a) => a.indexOf(x) === i);
  const update = () => {
    if (cur.priority !== pri) act(setPriority, tk.id, cur.priority as Priority);
    if (cur.group !== dept) act(setDepartment, tk.id, cur.group);
    if (cur.agent !== (tk.assignee ?? "")) act(assignTicket, tk.id, cur.agent || null);
    if (cur.status === "resolved" && tk.status !== "resolved") act(resolveTicket, tk.id);
    else if (cur.status === "closed" && tk.status !== "closed") act(closeTicket, tk.id);
    setForm({ status: "", priority: "", group: "", agent: null });
  };
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return (
    <section className="fd-props">
      <h3>{t("fd.properties")}</h3>
      <label><span>{t("fd.type")}</span><b>{t(`fd.type.${typeOf(tk.kind)}`)}</b></label>
      <label><span>{t("fd.col.status")}</span>
        <select value={cur.status} disabled={!open} onChange={set("status")}>{statuses.map((x) => <option key={x} value={x}>{t(`fd.status.${STATUS_LABELS.freshdusk[x as DeskStatus]}`)}</option>)}</select>
      </label>
      <label><span>{t("fd.col.priority")}</span>
        <select value={cur.priority} disabled={!open} onChange={set("priority")}>{[...PRIORITIES].reverse().map((x) => <option key={x} value={x}>{t(`fd.priority.${x}`)}</option>)}</select>
      </label>
      <label><span>{t("fd.group")}</span>
        <select value={cur.group} disabled={!open} onChange={set("group")}>{game.desk!.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
      </label>
      <label><span>{t("fd.col.agent")}</span>
        <select value={cur.agent} disabled={!open} onChange={set("agent")}>
          <option value="">-</option>
          <option value={OWNER}>{t("support.you")}</option>
          {supportStaff(game).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </label>
      <label><span>{t("fd.tags")}</span><b className="fd-tags">{[tk.kind, tk.topic].map((x) => <i key={x}>{x.toLowerCase()}</i>)}</b></label>
      {deskHas(game, "slaTimers") && <label><span>{t("fd.dueBy")}</span><b>{when(tk.dueAt)}</b></label>}
      {open && <button type="button" className="fd-btn primary" onClick={update}>{t("fd.update")}</button>}
    </section>
  );
}

function Item({ it }: { it: PaneItem }) {
  if (it.type === "event") return it.hour === null ? null : <p className="fd-event">{it.text} <time>{when(it.hour)}</time></p>;
  if (it.type === "note") return <Note cls="private" who={it.by} hour={it.hour} text={it.text} />;
  return (
    <>
      {it.type === "reply" && it.followUp && <Note cls="" who={it.followUp.from} hour={it.followUp.hour} text={it.followUp.text} />}
      <Note cls={it.msg.you ? "agent" : ""} who={it.msg.from} hour={it.msg.hour} text={it.msg.text} />
    </>
  );
}
const Note = ({ cls, who, hour, text }: { cls: string; who: string; hour: number; text: string }) => (
  <div className={`fd-note ${cls}`}><header><b>{who}</b><time>{when(hour)}</time></header><p>{text}</p></div>
);

function NoteBox({ tk, done }: { tk: Ticket; done: () => void }) {
  const act = useStore((s) => s.act), [note, setNote] = useState("");
  return (
    <form className="fd-editor private" onSubmit={(e) => { e.preventDefault(); if (act(addNote, tk.id, note).ok) { setNote(""); done(); } }}>
      <textarea rows={4} aria-label={t("fd.addNote")} value={note} onChange={(e) => setNote(e.target.value)} />
      <footer><span /><button type="submit" className="fd-btn primary" disabled={!note.trim()}>{t("fd.addNote")}</button></footer>
    </form>
  );
}

// What Insert canned response picks: a reply text, a retention offer, a ticket action, an answer or closing the ticket.
type Pick = "" | `tpl:${string}` | `offer:${string}` | `action:${string}` | `answer:${string}` | "close";

function runPick(h: ReplyHandlers, pick: Pick): void {
  const [kind, id] = pick.split(":") as [string, never];
  if (kind === "tpl") h.reply(id);
  else if (kind === "offer") h.retain(id);
  else if (kind === "action") h.action(id);
  else if (kind === "answer") h.answer(id);
  else if (kind === "close") h.close();
}

// The reply editor: a canned response, then Send, or Send and set as Pending or Resolved.
function Composer({ game, tk }: FdProps & { tk: Ticket }) {
  const [pick, setPick] = useState<Pick>(""), [status, setStatus] = useState(""), [code, setCode] = useState("");
  const options = (m: ReplyModel): string[] => (pick.startsWith("tpl:") ? ["waiting", "resolved"] : pick ? [] : m.resolve ? ["resolved"] : []);
  return (
    <ReplyPanel
      game={game}
      ticket={tk}
      previews={deskHas(game, "templates")}
      frame={(b) => <div className="fd-editor">{b}</div>}
      buttons={(m, h) => {
        const opts = options(m), to = opts.includes(status) ? status : opts[0] ?? "";
        const label = (st: string) => t(`fd.status.${STATUS_LABELS.freshdusk[st as DeskStatus]}`);
        const send = () => {
          if (pick) runPick(h, pick);
          if (to === "resolved") h.resolve();
          setPick(""); setStatus("");
        };
        const tpl = pick.startsWith("tpl:") ? m.templates?.find((x) => `tpl:${x.id}` === pick) : undefined;
        return (
          <>
            <select className="fd-canned" aria-label={t("fd.canned")} value={pick} disabled={m.locked} onChange={(e) => setPick(e.target.value as Pick)}>
              <option value="">{t("fd.canned")}</option>
              {!!m.templates?.length && <optgroup label={t("fd.admin.canned")}>{m.templates.map((x) => <option key={x.id} value={`tpl:${x.id}`}>{x.title}</option>)}</optgroup>}
              {!!m.offers?.length && <optgroup label={t("support.retentionOffers")}>{m.offers.map((o) => <option key={o.id} value={`offer:${o.id}`}>{`${o.title} (${o.value}, ${o.oddsLabel})`}</option>)}</optgroup>}
              {(m.actions.length > 0 || m.answers.length > 0 || m.close !== null) && (
                <optgroup label={t("fd.ticketActions")}>
                  {m.actions.map((a) => <option key={a.id} value={`action:${a.id}`} disabled={a.disabled}>{a.amount !== null ? `${a.label} (${a.amount})` : a.label}</option>)}
                  {m.answers.map((a) => <option key={a.id} value={`answer:${a.id}`} disabled={a.disabled}>{a.label}</option>)}
                  {m.close !== null && <option value="close">{m.close}</option>}
                </optgroup>
              )}
            </select>
            <textarea readOnly rows={5} aria-label={t("fd.reply")} value={tpl?.preview ?? tpl?.title ?? ""} />
            {m.transfer && (
              <p className="fd-transfer">
                <input aria-label={t("registrarForm.authCode")} placeholder={t("registrarForm.authCode")} value={code} onChange={(e) => setCode(e.target.value)} />
                <button type="button" className="fd-btn" disabled={m.locked || !code.trim()} onClick={() => h.transfer(code)}>{t("support.sendCode")}</button>
                <button type="button" className="fd-btn" disabled={m.locked} onClick={() => h.transfer(null)}>{t("support.refuseTransfer")}</button>
              </p>
            )}
            <footer>
              <span />
              <span className="fd-send">
                <button type="button" className="fd-btn primary" disabled={m.locked || (!pick && !to)} onClick={send}>{to ? t("fd.sendAs", { status: label(to) }) : t("fd.send")}</button>
                {opts.length > 1 && <select aria-label={t("fd.col.status")} value={to} onChange={(e) => setStatus(e.target.value)}>{opts.map((x) => <option key={x} value={x}>{label(x)}</option>)}</select>}
              </span>
            </footer>
          </>
        );
      }}
    />
  );
}
