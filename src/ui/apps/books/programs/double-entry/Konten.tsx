import { useState } from "react";
import { euroCents } from "../../../../../sim/00-core/money";
import { owed } from "../../../../../sim/45-billing/billing";
import { t } from "../../../../../i18n/en";
import { formatDay } from "../../../billing/format";
import { chartOf, useAccounts, useLedger, useOpenItems, yearOfHour } from "../../data";
import { arrowRows, useBooks } from "../../view";
import { saldo } from "./Buchungsmaske";

// The fiscal year a list shows, from the years with bookings.
export function YearPick({ year, set }: { year: number; set: (y: number) => void }) {
  const { years } = useLedger();
  return (
    <label className="de-year">{t("books-de.year")}
      <select value={year} onChange={(e) => set(Number(e.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select>
    </label>
  );
}
export const useYear = () => { const g = useBooks(); return useState(yearOfHour(g.hour)); };

// The chart of accounts: every account in use by number, its type and its balance in the year.
export function Kontenplan({ go }: { go: (tab: string) => void }) {
  const game = useBooks(), [year, setYear] = useYear(), [q, setQ] = useState("");
  const accounts = useAccounts(year).filter((a) => !q.trim() || String(a.no).startsWith(q.trim()) || a.label.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="de-page">
      <div className="de-bar">
        <span>{t("books-de.chart.frame")} <b>{t(`books-de.chart.${chartOf(game).id}`)}</b></span>
        <YearPick year={year} set={setYear} />
        <input type="search" aria-label={t("books-screens.search")} placeholder={t("books-screens.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="de-scroll" onKeyDown={arrowRows}>
        <table className="table de-table">
          <thead><tr><th>{t("books-de.col.account")}</th><th>{t("books-de.col.name")}</th><th>{t("books-de.col.kind")}</th><th className="r">{t("books-de.col.saldo")}</th></tr></thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} tabIndex={0} onDoubleClick={() => a.go && go(a.go)} onKeyDown={(e) => e.key === "Enter" && a.go && go(a.go)}>
                <td className="num">{a.no}</td><td>{a.label}</td><td>{t(`books-de.kind.${a.kind}`)}</td><td className="r num">{saldo(a.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// The journal: every posted booking of the year with its debit and credit account.
export function Journal() {
  const [year, setYear] = useYear(), { rows } = useLedger(), accounts = useAccounts();
  const bank = accounts.find((a) => a.id === "bank")!, no = (cat: string) => accounts.find((a) => a.id === cat)?.no ?? "";
  const shown = rows.filter((r) => yearOfHour(r.e.hour) === year);
  return (
    <div className="de-page">
      <div className="de-bar"><YearPick year={year} set={setYear} /><span>{t("books-de.journal.count", { n: shown.length })}</span></div>
      <div className="de-scroll">
        <table className="table de-table">
          <thead><tr>
            <th>{t("books-de.col.date")}</th><th className="r">{t("books-de.col.debitAcc")}</th><th className="r">{t("books-de.col.creditAcc")}</th>
            <th>{t("books-de.col.text")}</th><th className="r">{t("books-de.col.amount")}</th>
          </tr></thead>
          <tbody>
            {shown.map(({ e, i }) => (
              <tr key={i}>
                <td className="num">{formatDay(e.hour)}</td>
                <td className="r num">{e.amount > 0 ? bank.no : no(e.category)}</td><td className="r num">{e.amount > 0 ? no(e.category) : bank.no}</td>
                <td>{t(e.key, e.params)}</td><td className="r num">{euroCents(Math.abs(e.amount))}</td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={5} className="de-none">{t("misc.noBookings")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Open items: what customers still owe and what is still owed to suppliers, overdue ones marked.
export function OffenePosten({ go }: { go: (tab: string) => void }) {
  const game = useBooks(), { receivables, payables, receivable, payable } = useOpenItems();
  const name = (id: string) => game.customers.find((c) => c.id === id)?.name ?? "";
  const late = (due: number) => (game.hour >= due ? "de-late" : undefined);
  const head = <tr><th>{t("books-de.col.number")}</th><th>{t("books-de.col.name")}</th><th>{t("books-de.col.due")}</th><th className="r">{t("books-de.col.open")}</th></tr>;
  return (
    <div className="de-page de-scroll">
      <h3 className="de-h">{t("books-de.op.debtors")}</h3>
      <table className="table de-table">
        <thead>{head}</thead>
        <tbody>
          {receivables.map((i) => <tr key={i.id} className={late(i.dueAt)} onDoubleClick={() => go("invoices")}><td className="num">{i.number}</td><td>{name(i.customerId)}</td><td className="num">{formatDay(i.dueAt)}</td><td className="r num">{euroCents(owed(i))}</td></tr>)}
          <tr className="de-sum"><td colSpan={3}>{t("books-de.sum")}</td><td className="r num">{euroCents(receivable)}</td></tr>
        </tbody>
      </table>
      <h3 className="de-h">{t("books-de.op.creditors")}</h3>
      <table className="table de-table">
        <thead>{head}</thead>
        <tbody>
          {payables.map((p) => <tr key={p.id} className={late(p.dueAt)} onDoubleClick={() => go("payables")}><td className="num">{p.number}</td><td>{p.name}</td><td className="num">{formatDay(p.dueAt)}</td><td className="r num">{euroCents(p.amount - p.booked)}</td></tr>)}
          <tr className="de-sum"><td colSpan={3}>{t("books-de.sum")}</td><td className="r num">{euroCents(payable)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
