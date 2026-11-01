import { t } from "../../../../../../i18n/en";
import { euroCents } from "../../../../../../sim/00-core/money";
import { dateOf, hourOf } from "../../../../../../sim/00-core/time";
import { invoiceTotal } from "../../../../../../sim/45-billing/billing";
import { activeServices } from "../../../../../../sim/30-customers/customers";
import { isFinal } from "../../../../../../sim/40-support/tickets";
import type { GameState } from "../../../../../../sim/50-state";
import { formatDay } from "../../../../billing/format";
import { PRODUCT } from "../../../../support/labels";
import { CYCLE_LABEL } from "./ProductEdit";

const nextMonth = (hour: number): number => { const d = dateOf(hour); return hourOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))); };

// One customer's client area as the admin sees it after "Login as Client". Reads state only.
export function ClientArea({ game, customerId }: { game: GameState; customerId: string | null }) {
  const c = game.customers.find((x) => x.id === customerId);
  return (
    <div className="shop-client">
      <p className="shop-banner">{t("shop-store.banner")}</p>
      <h2>{c?.name ?? t("shop-admin.clientArea")}</h2>
      {c && (
        <>
          <h3>{t("shop-admin.services")}</h3>
          <table className="pt-table">
            <thead><tr><th>{t("shop-admin.product")}</th><th>{t("shop-store.cycle")}</th><th>{t("shop-store.nextDue")}</th><th>{t("shop-admin.price")}</th></tr></thead>
            <tbody>
              {activeServices(game.services, c.id).map((v) => (
                <tr key={v.id}>
                  <td>{v.label || PRODUCT[v.product]}{v.domain && ` (${v.domain})`}</td>
                  <td>{CYCLE_LABEL[v.cycle ?? "monthly"]}</td>
                  <td className="num">{formatDay(v.termEnd ?? nextMonth(game.hour))}</td>
                  <td className="num">{euroCents(v.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>{t("shop-admin.invoices")}</h3>
          <table className="pt-table">
            <thead><tr><th>{t("shop-admin.invoice")}</th><th>{t("shop-admin.date")}</th><th>{t("shop-admin.total")}</th><th>{t("shop-admin.status")}</th></tr></thead>
            <tbody>
              {game.invoices.filter((i) => i.customerId === c.id).reverse().map((i) => (
                <tr key={i.id}>
                  <td className="num">{i.number}</td><td className="num">{formatDay(i.issuedAt)}</td><td className="num">{euroCents(invoiceTotal(i))}</td>
                  <td>{t(`shop-admin.inv_${i.status}`)}{(i.status === "open" || i.status === "overdue") && <> <a href="#" onClick={(e) => e.preventDefault()}>{t("shop-store.pay")}</a></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>{t("shop-store.tickets")}</h3>
          <ul>{game.tickets.filter((x) => x.customerId === c.id && !isFinal(x)).map((x) => <li key={x.id}>{x.topic}</li>)}</ul>
        </>
      )}
    </div>
  );
}
