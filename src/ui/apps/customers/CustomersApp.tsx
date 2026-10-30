import { ChartLine, ChevronDown, ChevronUp, LifeBuoy, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { euro, euroCents, euroPrice } from "../../../sim/00-core/money";
import { activeServices } from "../../../sim/30-customers/customers";
import { isFinal, serviceMonthly } from "../../../sim/40-support/tickets";
import { invoiceTotal, isUnpaid } from "../../../sim/45-billing/billing";
import type { GameState } from "../../../sim/50-state";
import { menuOn, type MenuEntry } from "../../desktop/ContextMenu";
import { useFocus, useStore } from "../../store";
import { monthYear, moodClass } from "../support/labels";
import "../support/support.css";
import "../billing/billing.css";
import { CustomerPage, Mood, StatusChip, type Row, type Status, type Tab } from "./CustomerPage";
import { TrendCharts } from "./TrendCharts";
import "./customers.css";

const FILTERS: { id: Status | "current"; label: string }[] = [
  { id: "current", label: "Current" }, { id: "active", label: "Active" }, { id: "overdue", label: "Overdue" }, { id: "suspended", label: "Suspended" }, { id: "churned", label: "Churned" },
];
const BANDS = [
  { id: "any", label: "Any mood", match: () => true },
  { id: "ok", label: "Happy", match: (h: number) => moodClass(h) === "ok" },
  { id: "warn", label: "Neutral", match: (h: number) => moodClass(h) === "warn" },
  { id: "bad", label: "Unhappy", match: (h: number) => moodClass(h) === "bad" },
];

type Key = "name" | "status" | "happiness" | "services" | "monthly" | "lifetime" | "balance" | "since";
const COLUMNS: { key: Key; label: string; num?: boolean }[] = [
  { key: "name", label: "Name" }, { key: "status", label: "Status" }, { key: "happiness", label: "Happiness" },
  { key: "services", label: "Services", num: true }, { key: "monthly", label: "Monthly", num: true }, { key: "lifetime", label: "Lifetime", num: true },
  { key: "balance", label: "Balance", num: true }, { key: "since", label: "Since", num: true },
];
const ORDER: Status[] = ["active", "overdue", "suspended", "churned"];
const value = (r: Row, k: Key): number | string =>
  k === "name" ? r.c.name : k === "status" ? ORDER.indexOf(r.status) : k === "happiness" ? r.c.happiness : k === "since" ? r.c.since : r[k];

function rows(game: GameState): Row[] {
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

export function CustomerLink({ id, name }: { id: string; name: string }) {
  const openApp = useStore((s) => s.openApp);
  return <button className="link" onClick={(e) => { e.stopPropagation(); openApp("Customers", { kind: "customer", id }); }}>{name}</button>;
}

export function CustomersApp() {
  const game = useStore((s) => s.game);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Status | "current">("current");
  const [band, setBand] = useState("any");
  const [withTickets, setWithTickets] = useState(false);
  const [sort, setSort] = useState<{ key: Key; dir: number }>({ key: "name", dir: 1 });
  const [charts, setCharts] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const show = (id: string, t: Tab = "summary") => { setTab(t); setSel(id); };
  const menu = (id: string) => (): MenuEntry[] => [
    { label: "Open", run: () => show(id) },
    null,
    { label: "Show services", run: () => show(id, "services") },
    { label: "Show invoices", run: () => show(id, "invoices") },
    { label: "Show tickets", run: () => show(id, "tickets") },
  ];
  const all = useMemo(() => rows(game), [game]);
  useFocus("Customers", (f) => {
    const r = all.find((x) => x.c.id === f.id);
    if (f.kind !== "customer" || !r) return;
    setQuery("");
    setBand("any");
    setWithTickets(false);
    setFilter(r.status === "churned" ? "churned" : "current");
    show(f.id);
  });

  const q = query.trim().toLowerCase();
  const match = BANDS.find((b) => b.id === band)!.match;
  const list = all
    .filter((r) => (filter === "current" ? r.status !== "churned" : r.status === filter) && match(r.c.happiness) && (!withTickets || r.tickets > 0) && (!q || r.labels.includes(q)))
    .sort((a, b) => {
      const x = value(a, sort.key), y = value(b, sort.key);
      return sort.dir * (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number));
    });
  const current = all.find((r) => r.c.id === sel);
  const sortBy = (key: Key) => setSort(sort.key === key ? { key, dir: -sort.dir } : { key, dir: 1 });

  if (current) return <div className="cus"><CustomerPage key={current.c.id} r={current} tab={tab} onBack={() => setSel(null)} /></div>;
  return (
    <div className="cus">
      <div className="cus-main">
        <div className="cus-bar">
          <label className="search"><Search /><input type="search" placeholder="Search" aria-label="Search customers" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          <button className="btn cus-toggle" aria-pressed={charts} onClick={() => setCharts(!charts)}><ChartLine />History</button>
          <div className="seg" role="group" aria-label="Status">
            {FILTERS.map((f) => <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}
          </div>
          <div className="seg" role="group" aria-label="Happiness">
            {BANDS.map((b) => <button key={b.id} aria-pressed={band === b.id} onClick={() => setBand(b.id)}>{b.label}</button>)}
          </div>
          <button className="btn cus-toggle" aria-pressed={withTickets} onClick={() => setWithTickets(!withTickets)}><LifeBuoy />Open tickets</button>
        </div>
        {charts ? <div className="cus-scroll"><TrendCharts trend={game.trend} /></div> : <div className="cus-scroll">
          <table className="table">
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} className={col.num ? "r" : ""} aria-sort={sort.key === col.key ? (sort.dir > 0 ? "ascending" : "descending") : "none"}>
                    <button className="cus-sort" onClick={() => sortBy(col.key)}>
                      {col.label}{sort.key === col.key && (sort.dir > 0 ? <ChevronUp /> : <ChevronDown />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.c.id} onClick={() => show(r.c.id)} onContextMenu={menuOn(menu(r.c.id))}>
                  <td><button className="cus-name" onClick={() => show(r.c.id)}>{r.c.name}</button></td>
                  <td><StatusChip s={r.status} /></td>
                  <td><Mood c={r.c} /></td>
                  <td className="r num">{r.services}</td>
                  <td className="r num">{euroPrice(r.monthly)}</td>
                  <td className="r num">{euro(r.lifetime)}</td>
                  <td className="r num">{euroCents(r.balance)}</td>
                  <td className="r num">{monthYear(r.c.since)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <div className="sup-none">No customers</div>}
        </div>}
      </div>
    </div>
  );
}

