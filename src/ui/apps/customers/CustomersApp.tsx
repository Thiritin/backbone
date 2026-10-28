import { FileText, LifeBuoy } from "lucide-react";
import { useState } from "react";
import { euro, euroCents } from "../../../sim/00-core/money";
import { activeServices, type Customer } from "../../../sim/30-customers/customers";
import { monthlyValue, serviceMonthly } from "../../../sim/40-support/tickets";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { initials, kindOf, monthYear, moodClass, PRODUCT, stamp, STATUS } from "../support/labels";
import "../support/support.css";
import "./customers.css";

export function CustomersApp() {
  const game = useStore((s) => s.game);
  const [former, setFormer] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const active = game.customers.filter((c) => c.churnedAt === null);
  const list = (former ? game.customers.filter((c) => c.churnedAt !== null) : active).slice().sort((a, b) => a.name.localeCompare(b.name));
  const current = game.customers.find((c) => c.id === sel);

  return (
    <div className="cus">
      <div className="cus-main">
        <div className="cus-bar">
          <div className="seg" role="group" aria-label="Customers">
            <button aria-pressed={!former} onClick={() => setFormer(false)}>Active <span className="num">{active.length}</span></button>
            <button aria-pressed={former} onClick={() => setFormer(true)}>Former <span className="num">{game.customers.length - active.length}</span></button>
          </div>
        </div>
        <div className="cus-scroll">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Happiness</th><th className="r">Services</th><th className="r">Monthly</th><th className="r">Since</th></tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className={c.id === sel ? "active" : ""} onClick={() => setSel(c.id)}>
                  <td><button className="cus-name" onClick={() => setSel(c.id)}>{c.name}</button></td>
                  <td><Mood c={c} /></td>
                  <td className="r num">{activeServices(game.services, c.id).length}</td>
                  <td className="r num">{euro(monthlyValue(game.services, c.id))}</td>
                  <td className="r num">{monthYear(c.since)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <div className="sup-none">No customers</div>}
        </div>
      </div>
      {current ? <Detail c={current} /> : <div className="cus-detail sup-none">No customer selected</div>}
    </div>
  );
}

function Mood({ c }: { c: Customer }) {
  return (
    <span className="cus-mood">
      <span className="bar"><i className={moodClass(c.happiness)} style={{ width: `${c.happiness}%` }} /></span>
      <span className="num">{Math.round(c.happiness)}</span>
    </span>
  );
}

function Detail({ c }: { c: Customer }) {
  const game = useStore((s) => s.game);
  const services = game.services.filter((v) => v.customerId === c.id).sort((a, b) => Number(a.endedAt !== null) - Number(b.endedAt !== null));
  const tickets = game.tickets.filter((tk) => tk.customerId === c.id).sort((a, b) => b.createdAt - a.createdAt);
  return (
    <div className="cus-detail">
      <div className="cus-head">
        <div className="logo">{initials(c.name)}</div>
        <div>
          <h2>{c.name}</h2>
          {c.churnedAt !== null && <div className="cus-sub">Left <span className="num">{monthYear(c.churnedAt)}</span></div>}
        </div>
      </div>
      <dl className="cus-facts">
        <dt>Happiness</dt><dd><Mood c={c} /></dd>
        <dt>Monthly</dt><dd className="num">{euro(monthlyValue(game.services, c.id))}</dd>
        <dt>Since</dt><dd className="num">{monthYear(c.since)}</dd>
        <dt>Open tickets</dt><dd className="num">{tickets.filter((tk) => tk.status === "open").length}</dd>
      </dl>

      <section className="cus-card">
        <h3><FileText />Contracts</h3>
        {services.map((v) => (
          <div key={v.id} className={`cus-row${v.endedAt !== null ? " ended" : ""}`}>
            <span className="grow"><span className="cus-strong">{v.label}</span><span className="cus-dim">{PRODUCT[v.product]}{v.commitMonths > 0 && <> · <span className="num">{v.commitMonths}</span> months</>}</span></span>
            <span className="cus-right">
              <span className="num">{v.period === "hour" ? `${euro(serviceMonthly(v))} a month` : `${euroCents(v.price)} a year`}</span>
              <span className="cus-dim">{v.endedAt === null ? <>since <span className="num">{monthYear(v.startedAt)}</span></> : <>ended <span className="num">{monthYear(v.endedAt)}</span></>}</span>
            </span>
          </div>
        ))}
        {!services.length && <div className="cus-row cus-dim">No contracts</div>}
      </section>

      <section className="cus-card">
        <h3><LifeBuoy />Tickets</h3>
        {tickets.map((tk) => {
          const K = kindOf(tk.kind);
          return (
            <div key={tk.id} className="cus-row">
              <K.icon className="cus-kind" aria-label={K.label} />
              <span className="grow cus-strong">{t(`ticket.${tk.kind}.${tk.topic}.subject`, { service: game.services.find((v) => v.id === tk.serviceId)?.label ?? "" })}</span>
              <span className="cus-right"><span className="pill">{STATUS[tk.status]}</span><span className="cus-dim num">{stamp(tk.createdAt)}</span></span>
            </div>
          );
        })}
        {!tickets.length && <div className="cus-row cus-dim">No tickets</div>}
      </section>
    </div>
  );
}
