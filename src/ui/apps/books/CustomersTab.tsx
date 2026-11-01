import { UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { euroPrice } from "../../../sim/00-core/money";
import { activeServices } from "../../../sim/30-customers/customers";
import { serviceMonthly } from "../../../sim/40-support/tickets";
import { isUnpaid } from "../../../sim/45-billing/billing";
import { renewDomain } from "../../../sim/90-actions/orders";
import { t } from "../../../i18n/en";
import { menuOn } from "../../desktop/ContextMenu";
import { useStore } from "../../store";
import { useBooks } from "./view";
import { formatDay } from "../billing/format";
import { monthYear } from "../support/labels";
import { NEW, NewCustomer } from "./NewCustomer";
import { ChangePrice, CreditSheet } from "../customers/CustomerPage";
import "../customers/customers.css";

export function CustomersTab({ focus }: { focus: string | null }) {
  const game = useBooks(), act = useStore((s) => s.act);
  const all = game.customers.filter((c) => !c.sponsor).sort((a, b) => b.since - a.since);
  const archived = all.filter((c) => activeServices(game.services, c.id).length === 0);
  const [archive, setArchive] = useState(() => !!focus && archived.some((c) => c.id === focus));
  const current = all.filter((c) => !archived.includes(c)), list = archive ? archived : current;
  const [selected, setSelected] = useState<string | null>(focus?.startsWith(NEW) ? null : focus ?? list[0]?.id ?? null);
  const [adding, setAdding] = useState<string | null>(focus?.startsWith(NEW) ? focus.slice(NEW.length) : null);
  const [crediting, setCrediting] = useState(false), [pricing, setPricing] = useState<string | null>(null);
  const c = list.find((x) => x.id === selected);
  if (adding !== null) return <NewCustomer game={game} initial={adding} onDone={() => setAdding(null)} />;
  const add = <button className="btn" onClick={() => setAdding("")}><UserPlus />{t("pkg.newCustomer")}</button>;
  const toggle = archived.length > 0 && <button className="btn books-archive" aria-pressed={archive} onClick={() => { setArchive(!archive); setSelected((archive ? current : archived)[0]?.id ?? null); }}>{archive ? t("books.tab.customers") : t("books.archive", { n: archived.length })}</button>;
  if (list.length === 0) return <div className="fin-empty"><Users />{t("books.noCustomers")}{add}{toggle}</div>;
  const services = c ? activeServices(game.services, c.id) : [];
  const domains = c ? game.domains.filter((d) => d.customerId === c.id) : [];
  return (
    <div className="books-customers">
      <nav className="sidebar books-list" aria-label={t("books.tab.customers")}>
        {add}
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
        {toggle}
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
          {c.churnedAt === null && (
            <div className="fin-actions">
              <button className="btn" onClick={() => setCrediting(true)}>{t("misc.creditEllipsis")}</button>
            </div>
          )}
          {crediting && <CreditSheet customerId={c.id} onClose={() => setCrediting(false)} />}
          {services.length > 0 && (
            <table className="table">
              <thead><tr><th>{t("books.services")}</th><th className="r">{t("books.col.monthly")}</th></tr></thead>
              <tbody>{services.map((v) => (
                <tr key={v.id} onContextMenu={v.period === "hour" ? menuOn(() => [{ label: t("misc.changePrice"), run: () => setPricing(v.id) }]) : undefined}>
                  <td>{v.label}{pricing === v.id && <ChangePrice v={v} profile={c.profile} onClose={() => setPricing(null)} />}</td>
                  <td className="r num">{euroPrice(serviceMonthly(v))}</td>
                </tr>
              ))}</tbody>
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
