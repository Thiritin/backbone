import { ChevronLeft, Contact, FileText, Globe, History, LifeBuoy, ListChecks, Receipt, Server } from "lucide-react";
import { useId, useState } from "react";
import { euroCents, euroPrice } from "../../../sim/00-core/money";
import type { Customer, Profile, Service } from "../../../sim/30-customers/customers";
import { fqdn } from "../../../sim/30-customers/domains";
import { referenceFor } from "../../../sim/30-market/market";
import { subjectParams } from "../../../sim/40-support/notices";
import { isFinal, profileStats, serviceMonthly } from "../../../sim/40-support/tickets";
import { invoiceTotal, isUnpaid, type Invoice, type InvoiceStatus } from "../../../sim/45-billing/billing";
import type { GameState } from "../../../sim/50-state";
import { zoneOf } from "../../../sim/60-infra/network";
import { creditCustomer } from "../../../sim/90-actions/customers";
import { renewDomain } from "../../../sim/90-actions/orders";
import { changePrice } from "../../../sim/90-actions/sales";
import { menuOn, type MenuEntry } from "../../desktop/ContextMenu";
import { More } from "../More";
import { workloadActions } from "../workload-menu";
import { consoleEntry } from "../products/parts";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { formatDay } from "../billing/format";
import { PriceField } from "../sales/PriceField";
import { ActivityLog } from "./ActivityLog";
import { registryOf } from "../../../sim/30-customers/registry";
import { specText } from "../../../sim/30-market/spec";
import { initials, kindOf, monthYear, moodClass, patience, PRODUCT, statusOf } from "../support/labels";

export type Status = "active" | "overdue" | "suspended" | "churned";
export interface Row { c: Customer; status: Status; services: number; monthly: number; lifetime: number; balance: number; invoices: number; tickets: number; labels: string }

export const STATUSES: Record<Status, { label: string; pill: string }> = {
  active: { label: t("misc.active"), pill: "" },
  overdue: { label: t("misc.overdue"), pill: "warn" },
  suspended: { label: t("misc.suspended"), pill: "bad" },
  churned: { label: t("misc.churned"), pill: "" },
};
const INVOICE: Record<InvoiceStatus, { label: string; pill: string }> = {
  draft: { label: t("books.status.draft"), pill: "" }, open: { label: t("misc.open"), pill: "accent" }, overdue: { label: t("misc.overdue"), pill: "warn" }, paid: { label: t("misc.paid"), pill: "" }, writtenOff: { label: t("misc.writtenOff"), pill: "" },
};
const SLA = { basic: t("misc.slaBasic"), business: t("misc.slaBusiness"), premium: t("misc.slaPremium") } as const;
const PERSON: Profile[] = ["private", "gamer", "hobbyDev"];
const RECENT = 5;

export const StatusChip = ({ s }: { s: Status }) => <span className={`pill ${STATUSES[s].pill}`}>{STATUSES[s].label}</span>;

export function Mood({ c }: { c: Customer }) {
  return (
    <span className="cus-mood">
      <span className="bar"><i className={moodClass(c.happiness)} style={{ width: `${c.happiness}%` }} /></span>
      <span className="num">{Math.round(c.happiness)}</span>
    </span>
  );
}

function Trend({ c }: { c: Customer }) {
  const points = [...c.history, c.happiness];
  if (points.length < 2) return null;
  const w = 120, h = 24, step = w / (points.length - 1);
  return (
    <svg className="cus-trend" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label={t("misc.happinessTrend")} role="img">
      <polyline points={points.map((p, i) => `${i * step},${h - 2 - (p / 100) * (h - 4)}`).join(" ")} />
    </svg>
  );
}

// Contact address on the customer's own domain, or one named after them.
function email(c: Customer, services: Service[]): string {
  const domain = services.find((v) => v.domain)?.domain ?? services.find((v) => v.label.includes(".") && !v.label.includes(" "))?.label
    ?? `${c.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "")}.de`;
  const local = PERSON.includes(c.profile) ? c.name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "") : "info";
  return `${local || "info"}@${domain}`;
}

const price = (v: Service) => (v.period === "hour" ? t("misc.perMonth", { price: euroPrice(serviceMonthly(v)) }) : t("misc.perYear", { price: euroCents(v.price) }));
const location = (s: GameState, v: Service) => zoneOf(s, v)?.name ?? t("misc.none");
const serviceStatus = (v: Service, r: Row) => (v.endedAt !== null ? <span className="pill">{t("misc.ended")}</span> : r.status === "suspended" ? <span className="pill bad">{t("misc.suspended")}</span> : <span className="pill">{t("misc.active")}</span>);
const InvoicePill = ({ i }: { i: Invoice }) => (
  <span className="fin-pills">
    <span className={`pill ${INVOICE[i.status].pill}`}>{INVOICE[i.status].label}</span>
    {i.suspended && isUnpaid(i) && <span className="pill">{t("misc.suspended")}</span>}
  </span>
);

export type Tab = "summary" | "services" | "invoices" | "tickets" | "activity";

export function CustomerPage({ r, onBack, tab: first = "summary" }: { r: Row; onBack: () => void; tab?: Tab }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const openApp = useStore((s) => s.openApp);
  const [tab, setTab] = useState<Tab>(first);
  const [pricing, setPricing] = useState<string | null>(null);
  const [crediting, setCrediting] = useState(false);
  const { c } = r;
  const services = game.services.filter((v) => v.customerId === c.id).sort((a, b) => Number(a.endedAt !== null) - Number(b.endedAt !== null) || b.startedAt - a.startedAt);
  const invoices = game.invoices.filter((i) => i.customerId === c.id).reverse();
  const domains = game.domains.filter((d) => d.customerId === c.id);
  const tickets = game.tickets.filter((tk) => tk.customerId === c.id).sort((a, b) => b.createdAt - a.createdAt);
  const subject = (tk: (typeof tickets)[number]) => t(`ticket.${tk.kind}.${tk.topic}.subject`, subjectParams(game, tk));
  const openInvoice = (id: string) => openApp("Books", { kind: "invoice", id });
  const openTicket = (id: string) => openApp("Support", { kind: "ticket", id });
  const serviceMenu = (v: Service) => (): MenuEntry[] => {
    const w = v.endedAt === null ? game.workloads.find((x) => x.serviceId === v.id) : undefined;
    return [
      v.endedAt === null && v.period === "hour" && { label: t("misc.changePrice"), run: () => { setTab("services"); setPricing(v.id); } },
      null,
      ...(w ? workloadActions(game, w) : []),
      null,
      w && consoleEntry(game, w.clusterId),
    ];
  };
  const customerMenu = (): MenuEntry[] => [
    { label: t("misc.creditEllipsis"), run: () => setCrediting(true) },
  ];
  const openSite = (domain: string) => openApp("Browser", { kind: "url", id: `${domain}/` });
  const isSite = (name: string) => services.some((v) => v.product === "webHosting" && v.domain === name);
  const domainMenu = (name: string) => (): MenuEntry[] => [
    isSite(name) && { label: t("misc.openSite"), run: () => openSite(name) },
    c.churnedAt === null && { label: t("misc.renew"), run: () => act(renewDomain, name) },
    { label: t("misc.openInBooks"), run: () => openApp("Books", { kind: "customer", id: c.id }) },
  ];
  const tabs: [Tab, string, number?][] = [
    ["summary", t("misc.summary")],
    ["services", t("misc.services"), services.filter((v) => v.endedAt === null).length],
    ["invoices", t("misc.invoices"), invoices.filter(isUnpaid).length],
    ["tickets", t("misc.tickets"), tickets.filter((tk) => !isFinal(tk)).length],
    ["activity", t("misc.activity")],
  ];

  const invoiceRows = (list: Invoice[]) => list.map((i) => (
    <tr key={i.id} tabIndex={0} onClick={() => openInvoice(i.id)} onKeyDown={(e) => e.key === "Enter" && openInvoice(i.id)}>
      <td className="num">{i.number}</td>
      <td className="num">{formatDay(i.issuedAt)}</td>
      <td className="num">{formatDay(i.dueAt)}</td>
      <td className="r num">{euroCents(invoiceTotal(i))}</td>
      <td className="r"><InvoicePill i={i} /></td>
    </tr>
  ));
  const ticketRows = (list: typeof tickets) => list.map((tk) => {
    const K = kindOf(tk.kind);
    return (
      <tr key={tk.id} tabIndex={0} onClick={() => openTicket(tk.id)} onKeyDown={(e) => e.key === "Enter" && openTicket(tk.id)}>
        <td className="cus-subject">{subject(tk)}</td>
        <td><span className="cus-kind-cell"><K.icon className="cus-kind" />{K.label}</span></td>
        <td className="num">{formatDay(tk.createdAt)}</td>
        <td className="r"><span className="pill">{statusOf(tk)}</span></td>
      </tr>
    );
  });
  const invoiceHead = <thead><tr><th>{t("misc.number")}</th><th>{t("misc.issued")}</th><th>{t("misc.due")}</th><th className="r">{t("misc.total")}</th><th className="r">{t("misc.status")}</th></tr></thead>;
  const ticketHead = <thead><tr><th>{t("misc.subject")}</th><th>{t("misc.type")}</th><th>{t("misc.opened")}</th><th className="r">{t("misc.status")}</th></tr></thead>;

  return (
    <div className="cus-page" onContextMenu={c.churnedAt === null ? menuOn(customerMenu) : undefined}>
      <header className="cus-page-head">
        <button className="btn ghost cus-back" onClick={onBack}><ChevronLeft />{t("misc.customers")}</button>
        <div className="cus-head">
          <div className="logo">{initials(c.name)}</div>
          <div className="grow">
            <h2>{c.name}</h2>
            <div className="cus-sub">{c.churnedAt === null ? <>{t("misc.sinceLabel")} <span className="num">{monthYear(c.since)}</span></> : <>{t("misc.left")} <span className="num">{monthYear(c.churnedAt)}</span></>}</div>
          </div>
          <StatusChip s={r.status} />
        </div>
      </header>
      {crediting && c.churnedAt === null && <CreditSheet customerId={c.id} onClose={() => setCrediting(false)} />}
      <dl className="fin-totals cus-totals">
        <div><dt>{t("misc.monthlyValue")}</dt><dd className="num">{euroPrice(r.monthly)}</dd></div>
        <div><dt>{t("misc.openBalance")}</dt><dd className="num">{euroCents(r.balance)}</dd></div>
        <div><dt>{t("misc.customerSince")}</dt><dd className="num">{monthYear(c.since)}</dd></div>
        <div><dt>{t("misc.happiness")}</dt><dd><Mood c={c} /></dd></div>
      </dl>
      <div className="tabs" role="tablist" aria-label={t("misc.customer")}>
        {tabs.map(([id, label, count]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}{count ? <span className="tab-count num">{count}</span> : null}
          </button>
        ))}
      </div>

      <div className="cus-body" role="tabpanel">
        {tab === "summary" && (
          <div className="cus-summary">
            <div className="cus-col">
              <section className="fin-card">
                <h3 className="fin-card-h"><Contact />{t("misc.contact")}</h3>
                <dl className="fin-rows">
                  <div><dt>{t("misc.name")}</dt><dd>{c.name}</dd></div>
                  <div><dt>{t("misc.email")}</dt><dd className="num">{email(c, services)}</dd></div>
                  <div><dt>{t("misc.customerSince")}</dt><dd className="num">{formatDay(c.since)}</dd></div>
                  {c.churnedAt !== null && <div><dt>{t("misc.left")}</dt><dd className="num">{formatDay(c.churnedAt)}</dd></div>}
                </dl>
              </section>
              <section className="fin-card">
                <h3 className="fin-card-h"><FileText />{t("misc.figures")}</h3>
                <dl className="fin-rows">
                  <div><dt>{t("misc.happiness")}</dt><dd className="cus-happy"><Trend c={c} /><Mood c={c} /></dd></div>
                  <div><dt>{t("misc.lifetimeSpend")}</dt><dd className="num">{euroCents(r.lifetime)}</dd></div>
                  <div><dt>{t("misc.openBalance")}</dt><dd className="num">{euroCents(r.balance)}</dd></div>
                  <div><dt>{t("misc.monthlyValue")}</dt><dd className="num">{euroPrice(r.monthly)}</dd></div>
                  <div><dt>{t("misc.activeServices")}</dt><dd className="num">{r.services}</dd></div>
                  <div><dt>{t("misc.openTickets")}</dt><dd className="num">{r.tickets}</dd></div>
                  <div><dt>{t("misc.invoices")}</dt><dd className="num">{r.invoices}</dd></div>
                  <div><dt>{t("misc.replyWithin")}</dt><dd>{patience(profileStats(c.profile).reply)}</dd></div>
                </dl>
              </section>
            </div>
            <div className="cus-col">
              <section className="fin-card">
                <h3 className="fin-card-h"><Server />{t("misc.services")}</h3>
                <table className="table cus-table">
                  <tbody>
                    {services.filter((v) => v.endedAt === null).map((v) => (
                      <tr key={v.id} onClick={() => setTab("services")} onContextMenu={menuOn(serviceMenu(v))}>
                        <td className="cus-subject"><span className="cus-strong">{v.label}</span>{v.hostname && <div className="cus-sub num">{fqdn(game, v.hostname)}</div>}</td>
                        <td className="cus-dim">{specText(v.product, v.spec)}</td>
                        <td className="r num">{price(v)}</td>
                        <td className="r">{serviceStatus(v, r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!r.services && <div className="fin-none">{t("misc.noServices")}</div>}
              </section>
              {domains.length > 0 && (
                <section className="fin-card">
                  <h3 className="fin-card-h"><Globe />{t("misc.domains")}</h3>
                  <table className="table cus-table">
                    <tbody>
                      {domains.map((d) => (
                        <tr key={d.name} onClick={() => openApp("Books", { kind: "customer", id: c.id })} onContextMenu={menuOn(domainMenu(d.name))}>
                          <td className="cus-subject"><span className="cus-strong">{d.name}</span></td>
                          <td className="cus-dim">{registryOf(d.name).name}</td>
                          <td className="r num">{formatDay(d.expiresAt)}</td>
                          <td className="r">{game.hour >= d.expiresAt ? <span className="pill bad">{t("misc.expired")}</span> : <span className="pill">{t("misc.active")}</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
              <section className="fin-card">
                <h3 className="fin-card-h"><Receipt />{t("misc.recentInvoices")}</h3>
                <table className="table cus-table">{invoiceHead}<tbody>{invoiceRows(invoices.slice(0, RECENT))}</tbody></table>
                {!invoices.length && <div className="fin-none">{t("misc.noInvoices")}</div>}
              </section>
              <section className="fin-card">
                <h3 className="fin-card-h"><LifeBuoy />{t("misc.recentTickets")}</h3>
                <table className="table cus-table">{ticketHead}<tbody>{ticketRows(tickets.slice(0, RECENT))}</tbody></table>
                {!tickets.length && <div className="fin-none">{t("misc.noTickets")}</div>}
              </section>
            </div>
          </div>
        )}

        {tab === "services" && (
          <>
            <div className="cus-services">
              {services.map((v) => (
                <section key={v.id} className={`fin-card${v.endedAt !== null ? " cus-ended" : ""}`} onContextMenu={menuOn(serviceMenu(v))}>
                  <h3 className="fin-card-h"><span className="cus-title">{v.label}</span>{serviceStatus(v, r)}<More label={v.label} entries={serviceMenu(v)} /></h3>
                  <div className="fin-card-b">
                    <dl className="fin-rows">
                      <div><dt>{t("misc.product")}</dt><dd>{PRODUCT[v.product]}</dd></div>
                      {v.hostname && <div><dt>{t("misc.hostname")}</dt><dd className="num">{fqdn(game, v.hostname)}</dd></div>}
                      {v.domain && <div><dt>{t("misc.domain")}</dt><dd>{v.domain}{v.product === "webHosting" && <> <button className="btn" onClick={() => openSite(v.domain!)}>{t("misc.openSite")}</button></>}</dd></div>}
                      <div><dt>{t("misc.resources")}</dt><dd className="num">{specText(v.product, v.spec)}</dd></div>
                      <div><dt>{t("misc.price")}</dt><dd className="num">{price(v)}</dd></div>
                      <div><dt>{t("misc.billing")}</dt><dd>{v.period === "hour" ? t("misc.monthly") : t("misc.yearly")}</dd></div>
                      <div><dt>{t("misc.sla")}</dt><dd>{SLA[v.sla]}</dd></div>
                      <div><dt>{t("misc.term")}</dt><dd className="num">{v.commitMonths ? t("misc.nMonths", { n: v.commitMonths }) : t("misc.none")}</dd></div>
                      <div><dt>{t("misc.location")}</dt><dd>{location(game, v)}</dd></div>
                      <div><dt>{t("misc.started")}</dt><dd className="num">{formatDay(v.startedAt)}</dd></div>
                      {v.endedAt !== null && <div><dt>{t("misc.ended")}</dt><dd className="num">{formatDay(v.endedAt)}</dd></div>}
                    </dl>
                    {pricing === v.id && v.endedAt === null && <ChangePrice v={v} profile={c.profile} onClose={() => setPricing(null)} />}
                  </div>
                  <ActivityLog customerId={c.id} serviceId={v.id} />
                </section>
              ))}
            </div>
            {!services.length && <div className="fin-none">{t("misc.noServices")}</div>}
          </>
        )}

        {tab === "invoices" && (
          <section className="fin-card">
            <table className="table fin-table cus-table">{invoiceHead}<tbody>{invoiceRows(invoices)}</tbody></table>
            {!invoices.length && <div className="fin-none">{t("misc.noInvoices")}</div>}
          </section>
        )}

        {tab === "tickets" && (
          <section className="fin-card">
            <table className="table fin-table cus-table">{ticketHead}<tbody>{ticketRows(tickets)}</tbody></table>
            {!tickets.length && <div className="fin-none">{t("misc.noTickets")}</div>}
          </section>
        )}

        {tab === "activity" && (
          <section className="fin-card">
            <h3 className="fin-card-h"><ListChecks />{t("misc.workLog")}</h3>
            <ActivityLog customerId={c.id} />
          </section>
        )}
        {tab === "activity" && (
          <section className="fin-card">
            <h3 className="fin-card-h"><History />{t("misc.history")}</h3>
            <Timeline invoices={invoices} tickets={tickets} subject={subject} />
          </section>
        )}
      </div>
    </div>
  );
}

function Timeline({ invoices, tickets, subject }: { invoices: Invoice[]; tickets: GameState["tickets"]; subject: (tk: GameState["tickets"][number]) => string }) {
  const openApp = useStore((s) => s.openApp);
  const items = [
    ...invoices.map((i) => ({ at: i.issuedAt, what: t("misc.invoiceIssued", { number: i.number }), value: <span className="num">{euroCents(invoiceTotal(i))}</span>, open: () => openApp("Billing", { kind: "invoice", id: i.id }) })),
    ...invoices.filter((i) => i.paidAt !== null).map((i) => ({ at: i.paidAt!, what: t("misc.invoicePaid", { number: i.number }), value: <span className="num">{euroCents(invoiceTotal(i))}</span>, open: () => openApp("Billing", { kind: "invoice", id: i.id }) })),
    ...tickets.map((tk) => ({ at: tk.createdAt, what: t("misc.ticketOpened", { subject: subject(tk) }), value: <span className="pill">{statusOf(tk)}</span>, open: () => openApp("Support", { kind: "ticket", id: tk.id }) })),
  ].sort((a, b) => b.at - a.at);
  if (!items.length) return <div className="fin-none">{t("misc.noActivity")}</div>;
  return (
    <table className="table fin-table cus-table">
      <tbody>
        {items.map((x, n) => (
          <tr key={n} onClick={x.open}>
            <td className="num cus-when">{formatDay(x.at)}</td>
            <td className="cus-subject">{x.what}</td>
            <td className="r">{x.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CreditSheet({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const act = useStore((s) => s.act);
  const id = useId();
  const [text, setText] = useState(""), amount = Math.round(Number(text) * 100) / 100;
  const save = () => { if (act(creditCustomer, customerId, amount).ok) onClose(); };
  return (
    <div className="cus-price cus-credit">
      <div className="price-field">
        <label className="price-label" htmlFor={id}>{t("misc.creditAmount")}</label>
        <span className="price-input">
          <input id={id} type="number" min={0} step={0.01} autoFocus value={text} onChange={(e) => setText(e.target.value)} />
          <span aria-hidden>€</span>
        </span>
      </div>
      <div className="fin-actions">
        <button className="btn ghost" onClick={onClose}>{t("misc.cancel")}</button>
        <button className="btn primary" disabled={!(amount > 0)} onClick={save}>{t("misc.credit")}</button>
      </div>
    </div>
  );
}

export function ChangePrice({ v, profile, onClose }: { v: Service; profile: Profile; onClose: () => void }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const [monthly, setMonthly] = useState(Math.round(serviceMonthly(v) * 100) / 100);
  const save = () => { if (act(changePrice, v.id, monthly).ok) onClose(); };
  return (
    <div className="cus-price">
      <PriceField value={monthly} reference={referenceFor(game, profile, v.product, v.spec, v.sla)} onChange={setMonthly} label={t("misc.newMonthlyPrice")} />
      <div className="fin-actions">
        <button className="btn ghost" onClick={onClose}>{t("misc.cancel")}</button>
        <button className="btn primary" disabled={!(monthly > 0)} onClick={save}>{t("misc.savePrice")}</button>
      </div>
    </div>
  );
}
