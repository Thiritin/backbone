import { AlarmClock, BadgeCheck, Check, CircleCheck, CircleX, Handshake, Hourglass, Inbox, Layers, Mails, Send, Timer, TrendingDown, TriangleAlert, Wrench, X } from "lucide-react";
import { useState } from "react";
import { euroCents, euroPrice } from "../../../sim/00-core/money";
import { ACTIONS, canEscalate, isFinal, monthlyValue, TEMPLATES, type Ticket, type TicketAction, type TicketKind } from "../../../sim/40-support/tickets";
import { senderById, subjectParams, TAKEDOWN_HOURS } from "../../../sim/40-support/notices";
import { EXTENSION_DAYS } from "../../../sim/45-billing/billing";
import { missingFor, requestName, requirementsFor, type SalesRequest } from "../../../sim/30-market/market";
import { orderOf } from "../../../sim/30-market/orders";
import { companyParams } from "../../../sim/40-support/replies";
import type { GameState } from "../../../sim/50-state";
import { assignTicket, closeTicket, escalateTicket, readTicket, replyTicket, resolveTicket } from "../../../sim/90-actions/support";
import { t } from "../../../i18n/en";
import { menuOn, type MenuEntry } from "../../desktop/ContextMenu";
import { useFocus, useStore } from "../../store";
import { useSessionState } from "../../session";
import { More } from "../More";
import { CustomerLink } from "../customers/CustomersApp";
import { Incidents } from "./Incidents";
import { CustomCompose, InvoicePill } from "./CustomOrder";
import { specText } from "../../../sim/30-market/spec";
import { due, initials, KINDS, kindOf, monthYear, moodClass, PRODUCT, span, stamp, statusOf } from "./labels";
import { Bars, Card, Deadline, LostSales, need, OPEN, SALES_BOXES, STATUS as SALES_STATUS, type SalesBox } from "../sales/SalesApp";
import "./support.css";

type TicketBox = "open" | "overdue" | "waiting" | "escalated" | "done";
const BOXES: { id: TicketBox; label: string; icon: typeof Inbox; match: (t: Ticket, hour: number) => boolean }[] = [
  { id: "open", label: "Open", icon: Inbox, match: (t) => t.status === "open" },
  { id: "overdue", label: "Overdue", icon: AlarmClock, match: (t, hour) => t.status === "open" && hour > t.dueAt },
  { id: "waiting", label: "Waiting on customer", icon: Hourglass, match: (t) => t.status === "waiting" },
  { id: "escalated", label: "Escalated", icon: Wrench, match: (t) => t.status === "escalated" },
  { id: "done", label: "Closed", icon: CircleCheck, match: isFinal },
];
const ACTION_LABEL: Record<TicketAction, string> = {
  credit: "Credit 10%", retain: "Retention offer", cancel: "Process cancellation", unsuspend: `Unsuspend with ${EXTENSION_DAYS}-day extension`, keep: "Keep suspended",
  forward: "Forward to customer", takedown: `Take down for ${TAKEDOWN_HOURS} h`, reject: "Reject", comply: "Comply", object: "Object", refund: "Refund one month", revert: "Revert price",
  accept: "Accept order",
};
const actionLabel = (tk: Ticket, a: TicketAction) => (tk.kind === "refund" && a === "reject" ? "Refuse" : ACTION_LABEL[a]);

// Read, escalate and close for a ticket, and the customer or request behind it.
function ticketMenu(game: GameState, tk: Ticket): MenuEntry[] {
  const { act, openApp } = useStore.getState();
  const locked = !!tk.work || isFinal(tk);
  const request = tk.kind === "upgrade" ? game.sales.requests.find((r) => r.ticketId === tk.id) : undefined;
  const customer = game.customers.find((c) => c.id === tk.customerId);
  return [
    tk.unread && { label: "Mark as read", run: () => act((s) => readTicket(s, tk.id)) },
    canEscalate(tk.kind) && tk.status === "open" && { label: "Escalate", disabled: locked, run: () => act((s) => escalateTicket(s, tk.id)) },
    !isFinal(tk) && { label: tk.kind === "order" ? "Decline" : tk.notice ? "Ignore" : "Close", disabled: locked, run: () => act((s) => closeTicket(s, tk.id)) },
    null,
    customer && { label: "Open customer", run: () => openApp("Customers", { kind: "customer", id: customer.id }) },
    request && { label: "Open request", run: () => openApp("Support", { kind: "request", id: request.id }) },
  ];
}

const subjectOf = (s: GameState, tk: Ticket) => t(`ticket.${tk.kind}.${tk.topic}.subject`, subjectParams(s, tk));

function Sender({ id }: { id: string }) {
  const x = senderById(id);
  return <span>{x.name}{x.agency && <BadgeCheck className="verified" aria-label="Verified sender" />}</span>;
}

function Sla({ tk, hour }: { tk: Ticket; hour: number }) {
  if (tk.status !== "open") return <span className="sla num">{stamp(tk.updatedAt)}</span>;
  const left = tk.dueAt - hour;
  const cls = left < 0 ? "bad" : left <= (tk.dueAt - tk.createdAt) / 4 ? "warn" : "";
  if (!tk.notice && left >= 0) return <span className={`sla ${cls} num`}>{due(tk.dueAt, hour)}</span>;
  return <span className={`sla ${cls}`}><span className="num">{span(left)}</span> {left < 0 ? "over" : "left"}</span>;
}

type Box = "all" | TicketBox | `s:${SalesBox}` | "lost" | "incidents";
type Kind = TicketKind | "sales";
interface Item { id: string; due: number; tk?: Ticket; r?: SalesRequest }

// Order emails show as tickets; their request carries the order.
const inSales = (r: SalesRequest) => r.kind !== "order";
const liveRequest = (r: SalesRequest) => OPEN.includes(r.status) || r.status === "quoted" || r.status === "accepted";

function itemsIn(game: GameState, box: Box): Item[] {
  const tickets = (f: (tk: Ticket) => boolean): Item[] => game.tickets.filter(f).map((tk) => ({ id: tk.id, due: tk.dueAt, tk }));
  const requests = (f: (r: SalesRequest) => boolean): Item[] => game.sales.requests.filter((r) => inSales(r) && f(r)).map((r) => ({ id: r.id, due: r.deadline, r }));
  if (box === "all") return [...tickets((tk) => !isFinal(tk)), ...requests(liveRequest)];
  const tb = BOXES.find((b) => b.id === box);
  if (tb) return tickets((tk) => tb.match(tk, game.hour));
  const sb = SALES_BOXES.find((b) => `s:${b.id}` === box);
  return sb ? requests((r) => sb.match(game, r)) : [];
}
const ofKind = (it: Item, kind: Kind | null) => !kind || (kind === "sales" ? !!it.r : it.tk?.kind === kind);
const newestFirst = (box: Box) => box === "done" || box === "s:won";
const stampOf = (it: Item) => (it.tk ? it.tk.updatedAt : it.r!.createdAt);

export function SupportApp() {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const [box, setBox] = useSessionState<Box>("support.box", "all");
  const [kind, setKind] = useSessionState<Kind | null>("support.kind", null);
  const [sel, setSel] = useSessionState<string | null>("support.sel", null);

  const inBox = itemsIn(game, box);
  const list = inBox.filter((it) => ofKind(it, kind)).sort((a, b) => (newestFirst(box) ? stampOf(b) - stampOf(a) : a.due - b.due));
  const current = game.tickets.find((tk) => tk.id === sel) ?? null;
  const request = game.sales.requests.find((r) => r.id === sel) ?? null;
  const order = current?.kind === "order" ? orderOf(game, current) : undefined;
  const busy = game.playerBusyUntil > game.hour * 60;
  const title = box === "all" ? "All" : (BOXES.find((b) => b.id === box) ?? SALES_BOXES.find((b) => `s:${b.id}` === box))?.label;

  const open = (tk: Ticket) => {
    setSel(tk.id);
    if (tk.unread) act((s) => readTicket(s, tk.id));
  };
  useFocus("Support", (f) => {
    const tk = game.tickets.find((x) => x.id === f.id), r = game.sales.requests.find((x) => x.id === f.id);
    setKind(null);
    if (f.kind === "ticket" && tk) {
      setBox(isFinal(tk) ? "done" : "all");
      open(tk);
    } else if (f.kind === "request" && r) {
      setBox(liveRequest(r) ? "all" : `s:${SALES_BOXES.find((b) => b.match(game, r))?.id ?? "won"}`);
      setSel(r.id);
    }
  });

  const side = (id: Box, label: string, Icon: typeof Inbox, count: number) => (
    <button key={id} className={`side-item${box === id ? " active" : ""}`} onClick={() => setBox(id)}>
      <Icon />{label}<span className="side-count">{count}</span>
    </button>
  );
  const typeItem = (id: Kind | null, label: string, Icon: typeof Inbox) => (
    <button key={`type-${id ?? "all"}`} className={`side-item${kind === id ? " active" : ""}`} aria-pressed={kind === id} onClick={() => setKind(id)}>
      <Icon />{label}<span className="side-count">{inBox.filter((it) => ofKind(it, id)).length}</span>
    </button>
  );

  return (
    <div className={`sup sales${box === "lost" ? " sales-wide" : ""}`}>
      <aside className="sidebar sup-side">
        <div className="side-h">Inbox</div>
        {side("all", "All", Mails, itemsIn(game, "all").length)}
        {BOXES.map((b) => side(b.id, b.label, b.icon, game.tickets.filter((tk) => b.match(tk, game.hour)).length))}
        <div className="side-h">Sales</div>
        {SALES_BOXES.map((b) => side(`s:${b.id}`, b.label, b.icon, game.sales.requests.filter((r) => inSales(r) && b.match(game, r)).length))}
        {side("lost", "Lost sales", TrendingDown, game.sales.lost.length)}
        <div className="side-h">Type</div>
        {typeItem(null, "All types", Layers)}
        {typeItem("sales", "Sales request", Handshake)}
        {KINDS.map((k) => typeItem(k.id, k.label, k.icon))}
        <div className="side-h">Reports</div>
        {side("incidents", "Incidents", TriangleAlert, game.ops.incidents.length)}
      </aside>

      {box === "incidents" ? <Incidents /> : box === "lost" ? <LostSales /> : <>

      <div className="sup-list" role="list">
        <div className="sup-list-h">
          <h2>{title}{kind && ` · ${kind === "sales" ? "Sales request" : kindOf(kind).label}`}</h2>
          {busy && <span className="sup-busy">Busy until <span className="num">{stamp(game.playerBusyUntil / 60)}</span></span>}
        </div>
        {list.map((it) => (it.tk ? <TicketRow key={it.id} tk={it.tk} active={it.id === sel} onOpen={open} /> : <RequestRow key={it.id} r={it.r!} active={it.id === sel} onOpen={setSel} />))}
        {!list.length && <div className="sup-none">No emails</div>}
      </div>

      {request ? <Card key={request.id} r={request} />
        : current && order ? <OrderThread key={current.id} tk={current} r={order} />
        : current ? <Thread key={current.id} tk={current} />
        : <div className="sup-detail sup-none">No email selected</div>}
      </>}
    </div>
  );
}

function TicketRow({ tk, active, onOpen }: { tk: Ticket; active: boolean; onOpen: (tk: Ticket) => void }) {
  const game = useStore((s) => s.game);
  const c = game.customers.find((x) => x.id === tk.customerId);
  const order = tk.kind === "order" ? orderOf(game, tk) : undefined;
  const K = kindOf(tk.kind);
  return (
    <button role="listitem" className={`tk${active ? " active" : ""}${tk.unread ? " unread" : ""}`} onClick={() => onOpen(tk)} onContextMenu={menuOn(() => ticketMenu(game, tk))}>
      <span className="who">{tk.unread && <i className="dot" aria-label="Unread" />}{tk.notice ? <Sender id={tk.notice.sender} /> : <span>{order ? requestName(order) : c?.name}</span>}</span>
      <Sla tk={tk} hour={game.hour} />
      <span className="subj">{order ? need(order) : subjectOf(game, tk)}</span>
      <span className="meta"><span className="type"><K.icon />{K.label}</span>{tk.work && <span className="pill accent">Queued</span>}</span>
    </button>
  );
}

function RequestRow({ r, active, onOpen }: { r: SalesRequest; active: boolean; onOpen: (id: string) => void }) {
  const game = useStore((s) => s.game);
  const greyed = r.status === "open" && missingFor(game, r).length > 0;
  return (
    <button role="listitem" className={`tk${active ? " active" : ""}${greyed ? " greyed" : ""}`} onClick={() => onOpen(r.id)}>
      <span className="who"><span>{requestName(r)}</span></span>
      <Deadline r={r} hour={game.hour} />
      <span className="subj">{need(r)}</span>
      <span className="meta">
        <span className="type"><Handshake />{PRODUCT[r.product]}{r.kind === "expansion" && " · Expansion"}</span>
        {r.status !== "open" && <span className={`pill ${r.status === "countered" ? "accent" : r.status === "won" ? "ok" : ""}`}>{SALES_STATUS[r.status]}</span>}
      </span>
    </button>
  );
}

function OrderThread({ tk, r }: { tk: Ticket; r: SalesRequest }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const reqs = requirementsFor(game, r), missing = reqs.filter((x) => !x.ok);
  const customer = r.customerId ? game.customers.find((c) => c.id === r.customerId) : undefined;
  const locked = !!tk.work || isFinal(tk);
  const left = tk.dueAt - game.hour;
  const K = kindOf(tk.kind);
  return (
    <div className={`sup-detail${missing.length && !isFinal(tk) ? " greyed" : ""}`}>
      <div className="d-head">
        <div className="top"><h2>{specText(r.product, r.spec)}</h2><span className="id num">#{tk.id.slice(3)}</span><More label={specText(r.product, r.spec)} entries={() => ticketMenu(game, tk)} /></div>
        <div className="facts">
          <span className="type"><K.icon />{K.label}</span>
          {r.domain && <span>{r.domain}</span>}
          <span>{r.city}</span>
          <InvoicePill r={r} />
          {tk.status === "open"
            ? <span className={`pill ${left < 0 ? "bad" : left <= (tk.dueAt - tk.createdAt) / 4 ? "warn" : ""}`}><Timer /><span><span className="num">{Math.max(0, left)} h</span> to respond</span></span>
            : <span className="pill">{statusOf(tk)}</span>}
        </div>
      </div>

      <div className="cust">
        <div className="logo">{initials(requestName(r))}</div>
        <div>
          <div className="name">{customer ? <CustomerLink id={customer.id} name={customer.name} /> : requestName(r)}</div>
          <div className="sub">{r.company ? `${r.contact} · ` : ""}Received <span className="num">{stamp(tk.createdAt)}</span></div>
        </div>
      </div>

      {!isFinal(tk) && (
        <ul className="sales-reqs">
          {reqs.map((x) => (
            <li key={x.key} className={x.ok ? "ok" : "bad"}>{x.ok ? <Check aria-label="Met" /> : <X aria-label="Missing" />}{t(x.key.replace("sales.need.", "sales.req."), x.params)}</li>
          ))}
        </ul>
      )}
      {!missing.length && !isFinal(tk) && <Bars r={r} />}

      <div className="thread">
        {r.thread.map((m, i) => (
          <div key={i} className={`msg${m.from === "you" ? " you" : ""}`}>
            <div className="from">{m.from === "you" ? m.by ?? "You" : r.contact} · <span className="num">{stamp(m.hour)}</span></div>
            <p>{t(m.key, m.params)}{i === 0 && r.kind !== "expansion" && ` ${t(`request.use.${r.profile}`)}`}</p>
          </div>
        ))}
        {tk.work && <div className="event"><span>Queued until <span className="num">{stamp(tk.work.doneAt / 60)}</span></span></div>}
        {isFinal(tk) && <div className="event"><span>{t(`outcome.${tk.outcome ?? "closed"}`)} · <span className="num">{stamp(tk.updatedAt)}</span></span></div>}
      </div>

      {r.spec ? <CustomCompose tk={tk} r={r} /> : !isFinal(tk) && (
        <div className="compose">
          <div className="actions-row">
            <button className="btn ghost" disabled={locked} onClick={() => act((s) => resolveTicket(s, tk.id, "reject"))}><CircleX />Decline</button>
            <span className="grow" />
            <span className="sales-total">Revenue <span className="num">{euroCents(r.quote ?? r.reference)}</span> a month</span>
            <button className="btn primary" disabled={locked || missing.length > 0} onClick={() => act((s) => resolveTicket(s, tk.id, "accept"))}><Check />Accept order</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Thread({ tk }: { tk: Ticket }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const [tpl, setTpl] = useState<string | null>(null);
  const c = game.customers.find((x) => x.id === tk.customerId);
  const svc = game.services.find((v) => v.id === tk.serviceId);
  const p = subjectParams(game, tk);
  const sender = tk.notice && senderById(tk.notice.sender);
  const K = kindOf(tk.kind);
  const monthly = c ? monthlyValue(game.services, c.id) : 0;
  const left = tk.dueAt - game.hour;
  const services = game.services.filter((v) => v.customerId === tk.customerId && v.endedAt === null);
  const locked = !!tk.work || isFinal(tk);
  const agents = game.staff.filter((e) => e.role === "support");

  return (
    <div className="sup-detail">
      <div className="d-head">
        <div className="top"><h2>{t(`ticket.${tk.kind}.${tk.topic}.subject`, p)}</h2><span className="id num">#{tk.id.slice(3)}</span><More label={`ticket ${tk.id.slice(3)}`} entries={() => ticketMenu(game, tk)} /></div>
        <div className="facts">
          <span className="type"><K.icon />{K.label}</span>
          <span>Opened <span className="num">{stamp(tk.createdAt)}</span></span>
          {tk.status === "open"
            ? <span className={`pill ${left < 0 ? "bad" : left <= (tk.dueAt - tk.createdAt) / 4 ? "warn" : ""}`}><Timer />{tk.notice || left < 0
                ? <span><span className="num">{span(left)}</span> {left < 0 ? "overdue" : "to respond"}</span>
                : <span>Due <span className="num">{due(tk.dueAt, game.hour)}</span></span>}</span>
            : <span className="pill">{statusOf(tk)}</span>}
        </div>
        {agents.length > 0 && !isFinal(tk) && (
          <div className="facts">
            <span>Assign</span>
            <span className="seg wrap" role="group" aria-label="Assign">
              {[{ id: null, name: "Nobody" }, ...agents].map((a) => (
                <button key={a.id ?? "none"} aria-pressed={tk.assignee === a.id} onClick={() => act((s) => assignTicket(s, tk.id, a.id))}>{a.name}</button>
              ))}
            </span>
          </div>
        )}
      </div>

      {sender ? (
        <div className="cust">
          <div className="logo">{initials(sender.name)}</div>
          <div>
            <div className="name"><Sender id={sender.id} /></div>
            <div className="sub">{tk.notice!.from}</div>
          </div>
          <div className="happy">
            <div className="k">Customer</div>
            <div>{c ? <CustomerLink id={c.id} name={c.name} /> : "None"}</div>
          </div>
        </div>
      ) : c && (
      <div className="cust">
        <div className="logo">{initials(c.name)}</div>
        <div>
          <div className="name"><CustomerLink id={c.id} name={c.name} /></div>
          <div className="sub">
            {svc ? svc.label : services.length === 1 ? services[0].label : `${services.length} services`} · <span className="num">{euroPrice(monthly)}</span> a month · since <span className="num">{monthYear(c.since)}</span>
          </div>
        </div>
        <div className="happy">
          <div className="k">Happiness <span className="num">{Math.round(c.happiness)}</span> of <span className="num">100</span></div>
          <div className="bar"><i className={moodClass(c.happiness)} style={{ width: `${c.happiness}%` }} /></div>
        </div>
      </div>
      )}

      <div className="thread">
        <div className="msg">
          <div className="from">{sender ? sender.name : c?.name} · <span className="num">{stamp(tk.createdAt)}</span></div>
          <p>{t(`ticket.${tk.kind}.${tk.topic}.text`, p)}</p>
        </div>
        {tk.replies.map((r, i) => (
          <div key={i} className="thread-pair">
            <div className="msg you">
              <div className="from">{r.by ?? "You"} · <span className="num">{stamp(r.hour)}</span></div>
              <p>{r.key ? t(r.key, r.params) : t(`template.${r.template}.text`, companyParams(game))}</p>
            </div>
            {!r.right && (
              <div className="msg">
                <div className="from">{c?.name} · <span className="num">{stamp(r.hour)}</span></div>
                <p>{t("ticket.followUp.text")}</p>
              </div>
            )}
          </div>
        ))}
        {tk.outcome === "withdrawn" && (
          <div className="msg">
            <div className="from">{c?.name} · <span className="num">{stamp(tk.updatedAt)}</span></div>
            <p>{t("ticket.withdrawn.text")}</p>
          </div>
        )}
        {tk.work && <div className="event"><span>Queued until <span className="num">{stamp(tk.work.doneAt / 60)}</span></span></div>}
        {(tk.status === "escalated" || isFinal(tk)) && (
          <div className="event"><span>{t(`outcome.${tk.outcome ?? (tk.status === "closed" ? "closed" : tk.status === "escalated" ? "escalated" : "resolved")}`)} · <span className="num">{stamp(tk.updatedAt)}</span></span></div>
        )}
      </div>

      {!isFinal(tk) && (
        <div className="compose">
          {tk.status === "open" && TEMPLATES[tk.kind].length > 0 && (
            <>
              <h3>Reply</h3>
              <div className="templates" role="radiogroup" aria-label="Reply template">
                {TEMPLATES[tk.kind].map((id) => (
                  <label key={id} className="tpl">
                    <input type="radio" name={`tpl-${tk.id}`} checked={tpl === id} disabled={locked} onChange={() => setTpl(id)} />
                    <span className="t">{t(`template.${id}.title`)}</span>
                    <span className="p">{t(`template.${id}.text`, { ...companyParams(game), ...p })}</span>
                  </label>
                ))}
              </div>
            </>
          )}
          <div className="actions-row">
            {ACTIONS[tk.kind].filter((a) => a !== "revert" || tk.topic === "price").map((a) => (
              <button key={a} className="btn" disabled={locked || ((a === "forward" || a === "takedown") && !c)} onClick={() => act((s) => resolveTicket(s, tk.id, a))}>
                {actionLabel(tk, a)}{a === "credit" && <span className="num">({euroCents(monthly * 0.1)})</span>}{a === "refund" && <span className="num">({euroCents(monthly)})</span>}
              </button>
            ))}
            <span className="grow" />
            <button className="btn ghost" disabled={locked} onClick={() => act((s) => closeTicket(s, tk.id))}><X />{tk.notice ? "Ignore" : "Close"}</button>
            {tk.status === "waiting" && <button className="btn primary" disabled={locked} onClick={() => act((s) => resolveTicket(s, tk.id))}><CircleCheck />Resolve</button>}
            {tk.status === "open" && TEMPLATES[tk.kind].length > 0 && (
              <button className="btn primary" disabled={locked || !tpl} onClick={() => act((s) => replyTicket(s, tk.id, tpl!))}><Send />Send reply</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
