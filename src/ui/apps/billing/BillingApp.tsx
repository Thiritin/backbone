import { Ban, CircleCheck, CircleDot, Files, ListChecks, Mail, OctagonAlert, Pause, Play, Receipt, Trash2, Workflow } from "lucide-react";
import { useState, type ReactNode } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { dateOf } from "../../../sim/00-core/time";
import { AUTO_COLLECT_DAYS, AUTO_SUSPEND_DAYS, dueStep, freeRiding, invoiceTotal, rulesAutomated, STEPS, type BillingRules, type Invoice, type InvoiceStatus } from "../../../sim/45-billing/billing";
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
  const [filter, setFilter] = useState<InvoiceStatus | "all" | "automation">("all");
  const [selected, setSelected] = useState<string | null>(null);
  useFocus("Billing", (f) => {
    if (f.kind !== "invoice") return;
    setFilter("all");
    setSelected(f.id);
  });
  const name = (id: string) => game.customers.find((c) => c.id === id)?.name ?? id;
  const auto = rulesAutomated(game);
  const shown = game.invoices.filter((i) => filter === "all" || i.status === filter).reverse();
  const invoice = game.invoices.find((i) => i.id === selected);
  const totals: [string, number][] = [
    ["Open", sum(game.invoices.filter((i) => i.status === "open"))],
    ["Overdue", sum(game.invoices.filter((i) => i.status === "overdue"))],
    ["Paid this month", sum(game.invoices.filter((i) => i.paidAt !== null && i.status === "paid" && sameMonth(i.paidAt, game.hour)))],
    ["Owed by active customers", freeRiding(game).owed],
  ];

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
        <button className={`side-item fin-auto-item${filter === "automation" ? " active" : ""}`} aria-pressed={filter === "automation"} onClick={() => setFilter("automation")}>
          {auto ? <><Workflow />Automation</> : <><ListChecks />Rules</>}
        </button>
      </nav>
      {filter === "automation" && <Automation />}
      {filter !== "automation" && <div className="fin-main">
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
      </div>}
      {filter !== "automation" && invoice && <Detail key={invoice.id} inv={invoice} customer={name(invoice.customerId)} hour={game.hour} />}
    </div>
  );
}

function DaysRule<D extends number>({ label, days, value, onChange }: { label: string; days: readonly D[]; value: D; onChange: (d: D) => void }) {
  return (
    <div className="settings-line">
      <span>{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {days.map((d) => <button key={d} aria-pressed={value === d} onClick={() => onChange(d)}>{d ? `${d} days` : "Off"}</button>)}
      </div>
    </div>
  );
}

// Before the Automation research, bookkeepers and accountants carry the rules out in their work hours.
function Automation() {
  const game = useStore((s) => s.game);
  const rules = game.billingRules;
  const act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const set = (r: Partial<BillingRules>) => act((s) => setBillingRules(s, r));
  const auto = rulesAutomated(game);
  const clerks = game.staff.filter((e) => e.role === "bookkeeper" || e.role === "accountant").map((e) => e.name);
  return (
    <div className="fin-main">
      <div className="settings fin-auto">
        <h2>{auto ? "Automation" : "Rules"}</h2>
        {!auto && (
          <div className="settings-group">
            <div className="settings-line">
              <span>Carried out by</span>
              {clerks.length ? <span className="fin-auto-by">{clerks.join(", ")}</span> : (
                <span className="fin-auto-by">Bookkeepers or accountants · {game.installed.includes("Staff")
                  ? <button className="link" onClick={() => openApp("Staff", { kind: "market", id: "bookkeeper" })}>Hire in Staff</button>
                  : <button className="link" onClick={() => openApp("Shop", { kind: "software", id: "Staff" })}>Get Staff</button>}</span>
              )}
            </div>
          </div>
        )}
        <div className="settings-group">
          <div className="settings-line">
            <span>Send reminders</span>
            <input type="checkbox" role="switch" className="switch" aria-label="Send reminders" checked={rules.autoRemind} onChange={(e) => set({ autoRemind: e.target.checked })} />
          </div>
          <DaysRule label="Suspend services after" days={AUTO_SUSPEND_DAYS} value={rules.autoSuspendDays} onChange={(d) => set({ autoSuspendDays: d })} />
          <DaysRule label="Send to collections after" days={AUTO_COLLECT_DAYS} value={rules.autoCollectDays} onChange={(d) => set({ autoCollectDays: d })} />
        </div>
      </div>
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
