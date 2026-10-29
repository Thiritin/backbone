import { euroCents, euroPrice } from "../../../sim/00-core/money";
import { activeServices } from "../../../sim/30-customers/customers";
import { isFinal, serviceMonthly } from "../../../sim/40-support/tickets";
import { invoiceTotal, isUnpaid } from "../../../sim/45-billing/billing";
import type { GameState } from "../../../sim/50-state";
import { subjectParams } from "../../../sim/40-support/notices";
import { t } from "../../../i18n/en";
import { CustomerLink } from "../customers/CustomersApp";
import { initials, kindOf, monthYear, moodClass, statusOf } from "./labels";

// The customer beside a ticket: standing, contracts, money and the latest tickets.
export function CustomerCard({ game, id }: { game: GameState; id: string }) {
  const c = game.customers.find((x) => x.id === id);
  if (!c) return <aside className="sup-cust-card"><div className="sup-none">No customer</div></aside>;
  const services = activeServices(game.services, c.id);
  const invoices = game.invoices.filter((i) => i.customerId === c.id);
  const owed = invoices.filter(isUnpaid).reduce((n, i) => n + invoiceTotal(i), 0);
  const paid = invoices.filter((i) => i.status === "paid").reduce((n, i) => n + invoiceTotal(i), 0);
  const tickets = game.tickets.filter((tk) => tk.customerId === c.id).sort((a, b) => b.createdAt - a.createdAt);
  const recent = tickets.slice(0, 4);
  return (
    <aside className="sup-cust-card" aria-label="Customer">
      <div className="head">
        <div className="logo">{initials(c.name)}</div>
        <div>
          <div className="name"><CustomerLink id={c.id} name={c.name} /></div>
          <div className="sub">Since <span className="num">{monthYear(c.since)}</span></div>
        </div>
      </div>
      <div className="happy">
        <div className="k">Happiness <span className="num">{Math.round(c.happiness)}</span> of <span className="num">100</span></div>
        <div className="bar"><i className={moodClass(c.happiness)} style={{ width: `${c.happiness}%` }} /></div>
      </div>
      <dl>
        <div><dt>Services</dt><dd className="num">{services.length}</dd></div>
        <div><dt>Monthly</dt><dd className="num">{euroPrice(services.reduce((n, v) => n + serviceMonthly(v), 0))}</dd></div>
        <div><dt>Open balance</dt><dd className="num">{euroCents(owed)}</dd></div>
        <div><dt>Paid</dt><dd className="num">{euroCents(paid)}</dd></div>
        <div><dt>Open tickets</dt><dd className="num">{tickets.filter((tk) => !isFinal(tk)).length}</dd></div>
      </dl>
      <h3>Latest tickets</h3>
      <ul>
        {recent.map((tk) => (
          <li key={tk.id}>
            <span>{t(`ticket.${tk.kind}.${tk.topic}.subject`, subjectParams(game, tk))}</span>
            <span className="sub">{kindOf(tk.kind).label} · {statusOf(tk)}</span>
          </li>
        ))}
        {!recent.length && <li className="sub">No tickets</li>}
      </ul>
    </aside>
  );
}
