import { ChevronDown, ChevronUp, Cpu, FileText, LifeBuoy, Receipt, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { euro, euroCents } from "../../../sim/00-core/money";
import { activeServices, type Customer } from "../../../sim/30-customers/customers";
import { isFinal, serviceMonthly } from "../../../sim/40-support/tickets";
import { subjectParams } from "../../../sim/40-support/notices";
import { invoiceTotal, isUnpaid, type InvoiceStatus } from "../../../sim/45-billing/billing";
import type { GameState } from "../../../sim/50-state";
import { t } from "../../../i18n/en";
import { useFocus, useStore } from "../../store";
import { formatDay } from "../billing/BillingApp";
import { APPS } from "../registry";
import { initials, kindOf, monthYear, moodClass, PRODUCT, stamp, STATUS } from "../support/labels";
import "../support/support.css";
import { referenceFor } from "../../../sim/30-market/market";
import type { Profile, Service } from "../../../sim/30-customers/customers";
import { changePrice } from "../../../sim/90-actions/sales";
import { PriceField } from "../sales/PriceField";
import "./customers.css";

type Status = "active" | "overdue" | "suspended" | "churned";
const STATUSES: Record<Status, { label: string; pill: string }> = {
  active: { label: "Active", pill: "" },
  overdue: { label: "Overdue", pill: "warn" },
  suspended: { label: "Suspended", pill: "bad" },
  churned: { label: "Churned", pill: "" },
};
const INVOICE: Record<InvoiceStatus, { label: string; pill: string }> = {
  open: { label: "Open", pill: "accent" }, overdue: { label: "Overdue", pill: "warn" }, paid: { label: "Paid", pill: "" }, writtenOff: { label: "Written off", pill: "" },
};
const FILTERS: { id: Status | "current"; label: string }[] = [
  { id: "current", label: "Current" }, { id: "active", label: "Active" }, { id: "overdue", label: "Overdue" }, { id: "suspended", label: "Suspended" }, { id: "churned", label: "Churned" },
];
const BANDS = [
  { id: "any", label: "Any happiness", match: () => true },
  { id: "ok", label: "Happy", match: (h: number) => moodClass(h) === "ok" },
  { id: "warn", label: "Neutral", match: (h: number) => moodClass(h) === "warn" },
  { id: "bad", label: "Unhappy", match: (h: number) => moodClass(h) === "bad" },
];

interface Row { c: Customer; status: Status; services: number; monthly: number; lifetime: number; balance: number; invoices: number; tickets: number; labels: string }
type Key = "name" | "status" | "happiness" | "services" | "monthly" | "lifetime" | "balance" | "since";
const COLUMNS: { key: Key; label: string; num?: boolean }[] = [
  { key: "name", label: "Name" }, { key: "status", label: "Status" }, { key: "happiness", label: "Happiness" },
  { key: "services", label: "Services", num: true }, { key: "monthly", label: "Monthly", num: true }, { key: "lifetime", label: "Lifetime", num: true },
  { key: "balance", label: "Balance", num: true }, { key: "since", label: "Since", num: true },
];
const ORDER: Status[] = ["active", "overdue", "suspended", "churned"];
const value = (r: Row, k: Key): number | string =>
  k === "name" ? r.c.name : k === "status" ? ORDER.indexOf(r.status) : k === "happiness" ? r.c.happiness : k === "since" ? r.c.since : r[k];

function rows(game: GameState): Row[] {
  const by = <T,>() => new Map<string, T>();
  const paid = by<number>(), owed = by<number>(), count = by<number>(), tickets = by<number>(), labels = by<string>(), status = by<Status>();
  const add = (m: Map<string, number>, id: string, v: number) => m.set(id, (m.get(id) ?? 0) + v);
  for (const i of game.invoices) {
    add(count, i.customerId, 1);
    if (i.status === "paid") add(paid, i.customerId, invoiceTotal(i));
    if (!isUnpaid(i)) continue;
    add(owed, i.customerId, invoiceTotal(i));
    if (i.suspended) status.set(i.customerId, "suspended");
    else if (i.status === "overdue" && !status.has(i.customerId)) status.set(i.customerId, "overdue");
  }
  for (const tk of game.tickets) if (!isFinal(tk)) add(tickets, tk.customerId, 1);
  for (const v of game.services) labels.set(v.customerId, `${labels.get(v.customerId) ?? ""} ${v.label.toLowerCase()}`);
  return game.customers.map((c) => {
    const services = activeServices(game.services, c.id);
    return {
      c, status: c.churnedAt !== null ? "churned" : status.get(c.id) ?? "active", services: services.length,
      monthly: services.reduce((sum, v) => sum + serviceMonthly(v), 0), lifetime: paid.get(c.id) ?? 0, balance: owed.get(c.id) ?? 0,
      invoices: count.get(c.id) ?? 0, tickets: tickets.get(c.id) ?? 0, labels: `${c.name.toLowerCase()}${labels.get(c.id) ?? ""}`,
    };
  });
}

export function CustomerLink({ id, name }: { id: string; name: string }) {
  const openApp = useStore((s) => s.openApp);
  return <button className="link" onClick={(e) => { e.stopPropagation(); openApp("Customers", { kind: "customer", id }); }}>{name}</button>;
}

export function CustomersApp() {
  const game = useStore((s) => s.game);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Status | "current">("current");
  const [band, setBand] = useState("any");
  const [withTickets, setWithTickets] = useState(false);
  const [sort, setSort] = useState<{ key: Key; dir: number }>({ key: "name", dir: 1 });
  const [sel, setSel] = useState<string | null>(null);
  const all = useMemo(() => rows(game), [game]);
  useFocus("Customers", (f) => {
    const r = all.find((x) => x.c.id === f.id);
    if (f.kind !== "customer" || !r) return;
    setQuery("");
    setBand("any");
    setWithTickets(false);
    setFilter(r.status === "churned" ? "churned" : "current");
    setSel(f.id);
  });

  const q = query.trim().toLowerCase();
  const match = BANDS.find((b) => b.id === band)!.match;
  const list = all
    .filter((r) => (filter === "current" ? r.status !== "churned" : r.status === filter) && match(r.c.happiness) && (!withTickets || r.tickets > 0) && (!q || r.labels.includes(q)))
    .sort((a, b) => {
      const x = value(a, sort.key), y = value(b, sort.key);
      return sort.dir * (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number));
    });
  const current = all.find((r) => r.c.id === sel);
  const sortBy = (key: Key) => setSort(sort.key === key ? { key, dir: -sort.dir } : { key, dir: 1 });

  return (
    <div className="cus">
      <div className="cus-main">
        <div className="cus-bar">
          <label className="search"><Search /><input type="search" placeholder="Search" aria-label="Search customers" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          <div className="seg" role="group" aria-label="Status">
            {FILTERS.map((f) => <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}
          </div>
          <select className="field" aria-label="Happiness" value={band} onChange={(e) => setBand(e.target.value)}>
            {BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
          <button className="btn cus-toggle" aria-pressed={withTickets} onClick={() => setWithTickets(!withTickets)}><LifeBuoy />Open tickets</button>
        </div>
        <div className="cus-scroll">
          <table className="table">
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} className={col.num ? "r" : ""} aria-sort={sort.key === col.key ? (sort.dir > 0 ? "ascending" : "descending") : "none"}>
                    <button className="cus-sort" onClick={() => sortBy(col.key)}>
                      {col.label}{sort.key === col.key && (sort.dir > 0 ? <ChevronUp /> : <ChevronDown />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.c.id} className={r.c.id === sel ? "active" : ""} onClick={() => setSel(r.c.id)}>
                  <td><button className="cus-name" onClick={() => setSel(r.c.id)}>{r.c.name}</button></td>
                  <td><StatusChip s={r.status} /></td>
                  <td><Mood c={r.c} /></td>
                  <td className="r num">{r.services}</td>
                  <td className="r num">{euro(r.monthly)}</td>
                  <td className="r num">{euro(r.lifetime)}</td>
                  <td className="r num">{euroCents(r.balance)}</td>
                  <td className="r num">{monthYear(r.c.since)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <div className="sup-none">No customers</div>}
        </div>
      </div>
      {current ? <Detail r={current} /> : <div className="cus-detail sup-none">No customer selected</div>}
    </div>
  );
}

const StatusChip = ({ s }: { s: Status }) => <span className={`pill ${STATUSES[s].pill}`}>{STATUSES[s].label}</span>;

function Mood({ c }: { c: Customer }) {
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

type Tab = "overview" | "services" | "invoices" | "tickets" | "workloads";

function Detail({ r }: { r: Row }) {
  const game = useStore((s) => s.game);
  const openApp = useStore((s) => s.openApp);
  const [tab, setTab] = useState<Tab>("overview");
  const { c } = r;
  const vms = APPS.some((a) => a.name === "Virtual machines" && a.body);
  const tabs: [Tab, string][] = [["overview", "Overview"], ["services", "Services"], ["invoices", "Invoices"], ["tickets", "Tickets"], ...(vms ? [["workloads", "Workloads"] as [Tab, string]] : [])];
  const services = game.services.filter((v) => v.customerId === c.id).sort((a, b) => Number(a.endedAt !== null) - Number(b.endedAt !== null) || b.startedAt - a.startedAt);
  const invoices = game.invoices.filter((i) => i.customerId === c.id).reverse();
  const tickets = game.tickets.filter((tk) => tk.customerId === c.id).sort((a, b) => b.createdAt - a.createdAt);
  const counts: Partial<Record<Tab, number>> = {
    services: services.filter((v) => v.endedAt === null).length,
    invoices: invoices.filter(isUnpaid).length,
    tickets: tickets.filter((tk) => !isFinal(tk)).length,
  };

  return (
    <div className="cus-detail">
      <div className="cus-head">
        <div className="logo">{initials(c.name)}</div>
        <div className="grow">
          <h2>{c.name}</h2>
          <div className="cus-sub">{c.churnedAt === null ? <>Since <span className="num">{monthYear(c.since)}</span></> : <>Left <span className="num">{monthYear(c.churnedAt)}</span></>}</div>
        </div>
        <StatusChip s={r.status} />
      </div>
      <div className="seg cus-tabs" role="tablist" aria-label="Customer">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}{counts[id] ? <span className="tab-count num">{counts[id]}</span> : null}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <dl className="cus-facts">
          <dt>Happiness</dt><dd className="cus-happy"><Mood c={c} /><Trend c={c} /></dd>
          <dt>Lifetime spend</dt><dd className="num">{euroCents(r.lifetime)}</dd>
          <dt>Open balance</dt><dd className="num">{euroCents(r.balance)}</dd>
          <dt>Monthly value</dt><dd className="num">{euro(r.monthly)}</dd>
          <dt>Active services</dt><dd className="num">{r.services}</dd>
          <dt>Open tickets</dt><dd className="num">{r.tickets}</dd>
          <dt>Invoices</dt><dd className="num">{r.invoices}</dd>
        </dl>
      )}

      {tab === "services" && (
        <section className="cus-card">
          <h3><FileText />Services</h3>
          {services.map((v) => (
            <div key={v.id} className={`cus-row${v.endedAt !== null ? " ended" : ""}`}>
              <span className="grow"><span className="cus-strong">{v.label}</span><span className="cus-dim">{PRODUCT[v.product]} · {v.period === "hour" ? "Hourly" : "Yearly"}</span></span>
              <span className="cus-right">
                <span className="num">{v.period === "hour" ? `${euro(serviceMonthly(v))} a month` : `${euroCents(v.price)} a year`}</span>
                <span className="cus-dim">{v.endedAt === null ? <>since <span className="num">{formatDay(v.startedAt)}</span></> : <>ended <span className="num">{formatDay(v.endedAt)}</span></>}</span>
              </span>
              <span className={`pill ${v.endedAt === null && r.status === "suspended" ? "bad" : ""}`}>{v.endedAt !== null ? "Ended" : r.status === "suspended" ? "Suspended" : "Active"}</span>
              {v.endedAt === null && v.period === "hour" && <ChangePrice v={v} profile={c.profile} />}
            </div>
          ))}
          {!services.length && <div className="cus-row cus-dim">No services</div>}
        </section>
      )}

      {tab === "invoices" && (
        <section className="cus-card">
          <h3><Receipt />Invoices</h3>
          {invoices.map((i) => (
            <button key={i.id} className="cus-row" onClick={() => openApp("Billing", { kind: "invoice", id: i.id })}>
              <span className="grow"><span className="cus-strong num">{i.number}</span><span className="cus-dim">Issued <span className="num">{formatDay(i.issuedAt)}</span></span></span>
              <span className="num">{euroCents(invoiceTotal(i))}</span>
              <span className="fin-pills">
                <span className={`pill ${INVOICE[i.status].pill}`}>{INVOICE[i.status].label}</span>
                {i.suspended && isUnpaid(i) && <span className="pill">Suspended</span>}
              </span>
            </button>
          ))}
          {!invoices.length && <div className="cus-row cus-dim">No invoices</div>}
        </section>
      )}

      {tab === "tickets" && (
        <section className="cus-card">
          <h3><LifeBuoy />Tickets</h3>
          {tickets.map((tk) => {
            const K = kindOf(tk.kind);
            return (
              <button key={tk.id} className="cus-row" onClick={() => openApp("Support", { kind: "ticket", id: tk.id })}>
                <K.icon className="cus-kind" aria-label={K.label} />
                <span className="grow cus-strong">{t(`ticket.${tk.kind}.${tk.topic}.subject`, subjectParams(game, tk))}</span>
                <span className="cus-right"><span className="pill">{STATUS[tk.status]}</span><span className="cus-dim num">{stamp(tk.createdAt)}</span></span>
              </button>
            );
          })}
          {!tickets.length && <div className="cus-row cus-dim">No tickets</div>}
        </section>
      )}

      {tab === "workloads" && (
        <section className="cus-card">
          <h3><Cpu />Workloads</h3>
          <div className="cus-row cus-dim"><span className="grow">No workloads</span><button className="btn" onClick={() => openApp("Virtual machines")}>Open Virtual machines</button></div>
        </section>
      )}
    </div>
  );
}

function ChangePrice({ v, profile }: { v: Service; profile: Profile }) {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(Math.round(serviceMonthly(v) * 100) / 100);
  if (!open) return <button className="btn" onClick={() => setOpen(true)}>Change price</button>;
  const save = () => { if (act((s) => changePrice(s, v.id, price)).ok) setOpen(false); };
  return (
    <div className="cus-price">
      <PriceField value={price} reference={referenceFor(game, profile, v.product, v.plan ?? "", v.sla)} onChange={setPrice} label="New monthly price" />
      <div className="cus-price-actions">
        <button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn primary" disabled={!(price > 0)} onClick={save}>Save price</button>
      </div>
    </div>
  );
}
