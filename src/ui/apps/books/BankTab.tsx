import { useState, type KeyboardEvent } from "react";
import { Undo2 } from "lucide-react";
import { euroCents } from "../../../sim/00-core/money";
import { invoiceTotal, isUnpaid, owed } from "../../../sim/45-billing/billing";
import { matchTransfer, unmatchTransfer } from "../../../sim/90-actions/billing";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { useBooks } from "./view";
import { formatDay } from "../billing/format";
import { Locked } from "./Locked";

// Transfers on the left, open invoices on the right; picking one of each books it, or asks how when the amounts differ.
// Money taken back books against a paid invoice instead.
// ponytail: the latest paid invoices only; a search field once players chase older chargebacks.
const SHOWN = 50;

export function BankTab() {
  const game = useBooks(), act = useStore((s) => s.act);
  const [transfer, setTransfer] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<string | null>(null);
  const transfers = game.transfers.filter((x) => x.matchedAt === null);
  const booked = game.transfers.filter((x) => x.booked).slice(-SHOWN).reverse();
  const number = (id: string | null) => game.invoices.find((i) => i.id === id)?.number ?? "";
  const back = !!transfers.find((x) => x.id === transfer)?.back;
  const open = back ? game.invoices.filter((i) => i.status === "paid").slice(-SHOWN).reverse() : game.invoices.filter(isUnpaid);
  const tr = transfers.find((x) => x.id === transfer), inv = open.find((i) => i.id === invoice);
  const name = (id: string) => game.customers.find((c) => c.id === id)?.name ?? id;
  const book = (trId: string, invId: string, settle = false) => {
    act(matchTransfer, trId, invId, settle);
    setTransfer(null);
    setInvoice(null);
  };
  const pick = (trId: string | null, invId: string | null) => {
    const a = transfers.find((x) => x.id === trId), b = open.find((i) => i.id === invId);
    if (a && b && (a.back ? b.status === "paid" : a.amount === owed(b))) return book(a.id, b.id);
    setTransfer(trId);
    setInvoice(invId);
  };
  const short = tr && inv ? tr.amount < owed(inv) : false;

  return (
    <>
      <div className="fin-toolbar"><Locked id="match-by-reference" label={t("books.matchByReference")} /></div>
      <div className="books-bank">
        <section>
          <h3>{t("books.transfers")}</h3>
          <table className="table fin-table">
            <thead><tr><th>{t("books.col.date")}</th><th>{t("books.col.from")}</th><th>{t("books.col.reference")}</th><th className="r">{t("books.col.amount")}</th></tr></thead>
            <tbody>
              {transfers.map((x) => (
                <tr key={x.id} className={x.id === transfer ? "sel" : ""} tabIndex={0} onClick={() => pick(x.id === transfer ? null : x.id, invoice)} onKeyDown={(e: KeyboardEvent) => e.key === "Enter" && pick(x.id, invoice)}>
                  <td className="num">{formatDay(x.hour)}</td>
                  <td>{x.from}</td>
                  <td>{t(x.reference, x.params)}</td>
                  <td className="r num">{euroCents(x.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {transfers.length === 0 && <p className="books-none">{t("books.noTransfers")}</p>}
          {booked.length > 0 && (
            <>
              <h3>{t("books.booked")}</h3>
              <table className="table fin-table">
                <thead><tr><th>{t("books.col.date")}</th><th>{t("books.col.from")}</th><th>{t("books.col.number")}</th><th className="r">{t("books.col.amount")}</th><th /></tr></thead>
                <tbody>
                  {booked.map((x) => (
                    <tr key={x.id}>
                      <td className="num">{formatDay(x.hour)}</td>
                      <td>{x.from}</td>
                      <td className="num">{number(x.invoiceId)}</td>
                      <td className="r num">{euroCents(x.amount)}</td>
                      <td className="r"><button className="btn" onClick={() => act(unmatchTransfer, x.id)}><Undo2 />{t("books.undo")}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
        <section>
          <h3>{t(back ? "payment-methods.paidInvoices" : "books.openInvoices")}</h3>
          <table className="table fin-table">
            <thead><tr><th>{t("books.col.number")}</th><th>{t("books.col.customer")}</th><th className="r">{t("books.col.amount")}</th><th>{t("books.col.due")}</th></tr></thead>
            <tbody>
              {open.map((i) => (
                <tr key={i.id} className={i.id === invoice ? "sel" : ""} tabIndex={0} onClick={() => pick(transfer, i.id === invoice ? null : i.id)}
                  onKeyDown={(e) => e.key === "Enter" && pick(transfer, i.id)}>
                  <td className="num">{i.number}</td>
                  <td>{name(i.customerId)}</td>
                  <td className="r num">{euroCents(back ? invoiceTotal(i) : owed(i))}</td>
                  <td className="num">{formatDay(i.dueAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {open.length === 0 && <p className="books-none">{t("books.noOpen")}</p>}
        </section>
      </div>
      {tr && inv && (
        <div className="books-differs" role="status">
          <span>{t("books.differs", { transfer: euroCents(tr.amount), invoice: euroCents(owed(inv)) })}</span>
          {short ? (
            <>
              <button className="btn" onClick={() => book(tr.id, inv.id)}>{t("books.bookPartial")}</button>
              <button className="btn" onClick={() => book(tr.id, inv.id, true)}>{t("books.bookFull")}</button>
            </>
          ) : <button className="btn" onClick={() => book(tr.id, inv.id)}>{t("books.bookCredit")}</button>}
        </div>
      )}
    </>
  );
}
