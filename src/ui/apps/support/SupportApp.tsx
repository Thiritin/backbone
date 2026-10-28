import { AlarmClock, ArrowUpRight, CircleCheck, Hourglass, Inbox, Send, Timer, Wrench, X } from "lucide-react";
import { useState } from "react";
import { euro, euroCents } from "../../../sim/00-core/money";
import { ACTIONS, canEscalate, isFinal, monthlyValue, TEMPLATES, type Ticket, type TicketAction, type TicketKind } from "../../../sim/40-support/tickets";
import { EXTENSION_DAYS } from "../../../sim/45-billing/billing";
import type { GameState } from "../../../sim/50-state";
import { closeTicket, escalateTicket, readTicket, replyTicket, resolveTicket } from "../../../sim/90-actions/support";
import { t } from "../../../i18n/en";
import { useFocus, useStore } from "../../store";
import { CustomerLink } from "../customers/CustomersApp";
import { initials, KINDS, kindOf, monthYear, moodClass, stamp, STATUS } from "./labels";
import "./support.css";

type Box = "open" | "overdue" | "waiting" | "escalated" | "done";
const BOXES: { id: Box; label: string; icon: typeof Inbox; match: (t: Ticket, hour: number) => boolean }[] = [
  { id: "open", label: "Open", icon: Inbox, match: (t) => t.status === "open" },
  { id: "overdue", label: "Overdue", icon: AlarmClock, match: (t, hour) => t.status === "open" && hour > t.dueAt },
  { id: "waiting", label: "Waiting on customer", icon: Hourglass, match: (t) => t.status === "waiting" },
  { id: "escalated", label: "Escalated", icon: Wrench, match: (t) => t.status === "escalated" },
  { id: "done", label: "Closed", icon: CircleCheck, match: isFinal },
];
const ACTION_LABEL: Record<TicketAction, string> = {
  credit: "Credit 10%", retain: "Retention offer", cancel: "Process cancellation", unsuspend: `Unsuspend with ${EXTENSION_DAYS}-day extension`, keep: "Keep suspended",
};

const subjectOf = (s: GameState, tk: Ticket) => t(`ticket.${tk.kind}.${tk.topic}.subject`, { service: s.services.find((v) => v.id === tk.serviceId)?.label ?? "" });

function Sla({ tk, hour }: { tk: Ticket; hour: number }) {
  if (tk.status !== "open") return <span className="sla num">{stamp(tk.updatedAt)}</span>;
  const left = tk.dueAt - hour;
  const cls = left < 0 ? "bad" : left <= (tk.dueAt - tk.createdAt) / 4 ? "warn" : "";
  return <span className={`sla ${cls}`}><span className="num">{Math.abs(left)}</span> h {left < 0 ? "over" : "left"}</span>;
}

export function SupportApp() {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const [box, setBox] = useState<Box>("open");
  const [kind, setKind] = useState<TicketKind | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  const inBox = game.tickets.filter((tk) => BOXES.find((b) => b.id === box)!.match(tk, game.hour));
  const list = inBox.filter((tk) => !kind || tk.kind === kind)
    .sort((a, b) => (box === "done" ? b.updatedAt - a.updatedAt : a.dueAt - b.dueAt));
  const current = game.tickets.find((tk) => tk.id === sel) ?? null;
  const busy = game.playerBusyUntil > game.hour * 60;

  const open = (tk: Ticket) => {
    setSel(tk.id);
    if (tk.unread) act((s) => readTicket(s, tk.id));
  };
  useFocus("Support", (f) => {
    const tk = game.tickets.find((x) => x.id === f.id);
    if (f.kind !== "ticket" || !tk) return;
    setBox(BOXES.find((b) => b.match(tk, game.hour))!.id);
    setKind(null);
    open(tk);
  });

  return (
    <div className="sup">
      <aside className="sidebar sup-side">
        <div className="side-h">Inbox</div>
        {BOXES.map((b) => (
          <button key={b.id} className={`side-item${box === b.id ? " active" : ""}`} onClick={() => setBox(b.id)}>
            <b.icon />{b.label}<span className="side-count">{game.tickets.filter((tk) => b.match(tk, game.hour)).length}</span>
          </button>
        ))}
        <div className="side-h">Type</div>
        {KINDS.map((k) => (
          <button key={k.id} className={`side-item${kind === k.id ? " active" : ""}`} aria-pressed={kind === k.id} onClick={() => setKind(kind === k.id ? null : k.id)}>
            <k.icon />{k.label}<span className="side-count">{inBox.filter((tk) => tk.kind === k.id).length}</span>
          </button>
        ))}
      </aside>

      <div className="sup-list" role="list">
        <div className="sup-list-h">
          <h2>{BOXES.find((b) => b.id === box)!.label}{kind && ` · ${kindOf(kind).label}`}</h2>
          {busy && <span className="sup-busy">Busy until <span className="num">{stamp(game.playerBusyUntil / 60)}</span></span>}
        </div>
        {list.map((tk) => {
          const c = game.customers.find((x) => x.id === tk.customerId)!;
          const K = kindOf(tk.kind);
          return (
            <button key={tk.id} role="listitem" className={`tk${tk.id === sel ? " active" : ""}${tk.unread ? " unread" : ""}`} onClick={() => open(tk)}>
              <span className="who">{tk.unread && <i className="dot" aria-label="Unread" />}<span>{c.name}</span></span>
              <Sla tk={tk} hour={game.hour} />
              <span className="subj">{subjectOf(game, tk)}</span>
              <span className="meta"><span className="type"><K.icon />{K.label}</span>{tk.work && <span className="pill accent">Queued</span>}</span>
            </button>
          );
        })}
        {!list.length && <div className="sup-none">No tickets</div>}
      </div>

      {current ? <Thread key={current.id} tk={current} /> : <div className="sup-detail sup-none">No ticket selected</div>}
    </div>
  );
}

function Thread({ tk }: { tk: Ticket }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const [tpl, setTpl] = useState<string | null>(null);
  const c = game.customers.find((x) => x.id === tk.customerId)!;
  const svc = game.services.find((v) => v.id === tk.serviceId);
  const p = { service: svc?.label ?? "" };
  const K = kindOf(tk.kind);
  const monthly = monthlyValue(game.services, c.id);
  const left = tk.dueAt - game.hour;
  const services = game.services.filter((v) => v.customerId === c.id && v.endedAt === null);
  const locked = !!tk.work || isFinal(tk);

  return (
    <div className="sup-detail">
      <div className="d-head">
        <div className="top"><h2>{t(`ticket.${tk.kind}.${tk.topic}.subject`, p)}</h2><span className="id num">#{tk.id.slice(3)}</span></div>
        <div className="facts">
          <span className="type"><K.icon />{K.label}</span>
          <span>Opened <span className="num">{stamp(tk.createdAt)}</span></span>
          {tk.status === "open"
            ? <span className={`pill ${left < 0 ? "bad" : left <= (tk.dueAt - tk.createdAt) / 4 ? "warn" : ""}`}><Timer /><span><span className="num">{Math.abs(left)}</span> h {left < 0 ? "overdue" : "to respond"}</span></span>
            : <span className="pill">{STATUS[tk.status]}</span>}
        </div>
      </div>

      <div className="cust">
        <div className="logo">{initials(c.name)}</div>
        <div>
          <div className="name"><CustomerLink id={c.id} name={c.name} /></div>
          <div className="sub">
            {svc ? svc.label : `${services.length} services`} · <span className="num">{euro(monthly)}</span> a month · since <span className="num">{monthYear(c.since)}</span>
          </div>
        </div>
        <div className="happy">
          <div className="k">Happiness <span className="num">{Math.round(c.happiness)}</span> of <span className="num">100</span></div>
          <div className="bar"><i className={moodClass(c.happiness)} style={{ width: `${c.happiness}%` }} /></div>
        </div>
      </div>

      <div className="thread">
        <div className="msg">
          <div className="from">{c.name} · <span className="num">{stamp(tk.createdAt)}</span></div>
          <p>{t(`ticket.${tk.kind}.${tk.topic}.text`, p)}</p>
        </div>
        {tk.replies.map((r, i) => (
          <div key={i} className="thread-pair">
            <div className="msg you">
              <div className="from">{r.by ?? "You"} · <span className="num">{stamp(r.hour)}</span></div>
              <p>{t(`template.${r.template}.text`)}</p>
            </div>
            {!r.right && (
              <div className="msg">
                <div className="from">{c.name} · <span className="num">{stamp(r.hour)}</span></div>
                <p>{t("ticket.followUp.text")}</p>
              </div>
            )}
          </div>
        ))}
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
                    <span className="p">{t(`template.${id}.text`)}</span>
                  </label>
                ))}
              </div>
            </>
          )}
          <div className="actions-row">
            {ACTIONS[tk.kind].map((a) => (
              <button key={a} className="btn" disabled={locked} onClick={() => act((s) => resolveTicket(s, tk.id, a))}>
                {ACTION_LABEL[a]}{a === "credit" && <span className="num">({euroCents(monthly * 0.1)})</span>}
              </button>
            ))}
            {canEscalate(tk.kind) && tk.status === "open" && (
              <button className="btn" disabled={locked} onClick={() => act((s) => escalateTicket(s, tk.id))}><ArrowUpRight />Escalate</button>
            )}
            <span className="grow" />
            <button className="btn ghost" disabled={locked} onClick={() => act((s) => closeTicket(s, tk.id))}><X />Close</button>
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
