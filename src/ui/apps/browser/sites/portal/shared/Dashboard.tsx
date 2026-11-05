import type { ReactNode } from "react";
import { t } from "../../../../../../i18n/en";
import { euroCents } from "../../../../../../sim/00-core/money";
import { dateOf } from "../../../../../../sim/00-core/time";
import { invoiceTotal } from "../../../../../../sim/45-billing/billing";
import { isFinal } from "../../../../../../sim/40-support/tickets";
import { pendingOrders } from "../../../../../../sim/80-business/shop-orders";
import { formatDay } from "../../../../billing/format";
import type { ScreenName, ScreenProps } from "./nav";
import { PBox } from "./ui";

// The start page of each shop system carries the widgets its real admin had.
export type DashKind = "whmcs" | "blesta" | "hostbill" | "modem" | "exec" | "uber" | "orderbox" | "box";
type Widget = "overview" | "income" | "income3" | "activity" | "todo" | "automation" | "network" | "links" | "stats" | "domains";
const DASH: Record<DashKind, Widget[]> = {
  whmcs: ["overview", "income3", "automation", "activity", "todo", "network"],
  blesta: ["overview", "income", "activity", "links"],
  hostbill: ["overview", "income3", "activity", "stats"],
  modem: ["stats", "income", "activity"],
  exec: ["overview", "income", "todo", "activity"],
  uber: ["overview", "income", "network", "activity"],
  orderbox: ["domains", "income", "stats", "activity"],
  box: ["overview", "income", "activity", "stats"],
};

const same = (a: number, b: number, unit: "day" | "month" | "year") => {
  const x = dateOf(a), y = dateOf(b);
  return x.getUTCFullYear() === y.getUTCFullYear() && (unit === "year" || (x.getUTCMonth() === y.getUTCMonth() && (unit === "month" || x.getUTCDate() === y.getUTCDate())));
};

export function Dashboard({ game, go, dash = "whmcs", label }: ScreenProps & { dash?: DashKind; label?: (n: ScreenName) => string }) {
  const shop = game.invoices.filter((i) => i.source === "shop");
  const overdue = shop.filter((i) => i.status === "overdue"), open = shop.filter((i) => i.status === "open" || i.status === "overdue");
  const paid = (u: "day" | "month" | "year") => shop.filter((i) => i.status === "paid" && i.paidAt !== null && same(i.paidAt, game.hour, u));
  const tickets = game.tickets.filter((x) => !isFinal(x) && x.status !== "waiting").length, orders = pendingOrders(game);
  const sum = (l: typeof shop) => euroCents(l.reduce((n, i) => n + invoiceTotal(i), 0));
  const name = (n: ScreenName, fallback: string) => label?.(n) ?? fallback;
  const a = (n: ScreenName, text: string) => <a href="#" onClick={(e) => { e.preventDefault(); go({ name: n }); }}>{text}</a>;
  const row = (key: string, text: ReactNode, v?: string | number) => <li key={key}><span>{text}</span>{v !== undefined && <b className="num">{v}</b>}</li>;
  const active = game.customers.filter((c) => c.churnedAt === null).length;
  const W: Record<Widget, [string, ReactNode[]]> = {
    overview: [t("shop-admin.d.overview"), [row("o", a("orders", name("orders", t("shop-admin.pendingOrders"))), orders), row("t", t("shop-admin.d.tickets"), tickets), row("v", a("invoices", t("shop-admin.d.overdue")), overdue.length)]],
    income: [t("shop-admin.d.income"), [row("m", t("shop-admin.d.month"), sum(paid("month"))), row("u", t("shop-admin.d.outstanding"), sum(open))]],
    income3: [t("shop-admin.d.income"), [row("d", t("shop-admin.d.today"), sum(paid("day"))), row("m", t("shop-admin.d.month"), sum(paid("month"))), row("y", t("shop-admin.d.year"), sum(paid("year")))]],
    activity: [t("shop-admin.d.activity"), [...shop].reverse().slice(0, 5).map((i) => row(i.id, `${i.number} ${game.customers.find((c) => c.id === i.customerId)?.name ?? ""}`, formatDay(i.issuedAt)))],
    todo: [t("shop-admin.d.todo"), [row("o", a("orders", t("shop-admin.pendingOrders")), orders), row("t", t("shop-admin.d.tickets"), tickets)]],
    automation: [t("shop-admin.d.automation"), [row("u", t("shop-admin.inv_open"), open.length), row("v", t("shop-admin.inv_overdue"), overdue.length), row("s", t("shop-admin.d.servicesActive"), game.services.length)]],
    network: [t("shop-admin.d.network"), [row("c", t("shop-admin.d.servers"), game.clusters.length)]],
    links: [t("shop-admin.d.shortcuts"), (["orders", "products", "invoices", "clients"] as const).map((n) => row(n, a(n, name(n, t(`shop-admin.${n === "orders" ? "pendingOrders" : n}`)))))],
    stats: [t("shop-admin.d.stats"), [row("c", t("shop-admin.d.clientsActive"), active), row("s", t("shop-admin.d.servicesActive"), game.services.length), row("p", name("products", t("shop-admin.products")), game.shop.products.length)]],
    domains: [t("shop-admin.d.domains"), [row("d", a("orders", t("shop-admin.d.domains")), game.domains.length)]],
  };
  return (
    <div className={`pt-dash pt-dash-${dash}`}>
      {DASH[dash].map((w) => (
        <PBox key={w} title={W[w][0]} className={`pt-w-${w}`}>
          {W[w][1].length ? <ul className="pt-stats">{W[w][1]}</ul> : <p className="pt-none">{t("shop-admin.d.empty")}</p>}
        </PBox>
      ))}
    </div>
  );
}
