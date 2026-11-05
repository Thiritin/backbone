import { t } from "../../../../../../i18n/en";
import { euroCents } from "../../../../../../sim/00-core/money";
import { dateOf } from "../../../../../../sim/00-core/time";
import { invoiceTotal } from "../../../../../../sim/45-billing/billing";
import { isFinal } from "../../../../../../sim/40-support/tickets";
import { pendingOrders } from "../../../../../../sim/80-business/shop-orders";
import { formatDay } from "../../../../billing/format";
import type { ScreenName, ScreenProps } from "./nav";
import { PBox } from "./ui";

const sameMonth = (a: number, b: number) => { const x = dateOf(a), y = dateOf(b); return x.getUTCFullYear() === y.getUTCFullYear() && x.getUTCMonth() === y.getUTCMonth(); };

// The start page: widgets over reads the sim already keeps; each skin arranges them with its own CSS.
export function Dashboard({ game, go }: ScreenProps) {
  const shop = game.invoices.filter((i) => i.source === "shop");
  const overdue = shop.filter((i) => i.status === "overdue"), open = shop.filter((i) => i.status === "open" || i.status === "overdue");
  const month = shop.filter((i) => i.status === "paid" && i.paidAt !== null && sameMonth(i.paidAt, game.hour));
  const tickets = game.tickets.filter((x) => !isFinal(x) && x.status !== "waiting").length;
  const sum = (l: typeof shop) => euroCents(l.reduce((n, i) => n + invoiceTotal(i), 0));
  const link = (name: ScreenName, text: string, n: string | number) => (
    <li><a href="#" onClick={(e) => { e.preventDefault(); go({ name }); }}>{text}</a><b className="num">{n}</b></li>
  );
  return (
    <div className="pt-dash">
      <PBox title={t("shop-admin.d.overview")} className="pt-w-overview">
        <ul className="pt-stats">
          {link("orders", t("shop-admin.pendingOrders"), pendingOrders(game))}
          {link("clients", t("shop-admin.d.tickets"), tickets)}
          {link("invoices", t("shop-admin.d.overdue"), overdue.length)}
        </ul>
      </PBox>
      <PBox title={t("shop-admin.d.income")} className="pt-w-income">
        <ul className="pt-stats">
          <li><span>{t("shop-admin.d.month")}</span><b className="num">{sum(month)}</b></li>
          <li><span>{t("shop-admin.d.outstanding")}</span><b className="num">{sum(open)}</b></li>
        </ul>
      </PBox>
      <PBox title={t("shop-admin.d.activity")} className="pt-w-activity">
        <ul className="pt-stats">
          {[...shop].reverse().slice(0, 5).map((i) => (
            <li key={i.id}><span>{i.number} {game.customers.find((c) => c.id === i.customerId)?.name}</span><b className="num">{formatDay(i.issuedAt)}</b></li>
          ))}
        </ul>
      </PBox>
      <PBox title={t("shop-admin.d.shortcuts")} className="pt-w-links">
        <ul className="pt-stats">
          {(["orders", "products", "invoices", "clients"] as const).map((n) => <li key={n}><a href="#" onClick={(e) => { e.preventDefault(); go({ name: n }); }}>{t(`shop-admin.${n === "orders" ? "pendingOrders" : n}`)}</a></li>)}
        </ul>
      </PBox>
    </div>
  );
}
