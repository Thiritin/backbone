import { Users } from "lucide-react";
import { useState } from "react";
import { euroPrice } from "../../../sim/00-core/money";
import { activeServices } from "../../../sim/30-customers/customers";
import { serviceMonthly } from "../../../sim/40-support/tickets";
import { isUnpaid } from "../../../sim/45-billing/billing";
import { renewDomain } from "../../../sim/90-actions/orders";
import { t } from "../../../i18n/en";
import { menuOn } from "../../desktop/ContextMenu";
import { useStore } from "../../store";
import { formatDay } from "../billing/format";
import { monthYear } from "../support/labels";

export function CustomersTab({ focus }: { focus: string | null }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const list = game.customers.filter((c) => !c.sponsor).sort((a, b) => Number(a.churnedAt !== null) - Number(b.churnedAt !== null) || b.since - a.since);
  const [selected, setSelected] = useState<string | null>(focus ?? list[0]?.id ?? null);
  const c = list.find((x) => x.id === selected);
  if (list.length === 0) return <div className="fin-empty"><Users />{t("books.noCustomers")}</div>;
  const services = c ? activeServices(game.services, c.id) : [];
  const domains = c ? game.domains.filter((d) => d.customerId === c.id) : [];
  return (
    <div className="books-customers">
      <nav className="sidebar books-list" aria-label={t("books.tab.customers")}>
        {list.map((x) => {
          const first = activeServices(game.services, x.id)[0];
          return (
            <button key={x.id} className={`books-item${x.id === selected ? " active" : ""}`} aria-pressed={x.id === selected} onClick={() => setSelected(x.id)}>
              <span className="books-li">
                <strong>{x.name}</strong>
                <small>{[x.address.city, first?.label].filter(Boolean).join(" · ")}</small>
              </span>
              <small className="num">{monthYear(x.since)}</small>
            </button>
          );
        })}
      </nav>
      {c && (
        <section className="books-customer">
          <h2>{c.name}</h2>
          <address className="books-address">
            {[c.address.contact, c.address.street, `${c.address.zip} ${c.address.city}`, c.address.email].map((l) => <div key={l}>{l}</div>)}
          </address>
          <dl className="fin-facts">
            <div><dt>{t("books.since")}</dt><dd className="num">{monthYear(c.since)}</dd></div>
            <div><dt>{t("books.openInvoices")}</dt><dd className="num">{game.invoices.filter((i) => i.customerId === c.id && isUnpaid(i)).length}</dd></div>
          </dl>
          {services.length > 0 && (
            <table className="table">
              <thead><tr><th>{t("books.services")}</th><th className="r">{t("books.col.monthly")}</th></tr></thead>
              <tbody>{services.map((v) => <tr key={v.id}><td>{v.label}</td><td className="r num">{euroPrice(serviceMonthly(v))}</td></tr>)}</tbody>
            </table>
          )}
          {domains.length > 0 && (
            <table className="table">
              <thead><tr><th>{t("books.domains")}</th><th>{t("books.expires")}</th></tr></thead>
              <tbody>
                {domains.map((d) => (
                  <tr key={d.name} onContextMenu={menuOn(() => [c.churnedAt === null && { label: t("misc1.billing.renew"), run: () => act(renewDomain, d.name) }])}>
                    <td>{d.name}</td><td className="num">{formatDay(d.expiresAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
