import { Ban, CircleCheck, CircleDot, Files, Mail, OctagonAlert, Pause, Play, Receipt, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { dateOf } from "../../../sim/00-core/time";
import { AUTO_SUSPEND_DAYS, dueStep, freeRiding, invoiceTotal, STEPS, type BillingRules, type Invoice, type InvoiceStatus } from "../../../sim/45-billing/billing";
import { sendReminder, setBillingRules, suspendServices, writeOff } from "../../../sim/90-actions/billing";
import { t } from "../../../i18n/en";
import { Confirm } from "../../desktop/Confirm";
import { useFocus, useStore } from "../../store";
import { CustomerLink } from "../customers/CustomersApp";
import "./billing.css";

export const formatDay = (hour: number) =>
  dateOf(hour).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const sameMonth = (a: number, b: number) => {
  const x = dateOf(a), y = dateOf(b);
  return x.getUTCFullYear() === y.getUTCFullYear() && x.getUTCMonth() === y.getUTCMonth();
};

const STATUS: Record<InvoiceStatus, { label: string; pill: string }> = {
  open: { label: "Open", pill: "accent" },
  overdue: { label: "Overdue", pill: "warn" },
  paid: { label: "Paid", pill: "" },
  writtenOff: { label: "Written off", pill: "" },
};
const FILTERS: { id: InvoiceStatus | "all"; label: string; icon: ReactNode }[] = [
  { id: "all", label: "All invoices", icon: <Files /> },
  { id: "open", label: "Open", icon: <CircleDot /> },
  { id: "overdue", label: "Overdue", icon: <OctagonAlert /> },
  { id: "paid", label: "Paid", icon: <CircleCheck /> },
  { id: "writtenOff", label: "Written off", icon: <Ban /> },
];

const sum = (list: Invoice[]) => list.reduce((s, i) => s + invoiceTotal(i), 0);

export function BillingApp() {
  const game = useStore((s) => s.game);
  const [filter, setFilter] = useState<InvoiceStatus | "all">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const act = useStore((s) => s.act);
  useFocus("Billing", (f) => {
    if (f.kind !== "invoice") return;
    setFilter("all");
    setSelected(f.id);
  });
  const name = (id: string) => game.customers.find((c) => c.id === id)?.name ?? id;
  const shown = game.invoices.filter((i) => filter === "all" || i.status === filter).reverse();
  const invoice = game.invoices.find((i) => i.id === selected);
  const totals: [string, number][] = [
    ["Open", sum(game.invoices.filter((i) => i.status === "open"))],
    ["Overdue", sum(game.invoices.filter((i) => i.status === "overdue"))],
    ["Paid this month", sum(game.invoices.filter((i) => i.paidAt !== null && i.status === "paid" && sameMonth(i.paidAt, game.hour)))],
    ["Owed by active customers", freeRiding(game).owed],
  ];
  const rules = (r: Partial<BillingRules>) => act((s) => setBillingRules(s, r));

  return (
    <div className="fin">
      <nav className="sidebar fin-side" aria-label="Status">
        <div className="side-h">Invoices</div>
        {FILTERS.map((f) => (
          <button key={f.id} className={`side-item${filter === f.id ? " active" : ""}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.icon}{f.label}
            <span className="side-count">{f.id === "all" ? game.invoices.length : game.invoices.filter((i) => i.status === f.id).length}</span>
          </button>
        ))}
        <div className="side-h">Rules</div>
        <label className="fin-rule">
          Send reminders
          <input type="checkbox" role="switch" className="switch" checked={game.billingRules.autoRemind} onChange={(e) => rules({ autoRemind: e.target.checked })} />
        </label>
        <label className="fin-rule">
          Suspend after
          <select className="field" value={game.billingRules.autoSuspendDays} onChange={(e) => rules({ autoSuspendDays: Number(e.target.value) as BillingRules["autoSuspendDays"] })}>
            {AUTO_SUSPEND_DAYS.map((d) => <option key={d} value={d}>{d ? `${d} days` : "Off"}</option>)}
          </select>
        </label>
      </nav>
      <div className="fin-main">
        <dl className="fin-totals">
          {totals.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{euroCents(v)}</dd></div>)}
        </dl>
        <div className="fin-scroll">
          {shown.length === 0 ? (
            <div className="fin-empty"><Receipt />No invoices</div>
          ) : (
            <table className="table fin-table">
              <thead>
                <tr><th>Number</th><th>Customer</th><th className="r">Amount</th><th>Issued</th><th>Due</th><th>Status</th><th className="r">Reminders</th></tr>
              </thead>
              <tbody>
                {shown.map((i) => (
                  <tr key={i.id} className={i.id === selected ? "sel" : ""} onClick={() => setSelected(i.id)} tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setSelected(i.id)}>
                    <td className="num">{i.number}</td>
                    <td><CustomerLink id={i.customerId} name={name(i.customerId)} /></td>
                    <td className="r num">{euroCents(invoiceTotal(i))}</td>
                    <td className="num">{formatDay(i.issuedAt)}</td>
                    <td className="num">{formatDay(i.dueAt)}</td>
                    <td><StatusPill inv={i} /></td>
                    <td className="r num">{i.reminders.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {invoice && <Detail key={invoice.id} inv={invoice} customer={name(invoice.customerId)} hour={game.hour} />}
    </div>
  );
}

function StatusPill({ inv }: { inv: Invoice }) {
  const st = STATUS[inv.status];
  return (
    <span className="fin-pills">
      <span className={`pill ${st.pill}`}>{st.label}</span>
      {inv.suspended && inv.status === "overdue" && <span className="pill">Suspended</span>}
    </span>
  );
}

function Detail({ inv, customer, hour }: { inv: Invoice; customer: string; hour: number }) {
  const act = useStore((s) => s.act);
  const [confirm, setConfirm] = useState(false);
  const step = dueStep(inv, hour);
  const unpaid = inv.status === "open" || inv.status === "overdue";
  const facts: [string, ReactNode][] = [
    ["Customer", <CustomerLink id={inv.customerId} name={customer} />],
    ["Issued", formatDay(inv.issuedAt)],
    ["Due", formatDay(inv.dueAt)],
    ...(inv.paidAt !== null ? [["Paid", formatDay(inv.paidAt)] as [string, string]] : []),
    ...(inv.suspended && inv.suspendedAt !== null ? [["Suspended", formatDay(inv.suspendedAt)] as [string, string]] : []),
  ];

  return (
    <aside className="fin-detail" aria-label={`Invoice ${inv.number}`}>
      <div className="fin-detail-h">
        <h2 className="num">{inv.number}</h2>
        <StatusPill inv={inv} />
      </div>
      <dl className="fin-facts">
        {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className={k === "Customer" ? "" : "num"}>{v}</dd></div>)}
      </dl>
      <section className="fin-card">
        <h3 className="fin-card-h">Lines</h3>
        <table className="table fin-lines">
          <tbody>
            {inv.lines.map((l, n) => <tr key={n}><td>{t(l.key, l.params)}</td><td className="r num">{euroCents(l.amount)}</td></tr>)}
            <tr className="fin-sum"><td>Total</td><td className="r num">{euroCents(invoiceTotal(inv))}</td></tr>
          </tbody>
        </table>
      </section>
      {inv.reminders.length > 0 && (
        <section className="fin-card">
          <h3 className="fin-card-h">Reminders</h3>
          <dl className="fin-rows">
            {inv.reminders.map((h, n) => <div key={n}><dt>{t(`invoice.step.${STEPS[n].key}`)}</dt><dd className="num">{formatDay(h)}</dd></div>)}
          </dl>
        </section>
      )}
      {unpaid && (
        <div className="fin-actions">
          {step !== null && (
            <button className="btn primary" onClick={() => act((s) => sendReminder(s, inv.id))}>
              <Mail />{STEPS[step].key === "collections" ? "Hand to collections" : `Send ${t(`invoice.step.${STEPS[step].key}`).toLowerCase()}`}
            </button>
          )}
          {inv.status === "overdue" && (
            <button className="btn" onClick={() => act((s) => suspendServices(s, inv.id, !inv.suspended))}>
              {inv.suspended ? <><Play />Resume services</> : <><Pause />Suspend services</>}
            </button>
          )}
          <button className="btn danger" onClick={() => setConfirm(true)}><Trash2 />Write off</button>
        </div>
      )}
      {confirm && (
        <Confirm title={`Write off invoice ${inv.number}?`} text={`${customer} will not be asked to pay ${euroCents(invoiceTotal(inv))}.`} action="Write off"
          onCancel={() => setConfirm(false)} onConfirm={() => { act((s) => writeOff(s, inv.id)); setConfirm(false); }} />
      )}
    </aside>
  );
}
