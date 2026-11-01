import { AlarmClock, BadgeCheck, ChartColumn, Check, CircleCheck, CircleX, Hourglass, Inbox, Layers, Mails, Search, Timer, TrendingDown, TriangleAlert, Wrench, X } from "lucide-react";
import type { CSSProperties } from "react";
import { euroCents, euroPrice } from "../../../sim/00-core/money";
import { updatePrice } from "../../../sim/10-catalog/apps";
import { deskHas, deskOf, type DeskFeature } from "../../../sim/10-catalog/desks";
import { actionsOf, canEscalate, isFinal, monthlyValue, shownTemplates, templatesOf, type Ticket, type TicketAction, type TicketKind } from "../../../sim/40-support/tickets";
import { senderById, subjectParams, TAKEDOWN_HOURS } from "../../../sim/40-support/notices";
import { EXTENSION_DAYS } from "../../../sim/45-billing/billing";
import { requestName, requirementsFor, type SalesRequest } from "../../../sim/30-market/market";
import { orderOf } from "../../../sim/30-market/orders";
import { addressLines, mailedAddress } from "../../../sim/30-customers/addresses";
import { companyParams } from "../../../sim/40-support/replies";
import type { GameState } from "../../../sim/50-state";
import { acceptSponsorship, declineSponsorship } from "../../../sim/90-actions/community";
import { retentionOptions, type RetentionId } from "../../../sim/40-support/retention";
import { assignTicket, closeTicket, escalateTicket, readTicket, replyTicket, resolveTicket, retainTicket } from "../../../sim/90-actions/support";
import { t } from "../../../i18n/en";
import { menuOn, type MenuEntry } from "../../desktop/ContextMenu";
import { uiSound, useFocus, useStore } from "../../store";
import { useSessionState } from "../../session";
import { More } from "../More";
import { EmailSettings } from "../EmailSettings";
import { CustomerLink } from "../customers/CustomersApp";
import { Incidents } from "./Incidents";
import { CustomerCard } from "./CustomerCard";
import { Reports } from "./Reports";
import { supportApp } from "./desk";
import { CustomCompose, InvoicePill } from "./CustomOrder";
import { Compose } from "./Compose";
import { specText } from "../../../sim/30-market/spec";
import { OFFERS } from "../../../sim/80-business/walk";
import { LICENCE, lexwearUrl, NEWSLETTER } from "../../../sim/80-business/lexwear";
import { ORDER, orderKeys } from "../../../sim/80-business/vendor-shop";
import { moduleById } from "../../../sim/10-catalog/modules";
import { OrderKeys } from "../browser/sites/shop/VendorShop";
import { due, initials, KINDS, kindOf, monthYear, moodClass, span, stamp, statusOf } from "./labels";
import { SLAS } from "../../../sim/10-catalog/products";
import { Card, LostSales, need, SLA_LABEL } from "../sales/SalesApp";
import "./support.css";
import "./mail-styles.css";

type TicketBox = "open" | "overdue" | "waiting" | "escalated" | "done";
const BOXES: { id: TicketBox; label: string; icon: typeof Inbox; match: (t: Ticket, hour: number) => boolean }[] = [
  { id: "open", label: t("support.box.open"), icon: Inbox, match: (t) => t.status === "open" },
  { id: "overdue", label: t("support.box.overdue"), icon: AlarmClock, match: (t, hour) => t.status === "open" && hour > t.dueAt },
  { id: "waiting", label: t("support.status.waiting"), icon: Hourglass, match: (t) => t.status === "waiting" },
  { id: "escalated", label: t("support.status.escalated"), icon: Wrench, match: (t) => t.status === "escalated" },
  { id: "done", label: t("support.box.closed"), icon: CircleCheck, match: isFinal },
];
const ACTION_LABEL: Record<TicketAction, string> = {
  credit: t("support.action.credit"),
  cancel: t("support.action.cancel"),
  unsuspend: t("support.action.unsuspend", { days: EXTENSION_DAYS }),
  keep: t("support.action.keep"),
  forward: t("support.action.forward"),
  takedown: t("support.action.takedown", { h: TAKEDOWN_HOURS }),
  reject: t("support.action.reject"),
  comply: t("support.action.comply"),
  object: t("support.action.object"),
  refund: t("support.action.refund"),
  revert: t("support.action.revert"),
  pay: t("support.action.pay"),
  refuse: t("support.action.refuse"),
  accept: t("support.action.accept"),
  offerOnce: t("support.action.offerOnce"),
  offerManaged: t("support.action.offerManaged"),
  free: t("support.action.free"),
  clean: t("support.action.clean"),
  noBackup: t("support.action.noBackup"),
};
const OFFER_TITLE: Record<RetentionId, string> = {
  half: t("support.offer.half"),
  free: t("support.offer.free"),
  d3: t("support.offer.d3"),
  d6: t("support.offer.d6"),
  d12: t("support.offer.d12"),
  upgrade: t("support.offer.upgrade"),
  fix: t("support.offer.fix"),
  move: t("support.offer.move"),
};
const ODDS_LABEL = { unlikely: t("support.odds.unlikely"), even: t("support.odds.even"), likely: t("support.odds.likely") } as const;
const actionLabel = (tk: Ticket, a: TicketAction) => (tk.kind === "refund" && a === "reject" ? t("support.action.refuse") : ACTION_LABEL[a]);

// Read, escalate and close for a ticket, and the customer or request behind it.
function ticketMenu(game: GameState, tk: Ticket): MenuEntry[] {
  const { act, openApp } = useStore.getState();
  const locked = !!tk.work || isFinal(tk);
  const request = tk.kind === "upgrade" ? game.sales.requests.find((r) => r.ticketId === tk.id) : undefined;
  const customer = game.customers.find((c) => c.id === tk.customerId);
  return [
    tk.unread && { label: t("support.markRead"), run: () => act(readTicket, tk.id) },
    canEscalate(tk.kind) && tk.status === "open" && { label: t("support.escalate"), disabled: locked, run: () => act(escalateTicket, tk.id) },
    !isFinal(tk) && { label: tk.kind === "order" || tk.kind === "sponsor" ? t("support.decline") : tk.notice ? t("support.ignore") : t("support.close"), disabled: locked, run: () => act(closeTicket, tk.id) },
    null,
    customer && { label: t("support.openCustomer"), run: () => openApp("Customers", { kind: "customer", id: customer.id }) },
    request && { label: t("support.openRequest"), run: () => openApp("Support", { kind: "request", id: request.id }) },
  ];
}

// The replies available without a desk.

const subjectOf = (s: GameState, tk: Ticket) => t(`ticket.${tk.kind}.${tk.topic}.subject`, subjectParams(s, tk));

function Sender({ id }: { id: string }) {
  const x = senderById(id);
  return <span>{x.name}{x.agency && <BadgeCheck className="verified" aria-label={t("support.verifiedSender")} />}</span>;
}

function Sla({ tk, hour }: { tk: Ticket; hour: number }) {
  if (tk.status !== "open") return <span className="sla num">{stamp(tk.updatedAt)}</span>;
  const left = tk.dueAt - hour;
  const cls = left < 0 ? "bad" : left <= (tk.dueAt - tk.createdAt) / 4 ? "warn" : "";
  if (!tk.notice && left >= 0) return <span className={`sla ${cls} num`}>{due(tk.dueAt, hour)}</span>;
  return <span className={`sla ${cls}`}><span className="num">{span(left)}</span> {left < 0 ? t("support.over") : t("support.left")}</span>;
}

type Box = "all" | TicketBox | "lost" | "incidents" | "reports";
// What the installed desk unlocks in the thread view.
type Gates = Record<"assign" | "templates" | "slaTimers" | "customerSidebar", boolean>;
type Kind = TicketKind;
interface Item { id: string; due: number; tk: Ticket }

// Order and upgrade emails show as tickets; their request carries the order or the quote.

function itemsIn(game: GameState, box: Box): Item[] {
  const tickets = (f: (tk: Ticket) => boolean): Item[] => game.tickets.filter(f).map((tk) => ({ id: tk.id, due: tk.dueAt, tk }));
  // Company emails arrive closed and stay in the inbox like any email.
  if (box === "all") return tickets((tk) => !isFinal(tk) || tk.kind === "mail");
  const tb = BOXES.find((b) => b.id === box);
  return tb ? tickets((tk) => tb.match(tk, game.hour)) : [];
}
const ofKind = (it: Item, kind: Kind | null) => !kind || it.tk.kind === kind;
const newestFirst = (box: Box) => box === "done";
const stampOf = (it: Item) => it.tk.updatedAt;
const createdOf = (it: Item) => it.tk.createdAt;
// A search matches the sender, the subject and the ticket number.
const textOf = (game: GameState, it: Item) =>
  `${game.customers.find((c) => c.id === it.tk.customerId)?.name ?? ""} ${it.tk.notice ? senderById(it.tk.notice.sender).name : ""} ${subjectOf(game, it.tk)} ${it.tk.id.slice(3)}`.toLowerCase();

export function SupportApp() {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const [boxState, setBox] = useSessionState<Box>("support.box", "all");
  const [kindState, setKind] = useSessionState<Kind | null>("support.kind", null);
  const [sel, setSel] = useSessionState<string | null>("support.sel", null);
  const [query, setQuery] = useSessionState("support.query", "");
  // The email settings: the Settings button and the app menu open them.
  const [setup, setSetup] = useSessionState("support.setup", false);
  const [composing, setComposing] = useSessionState("support.compose", false);
  const desk = deskOf(game);
  const { style, brand, icon: Logo, tile } = supportApp(game);
  const has = (f: DeskFeature) => deskHas(game, f);
  const gates: Gates = { assign: has("assign"), templates: has("templates"), slaTimers: has("slaTimers"), customerSidebar: has("customerSidebar") };
  // Without a desk the app is one inbox; the desk decides which boxes and filters exist.
  const box: Box = desk && (boxState !== "reports" || has("reports")) ? boxState : "all";
  const kind = has("filters") ? kindState : null;
  const needle = has("search") ? query.trim().toLowerCase() : "";

  const inBox = itemsIn(game, box);
  const list = inBox.filter((it) => ofKind(it, kind) && (!needle || textOf(game, it).includes(needle)))
    .sort((a, b) => (!desk ? createdOf(b) - createdOf(a) : newestFirst(box) ? stampOf(b) - stampOf(a) : a.due - b.due));
  const current = game.tickets.find((tk) => tk.id === sel) ?? null;
  const order = current?.kind === "order" ? orderOf(game, current) : undefined;
  const upgrade = current?.kind === "upgrade" ? game.sales.requests.find((r) => r.ticketId === current.id) : undefined;
  const busy = game.playerBusyUntil > game.hour * 60;
  const title = !desk ? t("support.inbox") : box === "all" ? t("support.all") : BOXES.find((b) => b.id === box)?.label;

  const open = (tk: Ticket) => {
    setSel(tk.id);
    if (tk.unread) act(readTicket, tk.id);
  };
  useFocus("Support", (f) => {
    if (f.kind === "mailSetup") return setSetup(true);
    // An upgrade request opens on its ticket.
    const r = game.sales.requests.find((x) => x.id === f.id), tk = game.tickets.find((x) => x.id === (r?.kind === "expansion" ? r.ticketId : f.id));
    setKind(null);
    setQuery("");
    if ((f.kind === "ticket" || r?.kind === "expansion") && tk) {
      setBox(isFinal(tk) ? "done" : "all");
      open(tk);
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
    <div className={`sup sales${box === "lost" || box === "reports" ? " sales-wide" : ""}`} data-style={style} data-mode={desk ? "desk" : "inbox"}>
      <header className="sup-brand">
        <span className="sup-logo" style={{ "--tile": tile } as CSSProperties}><Logo /></span>
        <strong>{brand}</strong>
        <button className="btn ghost sup-settings" onClick={() => setComposing(true)}>{t("paperwork.mail.new")}</button>
        <button className="btn ghost sup-settings sup-settings-2" onClick={() => setSetup(true)}>{t("support.settings")}</button>
      </header>
      {setup && <EmailSettings onClose={() => setSetup(false)} />}
      {desk && <aside className="sidebar sup-side">
        <div className="side-h">{t("support.inbox")}</div>
        {side("all", t("support.all"), Mails, itemsIn(game, "all").length)}
        {BOXES.map((b) => side(b.id, b.label, b.icon, game.tickets.filter((tk) => b.match(tk, game.hour)).length))}
        {side("lost", t("support.lostSales"), TrendingDown, game.sales.lost.length)}
        {has("filters") && <>
          <div className="side-h">{t("support.type")}</div>
          {typeItem(null, t("support.allTypes"), Layers)}
          {KINDS.map((k) => typeItem(k.id, k.label, k.icon))}
        </>}
        <div className="side-h">{t("support.reports")}</div>
        {side("incidents", t("support.incidents"), TriangleAlert, game.ops.incidents.length)}
        {has("reports") && side("reports", t("support.tickets"), ChartColumn, game.tickets.length)}
      </aside>}

      {box === "incidents" ? <Incidents /> : box === "lost" ? <LostSales /> : box === "reports" ? <Reports /> : <>

      <div className="sup-list" role="list">
        <div className="sup-list-h">
          <h2>{title}{kind && ` · ${kindOf(kind).label}`}</h2>
          {!desk && <span className="sup-unread num">{inBox.filter((it) => it.tk.unread).length}</span>}
          {busy && <span className="sup-busy">{t("support.busyUntil", { time: stamp(game.playerBusyUntil / 60) })}</span>}
        </div>
        {has("search") && (
          <label className="sup-search"><Search aria-hidden /><input type="search" aria-label={t("support.search")} placeholder={t("support.search")} value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        )}
        {list.map((it) => <TicketRow key={it.id} tk={it.tk} active={it.id === sel} timers={gates.slaTimers} onOpen={open} />)}
        {!list.length && <div className="sup-none">{t("support.noEmails")}</div>}
      </div>

      {composing ? <Compose onClose={() => setComposing(false)} />
        : upgrade ? <Card key={upgrade.id} r={upgrade} />
        : current && order ? <OrderThread key={current.id} tk={current} r={order} gates={gates} />
        : current ? <Thread key={current.id} tk={current} gates={gates} />
        : <div className="sup-detail sup-none">{t("support.noEmailSelected")}</div>}
      </>}
    </div>
  );
}

function TicketRow({ tk, active, timers, onOpen }: { tk: Ticket; active: boolean; timers: boolean; onOpen: (tk: Ticket) => void }) {
  const game = useStore((s) => s.game);
  const c = game.customers.find((x) => x.id === tk.customerId);
  const order = tk.kind === "order" ? orderOf(game, tk) : undefined;
  const K = kindOf(tk.kind);
  return (
    <button role="listitem" className={`tk${active ? " active" : ""}${tk.unread ? " unread" : ""}`} onClick={() => onOpen(tk)} onContextMenu={menuOn(() => ticketMenu(game, tk))}>
      <span className="who">{tk.unread && <i className="dot" aria-label={t("support.unread")} />}{tk.notice ? <Sender id={tk.notice.sender} /> : <span>{order ? requestName(order) : tk.kind === "sponsor" ? subjectParams(game, tk).event : tk.mail ? tk.mail.from : tk.kind === "pear" ? t("walk.from") : c?.name}</span>}</span>
      {timers ? <Sla tk={tk} hour={game.hour} /> : <span className="sla num">{stamp(tk.status === "open" ? tk.createdAt : tk.updatedAt)}</span>}
      <span className="subj">{order ? need(order) : subjectOf(game, tk)}</span>
      <span className="meta"><span className="type" style={{ "--k": KINDS.findIndex((x) => x.id === tk.kind) } as CSSProperties}><K.icon />{K.label}</span>{tk.work && <span className="pill accent">{t("support.queued")}</span>}</span>
    </button>
  );
}

function OrderThread({ tk, r, gates }: { tk: Ticket; r: SalesRequest; gates: Gates }) {
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
          <span>{t("support.slaLine", { sla: SLA_LABEL[r.sla], uptime: (SLAS[r.sla].uptime * 100).toFixed(SLAS[r.sla].uptime >= 0.999 ? 2 : 1), h: SLAS[r.sla].responseHours })}</span>
          <InvoicePill r={r} />
          {tk.status === "open" && gates.slaTimers
            ? <span className={`pill ${left < 0 ? "bad" : left <= (tk.dueAt - tk.createdAt) / 4 ? "warn" : ""}`}><Timer /><span>{t("support.toRespond", { h: Math.max(0, left) })}</span></span>
            : <span className="pill">{statusOf(tk)}</span>}
        </div>
      </div>

      <div className="cust">
        <div className="logo">{initials(requestName(r))}</div>
        <div>
          <div className="name">{customer ? <CustomerLink id={customer.id} name={customer.name} /> : requestName(r)}</div>
          <div className="sub">{r.company ? `${r.contact} · ` : ""}{t("support.received", { time: stamp(tk.createdAt) })}</div>
        </div>
      </div>

      {!isFinal(tk) && (
        <ul className="sales-reqs">
          {reqs.map((x) => (
            <li key={x.key} className={x.ok ? "ok" : "bad"}>{x.ok ? <Check aria-label={t("support.met")} /> : <X aria-label={t("support.missing")} />}{t(x.key.replace("sales.need.", "sales.req."), x.params)}</li>
          ))}
        </ul>
      )}

      <div className="thread">
        {r.thread.map((m, i) => (
          <div key={i} className={`msg${m.from === "you" ? " you" : ""}`}>
            <div className="from">{m.from === "you" ? m.by ?? t("support.you") : r.contact} · <span className="num">{stamp(m.hour)}</span></div>
            <p>{t(m.key, m.params)}{i === 0 && r.kind !== "expansion" && ` ${t(`request.use.${r.profile}`)}`}{i === 0 && r.kind === "order" && `\n\n${addressLines(mailedAddress(game.seed, r)).join("\n")}`}</p>
          </div>
        ))}
        {tk.work && <div className="event"><span>{t("support.queuedUntil", { time: stamp(tk.work.doneAt / 60) })}</span></div>}
        {isFinal(tk) && <div className="event"><span>{t(`outcome.${tk.outcome ?? "closed"}`)} · <span className="num">{stamp(tk.updatedAt)}</span></span></div>}
      </div>

      {r.spec ? <CustomCompose tk={tk} r={r} /> : !isFinal(tk) && (
        <div className="compose">
          <div className="actions-row">
            <button className="btn ghost" disabled={locked} onClick={() => act(resolveTicket, tk.id, "reject")}><CircleX />{t("support.decline")}</button>
            <span className="grow" />
            <span className="sales-total">{t("support.revenue", { amount: euroCents(r.quote ?? r.reference) })}</span>
            <button className="btn primary" disabled={locked || missing.length > 0} onClick={() => act(resolveTicket, tk.id, "accept")}><Check />{t("support.action.accept")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Thread({ tk, gates }: { tk: Ticket; gates: Gates }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const reply: typeof act = (fn, ...args) => {
    const r = act(fn, ...args);
    if (r.ok) uiSound("typing");
    return r;
  };
  const c = game.customers.find((x) => x.id === tk.customerId);
  const svc = game.services.find((v) => v.id === tk.serviceId);
  const p = subjectParams(game, tk);
  const sender = tk.notice && senderById(tk.notice.sender);
  const openApp = useStore((s) => s.openApp);
  const K = kindOf(tk.kind);
  const monthly = c ? monthlyValue(game.services, c.id) : 0;
  const stray = tk.kind === "notice" && !tk.customerId;
  const left = tk.dueAt - game.hour;
  const services = game.services.filter((v) => v.customerId === tk.customerId && v.endedAt === null);
  const locked = !!tk.work || isFinal(tk);
  const agents = game.staff.filter((e) => e.role === "support");
  const sent = tk.kind === "migration" || (tk.kind === "maintenance" && (tk.topic === "notice" || tk.topic === "moved"));

  const body = (
    <div className="sup-detail">
      <div className="d-head">
        <div className="top"><h2>{t(`ticket.${tk.kind}.${tk.topic}.subject`, p)}</h2><span className="id num">#{tk.id.slice(3)}</span><More label={t("support.ticketNo", { n: tk.id.slice(3) })} entries={() => ticketMenu(game, tk)} /></div>
        <div className="facts">
          <span className="type"><K.icon />{K.label}</span>
          <span>{t("support.opened", { time: stamp(tk.createdAt) })}</span>
          {tk.status === "open" && gates.slaTimers
            ? <span className={`pill ${left < 0 ? "bad" : left <= (tk.dueAt - tk.createdAt) / 4 ? "warn" : ""}`}><Timer />{tk.notice || left < 0
                ? <span>{t(left < 0 ? "support.overdueBy" : "support.toRespondIn", { span: span(left) })}</span>
                : <span>{t("support.due", { time: due(tk.dueAt, game.hour) })}</span>}</span>
            : <span className="pill">{statusOf(tk)}</span>}
        </div>
        {gates.assign && agents.length > 0 && !isFinal(tk) && (
          <div className="facts">
            <span>{t("support.assign")}</span>
            <span className="seg wrap" role="group" aria-label={t("support.assign")}>
              {[{ id: null, name: t("support.nobody") }, ...agents].map((a) => (
                <button key={a.id ?? "none"} aria-pressed={tk.assignee === a.id} onClick={() => act(assignTicket, tk.id, a.id)}>{a.name}</button>
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
            {tk.topic === "phishing" && <button className="sup-url" onClick={() => openApp("Browser", { kind: "url", id: tk.notice!.url })}>{tk.notice!.url}</button>}
          </div>
          <div className="happy">
            <div className="k">{t("support.customer")}</div>
            <div>{c ? <CustomerLink id={c.id} name={c.name} /> : t("support.none")}</div>
          </div>
        </div>
      ) : c && !gates.customerSidebar && (
      <div className="cust">
        <div className="logo">{initials(c.name)}</div>
        <div>
          <div className="name"><CustomerLink id={c.id} name={c.name} /></div>
          <div className="sub">
            {t("support.custLine", { what: svc ? svc.label : services.length === 1 ? services[0].label : t("support.nServices", { n: services.length }), price: euroPrice(monthly), since: monthYear(c.since) })}
          </div>
        </div>
        <div className="happy">
          <div className="k">{t("support.happiness", { n: Math.round(c.happiness) })}</div>
          <div className="bar"><i className={moodClass(c.happiness)} style={{ width: `${c.happiness}%` }} /></div>
        </div>
      </div>
      )}

      <div className="thread">
        <div className={sent ? "msg you" : "msg"}>
          <div className="from">{sender ? sender.name : sent ? t("support.you") : tk.kind === "sponsor" ? p.event : tk.mail ? tk.mail.from : tk.kind === "pear" ? t("walk.from") : c?.name} · <span className="num">{stamp(tk.createdAt)}</span></div>
          <p>{t(`ticket.${tk.kind}.${tk.topic}.text`, p)}</p>
          {tk.topic === ORDER && <OrderKeys game={game} order={String(tk.mail!.params.order)} />}
          {(tk.topic === LICENCE || (tk.topic === ORDER && orderKeys(game, String(tk.mail!.params.order)).some((k) => moduleById(k.product)))) && <p><button className="btn primary" onClick={() => openApp("Books", { kind: "register", id: "" })}>{t("vendor-sites.register")}</button></p>}
          {tk.topic === NEWSLETTER && <p><button className="btn primary" onClick={() => openApp("Browser", { kind: "url", id: lexwearUrl(String(tk.mail!.params.module)) })}>{t("vendor-sites.viewModule")}</button></p>}
        </div>
        {tk.replies.map((r, i) => (
          <div key={i} className="thread-pair">
            <div className="msg you">
              <div className="from">{r.by ?? t("support.you")} · <span className="num">{stamp(r.hour)}</span></div>
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
        {tk.move?.log.map((m, i) => (
          <div key={`m${i}`} className="msg">
            <div className="from">{c?.name} · <span className="num">{stamp(m.hour)}</span></div>
            <p>{t(m.key, m.params)}</p>
          </div>
        ))}
        {tk.move?.windowAt != null && tk.status === "waiting" && <div className="event"><span>{t("support.moveAt", { time: stamp(tk.move.windowAt) })}</span></div>}
        {tk.outcome === "withdrawn" && (
          <div className="msg">
            <div className="from">{c?.name} · <span className="num">{stamp(tk.updatedAt)}</span></div>
            <p>{t("ticket.withdrawn.text")}</p>
          </div>
        )}
        {tk.work && <div className="event"><span>{t("support.queuedUntil", { time: stamp(tk.work.doneAt / 60) })}</span></div>}
        {(tk.status === "escalated" || isFinal(tk)) && (
          <div className="event"><span>{t(`outcome.${tk.outcome ?? (tk.status === "closed" ? "closed" : tk.status === "escalated" ? "escalated" : "resolved")}`)} · <span className="num">{stamp(tk.updatedAt)}</span></span></div>
        )}
      </div>

      {!isFinal(tk) && (
        <div className="compose">
          {tk.status === "open" && templatesOf(tk).length > 0 && (
            <>
              <h3>{t("support.reply")}</h3>
              <div className="templates">
                {shownTemplates(game, tk, gates.templates).map((id) => (
                  <button key={id} className="tpl" disabled={locked} onClick={() => reply(replyTicket, tk.id, id)}>
                    <span className="t">{t(`template.${id}.title`)}</span>
                    {gates.templates && <span className="p">{t(`template.${id}.text`, { ...companyParams(game), ...p })}</span>}
                  </button>
                ))}
              </div>
            </>
          )}
          {tk.kind === "cancellation" && tk.status === "open" && (
            <>
              <h3>{t("support.retentionOffers")}</h3>
              <div className="offers">
                {retentionOptions(game, tk).map((o) => {
                  const v = game.services.find((x) => x.id === o.serviceId);
                  return (
                    <button key={o.id} className="offer" disabled={locked} onClick={() => reply(retainTicket, tk.id, o.id)}>
                      <span className="t">{OFFER_TITLE[o.id]}</span>
                      <span className="v num">{o.spec && v ? specText(v.product, o.spec) : o.target ?? (o.cost > 0 ? euroCents(o.cost) : t("support.noCost"))}</span>
                      <span className={`odds ${o.odds}`}>{ODDS_LABEL[o.odds]}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className="actions-row">
            {actionsOf(tk).filter((a) => (a !== "revert" || tk.topic === "price") && (!stray || a === "reject")).map((a) => (
              <button key={a} className="btn" disabled={locked || ((a === "forward" || a === "takedown") && !c)} onClick={() => reply(resolveTicket, tk.id, a)}>
                {actionLabel(tk, a)}{a === "credit" && <span className="num">({euroCents(monthly * 0.1)})</span>}{a === "refund" && <span className="num">({euroCents(monthly)})</span>}{a === "pay" && <span className="num">({euroCents(Number(p.ransom))})</span>}{a === "offerOnce" && <span className="num">({euroCents(updatePrice(game.rates.webHosting, "updateOnce"))})</span>}{a === "offerManaged" && <span className="num">({t("support.perMonth", { price: euroCents(updatePrice(game.rates.webHosting, "updates")) })})</span>}
              </button>
            ))}
            <span className="grow" />
            {tk.kind === "pear" && <button className="btn primary" onClick={() => openApp(OFFERS.includes(tk.topic) ? "Shop" : tk.topic)}>{t("apps.open")}</button>}
            {tk.kind === "sponsor" && <button className="btn ghost" disabled={locked} onClick={() => act(declineSponsorship, tk.id)}><CircleX />{t("support.decline")}</button>}
            {tk.kind === "sponsor" && <button className="btn primary" disabled={locked} onClick={() => act(acceptSponsorship, tk.id)}><Check />{t("support.accept")}</button>}
            {!stray && tk.kind !== "sponsor" && <button className="btn ghost" disabled={locked} onClick={() => act(closeTicket, tk.id)}><X />{tk.notice ? t("support.ignore") : t("support.close")}</button>}
            {tk.status === "waiting" && tk.kind !== "migration" && !tk.work && <button className="btn primary" disabled={locked} onClick={() => act(resolveTicket, tk.id)}><CircleCheck />{t("support.resolve")}</button>}
          </div>
        </div>
      )}
    </div>
  );
  return gates.customerSidebar && c ? <div className="sup-split">{body}<CustomerCard game={game} id={c.id} /></div> : body;
}
