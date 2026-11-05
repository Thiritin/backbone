import type { ReactNode } from "react";
import { euroCents } from "../../../../../sim/00-core/money";
import { t } from "../../../../../i18n/en";
import { formatDay } from "../../../billing/format";
import { categoryLabel, sides, useAccounts, useReports, type Account } from "../../data";
import { useBooks } from "../../view";
import { saldo } from "./Buchungsmaske";
import { useYear, YearPick } from "./Konten";

const add = (list: number[]) => list.reduce((a, v) => a + v, 0);
const Row = ({ label, no, values, sum }: { label: ReactNode; no?: number; values: number[]; sum?: boolean }) => (
  <tr className={sum ? "de-sum" : undefined}><td className="num">{no ?? ""}</td><td>{label}</td>{values.map((v, i) => <td key={i} className={`r num${v < -0.005 ? " de-neg" : ""}`}>{euroCents(v)}</td>)}</tr>
);

// The trial balance: each account's debits, credits and balance in the year.
export function Susa() {
  const [year, setYear] = useYear(), accounts = useAccounts(year);
  const totals = (a: Account) => a.entries.reduce(([d, c], e) => { const [x, y] = sides(a, e); return [d + x, c + y]; }, [0, 0]);
  const all = accounts.map((a) => [a, ...totals(a)] as const);
  return (
    <div className="de-page">
      <div className="de-bar"><YearPick year={year} set={setYear} /></div>
      <div className="de-scroll">
        <table className="table de-table">
          <thead><tr><th>{t("books-de.col.account")}</th><th>{t("books-de.col.name")}</th><th className="r">{t("books-de.col.debit")}</th><th className="r">{t("books-de.col.credit")}</th><th className="r">{t("books-de.col.saldo")}</th></tr></thead>
          <tbody>
            {all.map(([a, d, c]) => <tr key={a.id}><td className="num">{a.no}</td><td>{a.label}</td><td className="r num">{euroCents(d)}</td><td className="r num">{euroCents(c)}</td><td className="r num">{saldo(a.balance)}</td></tr>)}
            <tr className="de-sum"><td /><td>{t("books-de.sum")}</td><td className="r num">{euroCents(add(all.map((x) => x[1])))}</td><td className="r num">{euroCents(add(all.map((x) => x[2])))}</td><td /></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Profit and loss for the year, account by account.
export function Guv() {
  const [year, setYear] = useYear(), pl = useReports().profitLoss(year), accounts = useAccounts(year);
  const year_ = (c: string) => add(pl.sums.get(c) ?? []), no = (c: string) => accounts.find((a) => a.id === c)?.no;
  const net = add(pl.net);
  return (
    <div className="de-page">
      <div className="de-bar"><YearPick year={year} set={setYear} /></div>
      <div className="de-scroll">
        <table className="table de-table">
          <tbody>
            {pl.revenue.map((c) => <Row key={c} no={no(c)} label={categoryLabel(c)} values={[year_(c)]} />)}
            <Row sum label={t("books-de.guv.revenue")} values={[add(pl.total(pl.revenue))]} />
            {pl.costs.map((c) => <Row key={c} no={no(c)} label={categoryLabel(c)} values={[year_(c)]} />)}
            <Row sum label={t("books-de.guv.costs")} values={[add(pl.total(pl.costs))]} />
            <Row sum label={t("books-de.guv.before")} values={[add(pl.before)]} />
            <Row label={t("books-de.guv.tax")} values={[add(pl.tax)]} />
            <Row sum label={t(net < 0 ? "books-de.guv.loss" : "books-de.guv.profit")} values={[net]} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// The short-term results, a month and the year so far: cost lines grouped as the standard form groups them.
const GROUPS: [string, string[]][] = [["staff", ["salaries"]], ["rooms", ["rent", "power"]], ["insurance", ["insurance"]], ["ads", ["marketing", "travel"]], ["depreciation", ["hardware"]], ["repairs", ["maintenance", "leasing"]]];
export function Bwa() {
  const [year, setYear] = useYear(), pl = useReports().profitLoss(year);
  const m = pl.keys.length - 1, both = (row: number[]) => [row[m] ?? 0, add(row)];
  const grouped = GROUPS.flatMap(([, cats]) => cats);
  const rest = pl.costs.filter((c) => !grouped.includes(c));
  const month = pl.keys[m] ? new Date(`${pl.keys[m]}-01T00:00:00Z`).getUTCMonth() + 1 : 12;
  return (
    <div className="de-page">
      <div className="de-bar"><YearPick year={year} set={setYear} /></div>
      <div className="de-scroll">
        <table className="table de-table">
          <thead><tr><th /><th /><th className="r">{t("books-de.bwa.month", { m: month, y: year })}</th><th className="r">{t("books-de.bwa.cumulated", { m: month, y: year })}</th></tr></thead>
          <tbody>
            <Row label={t("books-de.bwa.sales")} values={both(pl.total(pl.revenue))} />
            <Row sum label={t("books-de.bwa.output")} values={both(pl.total(pl.revenue))} />
            {GROUPS.map(([id, cats]) => <Row key={id} label={t(`books-de.bwa.${id}`)} values={both(pl.total(cats))} />)}
            <Row label={t("books-de.bwa.other")} values={both(pl.total(rest))} />
            <Row sum label={t("books-de.bwa.costs")} values={both(pl.total(pl.costs))} />
            <Row sum label={t("books-de.bwa.result")} values={both(pl.before)} />
            <Row label={t("books-de.bwa.tax")} values={both(pl.tax)} />
            <Row sum label={t("books-de.bwa.net")} values={both(pl.net)} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// The balance sheet today: bank and receivables against payables, loans and the equity that balances them.
export function Bilanz() {
  const game = useBooks(), accounts = useAccounts();
  const bal = (id: string) => accounts.find((a) => a.id === id)?.balance ?? 0;
  const bank = bal("bank"), receivables = bal("receivables"), payables = -bal("payables"), loans = -bal("loans");
  const assets = bank + receivables, equity = assets - payables - loans;
  const side = (title: string, rows: [string, number][], total: number) => (
    <table className="table de-table">
      <thead><tr><th colSpan={2}>{title}</th></tr></thead>
      <tbody>
        {rows.map(([k, v]) => <tr key={k}><td>{t(`books-de.bilanz.${k}`)}</td><td className="r num">{euroCents(v)}</td></tr>)}
        <tr className="de-sum"><td>{t("books-de.sum")}</td><td className="r num">{euroCents(total)}</td></tr>
      </tbody>
    </table>
  );
  return (
    <div className="de-page de-scroll">
      <h3 className="de-h">{t("books-de.bilanz.at", { date: formatDay(game.hour) })}</h3>
      <div className="de-bilanz">
        {side(t("books-de.bilanz.assets"), [["bank", bank], ["receivables", receivables]], assets)}
        {side(t("books-de.bilanz.liabilities"), [["equity", equity], ["loans", loans], ["payables", payables]], assets)}
      </div>
    </div>
  );
}
