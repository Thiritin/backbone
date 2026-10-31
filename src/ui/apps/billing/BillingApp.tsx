import { Ban, CircleCheck, CircleDot, Files, Globe, ListChecks, Mail, OctagonAlert, Receipt, Workflow } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useSessionState } from "../../session";
import { euroCents } from "../../../sim/00-core/money";
import { dateOf } from "../../../sim/00-core/time";
import { AUTO_COLLECT_DAYS, AUTO_SUSPEND_DAYS, dueStep, freeRiding, invoiceTotal, rulesAutomated, STEPS, type BillingRules, type Invoice, type InvoiceStatus } from "../../../sim/45-billing/billing";
import { sendReminder, setBillingRules, suspendServices, writeOff } from "../../../sim/90-actions/billing";
import { renewDomain } from "../../../sim/90-actions/orders";
import { DOMAIN_FEE, registryCost, registryOf } from "../../../sim/30-customers/registry";
import type { Customer } from "../../../sim/30-customers/customers";
import { yearOf } from "../../../sim/00-core/time";
import { t } from "../../../i18n/en";
import { Confirm } from "../../desktop/Confirm";
import { menuOn, type MenuEntry } from "../../desktop/ContextMenu";
import { More } from "../More";
import { useFocus, useStore } from "../../store";
import { CustomerLink } from "../customers/CustomersApp";
import "./billing.css";
import { LOCALE } from "../../../i18n/lang";

export const formatDay = (hour: number) =>
  dateOf(hour).toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const sameMonth = (a: number, b: number) => {
  const x = dateOf(a), y = dateOf(b);
  return x.getUTCFullYear() === y.getUTCFullYear() && x.getUTCMonth() === y.getUTCMonth();
};

const STATUS: Record<InvoiceStatus, { label: string; pill: string }> = {
  open: { label: t("misc1.billing.open"), pill: "accent" },
  overdue: { label: t("misc1.billing.overdue"), pill: "warn" },
  paid: { label: t("misc1.billing.paid"), pill: "" },
  writtenOff: { label: t("misc1.billing.writtenOff"), pill: "" },
};
const FILTERS: { id: InvoiceStatus | "all"; label: string; icon: ReactNode }[] = [
  { id: "all", label: t("misc1.billing.allInvoices"), icon: <Files /> },
  { id: "open", label: STATUS.open.label, icon: <CircleDot /> },
  { id: "overdue", label: STATUS.overdue.label, icon: <OctagonAlert /> },
  { id: "paid", label: STATUS.paid.label, icon: <CircleCheck /> },
  { id: "writtenOff", label: STATUS.writtenOff.label, icon: <Ban /> },
];

const sum = (list: Invoice[]) => list.reduce((s, i) => s + invoiceTotal(i), 0);

export function BillingApp() {
  const game = useStore((s) => s.game);
  const [filter, setFilter] = useSessionState<InvoiceStatus | "all" | "automation" | "domains">("billing.tab", "all");
  const [selected, setSelected] = useSessionState<string | null>("billing.sel", null);
  const [writing, setWriting] = useState<Invoice | null>(null);
  useFocus("Billing", (f) => {
    if (f.kind === "domain") setFilter("domains");
    if (f.kind !== "invoice") return;
    setFilter("all");
    setSelected(f.id);
  });
  const name = (id: string) => game.customers.find((c) => c.id === id)?.name ?? id;
  const auto = rulesAutomated(game);
  const shown = game.invoices.filter((i) => filter === "all" || i.status === filter).reverse();
  const invoice = game.invoices.find((i) => i.id === selected);
  const menu = (i: Invoice) => () => invoiceMenu(i, game.hour, setWriting);
  const totals: [string, number][] = [
    [t("misc1.billing.open"), sum(game.invoices.filter((i) => i.status === "open"))],
    [t("misc1.billing.overdue"), sum(game.invoices.filter((i) => i.status === "overdue"))],
    [t("misc1.billing.paidThisMonth"), sum(game.invoices.filter((i) => i.paidAt !== null && i.status === "paid" && sameMonth(i.paidAt, game.hour)))],
    [t("misc1.billing.owed"), freeRiding(game).owed],
  ];

  return (
    <div className="fin">
      <nav className="sidebar fin-side" aria-label={t("misc1.billing.status")}>
        <div className="side-h">{t("misc1.billing.invoices")}</div>
        {FILTERS.map((f) => (
          <button key={f.id} className={`side-item${filter === f.id ? " active" : ""}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.icon}{f.label}
            <span className="side-count">{f.id === "all" ? game.invoices.length : game.invoices.filter((i) => i.status === f.id).length}</span>
          </button>
        ))}
        <button className={`side-item fin-auto-item${filter === "automation" ? " active" : ""}`} aria-pressed={filter === "automation"} onClick={() => setFilter("automation")}>
          {auto ? <><Workflow />{t("misc1.billing.automation")}</> : <><ListChecks />{t("misc1.billing.rules")}</>}
        </button>
        <div className="side-h">{t("misc1.billing.customers")}</div>
        <button className={`side-item${filter === "domains" ? " active" : ""}`} aria-pressed={filter === "domains"} onClick={() => setFilter("domains")}>
          <Globe />{t("misc1.billing.domains")}<span className="side-count">{game.domains.filter((d) => d.customerId).length}</span>
        </button>
      </nav>
      {filter === "automation" && <Automation />}
      {filter === "domains" && <Domains />}
      {filter !== "automation" && filter !== "domains" && <div className="fin-main">
        <dl className="fin-totals">
          {totals.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{euroCents(v)}</dd></div>)}
        </dl>
        <div className="fin-scroll">
          {shown.length === 0 ? (
            <div className="fin-empty"><Receipt />{t("misc1.billing.noInvoices")}</div>
          ) : (
            <table className="table fin-table">
              <thead>
                <tr><th>{t("misc1.billing.number")}</th><th>{t("misc1.billing.customer")}</th><th className="r">{t("misc1.billing.amount")}</th><th>{t("misc1.billing.issued")}</th><th>{t("misc1.billing.due")}</th><th>{t("misc1.billing.statusCol")}</th><th className="r">{t("misc1.billing.reminders")}</th></tr>
              </thead>
              <tbody>
                {shown.map((i) => (
                  <tr key={i.id} className={i.id === selected ? "sel" : ""} onClick={() => setSelected(i.id)} tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setSelected(i.id)} onContextMenu={menuOn(menu(i))}>
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
      {filter !== "automation" && filter !== "domains" && invoice && <Detail key={invoice.id} inv={invoice} customer={name(invoice.customerId)} hour={game.hour} menu={menu(invoice)} />}
      {writing && <WriteOff inv={writing} customer={name(writing.customerId)} onClose={() => setWriting(null)} />}
    </div>
  );
}

const reminder = (step: number) => STEPS[step].key === "collections" ? t("misc1.billing.toCollections") : t("misc1.billing.sendStep", { step: t(`invoice.step.${STEPS[step].key}`).toLowerCase() });

function domainMenu(name: string, c: Customer | undefined, gone: boolean): MenuEntry[] {
  const { act, openApp } = useStore.getState();
  return [
    !gone && { label: t("misc1.billing.renew"), run: () => act(renewDomain, name) },
    null,
    c && { label: t("misc1.billing.openCustomer"), run: () => openApp("Customers", { kind: "customer", id: c.id }) },
  ];
}

// Reminder, suspension and write-off for an unpaid invoice.
function invoiceMenu(inv: Invoice, hour: number, onWriteOff: (i: Invoice) => void): MenuEntry[] {
  const { act, openApp } = useStore.getState();
  const step = dueStep(inv, hour), unpaid = inv.status === "open" || inv.status === "overdue";
  return [
    unpaid && step !== null && { label: reminder(step), run: () => act(sendReminder, inv.id) },
    unpaid && inv.status === "overdue" && { label: inv.suspended ? t("misc1.billing.resume") : t("misc1.billing.suspend"), run: () => act(suspendServices, inv.id, !inv.suspended) },
    unpaid && { label: t("misc1.billing.writeOffMenu"), run: () => onWriteOff(inv) },
    null,
    { label: t("misc1.billing.openCustomer"), run: () => openApp("Customers", { kind: "customer", id: inv.customerId }) },
  ];
}

function WriteOff({ inv, customer, onClose }: { inv: Invoice; customer: string; onClose: () => void }) {
  const act = useStore((s) => s.act);
  return (
    <Confirm title={t("misc1.billing.writeOffTitle", { number: inv.number })} text={t("misc1.billing.writeOffText", { customer, amount: euroCents(invoiceTotal(inv)) })} action={t("misc1.billing.writeOff")}
      onCancel={onClose} onConfirm={() => { act(writeOff, inv.id); onClose(); }} />
  );
}

// Every domain with its customer, registry and expiry, soonest first; renewing pays the registry and invoices the customer.
function Domains() {
  const game = useStore((s) => s.game);
  const year = yearOf(game.hour);
  const list = game.domains.filter((d) => d.customerId).sort((a, b) => a.expiresAt - b.expiresAt);
  const customer = (id: string | null) => game.customers.find((c) => c.id === id);
  return (
    <div className="fin-main">
      <div className="fin-scroll">
        {list.length === 0 ? <div className="fin-empty"><Globe />{t("misc1.billing.noDomains")}</div> : (
          <table className="table fin-table">
            <thead>
              <tr><th>{t("misc1.billing.domain")}</th><th>{t("misc1.billing.customer")}</th><th>{t("misc1.billing.registry")}</th><th>{t("misc1.billing.expires")}</th><th className="r">{t("misc1.billing.costYear")}</th><th className="r">{t("misc1.billing.feeYear")}</th><th>{t("misc1.billing.statusCol")}</th><th /></tr>
            </thead>
            <tbody>
              {list.map((d) => {
                const c = customer(d.customerId), gone = !c || c.churnedAt !== null, left = d.expiresAt - game.hour;
                return (
                  <tr key={d.name} onContextMenu={menuOn(() => domainMenu(d.name, c, gone))}>
                    <td>{d.name}</td>
                    <td>{c ? <CustomerLink id={c.id} name={c.name} /> : ""}</td>
                    <td>{registryOf(d.name).name}</td>
                    <td className="num">{formatDay(d.expiresAt)}</td>
                    <td className="r num">{euroCents(registryCost(d.name, year))}</td>
                    <td className="r num">{euroCents(DOMAIN_FEE)}</td>
                    <td>{gone ? <span className="pill">{t("misc1.billing.customerLeft")}</span> : left <= 0 ? <span className="pill bad">{t("misc1.billing.expired")}</span> : left <= 30 * 24 ? <span className="pill warn">{t("misc1.billing.expiresSoon")}</span> : <span className="pill">{t("misc1.billing.active")}</span>}</td>
                    <td className="r"><More label={d.name} entries={() => domainMenu(d.name, c, gone)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DaysRule<D extends number>({ label, days, value, onChange }: { label: string; days: readonly D[]; value: D; onChange: (d: D) => void }) {
  return (
    <div className="settings-line">
      <span>{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {days.map((d) => <button key={d} aria-pressed={value === d} onClick={() => onChange(d)}>{d ? t("misc1.billing.nDays", { n: d }) : t("misc1.billing.off")}</button>)}
      </div>
    </div>
  );
}

// Before the Automation research, bookkeepers and accountants carry the rules out in their work hours.
function Automation() {
  const game = useStore((s) => s.game);
  const rules = game.billingRules;
  const act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const set = (r: Partial<BillingRules>) => act(setBillingRules, r);
  const auto = rulesAutomated(game);
  const clerks = game.staff.filter((e) => e.role === "bookkeeper" || e.role === "accountant").map((e) => e.name);
  return (
    <div className="fin-main">
      <div className="settings fin-auto">
        <h2>{auto ? t("misc1.billing.automation") : t("misc1.billing.rules")}</h2>
        {!auto && (
          <div className="settings-group">
            <div className="settings-line">
              <span>{t("misc1.billing.carriedOutBy")}</span>
              {clerks.length ? <span className="fin-auto-by">{clerks.join(", ")}</span> : (
                <span className="fin-auto-by">{t("misc1.billing.clerkRoles")} · {game.installed.includes("Staff")
                  ? <button className="link" onClick={() => openApp("Staff", { kind: "market", id: "bookkeeper" })}>{t("misc1.billing.hireStaff")}</button>
                  : <button className="link" onClick={() => openApp("Shop", { kind: "software", id: "Staff" })}>{t("misc1.billing.getStaff")}</button>}</span>
              )}
            </div>
          </div>
        )}
        <div className="settings-group">
          <div className="settings-line">
            <span>{t("misc1.billing.sendReminders")}</span>
            <input type="checkbox" role="switch" className="switch" aria-label={t("misc1.billing.sendReminders")} checked={rules.autoRemind} onChange={(e) => set({ autoRemind: e.target.checked })} />
          </div>
          <DaysRule label={t("misc1.billing.suspendAfter")} days={AUTO_SUSPEND_DAYS} value={rules.autoSuspendDays} onChange={(d) => set({ autoSuspendDays: d })} />
          <DaysRule label={t("misc1.billing.collectAfter")} days={AUTO_COLLECT_DAYS} value={rules.autoCollectDays} onChange={(d) => set({ autoCollectDays: d })} />
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
      {inv.suspended && inv.status === "overdue" && <span className="pill">{t("misc1.billing.suspended")}</span>}
    </span>
  );
}

function Detail({ inv, customer, hour, menu }: { inv: Invoice; customer: string; hour: number; menu: () => MenuEntry[] }) {
  const act = useStore((s) => s.act);
  const step = dueStep(inv, hour);
  const unpaid = inv.status === "open" || inv.status === "overdue";
  const facts: [string, ReactNode][] = [
    [t("misc1.billing.customer"), <CustomerLink id={inv.customerId} name={customer} />],
    [t("misc1.billing.issued"), formatDay(inv.issuedAt)],
    [t("misc1.billing.due"), formatDay(inv.dueAt)],
    ...(inv.paidAt !== null ? [[t("misc1.billing.paid"), formatDay(inv.paidAt)] as [string, string]] : []),
    ...(inv.suspended && inv.suspendedAt !== null ? [[t("misc1.billing.suspended"), formatDay(inv.suspendedAt)] as [string, string]] : []),
  ];

  return (
    <aside className="fin-detail" aria-label={t("misc1.billing.invoice", { number: inv.number })}>
      <div className="fin-detail-h">
        <h2 className="num">{inv.number}</h2>
        <StatusPill inv={inv} />
        <More label={t("misc1.billing.invoiceLower", { number: inv.number })} entries={menu} />
      </div>
      <dl className="fin-facts">
        {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className={k === t("misc1.billing.customer") ? "" : "num"}>{v}</dd></div>)}
      </dl>
      <section className="fin-card">
        <h3 className="fin-card-h">{t("misc1.billing.lines")}</h3>
        <table className="table fin-lines">
          <tbody>
            {inv.lines.map((l, n) => <tr key={n}><td>{t(l.key, l.params)}</td><td className="r num">{euroCents(l.amount)}</td></tr>)}
            <tr className="fin-sum"><td>{t("misc1.billing.total")}</td><td className="r num">{euroCents(invoiceTotal(inv))}</td></tr>
          </tbody>
        </table>
      </section>
      {inv.reminders.length > 0 && (
        <section className="fin-card">
          <h3 className="fin-card-h">{t("misc1.billing.reminders")}</h3>
          <dl className="fin-rows">
            {inv.reminders.map((h, n) => <div key={n}><dt>{t(`invoice.step.${STEPS[n].key}`)}</dt><dd className="num">{formatDay(h)}</dd></div>)}
          </dl>
        </section>
      )}
      {unpaid && step !== null && (
        <div className="fin-actions">
          <button className="btn primary" onClick={() => act(sendReminder, inv.id)}>
            <Mail />{reminder(step)}
          </button>
        </div>
      )}
    </aside>
  );
}
