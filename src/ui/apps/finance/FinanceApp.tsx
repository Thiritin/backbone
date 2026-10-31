import { CalendarDays, ChartColumn, Landmark, Layers, LayoutGrid, ShieldCheck, Table } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { euro, euroCents } from "../../../sim/00-core/money";
import { dateOf } from "../../../sim/00-core/time";
import { hardwarePremium, monthStartOf, nextTax, profitBetween, profitOf, runwayMonths } from "../../../sim/46-finance/finance";
import { buyInsurance, cancelInsurance } from "../../../sim/90-actions/finance";
import type { GameState } from "../../../sim/50-state";
import { metrics } from "../../../sim/metrics";
import { t } from "../../../i18n/en";
import { useStore, useFocus } from "../../store";
import { BankApp } from "../bank/BankApp";
import { formatDay } from "../billing/BillingApp";
import "../billing/billing.css";
import "../shop/shop.css";
import "./finance.css";
import { LOCALE } from "../../../i18n/lang";

const CATEGORY: Record<string, string> = {
  payments: t("misc.catPayments"), setup: t("misc.catSetup"), sales: t("misc.catSales"), hardware: t("misc.catHardware"), rent: t("misc.catRent"), power: t("misc.catPower"), transit: t("misc.catTransit"), salaries: t("misc.catSalaries"),
  leasing: t("misc.catLeasing"), maintenance: t("misc.catMaintenance"), moving: t("misc.catMoving"), insurance: t("misc.catInsurance"), loans: t("misc.catLoans"), tax: t("misc.catTax"), subscriptions: t("misc.catSubscriptions"), ai: t("misc.catAi"), marketing: t("misc.catMarketing"), fees: t("misc.catFees"),
};
const categoryLabel = (c: string) => CATEGORY[c] ?? c.charAt(0).toUpperCase() + c.slice(1);
const REVENUE = ["payments", "setup", "sales"];
const monthKey = (hour: number) => dateOf(hour).toISOString().slice(0, 7);
const monthLabel = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString(LOCALE, { month: "long", year: "numeric", timeZone: "UTC" });
const monthShort = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString(LOCALE, { month: "short", timeZone: "UTC" });
const compact = (v: number) => {
  const a = Math.abs(v), sign = v < 0 ? "-" : "";
  return a >= 1000 ? `${sign}${Number((a / 1000).toFixed(a >= 10_000 ? 0 : 1))}k €` : `${sign}${Math.round(a)} €`;
};

type View = "overview" | "pnl" | "cash" | "tax" | "loans" | "statement";
const VIEWS: { id: View; label: string; icon: typeof Layers }[] = [
  { id: "overview", label: t("misc.overview"), icon: LayoutGrid },
  { id: "pnl", label: t("misc.profitAndLoss"), icon: Table },
  { id: "cash", label: t("misc.cashFlow"), icon: ChartColumn },
  { id: "tax", label: t("misc.taxAndInsurance"), icon: ShieldCheck },
  { id: "loans", label: t("misc.loans"), icon: Landmark },
];

interface MonthFlow { key: string; inflow: number; outflow: number; end: number }

// The last `count` months up to the current one, with money in and out and the balance at each month's end.
function cashFlow(game: GameState, count: number): MonthFlow[] {
  const now = dateOf(game.hour);
  const keys = Array.from({ length: count }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - count + 1 + i, 1)).toISOString().slice(0, 7));
  const flows = new Map(keys.map((key) => [key, { key, inflow: 0, outflow: 0, end: 0 }]));
  for (const e of game.ledger) {
    const f = flows.get(monthKey(e.hour));
    if (f) { if (e.amount > 0) f.inflow += e.amount; else f.outflow -= e.amount; }
  }
  let end = game.cash;
  for (const key of [...keys].reverse()) {
    const f = flows.get(key)!;
    f.end = end;
    end -= f.inflow - f.outflow;
  }
  return keys.map((k) => flows.get(k)!);
}

export function FinanceApp() {
  const game = useStore((s) => s.game);
  const [view, setView] = useState<View>("overview");
  const [month, setMonth] = useState<string | null>(null);
  useFocus("Finance", (f) => { if (f.kind === "tab" && f.id === "loans") setView("loans"); });
  // Balance after each entry, counted back from current cash.
  let balance = game.cash;
  const rows = game.ledger.map((e, i) => ({ e, i })).reverse().map(({ e, i }) => {
    const row = { e, i, balance };
    balance -= e.amount;
    return row;
  });
  const months = [...new Set(rows.map((r) => monthKey(r.e.hour)))].sort().reverse();
  const count = (m: string) => rows.filter((r) => monthKey(r.e.hour) === m).length;
  const shown = month ? rows.filter((r) => monthKey(r.e.hour) === month) : rows;
  const statement = (m: string | null) => { setView("statement"); setMonth(m); };

  return (
    <div className="fin">
      <aside className="sidebar fin-side" aria-label={t("misc.finance")}>
        <div className="side-h">{t("misc.finance")}</div>
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`side-item${view === id ? " active" : ""}`} aria-pressed={view === id} onClick={() => setView(id)}>
            <Icon />{label}
          </button>
        ))}
        <div className="side-h">{t("misc.statement")}</div>
        <button className={`side-item${view === "statement" && !month ? " active" : ""}`} aria-pressed={view === "statement" && !month} onClick={() => statement(null)}>
          <Layers />{t("misc.allMonths")}<span className="side-count">{rows.length}</span>
        </button>
        {months.map((m) => (
          <button key={m} className={`side-item${view === "statement" && month === m ? " active" : ""}`} aria-pressed={view === "statement" && month === m} onClick={() => statement(m)}>
            <CalendarDays />{monthLabel(m)}<span className="side-count">{count(m)}</span>
          </button>
        ))}
      </aside>
      <div className="fin-main">
        <div className="fin-toolbar">
          <h2>{view === "statement" ? t("misc.account") : VIEWS.find((v) => v.id === view)!.label}</h2>
          <span className="grow" />
          <span className="num">{euroCents(game.cash)}</span>
        </div>
        {view === "overview" && <Overview game={game} />}
        {view === "pnl" && <ProfitLoss game={game} />}
        {view === "loans" && <BankApp />}
        {view === "cash" && <CashFlowView game={game} />}
        {view === "tax" && <TaxInsurance game={game} />}
        {view === "statement" && (
          <div className="fin-scroll">
            {shown.length === 0 ? (
              <div className="fin-empty"><Landmark />{t("misc.noBookings")}</div>
            ) : (
              <table className="table">
                <thead><tr><th>{t("misc.date")}</th><th>{t("misc.category")}</th><th>{t("misc.text")}</th><th className="r">{t("misc.amount")}</th><th className="r">{t("misc.balance")}</th></tr></thead>
                <tbody>
                  {shown.map(({ e, i, balance }) => (
                    <tr key={i}>
                      <td className="num">{formatDay(e.hour)}</td>
                      <td>{categoryLabel(e.category)}</td>
                      <td className="fin-text">{t(e.key, e.params)}</td>
                      <td className="r num">{euroCents(e.amount)}</td>
                      <td className="r num">{euroCents(balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const runwayLabel = (months: number) => (Number.isFinite(months) ? t("misc.nMonthsDecimal", { n: months.toFixed(1) }) : "∞");

function Overview({ game }: { game: GameState }) {
  const start = monthStartOf(game.hour);
  const prev = monthStartOf(start - 1);
  const lastMonth = profitBetween(game, prev, start);
  const runway = runwayLabel(runwayMonths(game));
  return (
    <div className="fin-scroll">
      <dl className="fin-totals fin-cards">
        <div><dt>{t("misc.cash")}</dt><dd className="num">{euroCents(game.cash)}</dd></div>
        <div><dt>MRR</dt><dd className="num">{euroCents(metrics(game).mrr)}</dd></div>
        <div><dt>{t("misc.profitIn", { month: monthLabel(monthKey(prev)) })}</dt><dd className={`num${lastMonth < 0 ? " fin-neg" : ""}`}>{euroCents(lastMonth)}</dd></div>
        <div><dt>{t("misc.runway")}</dt><dd className="num">{runway}</dd></div>
      </dl>
      <h3 className="fin-h">{t("misc.last12Months")}</h3>
      <CashChart flows={cashFlow(game, 12)} />
    </div>
  );
}

function ProfitLoss({ game }: { game: GameState }) {
  const current = dateOf(game.hour).getUTCFullYear();
  const years = [...new Set([current, ...game.ledger.map((e) => dateOf(e.hour).getUTCFullYear())])].sort((a, b) => b - a);
  const [year, setYear] = useState(current);
  const last = year === current ? dateOf(game.hour).getUTCMonth() : 11;
  const keys = Array.from({ length: last + 1 }, (_, m) => `${year}-${String(m + 1).padStart(2, "0")}`);
  const sums = new Map<string, number[]>();
  for (const e of game.ledger) {
    const m = keys.indexOf(monthKey(e.hour));
    if (m < 0) continue;
    const row = sums.get(e.category) ?? Array<number>(keys.length).fill(0);
    row[m] += e.category === "tax" ? e.amount : profitOf(e);
    sums.set(e.category, row);
  }
  const cats = [...sums.keys()].filter((c) => c !== "tax" && sums.get(c)!.some((v) => v !== 0));
  const total = (list: string[]) => keys.map((_, m) => list.reduce((sum, c) => sum + (sums.get(c)?.[m] ?? 0), 0));
  const revenue = cats.filter((c) => REVENUE.includes(c)), costs = cats.filter((c) => !REVENUE.includes(c));
  const before = total(cats), tax = total(["tax"]), net = keys.map((_, m) => before[m] + tax[m]);
  // Only result lines mark a loss in red; costs are negative by nature.
  const line = (label: string, values: number[], cls = "", result = false) => {
    const neg = (v: number) => (result && v < 0 ? " fin-neg" : "");
    const sum = values.reduce((a, b) => a + b, 0);
    return (
      <tr key={label} className={cls}>
        <th scope="row">{label}</th>
        {values.map((v, m) => <td key={m} className={`r num${neg(v)}`}>{v ? euro(v) : ""}</td>)}
        <td className={`r num fin-sum${neg(sum)}`}>{euro(sum)}</td>
      </tr>
    );
  };
  const section = (label: string) => <tr className="fin-sec"><th scope="rowgroup" colSpan={keys.length + 2}>{label}</th></tr>;
  return (
    <>
      <div className="fin-bar">
        <div className="seg" role="group" aria-label={t("misc.year")}>
          {years.map((y) => <button key={y} aria-pressed={year === y} onClick={() => setYear(y)}>{y}</button>)}
        </div>
      </div>
      <div className="fin-scroll">
        <table className="table fin-pnl">
          <thead><tr><th />{keys.map((k) => <th key={k} className="r">{monthShort(k)}</th>)}<th className="r">{t("misc.total")}</th></tr></thead>
          <tbody>
            {section(t("misc.revenue"))}
            {revenue.map((c) => line(categoryLabel(c), sums.get(c)!))}
            {line(t("misc.totalRevenue"), total(revenue), "fin-total")}
            {section(t("misc.costs"))}
            {costs.map((c) => line(c === "loans" ? t("misc.interestAndFees") : categoryLabel(c), sums.get(c)!))}
            {line(t("misc.totalCosts"), total(costs), "fin-total")}
            {section(t("misc.result"))}
            {line(t("misc.profitBeforeTax"), before, "fin-total", true)}
            {line(t("misc.tax"), tax)}
            {line(t("misc.netProfit"), net, "fin-total", true)}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CashFlowView({ game }: { game: GameState }) {
  const [count, setCount] = useState(12);
  const flows = cashFlow(game, count);
  return (
    <>
      <div className="fin-bar">
        <div className="seg" role="group" aria-label={t("misc.range")}>
          {[12, 24].map((n) => <button key={n} aria-pressed={count === n} onClick={() => setCount(n)}>{t("misc.nMonths", { n })}</button>)}
        </div>
      </div>
      <div className="fin-scroll">
        <CashChart flows={flows} />
        <table className="table">
          <thead><tr><th>{t("misc.month")}</th><th className="r">{t("misc.in")}</th><th className="r">{t("misc.out")}</th><th className="r">{t("misc.net")}</th><th className="r">{t("misc.cashAtMonthEnd")}</th></tr></thead>
          <tbody>
            {[...flows].reverse().map((f) => (
              <tr key={f.key}>
                <td>{monthLabel(f.key)}</td>
                <td className="r num">{euroCents(f.inflow)}</td>
                <td className="r num">{euroCents(f.outflow ? -f.outflow : 0)}</td>
                <td className={`r num${f.inflow - f.outflow < 0 ? " fin-neg" : ""}`}>{euroCents(f.inflow - f.outflow)}</td>
                <td className="r num">{euroCents(f.end)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const PAD = { l: 56, r: 12 }, FLOW_H = 160, GAP = 16, CASH_H = 96, AXIS_H = 22;

function niceStep(range: number, parts: number): number {
  const raw = Math.max(range, 1) / parts, p = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 5, 10].find((m) => m * p >= raw) ?? 10) * p;
}

// Ticks covering lo..hi in nice steps, and a scale from value to y inside a panel starting at `top`.
function scale(lo: number, hi: number, parts: number, top: number, height: number) {
  const step = niceStep(Math.max(hi - lo, 1000), parts);
  const max = Math.ceil(hi / step) * step || step, min = Math.floor(lo / step) * step;
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step);
  return { ticks, y: (v: number) => top + 6 + ((max - v) / (max - min)) * (height - 12) };
}

// A bar from the baseline to y with a 4px rounded end away from the baseline.
function bar(x: number, w: number, base: number, y: number): string {
  const h = Math.abs(base - y), r = Math.min(4, w / 2, h), up = y < base;
  if (h < 0.5) return "";
  const end = up ? base - h : base + h, s = up ? 1 : -1;
  return `M${x},${base}V${end + s * r}Q${x},${end} ${x + r},${end}H${x + w - r}Q${x + w},${end} ${x + w},${end + s * r}V${base}Z`;
}

// Two panels on one month axis: money in above and out below the zero line, then the cash balance at each month's end.
function CashChart({ flows }: { flows: MonthFlow[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(640);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, Math.floor(e.contentRect.width))));
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const H = FLOW_H + GAP + CASH_H + AXIS_H;
  const flow = scale(Math.min(0, ...flows.map((f) => -f.outflow)), Math.max(0, ...flows.map((f) => f.inflow)), 4, 0, FLOW_H);
  const cash = scale(Math.min(0, ...flows.map((f) => f.end)), Math.max(0, ...flows.map((f) => f.end)), 2, FLOW_H + GAP, CASH_H);
  const plotW = width - PAD.l - PAD.r, slot = plotW / flows.length, bw = Math.min(18, slot * 0.6);
  const cx = (i: number) => PAD.l + slot * i + slot / 2;
  const every = flows.length > 12 ? 3 : 1;
  const shown = flows[hover ?? flows.length - 1];
  const grid = (sc: ReturnType<typeof scale>) => sc.ticks.map((v) => (
    <g key={v}>
      <line x1={PAD.l} x2={width - PAD.r} y1={sc.y(v)} y2={sc.y(v)} className={v === 0 ? "fin-zero" : "fin-grid"} />
      <text x={PAD.l - 8} y={sc.y(v) + 3.5} textAnchor="end" className="fin-axis">{compact(v)}</text>
    </g>
  ));
  return (
    <figure className="fin-chart">
      <figcaption className="fin-legend">
        <strong>{monthLabel(shown.key)}</strong>
        <span><i className="fin-key in" />{t("misc.in")} <b className="num">{euro(shown.inflow)}</b></span>
        <span><i className="fin-key out" />{t("misc.out")} <b className="num">{euro(shown.outflow ? -shown.outflow : 0)}</b></span>
        <span><i className="fin-key cash" />{t("misc.cashAtMonthEnd")} <b className="num">{euro(shown.end)}</b></span>
      </figcaption>
      <div ref={box}>
        <svg width={width} height={H} role="img" aria-label={t("misc.cashChartLabel")} onMouseLeave={() => setHover(null)}>
          {hover !== null && <rect x={PAD.l + slot * hover} y={0} width={slot} height={FLOW_H + GAP + CASH_H} className="fin-hover" />}
          {grid(flow)}
          {grid(cash)}
          {flows.map((f, i) => (
            <g key={f.key}>
              <path d={bar(cx(i) - bw / 2, bw, flow.y(0), flow.y(f.inflow))} className="fin-in" />
              <path d={bar(cx(i) - bw / 2, bw, flow.y(0), flow.y(-f.outflow))} className="fin-out" />
              {i % every === 0 && <text x={cx(i)} y={H - 6} textAnchor="middle" className="fin-axis">{monthShort(f.key)}</text>}
            </g>
          ))}
          <polyline points={flows.map((f, i) => `${cx(i)},${cash.y(f.end)}`).join(" ")} className="fin-line" />
          {hover !== null && <circle cx={cx(hover)} cy={cash.y(flows[hover].end)} r={4} className="fin-dot" />}
          {flows.map((f, i) => <rect key={f.key} x={PAD.l + slot * i} y={0} width={slot} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />)}
        </svg>
      </div>
    </figure>
  );
}

function TaxInsurance({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const tax = nextTax(game);
  const policy = game.insurance.find((p) => p.id === "hardware");
  const premium = hardwarePremium(game);
  const claims = game.ledger.filter((e) => e.key === "ledger.insuranceClaim");
  const paid = game.ledger.filter((e) => e.category === "tax").at(-1);
  return (
    <div className="fin-scroll">
      <h3 className="fin-h">{t("misc.corporateTax")}</h3>
      <div className="shop-grid fin-grid-cards">
        <div className="shop-card">
          <div className="shop-name">
            <strong>{t("misc.taxFor", { year: tax.year })}</strong>
            <span>{t("misc.dueOn", { date: formatDay(tax.dueAt) })}</span>
          </div>
          <dl className="shop-specs">
            <div><dt>{t("misc.profitIn", { month: tax.year })}</dt><dd className={`num${tax.profit < 0 ? " fin-neg" : ""}`}>{euroCents(tax.profit)}</dd></div>
            <div><dt>{t("misc.lossesCarried")}</dt><dd className="num">{euroCents(game.taxLoss)}</dd></div>
            <div><dt>{t("misc.taxRate")}</dt><dd className="num">30%</dd></div>
            <div><dt>{t("misc.estimatedTax")}</dt><dd className="num">{euroCents(tax.tax)}</dd></div>
          </dl>
        </div>
        {paid && (
          <div className="shop-card">
            <div className="shop-name">
              <strong>{t("misc.taxFor", { year: paid.params.year })}</strong>
              <span>{t("misc.paidOn", { date: formatDay(paid.hour) })}</span>
            </div>
            <dl className="shop-specs">
              <div><dt>{t("misc.amount")}</dt><dd className="num">{euroCents(-paid.amount)}</dd></div>
            </dl>
          </div>
        )}
      </div>
      <h3 className="fin-h">{t("misc.insurance")}</h3>
      <div className="shop-grid fin-grid-cards">
        <div className="shop-card">
          <div className="shop-name">
            <strong>{t("misc.hardwareInsurance")}</strong>
            <span>{t("misc.hardwareInsuranceText")}</span>
          </div>
          <dl className="shop-specs">
            <div><dt>{t("misc.monthlyPremium")}</dt><dd className="num">{euroCents(premium)}</dd></div>
            <div><dt>{t("misc.insuredSince")}</dt><dd>{policy ? formatDay(policy.since) : t("misc.notInsured")}</dd></div>
            <div><dt>{t("misc.claimsPaid")}</dt><dd className="num">{claims.length}</dd></div>
            <div><dt>{t("misc.paidOut")}</dt><dd className="num">{euroCents(claims.reduce((sum, e) => sum + e.amount, 0))}</dd></div>
          </dl>
          <div className="shop-buy">
            <span className="grow" />
            {policy
              ? <button className="btn" onClick={() => act(cancelInsurance)}>{t("misc.cancel")}</button>
              : <button className="btn primary" disabled={game.cash < premium} onClick={() => act(buyInsurance)}>{t("misc.buy")}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
