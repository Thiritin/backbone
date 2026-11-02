import { activeServices } from "../../../sim/30-customers/customers";
import { companyDomain } from "../../../sim/30-customers/domains";
import { isFinal, serviceMonthly } from "../../../sim/40-support/tickets";
import { invoiceTotal, isUnpaid } from "../../../sim/45-billing/billing";
import type { GameState } from "../../../sim/50-state";
import { portalPath } from "../../../sim/80-business/portal";
import { shopActive } from "../../../sim/80-business/shop";
import { useStore } from "../../store";
import "../support/support.css";
import "../billing/billing.css";
import { CustomerPage, type Row, type Status, type Tab } from "./CustomerPage";
import "./customers.css";

export function rows(game: GameState): Row[] {
  const by = <T,>() => new Map<string, T>();
  const paid = by<number>(), owed = by<number>(), count = by<number>(), tickets = by<number>(), labels = by<string>(), status = by<Status>();
  const add = (m: Map<string, number>, id: string, v: number) => m.set(id, (m.get(id) ?? 0) + v);
  for (const i of game.invoices) {
    add(count, i.customerId, 1);
    if (i.status === "paid") add(paid, i.customerId, invoiceTotal(i));
    if (!isUnpaid(i)) continue;
    add(owed, i.customerId, invoiceTotal(i));
    if (i.suspended) status.set(i.customerId, "suspended");
    else if (i.status === "overdue" && !status.has(i.customerId)) status.set(i.customerId, "overdue");
  }
  for (const tk of game.tickets) if (!isFinal(tk)) add(tickets, tk.customerId, 1);
  for (const v of game.services) labels.set(v.customerId, `${labels.get(v.customerId) ?? ""} ${v.label.toLowerCase()}`);
  return game.customers.filter((c) => !c.sponsor).map((c) => {
    const services = activeServices(game.services, c.id);
    return {
      c, status: c.churnedAt !== null ? "churned" : status.get(c.id) ?? "active", services: services.length,
      monthly: services.reduce((sum, v) => sum + serviceMonthly(v), 0), lifetime: paid.get(c.id) ?? 0, balance: owed.get(c.id) ?? 0,
      invoices: count.get(c.id) ?? 0, tickets: tickets.get(c.id) ?? 0, labels: `${c.name.toLowerCase()}${labels.get(c.id) ?? ""}`,
    };
  });
}

// A running shop system keeps the customer record in its admin; before that, Books keeps the contracts.
export function openCustomer(id: string, tab?: Tab): void {
  const { game, openApp } = useStore.getState();
  const v = game.shop.variant;
  if (v && shopActive(game)) openApp("Browser", { kind: "url", id: `portal.${companyDomain(game)}${portalPath(v, "admin", {}, { s: "client", id, ...(tab && { tab }) })}` });
  else openApp("Books", { kind: "customer", id });
}

export function CustomerLink({ id, name }: { id: string; name: string }) {
  return <button className="link" onClick={(e) => { e.stopPropagation(); openCustomer(id); }}>{name}</button>;
}

export function CustomerView({ game, id, tab, onBack }: { game: GameState; id: string; tab?: string; onBack: () => void }) {
  const r = rows(game).find((x) => x.c.id === id);
  return r ? <div className="cus"><CustomerPage key={id} r={r} tab={tab as Tab | undefined} onBack={onBack} /></div> : null;
}
