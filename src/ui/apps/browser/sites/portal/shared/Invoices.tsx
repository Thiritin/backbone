import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { euroCents } from "../../../../../../sim/00-core/money";
import { invoiceTotal } from "../../../../../../sim/45-billing/billing";
import { formatDay } from "../../../../billing/format";
import { exportShop } from "../../../../../../sim/90-actions/dataflow";
import { useStore } from "../../../../../store";
import type { ScreenProps } from "./nav";

export function Invoices({ game }: ScreenProps) {
  const act = useStore((s) => s.act);
  const [saved, setSaved] = useState<string | null>(null);
  const exportFile = () => {
    const r = act(exportShop);
    setSaved(r.ok ? useStore.getState().game.docs.find((d) => d.id === r.id)?.title ?? null : null);
  };
  return (
    <div className="pt-screen">
      <p>
        <button className="btn" onClick={exportFile}>{t("dataFlow.exportShop")}</button>
        {saved && <span role="status"> {t("dataFlow.saved", { name: saved })}</span>}
      </p>
      <table className="pt-table">
        <thead><tr><th>{t("shop-admin.invoice")}</th><th>{t("shop-admin.client")}</th><th>{t("shop-admin.date")}</th><th>{t("shop-admin.total")}</th><th>{t("shop-admin.status")}</th></tr></thead>
        <tbody>
          {[...game.invoices].reverse().map((i) => (
            <tr key={i.id}>
              <td className="num">{i.number}</td>
              <td>{game.customers.find((c) => c.id === i.customerId)?.name}</td>
              <td className="num">{formatDay(i.issuedAt)}</td>
              <td className="num">{euroCents(invoiceTotal(i))}</td>
              <td>{t(`shop-admin.inv_${i.status}`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
