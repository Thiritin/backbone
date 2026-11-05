import { PBody, PBtn, PSelect } from "./ui";
import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { euroCents } from "../../../../../../sim/00-core/money";
import { orderNumber, orderTotal, type OrderStatus, type ShopOrder } from "../../../../../../sim/80-business/shop-orders";
import type { GameState } from "../../../../../../sim/50-state";
import type { ActionResult } from "../../../../../../sim/90-actions/hardware";
import { acceptError, acceptOrder, cancelOrder, deleteOrder, fraudOrder } from "../../../../../../sim/90-actions/shop-orders";
import { useStore } from "../../../../../store";
import { formatDay } from "../../../../billing/format";
import { statusLabel } from "../../../../books/InvoicesTab";
import type { ScreenProps } from "./nav";
import { CYCLE_LABEL } from "./ProductEdit";
import { acceptLabel, orderStatusLabel } from "./terms";

const STATUSES: OrderStatus[] = ["pending", "active", "fraud", "cancelled"];
const clientOf = (game: GameState, o: ShopOrder) => game.customers.find((c) => c.id === o.customerId)?.name ?? o.contact;
const invoiceOf = (game: GameState, o: ShopOrder) => game.invoices.find((i) => i.id === o.invoiceId);

// Orders > List Orders, filtered by status; the newest first.
export function Orders({ game, go }: ScreenProps) {
  const [filter, setFilter] = useState<OrderStatus | "">("pending");
  const list = game.shop.orders.filter((o) => !filter || o.status === filter).reverse();
  return (
    <div className="pt-screen">
      <div className="pt-form">
        <PSelect aria-label={t("shop-admin.status")} value={filter} onChange={(e) => setFilter(e.target.value as OrderStatus | "")}>
          <option value="">{t("shop-orders.any")}</option>
          {STATUSES.map((x) => <option key={x} value={x}>{orderStatusLabel(game.shop.variant, x)}</option>)}
        </PSelect>
      </div>
      <table className="pt-table">
        <thead><tr><th>{t("shop-orders.number")}</th><th>{t("shop-admin.date")}</th><th>{t("shop-admin.client")}</th><th>{t("shop-admin.total")}</th><th>{t("shop-orders.payment")}</th><th>{t("shop-admin.status")}</th></tr></thead>
        <PBody>
          {list.map((o) => {
            const inv = invoiceOf(game, o);
            return (
              <tr key={o.id}>
                <td className="num"><a href="#" onClick={(e) => { e.preventDefault(); go({ name: "order", id: o.id }); }}>{orderNumber(o)}</a></td>
                <td className="num">{formatDay(o.placedAt)}</td>
                <td>{clientOf(game, o)}</td>
                <td className="num">{euroCents(orderTotal(o))}</td>
                <td>{inv ? statusLabel(inv) : ""}</td>
                <td>{orderStatusLabel(game.shop.variant, o.status)}</td>
              </tr>
            );
          })}
        </PBody>
      </table>
    </div>
  );
}

// One order: its client, items, invoice and the buttons Accept, Cancel, Mark as fraud and Delete.
export function OrderDetail({ game, go, id }: ScreenProps & { id: string }) {
  const act = useStore((s) => s.act);
  const [failed, setFailed] = useState<ActionResult | null>(null);
  const o = game.shop.orders.find((x) => x.id === id);
  if (!o) return null;
  const inv = invoiceOf(game, o), pending = o.status === "pending", error = pending ? acceptError(game, o) : null;
  const service = (sid: string | null) => game.services.find((v) => v.id === sid);
  return (
    <div className="pt-screen">
      <dl className="pt-fields">
        <div><dt>{t("shop-orders.number")}</dt><dd className="num">{orderNumber(o)}</dd></div>
        <div><dt>{t("shop-admin.date")}</dt><dd className="num">{formatDay(o.placedAt)}</dd></div>
        <div><dt>{t("shop-admin.client")}</dt><dd>{o.customerId ? <a href="#" onClick={(e) => { e.preventDefault(); go({ name: "client", id: o.customerId! }); }}>{clientOf(game, o)}</a> : clientOf(game, o)}</dd></div>
        <div><dt>{t("shop-orders.invoice")}</dt><dd className="num">{inv?.number ?? ""}</dd></div>
        <div><dt>{t("shop-orders.payment")}</dt><dd>{inv ? statusLabel(inv) : ""}</dd></div>
        <div><dt>{t("shop-admin.status")}</dt><dd>{orderStatusLabel(game.shop.variant, o.status)}</dd></div>
      </dl>
      <table className="pt-table">
        <thead><tr><th>{t("shop-admin.product")}</th><th>{t("shop-store.cycle")}</th><th>{t("shop-admin.total")}</th><th>{t("shop-admin.status")}</th></tr></thead>
        <PBody>
          {o.items.map((i) => (
            <tr key={i.requestId}>
              <td>{i.serviceId ? <a href="#" onClick={(e) => { e.preventDefault(); go({ name: "service", id: i.serviceId! }); }}>{service(i.serviceId)?.label || i.name}</a> : i.name}</td>
              <td>{CYCLE_LABEL[i.cycle]}</td>
              <td className="num">{euroCents(i.amount)}</td>
              <td>{orderStatusLabel(game.shop.variant, i.serviceId ? "active" : o.status)}</td>
            </tr>
          ))}
        </PBody>
        <tfoot><tr><td colSpan={2} /><td className="num">{euroCents(orderTotal(o))}</td><td /></tr></tfoot>
      </table>
      {error ? <p className="pt-error" role="alert">{t(error)}</p> : failed && !failed.ok && <p className="pt-error" role="alert">{t(failed.error, failed.params)}</p>}
      <div className="pt-form">
        <PBtn primary disabled={!!error || !pending} onClick={() => setFailed(act(acceptOrder, o.id))}>{acceptLabel(game.shop.variant)}</PBtn>
        <PBtn disabled={!pending} onClick={() => act(cancelOrder, o.id)}>{t("shop-admin.cancelOrder")}</PBtn>
        <PBtn disabled={!pending} onClick={() => act(fraudOrder, o.id)}>{t("shop-orders.fraud")}</PBtn>
        <PBtn onClick={() => { if (act(deleteOrder, o.id).ok) go({ name: "orders" }); }}>{t("orderSteps.delete")}</PBtn>
      </div>
    </div>
  );
}
