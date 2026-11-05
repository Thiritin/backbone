import { useState } from "react";
import { euroCents } from "../../../../../sim/00-core/money";
import { vatRate } from "../../../../../sim/80-business/tax";
import { bookByNumber } from "../../../../../sim/90-actions/bookkeeping";
import { t } from "../../../../../i18n/en";
import { useStore } from "../../../../store";
import { formatDay } from "../../../billing/format";
import { docsFor, useAccounts, useBankLines, type Account, type BankLine } from "../../data";
import { useBooks } from "../../view";
import "./double-entry.css";

// A booking typed into the mask and waiting in the batch. counter is the contra account, key the tax key, debit whether the bank is debited.
export interface Draft { line: string; hour: number; text: string; amount: number; debit: boolean; number: string; counter: number; key: string; settle: boolean; error?: string }

// Tax keys after the German standard: output VAT on money in, input VAT on money out.
const KEYS = ["0", "3", "9"];
const taxOf = (key: string, amount: number, hour: number) => (key === "0" ? 0 : (Math.abs(amount) * vatRate(hour)) / (1 + vatRate(hour)));
// The account a line's document lives on: supplier bills for a payment out, invoices otherwise.
const opOf = (accounts: Account[], line: BankLine) => accounts.find((a) => a.id === (line.out ? "payables" : "receivables"))!;
// A balance with its side, debit (S) or credit (H).
export const saldo = (v: number) => `${euroCents(Math.abs(v))} ${t(v < 0 ? "books-de.h" : "books-de.s")}`;

// The booking mask: an unbooked bank line is the account side; the document number and the contra account book it into the batch.
export function Buchungsmaske({ drafts, add }: { drafts: Draft[]; add: (d: Draft) => void }) {
  const game = useBooks(), accounts = useAccounts();
  const lines = useBankLines().filter((l) => !drafts.some((d) => d.line === l.id));
  const [picked, setPicked] = useState<string | null>(null);
  const [number, setNumber] = useState("");
  const [counter, setCounter] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const [settle, setSettle] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const line = lines.find((l) => l.id === picked) ?? lines[0];
  if (!line) return <div className="de-mask"><p className="de-none">{t("books.noTransfers")}</p></div>;
  const bank = accounts.find((a) => a.id === "bank")!, op = opOf(accounts, line), docs = docsFor(game, line);
  const contra = accounts.find((a) => String(a.no) === counter.trim());
  const sts = key ?? (line.out ? "9" : "3"), rate = Math.round(vatRate(line.hour) * 100);
  // Money in debits the bank; a payment out or a refund credits it.
  const bankDebit = line.amount > 0 && !line.back;
  const typeNumber = (v: string) => {
    setNumber(v); setErr(null);
    if (!counter && docs.includes(v.trim())) setCounter(String(op.no));
  };
  const book = () => {
    if (!number.trim()) return setErr(t("books-de.mask.noNumber"));
    if (!docs.includes(number.trim())) return setErr(t("books-screens.noDocument", { number: number.trim() }));
    if (counter.trim() !== String(op.no)) return setErr(t("books-de.mask.wrongCounter", { no: counter.trim() || "-", number: number.trim() }));
    add({ line: line.id, hour: line.hour, text: line.text, amount: line.amount, debit: bankDebit, number: number.trim(), counter: op.no, key: sts, settle });
    setPicked(null); setNumber(""); setCounter(""); setKey(null); setSettle(false); setErr(null);
  };
  const id = (x: string) => `de-mask-${x}`;
  return (
    <form className="de-mask" onSubmit={(e) => { e.preventDefault(); book(); }}>
      <div className="de-grid">
        <label htmlFor={id("line")}>{t("books-de.mask.line")}</label>
        <select id={id("line")} value={line.id} onChange={(e) => { setPicked(e.target.value); setErr(null); }}>
          {lines.map((l) => <option key={l.id} value={l.id}>{`${formatDay(l.hour)}  ${l.name}  ${euroCents(l.amount)}`}</option>)}
        </select>
        <span className="de-label">{t("books-de.col.date")}</span><span className="de-value num">{formatDay(line.hour)}</span>
        <label htmlFor={id("number")}>{t("books-de.col.number")}</label>
        <span>
          <input id={id("number")} className="num" list={id("docs")} value={number} autoComplete="off" spellCheck={false} onChange={(e) => typeNumber(e.target.value)} />
          <datalist id={id("docs")}>{docs.map((d) => <option key={d} value={d} />)}</datalist>
        </span>
        <span className="de-label">{t("books-de.col.text")}</span><span className="de-value">{line.text}</span>
        <span className="de-label">{t("books-de.col.account")}</span>
        <span className="de-value"><b className="num">{bank.no}</b> {bank.label} <span className="de-saldo num">{saldo(bank.balance)}</span></span>
        <label htmlFor={id("counter")}>{t("books-de.col.counter")}</label>
        <span>
          <input id={id("counter")} className="num de-no" inputMode="numeric" list={id("accounts")} value={counter} autoComplete="off" onChange={(e) => { setCounter(e.target.value.replace(/\D/g, "")); setErr(null); }} />
          <datalist id={id("accounts")}>{accounts.filter((a) => String(a.no).startsWith(counter.trim())).map((a) => <option key={a.id} value={a.no} label={a.label} />)}</datalist>
          {contra && <span className="de-value"> {contra.label} <span className="de-saldo num">{saldo(contra.balance)}</span></span>}
        </span>
        <span className="de-label">{t("books-de.col.amount")}</span>
        <span className="de-value num">{euroCents(Math.abs(line.amount))} {t(bankDebit ? "books-de.s" : "books-de.h")}</span>
        <label htmlFor={id("key")}>{t("books-de.col.key")}</label>
        <span>
          <select id={id("key")} value={sts} onChange={(e) => setKey(e.target.value)}>
            {KEYS.map((k) => <option key={k} value={k}>{t(`books-de.key.${k}`, { rate })}</option>)}
          </select>
          <span className="de-value"> {t("books-de.mask.tax")} <span className="num">{euroCents(taxOf(sts, line.amount, line.hour))}</span></span>
        </span>
        {!line.out && !line.back && <><span /><label className="de-check"><input type="checkbox" checked={settle} onChange={(e) => setSettle(e.target.checked)} /> {t("books-screens.settle")}</label></>}
      </div>
      {err && <p className="de-err" role="alert">{err}</p>}
      <div className="de-actions"><button type="submit" className="btn">{t("books-de.mask.book")}</button></div>
    </form>
  );
}

// The batch: bookings typed in and not yet posted. Posting books each against its document; one that fails stays with its error.
export function Stapel({ drafts, setDrafts }: { drafts: Draft[]; setDrafts: (d: Draft[]) => void }) {
  const attempt = useStore((s) => s.attempt), bank = useAccounts().find((a) => a.id === "bank")!;
  const [posted, setPosted] = useState<number | null>(null);
  const post = () => {
    const kept: Draft[] = [];
    for (const d of drafts) {
      const r = attempt(bookByNumber, d.line, d.number, d.settle);
      if (!r.ok) kept.push({ ...d, error: t(r.error, r.params) });
    }
    setPosted(drafts.length - kept.length);
    setDrafts(kept);
  };
  const total = drafts.reduce((a, d) => a + Math.abs(d.amount), 0);
  return (
    <div className="de-stapel">
      <div className="de-scroll">
        <table className="table de-table">
          <thead><tr>
            <th>{t("books-de.col.date")}</th><th>{t("books-de.col.number")}</th><th>{t("books-de.col.text")}</th>
            <th className="r">{t("books-de.col.debitAcc")}</th><th className="r">{t("books-de.col.creditAcc")}</th><th>{t("books-de.col.keyShort")}</th>
            <th className="r">{t("books-de.col.amount")}</th><th />
          </tr></thead>
          <tbody>
            {drafts.map((d) => {
              const [soll, haben] = d.debit ? [bank.no, d.counter] : [d.counter, bank.no];
              return (
                <tr key={d.line} className={d.error ? "de-failed" : undefined}>
                  <td className="num">{formatDay(d.hour)}</td><td className="num">{d.number}</td>
                  <td>{d.text}{d.error && <div className="de-err">{d.error}</div>}</td>
                  <td className="r num">{soll}</td><td className="r num">{haben}</td><td className="num">{d.key}</td>
                  <td className="r num">{euroCents(Math.abs(d.amount))}</td>
                  <td><button type="button" className="btn de-del" aria-label={t("books-de.stapel.delete")} title={t("books-de.stapel.delete")} onClick={() => setDrafts(drafts.filter((x) => x !== d))}>×</button></td>
                </tr>
              );
            })}
            {!drafts.length && <tr><td colSpan={8} className="de-none">{t("books-de.stapel.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="de-foot">
        <span>{t("books-de.stapel.count", { n: drafts.length })}</span>
        <span>{t("books-de.stapel.total")} <b className="num">{euroCents(total)}</b></span>
        {posted !== null && <span role="status">{t("books-de.stapel.posted", { n: posted })}</span>}
        <button type="button" className="btn" disabled={!drafts.length} onClick={post}>{t("books-de.stapel.post")}</button>
      </div>
    </div>
  );
}
