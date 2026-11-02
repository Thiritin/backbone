import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { deskHas, STATUS_LABELS, type DeskStatus } from "../../../../../../sim/10-catalog/desks";
import { priorityOf, type Priority } from "../../../../../../sim/40-support/desk";
import { deskRecords } from "../../../../../../sim/40-support/desk-records";
import { deskReport } from "../../../../../../sim/40-support/desk-reports";
import { held, inDesk, OWNER, PRIORITIES } from "../../../../../../sim/40-support/desk-work";
import type { Ticket, TicketKind } from "../../../../../../sim/40-support/tickets";
import type { GameState } from "../../../../../../sim/50-state";
import { addNote, markSpam, setDepartment, setPriority } from "../../../../../../sim/90-actions/desk";
import { assignTicket } from "../../../../../../sim/90-actions/support";
import { useStore } from "../../../../../store";
import { ReplyPanel, type ReplyHandlers } from "../headless/ReplyPanel";
import { DraftBox, Suggested, ticketArticle } from "../headless/AiPage";
import { useDeskTickets } from "../headless/useDeskTickets";
import { useTicketPane, type PaneItem } from "../headless/useTicketPane";
import type { ReplyModel } from "../headless/useTicketReplies";
import { Panel, when, type ZdPage, type ZdProps } from "./ZenduskSite";

const WEEK = 7 * 24;
const unsolved = (s: GameState) => [...useDeskTickets(s, "open"), ...useDeskTickets(s, "waiting"), ...useDeskTickets(s, "escalated")];
const recent = (s: GameState, list: Ticket[]) => list.filter((x) => x.updatedAt >= s.hour - WEEK).sort((a, b) => b.updatedAt - a.updatedAt);

// The default views in Zendusk's order, with the tickets each one lists.
export const VIEWS: [string, (s: GameState) => Ticket[]][] = [
  ["your-unsolved", (s) => unsolved(s).filter((x) => x.assignee === OWNER)],
  ["unassigned", (s) => unsolved(s).filter((x) => !x.assignee)],
  ["all-unsolved", unsolved],
  ["recently-updated", (s) => recent(s, [...unsolved(s), ...useDeskTickets(s, "closed")])],
  ["pending", (s) => useDeskTickets(s, "waiting")],
  ["recently-solved", (s) => recent(s, useDeskTickets(s, "closed"))],
  ["suspended", (s) => useDeskTickets(s, "spam")],
];
export const viewName = (p: ZdProps, id: string) => t(id === "your-unsolved" && p.look === "classic" ? "zd.view.my-unsolved" : `zd.view.${id}`);

export const statusOf = (tk: Ticket): DeskStatus => (tk.kind === "spam" || tk.outcome === "spam" ? "spam" : tk.status === "open" && tk.unread && !tk.replies.length ? "new" : tk.status);
const Status = ({ tk }: { tk: Ticket }) => {
  const id = STATUS_LABELS.zendusk[statusOf(tk)];
  return <span className={`zd-status ${id}`}>{t(`zd.status.${id}`)}</span>;
};
const TYPE: Partial<Record<TicketKind, string>> = { outage: "incident", howTo: "question", billing: "question", abuse: "problem", order: "task", migration: "task" };
const typeOf = (k: TicketKind) => TYPE[k] ?? "question";
export const assigneeName = (s: GameState, id: string | null): string => (id === OWNER ? t("support.you") : s.staff.find((e) => e.id === id)?.name ?? "");

export function AgentPage(p: ZdProps) {
  const page = p.route.page as ZdPage;
  if (page === "ticket") return <TicketPage {...p} />;
  if (page === "view") return <Views {...p} />;
  if (page === "start") return <GetStarted {...p} />;
  if (page === "users") return <Users {...p} />;
  if (page === "organizations") return <Panel title={t("zd.organizations")}><Tabs {...p} /><table className="zd-table"><tbody><tr><td className="zd-empty">{t("zd.none")}</td></tr></tbody></table></Panel>;
  if (page === "reporting") return <Reporting {...p} />;
  if (page === "search") return <Search {...p} />;
  return <Home {...p} />;
}

function Home(p: ZdProps) {
  const { game, nav } = p;
  const mine = VIEWS[0][1](game), all = unsolved(game), solved = VIEWS[5][1](game).filter((x) => x.status === "resolved");
  const count = (list: Ticket[], status: Ticket["status"]) => list.filter((x) => x.status === status).length;
  const stats: [string, number][] = [
    [t("zd.home.youOpen"), count(mine, "open")], [t("zd.home.youPending"), count(mine, "waiting")],
    [t("zd.home.groupsOpen"), count(all, "open")], [t("zd.home.groupsPending"), count(all, "waiting")], [t("zd.home.solved"), solved.length],
  ];
  return (
    <>
      <Panel title={t("zd.home.title")} actions={!onboarded(game) ? <a className="zd-btn" onClick={() => nav("start")}>{t("zd.start.title")}</a> : null}>
        <div className="zd-stats">{stats.map(([label, n]) => <p key={label}><b>{n}</b><span>{label}</span></p>)}</div>
      </Panel>
      <Panel title={viewName(p, "your-unsolved")}><List {...p} list={mine} /></Panel>
    </>
  );
}

// The onboarding list a new account opens on.
export const steps = (s: GameState): [string, boolean, ZdPage, Record<string, string>][] => [
  ["zd.start.email", s.mail.channels.some((c) => c.desk === "zendusk" && c.verified), "adminScreen", { section: "email" }],
  ["zd.start.agents", s.staff.some((e) => e.role === "support"), "adminScreen", { section: "people" }],
  ["zd.start.domain", deskRecords(s).some((r) => r.role === "host" && r.ok), "adminScreen", { section: "branding" }],
  ["zd.start.hc", s.tickets.some((x) => x.via === "web"), "hc", {}],
];
const onboarded = (s: GameState) => steps(s).every(([, done]) => done);

function GetStarted({ game, nav }: ZdProps) {
  return (
    <Panel title={t("zd.start.title")}>
      <ol className="zd-steps">
        {steps(game).map(([key, done, page, args]) => <li key={key} className={done ? "done" : ""}><a onClick={() => nav(page, args)}>{t(key)}</a>{done && <span>{t("zd.start.done")}</span>}</li>)}
      </ol>
    </Panel>
  );
}

function Views(p: ZdProps) {
  const id = VIEWS.some(([v]) => v === p.route.args.view) ? p.route.args.view! : "your-unsolved";
  const list = VIEWS.find(([v]) => v === id)![1](p.game);
  return (
    <div className="zd-views">
      <nav className="zd-viewlist">
        <h3>{t("zd.nav.views")}</h3>
        {VIEWS.map(([v, get]) => <a key={v} className={v === id ? "active" : ""} onClick={() => p.nav("view", { view: v })}><span>{viewName(p, v)}</span><b>{get(p.game).length}</b></a>)}
      </nav>
      <Panel title={viewName(p, id)}><p className="zd-count">{t("zd.tickets", { n: list.length })}</p><List {...p} list={list} /></Panel>
    </div>
  );
}

function List({ game, nav, list }: ZdProps & { list: Ticket[] }) {
  const sla = deskHas(game, "slaTimers");
  return (
    <table className="zd-table">
      <thead><tr><th>{t("zd.col.status")}</th><th>{t("zd.col.id")}</th><th>{t("zd.col.subject")}</th><th>{t("zd.col.requester")}</th><th>{t("zd.col.requested")}</th><th>{t("zd.col.priority")}</th><th>{t("zd.col.assignee")}</th>{sla && <th>{t("zd.col.sla")}</th>}</tr></thead>
      <tbody>
        {list.map((tk) => <Row key={tk.id} game={game} tk={tk} sla={sla} open={() => nav("ticket", { n: tk.ref ?? "" })} />)}
        {!list.length && <tr><td colSpan={sla ? 8 : 7} className="zd-empty">{t("zd.none")}</td></tr>}
      </tbody>
    </table>
  );
}

function Row({ game, tk, sla, open }: { game: GameState; tk: Ticket; sla: boolean; open: () => void }) {
  const m = useTicketPane(game, tk);
  return (
    <tr onClick={open}>
      <td><Status tk={tk} /></td>
      <td>#{tk.ref}</td>
      <td><a>{m.subject}</a></td>
      <td>{m.customer?.name ?? m.sender?.from ?? ""}</td>
      <td>{when(tk.createdAt)}</td>
      <td>{t(`zd.priority.${priorityOf(game, tk)}`)}</td>
      <td>{assigneeName(game, tk.assignee)}</td>
      {sla && <td>{m.due && <span className={`zd-sla ${m.due.tone}`}>{m.due.text}</span>}</td>}
    </tr>
  );
}

const Tabs = ({ route, nav }: ZdProps) => (
  <nav className="zd-subtabs">
    <a className={route.page === "users" ? "active" : ""} onClick={() => nav("users")}>{t("zd.users")}</a>
    <a className={route.page === "organizations" ? "active" : ""} onClick={() => nav("organizations")}>{t("zd.organizations")}</a>
  </nav>
);

function Users(p: ZdProps) {
  const { game } = p, people = game.customers.filter((c) => c.churnedAt === null);
  return (
    <Panel title={t(p.look === "classic" ? "zd.users" : "zd.nav.customers")}>
      <Tabs {...p} />
      <table className="zd-table">
        <thead><tr><th>{t("zd.name")}</th><th>{t("zd.email")}</th><th>{t("zd.col.tickets")}</th></tr></thead>
        <tbody>{people.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.address.email}</td><td>{game.tickets.filter((x) => x.customerId === c.id && x.ref).length}</td></tr>)}</tbody>
      </table>
    </Panel>
  );
}

function Reporting({ game }: ZdProps) {
  const r = deskReport(game, game.hour - 30 * 24, game.hour + 1), sla = deskHas(game, "slaTimers");
  const hours = (n: number | null) => (n === null ? "" : t("zd.hours", { n: n.toLocaleString(LOCALE, { maximumFractionDigits: 1 }) }));
  const rows: [string, string][] = [
    ["zd.report.created", String(r.created)], ["zd.report.solved", String(r.solved)], ["zd.report.firstReply", hours(r.firstResponse)],
    ...(sla ? [["zd.report.sla", r.slaHit === null ? "" : r.slaHit.toLocaleString(LOCALE, { style: "percent" })] as [string, string]] : []),
  ];
  return (
    <>
      <Panel title={t("zd.report.title")}>
        <div className="zd-stats">{rows.map(([k, v]) => <p key={k}><b>{v}</b><span>{t(k)}</span></p>)}</div>
      </Panel>
      <Panel title={t("zd.report.agents")}>
        <table className="zd-table">
          <thead><tr><th>{t("zd.name")}</th><th>{t("zd.report.replies")}</th></tr></thead>
          <tbody>{Object.entries(r.byAgent).map(([id, n]) => <tr key={id}><td>{id === OWNER ? t("support.you") : id}</td><td>{n}</td></tr>)}</tbody>
        </table>
      </Panel>
    </>
  );
}

function Search(p: ZdProps) {
  const [q, setQ] = useState("");
  const all = p.game.tickets.filter((x) => inDesk(x) && held(x) && x.ref), needle = q.trim().toLowerCase();
  const hits = needle ? all.filter((x) => x.ref === needle.replace(/^#/, "") || subjectOf(p.game, x).toLowerCase().includes(needle) || (p.game.customers.find((c) => c.id === x.customerId)?.name.toLowerCase().includes(needle) ?? false)) : [];
  return (
    <Panel title={t("zd.search")}>
      <input className="zd-bigsearch" type="search" aria-label={t("zd.search")} placeholder={t("zd.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      {needle && <><p className="zd-count">{t("zd.results", { n: hits.length })}</p><List {...p} list={hits} /></>}
    </Panel>
  );
}
const subjectOf = (s: GameState, tk: Ticket): string => useTicketPane(s, tk).subject;

type Mode = "public" | "note";

function TicketPage(p: ZdProps) {
  const { game, nav, route, look } = p;
  const act = useStore((s) => s.act);
  const tk = game.desk ? game.tickets.find((x) => x.ref === route.args.n && inDesk(x) && held(x)) : undefined;
  if (!tk) return <Panel title={t("zd.ticket")}><p className="zd-error">{t("zd.noTicket")}</p></Panel>;
  const m = useTicketPane(game, tk), open = tk.status !== "closed" && tk.status !== "resolved" && statusOf(tk) !== "spam";
  const customer = game.customers.find((c) => c.id === tk.customerId);
  const related = customer ? game.tickets.filter((x) => x.customerId === customer.id && x.id !== tk.id && x.ref && inDesk(x)) : [];
  const staff = game.staff.filter((e) => e.role === "support");
  const sla = deskHas(game, "slaTimers") && open && m.due;
  const items = look === "workspace" ? m.items : [...m.items].reverse();
  const props = (
    <aside className="zd-props">
      <label><span>{t("zd.col.requester")}</span><b>{m.customer?.name ?? m.sender?.from ?? ""}</b></label>
      <label><span>{t("zd.col.assignee")}</span>
        <select value={tk.assignee ?? ""} disabled={!open} onChange={(e) => act(assignTicket, tk.id, e.target.value || null)}>
          <option value="">-</option>
          <option value={OWNER}>{t("support.you")}</option>
          {staff.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        {open && look === "classic" && tk.assignee !== OWNER && <a onClick={() => act(assignTicket, tk.id, OWNER)}>{t("zd.takeIt")}</a>}
      </label>
      <label><span>{t("zd.group")}</span>
        <select value={tk.deptId ?? ""} disabled={!open} onChange={(e) => act(setDepartment, tk.id, e.target.value)}>
          {game.desk!.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
      <label><span>{t("zd.ccs")}</span><b /></label>
      <label><span>{t("zd.tags")}</span><b className="zd-tags">{[tk.kind, tk.topic].map((x) => <i key={x}>{x.toLowerCase()}</i>)}</b></label>
      <label><span>{t("zd.type")}</span><b>{t(`zd.type.${typeOf(tk.kind)}`)}</b></label>
      <label><span>{t("zd.col.priority")}</span>
        <select value={priorityOf(game, tk)} disabled={!open} onChange={(e) => act(setPriority, tk.id, e.target.value as Priority)}>
          {[...PRIORITIES].reverse().map((x) => <option key={x} value={x}>{t(`zd.priority.${x}`)}</option>)}
        </select>
      </label>
    </aside>
  );
  return (
    <div className="zd-ticket">
      {look !== "classic" && props}
      <article className="zd-conv">
        <header className="zd-thead">
          <h1>{m.subject}</h1>
          <p><Status tk={tk} /> <span>#{tk.ref}</span> <span>{t(tk.via === "web" ? "zd.via.web" : "zd.via.email")}</span>
            {sla && <span className={`zd-sla ${m.due!.tone}`}>{m.due!.text}</span>}
            {open && <button type="button" className="zd-btn" onClick={() => act(markSpam, tk.id)}>{t("zd.markSpam")}</button>}
          </p>
        </header>
        {look === "classic" && props}
        {look !== "workspace" && open && <><DraftBox game={game} tk={tk} brand="zd" /><Composer {...p} tk={tk} /></>}
        <div className="zd-thread">{items.map((it, i) => <Item key={i} it={it} />)}</div>
        {look === "workspace" && open && <><DraftBox game={game} tk={tk} brand="zd" /><Composer {...p} tk={tk} /></>}
      </article>
      <aside className="zd-requester">
        <h3>{t(look === "workspace" ? "zd.context" : "zd.user")}</h3>
        {m.customer ? <><b>{m.customer.name}</b><p>{customer?.address.email}</p><p>{m.customer.line}</p></> : <p>{m.sender?.from}</p>}
        <h4>{t("zd.related")}</h4>
        <ul>{related.map((x) => <li key={x.id}><Status tk={x} /> <a onClick={() => nav("ticket", { n: x.ref ?? "" })}>#{x.ref} {subjectOf(game, x)}</a></li>)}</ul>
        {!related.length && <p className="zd-empty">{t("zd.none")}</p>}
        <Suggested topics={[ticketArticle(game, tk)].filter((x) => x !== null)} brand="zd" open={(id) => nav("hcArticle", { id })} />
      </aside>
    </div>
  );
}

function Item({ it }: { it: PaneItem }) {
  if (it.type === "event") return it.hour === null ? null : <p className="zd-event">{it.text} <time>{when(it.hour)}</time></p>;
  if (it.type === "note") return <Comment cls="internal" who={it.by} hour={it.hour} text={it.text} />;
  return (
    <>
      {it.type === "reply" && it.followUp && <Comment cls="" who={it.followUp.from} hour={it.followUp.hour} text={it.followUp.text} />}
      <Comment cls={it.msg.you ? "agent" : ""} who={it.msg.from} hour={it.msg.hour} text={it.msg.text} />
    </>
  );
}
const Comment = ({ cls, who, hour, text }: { cls: string; who: string; hour: number; text: string }) => (
  <div className={`zd-comment ${cls}`}><header><b>{who}</b><time>{when(hour)}</time></header><p>{text}</p></div>
);

// The macro picked in Apply macro: a reply text, a retention offer, a ticket action, an answer or closing the ticket.
type Macro = "" | `tpl:${string}` | `offer:${string}` | `action:${string}` | `answer:${string}` | "close";

function runMacro(h: ReplyHandlers, macro: Macro): void {
  const [kind, id] = macro.split(":") as [string, never];
  if (kind === "tpl") h.reply(id);
  else if (kind === "offer") h.retain(id);
  else if (kind === "action") h.action(id);
  else if (kind === "answer") h.answer(id);
  else if (kind === "close") h.close();
}

// The comment box: Public reply or Internal note (the Public checkbox in the classic look), Apply macro and Submit as.
function Composer(p: ZdProps & { tk: Ticket }) {
  const { game, tk, look } = p;
  const act = useStore((s) => s.act);
  const [mode, setMode] = useState<Mode>("public"), [macro, setMacro] = useState<Macro>(""), [status, setStatus] = useState(""), [note, setNote] = useState(""), [code, setCode] = useState("");
  if (mode === "note") {
    return (
      <form className="zd-composer internal" onSubmit={(e) => { e.preventDefault(); if (act(addNote, tk.id, note).ok) setNote(""); }}>
        <ModeSwitch look={look} mode={mode} set={setMode} />
        <textarea rows={4} aria-label={t("zd.internalNote")} value={note} onChange={(e) => setNote(e.target.value)} />
        <footer><span /><button type="submit" className="zd-btn primary" disabled={!note.trim()}>{t("zd.submit")}</button></footer>
      </form>
    );
  }
  // A reply leaves the ticket pending unless it is solved at once; other macros take the status the simulation gives.
  const options = (m: ReplyModel): string[] => (macro.startsWith("tpl:") ? ["waiting", "resolved"] : macro ? [] : m.resolve ? ["resolved"] : []);
  return (
    <ReplyPanel
      game={game}
      ticket={tk}
      previews={deskHas(game, "templates")}
      frame={(b) => <div className="zd-composer">{b}</div>}
      buttons={(m, h) => {
        const opts = options(m), pick = opts.includes(status) ? status : opts[0] ?? "";
        const label = (st: string) => t(`zd.status.${STATUS_LABELS.zendusk[st as DeskStatus]}`);
        const submit = () => {
          if (macro) runMacro(h, macro);
          if (pick === "resolved") h.resolve();
          setMacro(""); setStatus("");
        };
        const tpl = macro.startsWith("tpl:") ? m.templates?.find((x) => `tpl:${x.id}` === macro) : undefined;
        return (
          <>
            <ModeSwitch look={look} mode={mode} set={setMode} />
            <textarea readOnly rows={5} aria-label={t("zd.publicReply")} value={tpl?.preview ?? tpl?.title ?? ""} />
            {m.transfer && (
              <p className="zd-transfer">
                <input aria-label={t("registrarForm.authCode")} placeholder={t("registrarForm.authCode")} value={code} onChange={(e) => setCode(e.target.value)} />
                <button type="button" className="zd-btn" disabled={m.locked || !code.trim()} onClick={() => h.transfer(code)}>{t("support.sendCode")}</button>
                <button type="button" className="zd-btn" disabled={m.locked} onClick={() => h.transfer(null)}>{t("support.refuseTransfer")}</button>
              </p>
            )}
            <footer>
              <select className="zd-macro" aria-label={t("zd.applyMacro")} value={macro} disabled={m.locked} onChange={(e) => setMacro(e.target.value as Macro)}>
                <option value="">{t("zd.applyMacro")}</option>
                {!!m.templates?.length && <optgroup label={t("zd.macro.replies")}>{m.templates.map((x) => <option key={x.id} value={`tpl:${x.id}`}>{x.title}</option>)}</optgroup>}
                {!!m.offers?.length && <optgroup label={t("support.retentionOffers")}>{m.offers.map((o) => <option key={o.id} value={`offer:${o.id}`}>{`${o.title} (${o.value}, ${o.oddsLabel})`}</option>)}</optgroup>}
                {(m.actions.length > 0 || m.answers.length > 0 || m.close !== null) && (
                  <optgroup label={t("zd.macro.actions")}>
                    {m.actions.map((a) => <option key={a.id} value={`action:${a.id}`} disabled={a.disabled}>{a.amount !== null ? `${a.label} (${a.amount})` : a.label}</option>)}
                    {m.answers.map((a) => <option key={a.id} value={`answer:${a.id}`} disabled={a.disabled}>{a.label}</option>)}
                    {m.close !== null && <option value="close">{m.close}</option>}
                  </optgroup>
                )}
              </select>
              <span className="zd-submit">
                {look === "classic" && opts.length > 0 && (
                  <select aria-label={t("zd.ticketStatus")} value={pick} onChange={(e) => setStatus(e.target.value)}>{opts.map((x) => <option key={x} value={x}>{label(x)}</option>)}</select>
                )}
                <button type="button" className="zd-btn primary" disabled={m.locked || (!macro && !pick)} onClick={submit}>
                  {look === "classic" || !pick ? t("zd.submit") : t("zd.submitAs", { status: label(pick) })}
                </button>
                {look !== "classic" && opts.length > 1 && (
                  <select className="zd-split" aria-label={t("zd.ticketStatus")} value={pick} onChange={(e) => setStatus(e.target.value)}>{opts.map((x) => <option key={x} value={x}>{label(x)}</option>)}</select>
                )}
              </span>
            </footer>
          </>
        );
      }}
    />
  );
}

function ModeSwitch({ look, mode, set }: { look: ZdProps["look"]; mode: Mode; set: (m: Mode) => void }) {
  if (look === "classic") return <label className="zd-public"><input type="checkbox" checked={mode === "public"} onChange={(e) => set(e.target.checked ? "public" : "note")} /> {t("zd.publicComment")}</label>;
  return (
    <nav className="zd-modes">
      <a className={mode === "public" ? "active" : ""} onClick={() => set("public")}>{t("zd.publicReply")}</a>
      <a className={mode === "note" ? "active" : ""} onClick={() => set("note")}>{t("zd.internalNote")}</a>
    </nav>
  );
}
