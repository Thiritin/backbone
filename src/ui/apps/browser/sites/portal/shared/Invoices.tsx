import { t } from "../../../../../../i18n/en";
import { euroCents } from "../../../../../../sim/00-core/money";
import { invoiceTotal } from "../../../../../../sim/45-billing/billing";
import { formatDay } from "../../../../billing/format";
import { resendInvoice } from "../../../../../../sim/90-actions/shop-orders";
import { useStore } from "../../../../../store";
import type { ScreenProps } from "./nav";

export function Invoices({ game }: ScreenProps) {
  const act = useStore((s) => s.act);
  return (
    <div className="pt-screen">
      <table className="pt-table">
        <thead><tr><th>{t("shop-admin.invoice")}</th><th>{t("shop-admin.client")}</th><th>{t("shop-admin.date")}</th><th>{t("shop-admin.total")}</th><th>{t("shop-admin.status")}</th><th /></tr></thead>
        <tbody>
          {[...game.invoices].reverse().map((i) => (
            <tr key={i.id}>
              <td className="num">{i.number}</td>
              <td>{game.customers.find((c) => c.id === i.customerId)?.name}</td>
              <td className="num">{formatDay(i.issuedAt)}</td>
              <td className="num">{euroCents(invoiceTotal(i))}</td>
              <td>{t(`shop-admin.inv_${i.status}`)}</td>
              <td>{i.source === "shop" && i.status !== "draft" && <button className="btn" onClick={() => act(resendInvoice, i.id)}>{t("shop-mail.resend")}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
