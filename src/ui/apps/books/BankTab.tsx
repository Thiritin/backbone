import { useState, type KeyboardEvent } from "react";
import { Check, Undo2 } from "lucide-react";
import { euroCents } from "../../../sim/00-core/money";
import { invoiceTotal, isUnpaid, owed, type Invoice, type Transfer } from "../../../sim/45-billing/billing";
import type { Outgoing } from "../../../sim/46-finance/bank";
import { referenced, suggested } from "../../../sim/80-business/bookkeeping";
import { assignPayment, unassignPayment } from "../../../sim/90-actions/bank";
import { matchTransfer, unmatchTransfer } from "../../../sim/90-actions/billing";
import { t } from "../../../i18n/en";
import { useSessionState } from "../../session";
import { useStore } from "../../store";
import { useBooks } from "./view";
import { formatDay } from "../billing/format";
import { Locked } from "./Locked";

// Every booking on the account, newest first, after lexoffice's Umsätze: To assign holds what no document covers yet, All
// the rest too. A selected booking lists the documents it can pay, the suggestion first, or shows the one it is assigned to.
// ponytail: the latest SHOWN only; a search field once players chase older bookings.
const SHOWN = 100;
type Row = { id: string; hour: number; tr?: Transfer; out?: Outgoing };
const unassigned = (r: Row) => (r.tr ? r.tr.matchedAt === null : r.out!.matched === null && !r.out!.returned);
const EPS = 0.005;

export function BankTab() {
  const game = useBooks(), act = useStore((s) => s.act);
  const [view, setView] = useSessionState<"open" | "all">("books.bankView", "open");
  const [selected, setSelected] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<string | null>(null);
  const all: Row[] = [
    ...game.transfers.map((tr) => ({ id: tr.id, hour: tr.hour, tr })),
    ...(game.bank?.outgoing ?? []).map((out) => ({ id: out.id, hour: out.hour, out })),
  ].sort((a, b) => b.hour - a.hour);
  const open = all.filter(unassigned);
  const rows = (view === "open" ? open : all).slice(0, SHOWN);
  const row = all.find((r) => r.id === selected);
  const invoiceNo = (id: string | null) => game.invoices.find((i) => i.id === id)?.number ?? "";
  const payable = (id: string | null) => game.payables.find((p) => p.id === id);
  const customer = (id: string) => game.customers.find((c) => c.id === id)?.name ?? id;
  const proposal = (tr: Transfer) => (tr.back ? referenced(game, tr) : suggested(game, tr));

  const book = (trId: string, invId: string, settle = false) => {
    act(matchTransfer, trId, invId, settle);
    setSelected(null);
    setInvoice(null);
  };
  // Equal amounts book at once; a differing one asks how, as lexoffice's Differenz festgestellt does.
  const pick = (tr: Transfer, inv: Invoice) => {
    setSelected(tr.id);
    if (tr.back || tr.amount === owed(inv)) return book(tr.id, inv.id);
    setInvoice(inv.id);
  };
  const choose = (id: string | null) => {
    setSelected(id);
    setInvoice(null);
  };

  const cell = (r: Row) => {
    if (r.out) {
      if (r.out.returned) return <span className="pill">{t("books.returned")}</span>;
      if (r.out.matched) return <span className="books-assigned"><Check />{payable(r.out.matched)?.number}</span>;
      return <span className="pill warn">{t("books.assignManually")}</span>;
    }
    const tr = r.tr!;
    if (tr.matchedAt !== null) return tr.invoiceId ? <span className="books-assigned"><Check />{invoiceNo(tr.invoiceId)}</span> : <span className="books-muted">{t("books.booked")}</span>;
    const s = proposal(tr);
    if (!s) return <span className="pill warn">{t("books.assignManually")}</span>;
    return (
      <span className="books-suggest">
        <span className="pill accent" title={t("books.suggested")}>{s.number}</span>
        <button className="btn" onClick={(e) => { e.stopPropagation(); pick(tr, s); }}>{t("books.accept")}</button>
      </span>
    );
  };

  return (
    <>
      <div className="fin-toolbar books-bankbar">
        <div className="seg" role="group" aria-label={t("books.col.assignment")}>
          <button aria-pressed={view === "open"} onClick={() => setView("open")}>{t("books.view.open")}{open.length > 0 && <span className="tab-count num">{open.length}</span>}</button>
          <button aria-pressed={view === "all"} onClick={() => setView("all")}>{t("books.view.all")}</button>
        </div>
        <Locked id="match-by-reference" label={t("books.matchByReference")} />
      </div>
      <div className="books-bank">
        <div className="fin-scroll">
          <table className="table fin-table">
            <thead><tr><th>{t("books.col.date")}</th><th>{t("books.col.name")}</th><th>{t("books.col.reference")}</th><th className="r">{t("books.col.amount")}</th><th>{t("books.col.assignment")}</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const amount = r.tr ? r.tr.amount : -r.out!.amount, ref = r.tr ? t(r.tr.reference, r.tr.params) : r.out!.reference;
                return (
                  <tr key={r.id} className={r.id === selected ? "sel" : ""} tabIndex={0} onClick={() => choose(r.id === selected ? null : r.id)} onKeyDown={(e) => e.key === "Enter" && choose(r.id)}>
                    <td className="num">{formatDay(r.hour)}</td>
                    <td>{r.tr ? r.tr.from : r.out!.name}</td>
                    <td className="books-ref" title={ref}>{ref}{r.out?.debit && <span className="pill">{t("books.debit")}</span>}</td>
                    <td className={`r num${amount < 0 ? " neg" : ""}`}>{euroCents(amount)}</td>
                    <td>{cell(r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="books-none">{t("books.noTransfers")}</p>}
        </div>
        {row && panel(row)}
      </div>
      {differs()}
    </>
  );

  // Below the list: the documents a booking can pay, or the one it pays with the way back out.
  function panel(r: Row) {
    const docs = (title: string, list: { id: string; number: string; name: string; due: number; amount: number; tag?: boolean; onPick?: () => void; sel?: boolean }[], undo?: () => void) => (
      <section className="books-assign">
        <h3>{title}</h3>
        <table className="table fin-table">
          <tbody>
            {list.map((d) => (
              <tr key={d.id} className={d.sel ? "sel" : ""} {...(d.onPick && { tabIndex: 0, onClick: d.onPick, onKeyDown: (e: KeyboardEvent) => e.key === "Enter" && d.onPick!() })}>
                <td className="num">{d.number}{d.tag && <span className="pill accent">{t("books.suggested")}</span>}</td>
                <td>{d.name}</td>
                <td className="num">{formatDay(d.due)}</td>
                <td className="r num">{euroCents(d.amount)}</td>
                {undo && <td className="r"><button className="btn" onClick={undo}><Undo2 />{t("books.unassign")}</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="books-none">{t("books.noOpen")}</p>}
      </section>
    );
    if (r.out) {
      const o = r.out, p = payable(o.matched);
      if (o.returned) return null;
      if (p) return docs(t("books.col.assignment"), [{ id: p.id, number: p.number, name: p.name, due: p.dueAt, amount: o.amount }], () => act(unassignPayment, o.id));
      return docs(t("books.openPayables"), game.payables.filter((x) => x.booked < x.amount - EPS).map((x) => ({
        id: x.id, number: x.number, name: x.name, due: x.dueAt, amount: x.amount - x.booked, onPick: () => { act(assignPayment, o.id, x.id); choose(null); },
      })));
    }
    const tr = r.tr!;
    if (tr.matchedAt !== null) {
      const inv = game.invoices.find((i) => i.id === tr.invoiceId);
      if (!tr.booked || !inv) return null;
      return docs(t("books.col.assignment"), [{ id: inv.id, number: inv.number, name: customer(inv.customerId), due: inv.dueAt, amount: tr.amount }], () => act(unmatchTransfer, tr.id));
    }
    const s = proposal(tr);
    const list = tr.back ? game.invoices.filter((i) => i.status === "paid").slice(-50).reverse() : game.invoices.filter(isUnpaid);
    return docs(t(tr.back ? "payment-methods.paidInvoices" : "books.openInvoices"), (s ? [s, ...list.filter((i) => i.id !== s.id)] : list).map((i) => ({
      id: i.id, number: i.number, name: customer(i.customerId), due: i.dueAt, amount: tr.back ? invoiceTotal(i) : owed(i), tag: i.id === s?.id, sel: i.id === invoice, onPick: () => pick(tr, i),
    })));
  }

  function differs() {
    const tr = row?.tr, inv = game.invoices.find((i) => i.id === invoice);
    if (!tr || !inv) return null;
    return (
      <div className="books-differs" role="status">
        <span>{t("books.differs", { transfer: euroCents(tr.amount), invoice: euroCents(owed(inv)) })}</span>
        {tr.amount < owed(inv) ? (
          <>
            <button className="btn" onClick={() => book(tr.id, inv.id)}>{t("books.bookPartial")}</button>
            <button className="btn" onClick={() => book(tr.id, inv.id, true)}>{t("books.bookFull")}</button>
          </>
        ) : <button className="btn" onClick={() => book(tr.id, inv.id)}>{t("books.bookCredit")}</button>}
      </div>
    );
  }
}
