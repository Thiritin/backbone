import { t } from "../../../../../../i18n/en";
import { orderError, orderOf } from "../../../../../../sim/30-market/orders";
import { resolveTicket } from "../../../../../../sim/90-actions/support";
import { useStore } from "../../../../../store";
import { formatDay } from "../../../../billing/format";
import { PRODUCT } from "../../../../support/labels";
import type { ScreenProps } from "./nav";

// Orders waiting for the admin; they are the order tickets of Support.
export function Orders({ game }: ScreenProps) {
  const act = useStore((s) => s.act);
  const pending = game.tickets.filter((x) => x.kind === "order" && x.status === "open");
  return (
    <div className="pt-screen">
      <table className="pt-table">
        <thead><tr><th>{t("shop-admin.date")}</th><th>{t("shop-admin.client")}</th><th>{t("shop-admin.product")}</th><th /></tr></thead>
        <tbody>
          {pending.map((x) => {
            const r = orderOf(game, x), prod = r?.productId ? game.shop.products.find((p) => p.id === r.productId) : undefined;
            return (
              <tr key={x.id}>
                <td className="num">{formatDay(x.createdAt)}</td>
                <td>{r?.company ?? r?.contact ?? game.customers.find((c) => c.id === x.customerId)?.name}</td>
                <td>{prod?.name ?? (r ? PRODUCT[r.product] : "")}</td>
                <td>
                  <button className="btn" disabled={!!orderError(game, x)} onClick={() => act(resolveTicket, x.id, "accept")}>{t("shop-admin.acceptOrder")}</button>
                  <button className="btn" onClick={() => act(resolveTicket, x.id, "reject")}>{t("shop-admin.cancelOrder")}</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
