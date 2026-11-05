import { useState } from "react";
import { PBtn, PTable } from "./ui";
import { t } from "../../../../../../i18n/en";
import { euroCents } from "../../../../../../sim/00-core/money";
import { invoiceTotal, type InvoiceStatus } from "../../../../../../sim/45-billing/billing";
import { formatDay } from "../../../../billing/format";
import { resendInvoice } from "../../../../../../sim/90-actions/shop-orders";
import { useStore } from "../../../../../store";
import type { ScreenProps } from "./nav";

export function Invoices({ game }: ScreenProps) {
  const act = useStore((s) => s.act);
  const [tab, setTab] = useState<InvoiceStatus | "all">("all");
  const tabs: (InvoiceStatus | "all")[] = ["all", "open", "overdue", "paid"];
  return (
    <div className="pt-screen">
      <div className="pt-tabs" role="tablist">
        {tabs.map((k) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{t(k === "all" ? "shop-admin.d.all" : `shop-admin.inv_${k}`)}</button>)}
      </div>
      <PTable>
        <thead><tr><th>{t("shop-admin.invoice")}</th><th>{t("shop-admin.client")}</th><th>{t("shop-admin.date")}</th><th>{t("shop-admin.total")}</th><th>{t("shop-admin.status")}</th><th /></tr></thead>
        <tbody>
          {[...game.invoices].reverse().filter((i) => tab === "all" || i.status === tab || (tab === "open" && i.status === "overdue")).map((i) => (
            <tr key={i.id}>
              <td className="num">{i.number}</td>
              <td>{game.customers.find((c) => c.id === i.customerId)?.name}</td>
              <td className="num">{formatDay(i.issuedAt)}</td>
              <td className="num">{euroCents(invoiceTotal(i))}</td>
              <td>{t(`shop-admin.inv_${i.status}`)}</td>
              <td>{i.source === "shop" && i.status !== "draft" && <PBtn onClick={() => act(resendInvoice, i.id)}>{t("shop-mail.resend")}</PBtn>}</td>
            </tr>
          ))}
        </tbody>
      </PTable>
    </div>
  );
}
