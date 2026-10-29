import { ChevronLeft, Contact, Cpu, FileText, Globe, History, LifeBuoy, ListChecks, Receipt, Server } from "lucide-react";
import { useState } from "react";
import { euroCents, euroPrice } from "../../../sim/00-core/money";
import { planOf } from "../../../sim/10-catalog/products";
import type { Customer, Profile, Service } from "../../../sim/30-customers/customers";
import { referenceFor } from "../../../sim/30-market/market";
import { subjectParams } from "../../../sim/40-support/notices";
import { isFinal, profileStats, serviceMonthly } from "../../../sim/40-support/tickets";
import { invoiceTotal, isUnpaid, type Invoice, type InvoiceStatus } from "../../../sim/45-billing/billing";
import type { GameState } from "../../../sim/50-state";
import { zoneOf } from "../../../sim/60-infra/network";
import { renewDomain } from "../../../sim/90-actions/orders";
import { changePrice } from "../../../sim/90-actions/sales";
import { menuOn, type MenuEntry } from "../../desktop/ContextMenu";
import { More } from "../More";
import { workloadActions } from "../vms/VmApp";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { formatDay } from "../billing/BillingApp";
import { PriceField } from "../sales/PriceField";
import { ActivityLog } from "./ActivityLog";
import { registryOf } from "../../../sim/30-customers/registry";
import { customReference } from "../../../sim/30-market/manual";
import { specLine } from "../support/CustomOrder";
import { initials, kindOf, monthYear, moodClass, noticed, patience, PRODUCT, STATUS } from "../support/labels";

export type Status = "active" | "overdue" | "suspended" | "churned";
export interface Row { c: Customer; status: Status; services: number; monthly: number; lifetime: number; balance: number; invoices: number; tickets: number; labels: string }

export const STATUSES: Record<Status, { label: string; pill: string }> = {
  active: { label: "Active", pill: "" },
  overdue: { label: "Overdue", pill: "warn" },
  suspended: { label: "Suspended", pill: "bad" },
  churned: { label: "Churned", pill: "" },
};
const INVOICE: Record<InvoiceStatus, { label: string; pill: string }> = {
  open: { label: "Open", pill: "accent" }, overdue: { label: "Overdue", pill: "warn" }, paid: { label: "Paid", pill: "" }, writtenOff: { label: "Written off", pill: "" },
};
const SLA = { basic: "Basic", business: "Business", premium: "Premium" } as const;
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
    <svg className="cus-trend" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="Happiness trend" role="img">
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

const price = (v: Service) => (v.period === "hour" ? `${euroPrice(serviceMonthly(v))} a month` : `${euroCents(v.price)} a year`);
const location = (s: GameState, v: Service) => zoneOf(s, v)?.name ?? "None";
const serviceStatus = (v: Service, r: Row) => (v.endedAt !== null ? <span className="pill">Ended</span> : r.status === "suspended" ? <span className="pill bad">Suspended</span> : <span className="pill">Active</span>);
const InvoicePill = ({ i }: { i: Invoice }) => (
  <span className="fin-pills">
    <span className={`pill ${INVOICE[i.status].pill}`}>{INVOICE[i.status].label}</span>
    {i.suspended && isUnpaid(i) && <span className="pill">Suspended</span>}
  </span>
);

export type Tab = "summary" | "services" | "invoices" | "tickets" | "activity";

export function CustomerPage({ r, onBack, tab: first = "summary" }: { r: Row; onBack: () => void; tab?: Tab }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const openApp = useStore((s) => s.openApp);
  const [tab, setTab] = useState<Tab>(first);
  const [pricing, setPricing] = useState<string | null>(null);
  const { c } = r;
  const vms = game.installed.includes("Virtual machines");
  const services = game.services.filter((v) => v.customerId === c.id).sort((a, b) => Number(a.endedAt !== null) - Number(b.endedAt !== null) || b.startedAt - a.startedAt);
  const invoices = game.invoices.filter((i) => i.customerId === c.id).reverse();
  const domains = game.domains.filter((d) => d.customerId === c.id);
  const tickets = game.tickets.filter((tk) => tk.customerId === c.id).sort((a, b) => b.createdAt - a.createdAt);
  const subject = (tk: (typeof tickets)[number]) => t(`ticket.${tk.kind}.${tk.topic}.subject`, subjectParams(game, tk));
  const openInvoice = (id: string) => openApp("Billing", { kind: "invoice", id });
  const openTicket = (id: string) => openApp("Support", { kind: "ticket", id });
  const serviceMenu = (v: Service) => (): MenuEntry[] => {
    const w = v.endedAt === null ? game.workloads.find((x) => x.serviceId === v.id) : undefined;
    const kind = w && game.clusters.find((x) => x.id === w.clusterId)?.kind;
    return [
      v.endedAt === null && v.period === "hour" && { label: "Change price", run: () => { setTab("services"); setPricing(v.id); } },
      null,
      ...(w ? workloadActions(game, w) : []),
      null,
      w && kind === "cloud" && vms && { label: "Open in Virtual machines", run: () => openApp("Virtual machines", { kind: "workload", id: w.id }) },
      w && kind === "panel" && { label: "Open panel host", run: () => openApp("Products", { kind: "cluster", id: w.clusterId! }) },
    ];
  };
  const domainMenu = (name: string) => (): MenuEntry[] => [
    c.churnedAt === null && { label: "Renew", run: () => act((s) => renewDomain(s, name)) },
    { label: "Open in Billing", run: () => openApp("Billing", { kind: "domain", id: name }) },
  ];
  const tabs: [Tab, string, number?][] = [
    ["summary", "Summary"],
    ["services", "Services", services.filter((v) => v.endedAt === null).length],
    ["invoices", "Invoices", invoices.filter(isUnpaid).length],
    ["tickets", "Tickets", tickets.filter((tk) => !isFinal(tk)).length],
    ["activity", "Activity"],
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
        <td className="r"><span className="pill">{STATUS[tk.status]}</span></td>
      </tr>
    );
  });
  const invoiceHead = <thead><tr><th>Number</th><th>Issued</th><th>Due</th><th className="r">Total</th><th className="r">Status</th></tr></thead>;
  const ticketHead = <thead><tr><th>Subject</th><th>Type</th><th>Opened</th><th className="r">Status</th></tr></thead>;

  return (
    <div className="cus-page">
      <header className="cus-page-head">
        <button className="btn ghost cus-back" onClick={onBack}><ChevronLeft />Customers</button>
        <div className="cus-head">
          <div className="logo">{initials(c.name)}</div>
          <div className="grow">
            <h2>{c.name}</h2>
            <div className="cus-sub">{c.churnedAt === null ? <>Since <span className="num">{monthYear(c.since)}</span></> : <>Left <span className="num">{monthYear(c.churnedAt)}</span></>}</div>
          </div>
          <StatusChip s={r.status} />
        </div>
      </header>
      <dl className="fin-totals cus-totals">
        <div><dt>Monthly value</dt><dd className="num">{euroPrice(r.monthly)}</dd></div>
        <div><dt>Open balance</dt><dd className="num">{euroCents(r.balance)}</dd></div>
        <div><dt>Customer since</dt><dd className="num">{monthYear(c.since)}</dd></div>
        <div><dt>Happiness</dt><dd><Mood c={c} /></dd></div>
      </dl>
      <div className="cus-tabs" role="tablist" aria-label="Customer">
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
                <h3 className="fin-card-h"><Contact />Contact</h3>
                <dl className="fin-rows">
                  <div><dt>Name</dt><dd>{c.name}</dd></div>
                  <div><dt>Email</dt><dd className="num">{email(c, services)}</dd></div>
                  <div><dt>Customer since</dt><dd className="num">{formatDay(c.since)}</dd></div>
                  {c.churnedAt !== null && <div><dt>Left</dt><dd className="num">{formatDay(c.churnedAt)}</dd></div>}
                </dl>
              </section>
              <section className="fin-card">
                <h3 className="fin-card-h"><FileText />Figures</h3>
                <dl className="fin-rows">
                  <div><dt>Happiness</dt><dd className="cus-happy"><Trend c={c} /><Mood c={c} /></dd></div>
                  <div><dt>Lifetime spend</dt><dd className="num">{euroCents(r.lifetime)}</dd></div>
                  <div><dt>Open balance</dt><dd className="num">{euroCents(r.balance)}</dd></div>
                  <div><dt>Monthly value</dt><dd className="num">{euroPrice(r.monthly)}</dd></div>
                  <div><dt>Active services</dt><dd className="num">{r.services}</dd></div>
                  <div><dt>Open tickets</dt><dd className="num">{r.tickets}</dd></div>
                  <div><dt>Invoices</dt><dd className="num">{r.invoices}</dd></div>
                  <div><dt>Reply within</dt><dd>{patience(profileStats(c.profile).reply)}</dd></div>
                  <div><dt>Notices outages</dt><dd>{noticed(profileStats(c.profile).tolerance)}</dd></div>
                </dl>
              </section>
            </div>
            <div className="cus-col">
              <section className="fin-card">
                <h3 className="fin-card-h"><Server />Services</h3>
                <table className="table cus-table">
                  <tbody>
                    {services.filter((v) => v.endedAt === null).map((v) => (
                      <tr key={v.id} onClick={() => setTab("services")} onContextMenu={menuOn(serviceMenu(v))}>
                        <td className="cus-subject"><span className="cus-strong">{v.label}</span></td>
                        <td className="cus-dim">{v.spec ? specLine(v.product, v.spec) : planOf(v.product, v.plan).name}</td>
                        <td className="r num">{price(v)}</td>
                        <td className="r">{serviceStatus(v, r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!r.services && <div className="fin-none">No services</div>}
              </section>
              {domains.length > 0 && (
                <section className="fin-card">
                  <h3 className="fin-card-h"><Globe />Domains</h3>
                  <table className="table cus-table">
                    <tbody>
                      {domains.map((d) => (
                        <tr key={d.name} onClick={() => openApp("Billing", { kind: "domain", id: d.name })} onContextMenu={menuOn(domainMenu(d.name))}>
                          <td className="cus-subject"><span className="cus-strong">{d.name}</span></td>
                          <td className="cus-dim">{registryOf(d.name).name}</td>
                          <td className="r num">{formatDay(d.expiresAt)}</td>
                          <td className="r">{game.hour >= d.expiresAt ? <span className="pill bad">Expired</span> : <span className="pill">Active</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
              <section className="fin-card">
                <h3 className="fin-card-h"><Receipt />Recent invoices</h3>
                <table className="table cus-table">{invoiceHead}<tbody>{invoiceRows(invoices.slice(0, RECENT))}</tbody></table>
                {!invoices.length && <div className="fin-none">No invoices</div>}
              </section>
              <section className="fin-card">
                <h3 className="fin-card-h"><LifeBuoy />Recent tickets</h3>
                <table className="table cus-table">{ticketHead}<tbody>{ticketRows(tickets.slice(0, RECENT))}</tbody></table>
                {!tickets.length && <div className="fin-none">No tickets</div>}
              </section>
            </div>
          </div>
        )}

        {tab === "services" && (
          <>
            {vms && <div className="fin-actions"><button className="btn" onClick={() => openApp("Virtual machines")}><Cpu />Open Virtual machines</button></div>}
            <div className="cus-services">
              {services.map((v) => (
                <section key={v.id} className={`fin-card${v.endedAt !== null ? " cus-ended" : ""}`} onContextMenu={menuOn(serviceMenu(v))}>
                  <h3 className="fin-card-h"><span className="cus-title">{v.label}</span>{serviceStatus(v, r)}<More label={v.label} entries={serviceMenu(v)} /></h3>
                  <div className="fin-card-b">
                    <dl className="fin-rows">
                      <div><dt>Product</dt><dd>{PRODUCT[v.product]}</dd></div>
                      {v.domain && <div><dt>Domain</dt><dd>{v.domain}</dd></div>}
                      {v.spec ? <div><dt>Resources</dt><dd className="num">{specLine(v.product, v.spec)}</dd></div> : <div><dt>Plan</dt><dd>{planOf(v.product, v.plan).name}</dd></div>}
                      <div><dt>Price</dt><dd className="num">{price(v)}</dd></div>
                      <div><dt>Billing</dt><dd>{v.period === "hour" ? "Monthly" : "Yearly"}</dd></div>
                      <div><dt>SLA</dt><dd>{SLA[v.sla]}</dd></div>
                      <div><dt>Term</dt><dd className="num">{v.commitMonths ? `${v.commitMonths} month${v.commitMonths === 1 ? "" : "s"}` : "None"}</dd></div>
                      <div><dt>Location</dt><dd>{location(game, v)}</dd></div>
                      <div><dt>Started</dt><dd className="num">{formatDay(v.startedAt)}</dd></div>
                      {v.endedAt !== null && <div><dt>Ended</dt><dd className="num">{formatDay(v.endedAt)}</dd></div>}
                    </dl>
                    {pricing === v.id && v.endedAt === null && <ChangePrice v={v} profile={c.profile} onClose={() => setPricing(null)} />}
                  </div>
                  <ActivityLog customerId={c.id} serviceId={v.id} />
                </section>
              ))}
            </div>
            {!services.length && <div className="fin-none">No services</div>}
          </>
        )}

        {tab === "invoices" && (
          <section className="fin-card">
            <table className="table fin-table cus-table">{invoiceHead}<tbody>{invoiceRows(invoices)}</tbody></table>
            {!invoices.length && <div className="fin-none">No invoices</div>}
          </section>
        )}

        {tab === "tickets" && (
          <section className="fin-card">
            <table className="table fin-table cus-table">{ticketHead}<tbody>{ticketRows(tickets)}</tbody></table>
            {!tickets.length && <div className="fin-none">No tickets</div>}
          </section>
        )}

        {tab === "activity" && (
          <section className="fin-card">
            <h3 className="fin-card-h"><ListChecks />Work log</h3>
            <ActivityLog customerId={c.id} />
          </section>
        )}
        {tab === "activity" && (
          <section className="fin-card">
            <h3 className="fin-card-h"><History />History</h3>
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
    ...invoices.map((i) => ({ at: i.issuedAt, what: `Invoice ${i.number} issued`, value: <span className="num">{euroCents(invoiceTotal(i))}</span>, open: () => openApp("Billing", { kind: "invoice", id: i.id }) })),
    ...invoices.filter((i) => i.paidAt !== null).map((i) => ({ at: i.paidAt!, what: `Invoice ${i.number} paid`, value: <span className="num">{euroCents(invoiceTotal(i))}</span>, open: () => openApp("Billing", { kind: "invoice", id: i.id }) })),
    ...tickets.map((tk) => ({ at: tk.createdAt, what: `Ticket opened: ${subject(tk)}`, value: <span className="pill">{STATUS[tk.status]}</span>, open: () => openApp("Support", { kind: "ticket", id: tk.id }) })),
  ].sort((a, b) => b.at - a.at);
  if (!items.length) return <div className="fin-none">No activity</div>;
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

function ChangePrice({ v, profile, onClose }: { v: Service; profile: Profile; onClose: () => void }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const [monthly, setMonthly] = useState(Math.round(serviceMonthly(v) * 100) / 100);
  const save = () => { if (act((s) => changePrice(s, v.id, monthly)).ok) onClose(); };
  return (
    <div className="cus-price">
      <PriceField value={monthly} reference={v.spec ? customReference(game, profile, v.product, v.spec, v.sla) : referenceFor(game, profile, v.product, v.plan ?? "", v.sla)} onChange={setMonthly} label="New monthly price" />
      <div className="fin-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!(monthly > 0)} onClick={save}>Save price</button>
      </div>
    </div>
  );
}
