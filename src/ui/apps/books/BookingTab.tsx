import { useState } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { bookByNumber } from "../../../sim/90-actions/bookkeeping";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { formatDay } from "../billing/format";
import { docsFor, useBankLines } from "./data";
import { useBooks } from "./view";

// Kontomix's booking form: pick an unbooked line from the account, type the document number it pays, book it.
export function BookingTab() {
  const game = useBooks(), attempt = useStore((s) => s.attempt);
  const lines = useBankLines();
  const [picked, setPicked] = useState<string | null>(null);
  const [number, setNumber] = useState("");
  const [settle, setSettle] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const line = lines.find((l) => l.id === picked) ?? lines[0];
  const acc = (key: string, no: number) => `${no} ${t(`books-screens.acc.${key}`)}`;
  const [debit, credit] = !line ? ["", ""] : line.out ? [acc("payables", 1600), acc("bank", 1200)] : line.back ? [acc("receivables", 1400), acc("bank", 1200)] : [acc("bank", 1200), acc("receivables", 1400)];
  const docs = line ? docsFor(game, line) : [];
  const book = () => {
    if (!line) return;
    const r = attempt(bookByNumber, line.id, number, settle);
    setResult(r.ok ? { ok: true, text: t("books-screens.booked", { number: number.trim() }) } : { ok: false, text: t(r.error, r.params) });
    if (r.ok) { setPicked(null); setNumber(""); setSettle(false); }
  };
  return (
    <form className="bk-booking" onSubmit={(e) => { e.preventDefault(); book(); }}>
      <h2>{t("books-screens.bookingTitle")}</h2>
      {result && <p className={result.ok ? "bk-booking-ok" : "bk-booking-err"} role={result.ok ? "status" : "alert"}>{result.text}</p>}
      {!line ? <p className="books-none">{t("books.noTransfers")}</p> : (
        <table>
          <tbody>
            <tr><th><label htmlFor="bk-line">{t("books-screens.line")}</label></th><td>
              <select id="bk-line" value={line.id} onChange={(e) => { setPicked(e.target.value); setResult(null); }}>
                {lines.map((l) => <option key={l.id} value={l.id}>{`${formatDay(l.hour)}  ${l.name}  ${euroCents(l.amount)}`}</option>)}
              </select>
            </td></tr>
            <tr><th>{t("books-screens.docDate")}</th><td className="num">{formatDay(line.hour)}</td></tr>
            <tr><th>{t("books-screens.col.debit")}</th><td>{debit}</td></tr>
            <tr><th>{t("books-screens.col.credit")}</th><td>{credit}</td></tr>
            <tr><th>{t("books.col.amount")}</th><td className="num">{euroCents(Math.abs(line.amount))}</td></tr>
            <tr><th>{t("books-screens.col.text")}</th><td>{line.text}</td></tr>
            <tr><th><label htmlFor="bk-doc">{t("books-screens.docNo")}</label></th><td>
              <input id="bk-doc" className="num" list="bk-docs" value={number} autoComplete="off" spellCheck={false} onChange={(e) => { setNumber(e.target.value); setResult(null); }} />
              <datalist id="bk-docs">{docs.map((d) => <option key={d} value={d} />)}</datalist>
            </td></tr>
            {!line.out && !line.back && (
              <tr><th /><td><label><input type="checkbox" checked={settle} onChange={(e) => setSettle(e.target.checked)} /> {t("books-screens.settle")}</label></td></tr>
            )}
            <tr><th /><td><button type="submit" disabled={!number.trim()}>{t("books-screens.book")}</button></td></tr>
          </tbody>
        </table>
      )}
    </form>
  );
}
