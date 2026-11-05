import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { euroCents } from "../../../../../../sim/00-core/money";
import { dateOf } from "../../../../../../sim/00-core/time";
import { invoiceTotal } from "../../../../../../sim/45-billing/billing";
import { formatDay } from "../../../../billing/format";
import { PRODUCT } from "../../../../support/labels";
import type { ScreenProps } from "./nav";
import { PBody, PTable } from "./ui";

const who = (p: ScreenProps, id: string | null) => p.game.customers.find((c) => c.id === id)?.name ?? "";

// Accounts: every hosted service of the shop's customers.
export function Accounts(p: ScreenProps) {
  return (
    <PTable>
      <thead><tr><th>{t("shop-admin.product")}</th><th>{t("shop-admin.client")}</th><th>{t("shop-admin.since")}</th><th>{t("shop-admin.status")}</th></tr></thead>
      <PBody>{p.game.services.map((s) => <tr key={s.id}><td>{s.label || PRODUCT[s.product]}</td><td>{who(p, s.customerId)}</td><td className="num">{formatDay(s.startedAt)}</td><td>{t(s.endedAt === null ? "shop-admin.active" : "shop-admin.inv_writtenOff")}</td></tr>)}</PBody>
    </PTable>
  );
}

// Domains: the registered domains with their owner and expiry.
export function Domains(p: ScreenProps) {
  return (
    <PTable>
      <thead><tr><th>{t("shop-admin.d.domain")}</th><th>{t("shop-admin.client")}</th><th>{t("shop-admin.d.expires")}</th></tr></thead>
      <PBody>{p.game.domains.map((d) => <tr key={d.name}><td>{d.name}</td><td>{who(p, d.customerId)}</td><td className="num">{formatDay(d.expiresAt)}</td></tr>)}</PBody>
    </PTable>
  );
}

// Reports: income per month from the shop's paid invoices.
export function Reports({ game }: ScreenProps) {
  const by = new Map<string, { n: number; sum: number }>();
  for (const i of game.invoices) {
    if (i.source !== "shop" || i.status !== "paid" || i.paidAt === null) continue;
    const d = dateOf(i.paidAt), k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, e = by.get(k) ?? { n: 0, sum: 0 };
    by.set(k, { n: e.n + 1, sum: e.sum + invoiceTotal(i) });
  }
  const rows = [...by].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  return (
    <PTable>
      <thead><tr><th>{t("shop-admin.d.monthName")}</th><th>{t("shop-admin.d.invoices")}</th><th>{t("shop-admin.d.income")}</th></tr></thead>
      <PBody>{rows.map(([k, v]) => <tr key={k}><td>{new Date(`${k}-01T00:00:00Z`).toLocaleDateString(LOCALE, { month: "long", year: "numeric", timeZone: "UTC" })}</td><td className="num">{v.n}</td><td className="num">{euroCents(v.sum)}</td></tr>)}</PBody>
    </PTable>
  );
}

// Network: the devices the shop's services run on.
export function Network({ game }: ScreenProps) {
  return (
    <PTable>
      <thead><tr><th>{t("shop-admin.d.servers")}</th><th>{t("shop-admin.type")}</th><th>{t("shop-admin.d.nodes")}</th></tr></thead>
      <PBody>{game.clusters.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.kind}</td><td className="num">{c.nodes.length}</td></tr>)}</PBody>
    </PTable>
  );
}
