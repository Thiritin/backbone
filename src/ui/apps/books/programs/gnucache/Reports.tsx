import { useState } from "react";
import { euroCents } from "../../../../../sim/00-core/money";
import { t } from "../../../../../i18n/en";
import { OverviewTab, StatementTab, StatisticsTab } from "../../Reports";
import { categoryLabel, useLedger, useReports } from "../../data";
import { money, shown, useChart } from "./shared";

export const REPORTS = ["balance", "pl", "accounts", "transactions", "figures", "stats"] as const;
export type ReportKind = (typeof REPORTS)[number];

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);

// Equity is what the assets leave after the debts, so both sides of the balance sheet add up to the same total.
function Balance() {
  const accounts = useChart();
  const assets = accounts.filter((a) => a.kind === "asset"), debts = accounts.filter((a) => a.kind === "liability");
  const total = assets.reduce((x, a) => x + shown(a.kind, a.balance), 0), owed = debts.reduce((x, a) => x + shown(a.kind, a.balance), 0);
  const row = (a: (typeof accounts)[number]) => <tr key={a.id}><td>{a.label}</td><td className="r num">{money(a.kind, a.balance)}</td></tr>;
  return (
    <table className="gc-report"><tbody>
      <tr className="gc-head"><td colSpan={2}>{t("gc.grp.asset")}</td></tr>
      {assets.map(row)}
      <tr className="gc-sum"><td>{t("gc.rep.assets")}</td><td className="r num">{euroCents(total)}</td></tr>
      <tr className="gc-head"><td colSpan={2}>{t("gc.grp.liability")}</td></tr>
      {debts.map(row)}
      <tr><td>{t("gc.grp.equity")}</td><td className="r num">{euroCents(total - owed)}</td></tr>
      <tr className="gc-sum"><td>{t("gc.rep.liabilities")}</td><td className="r num">{euroCents(owed + (total - owed))}</td></tr>
    </tbody></table>
  );
}

function ProfitLoss() {
  const { years } = useLedger(), reports = useReports();
  const [year, setYear] = useState(years[0]);
  const p = reports.profitLoss(year);
  const part = (cats: string[]) => cats.map((c) => <tr key={c}><td>{categoryLabel(c)}</td><td className="r num">{euroCents(sum(p.sums.get(c) ?? []))}</td></tr>);
  return (
    <>
      <label className="gc-opt">{t("gc.rep.year")} <select value={year} onChange={(e) => setYear(+e.target.value)}>{years.map((y) => <option key={y}>{y}</option>)}</select></label>
      <table className="gc-report"><tbody>
        <tr className="gc-head"><td colSpan={2}>{t("gc.rep.revenue")}</td></tr>{part(p.revenue)}
        <tr className="gc-sum"><td>{t("gc.reg.total")}</td><td className="r num">{euroCents(sum(p.total(p.revenue)))}</td></tr>
        <tr className="gc-head"><td colSpan={2}>{t("gc.rep.costs")}</td></tr>{part(p.costs)}
        <tr className="gc-sum"><td>{t("gc.reg.total")}</td><td className="r num">{euroCents(sum(p.total(p.costs)))}</td></tr>
        <tr className="gc-sum"><td>{t("gc.rep.result")}</td><td className="r num">{euroCents(sum(p.net))}</td></tr>
      </tbody></table>
    </>
  );
}

function Accounts() {
  const accounts = useChart();
  return (
    <table className="gc-report"><thead><tr><th>{t("gc.col.code")}</th><th>{t("gc.col.name")}</th><th className="r">{t("gc.col.total")}</th></tr></thead>
      <tbody>{accounts.map((a) => <tr key={a.id}><td className="num">{a.no}</td><td>{a.label}</td><td className="r num">{money(a.kind, a.balance)}</td></tr>)}</tbody>
    </table>
  );
}

// A report page: its own output on a white sheet; the sim's existing statement and figures pages sit in the same frame.
export function Report({ kind }: { kind: ReportKind }) {
  return (
    <div className="gc-scroll gc-sheet">
      {kind === "balance" ? <Balance /> : kind === "pl" ? <ProfitLoss /> : kind === "accounts" ? <Accounts />
        : kind === "transactions" ? <StatementTab /> : kind === "figures" ? <OverviewTab /> : <StatisticsTab />}
    </div>
  );
}
