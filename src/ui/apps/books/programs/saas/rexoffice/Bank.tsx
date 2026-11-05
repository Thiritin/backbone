import { Check } from "lucide-react";
import { useState } from "react";
import { euroCents } from "../../../../../../sim/00-core/money";
import { dateOf } from "../../../../../../sim/00-core/time";
import { owed, type Invoice, type Transfer } from "../../../../../../sim/45-billing/billing";
import type { Outgoing } from "../../../../../../sim/46-finance/bank";
import { unbooked } from "../../../../../../sim/46-finance/payables";
import { referenced, suggested } from "../../../../../../sim/80-business/bookkeeping";
import { assignPayment, unassignPayment } from "../../../../../../sim/90-actions/bank";
import { matchTransfer, unmatchTransfer } from "../../../../../../sim/90-actions/billing";
import type { ActionResult } from "../../../../../../sim/90-actions/hardware";
import { t } from "../../../../../../i18n/en";
import { LOCALE } from "../../../../../../i18n/lang";
import { useStore } from "../../../../../store";
import { useBooks } from "../../../view";
import { Locked } from "../../../Locked";
import { Empty, Tabs } from "../ui";

type Row = { id: string; hour: number; tr?: Transfer; out?: Outgoing };
const open = (r: Row) => (r.tr ? r.tr.matchedAt === null : r.out!.matched === null && !r.out!.returned);
const day = (hour: number) => dateOf(hour).toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const SHOWN = 100;

// Bank, Umsätze: the account's bookings by day. A booking is assigned to the document it pays, the suggestion first.
export function Bank({ q }: { q: string }) {
  const game = useBooks(), act = useStore((s) => s.act);
  const [view, setView] = useState<"open" | "all">("open");
  const [pick, setPick] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const rows: Row[] = [
    ...game.transfers.map((tr) => ({ id: tr.id, hour: tr.hour, tr })),
    ...(game.bank?.outgoing ?? []).map((out) => ({ id: out.id, hour: out.hour, out })),
  ].sort((a, b) => b.hour - a.hour);
  const text = (r: Row) => (r.tr ? `${r.tr.from} ${t(r.tr.reference, r.tr.params)}` : `${r.out!.name} ${r.out!.reference}`);
  const todo = rows.filter(open);
  const shown = (view === "open" ? todo : rows).filter((r) => !q || text(r).toLowerCase().includes(q.toLowerCase())).slice(0, SHOWN);
  const days = [...new Set(shown.map((r) => day(r.hour)))];
  const invoice = (id: string | null) => game.invoices.find((i) => i.id === id);
  const run = (r: ActionResult) => setError(r.ok ? "" : t(r.error, r.params));
  const proposal = (tr: Transfer): Invoice | undefined => (tr.back ? referenced(game, tr) : suggested(game, tr)) ?? undefined;

  const incoming = (tr: Transfer) => {
    if (tr.matchedAt !== null) {
      const inv = invoice(tr.invoiceId);
      return inv ? <><span className="sx-chip ok"><Check size={12} aria-hidden /> {inv.number}</span><button type="button" className="sx-btn" onClick={() => run(act(unmatchTransfer, tr.id))}>{t("rx.unassign")}</button></> : <span className="sx-chip">{t("books.booked")}</span>;
    }
    const s = proposal(tr), docs = game.invoices.filter((i) => i.status === "open" || i.status === "overdue");
    const chosen = pick[tr.id] ?? s?.id ?? "";
    const inv = invoice(chosen), differs = !!inv && !tr.back && tr.amount !== owed(inv);
    return (
      <>
        <select className="sx-btn" aria-label={t("books.col.assignment")} value={chosen} onChange={(e) => setPick({ ...pick, [tr.id]: e.target.value })}>
          <option value="">{t("rx.pickDocument")}</option>
          {docs.map((i) => <option key={i.id} value={i.id}>{i.number} · {euroCents(owed(i))}</option>)}
        </select>
        <button type="button" className="sx-btn primary" disabled={!inv} onClick={() => run(act(matchTransfer, tr.id, chosen, false))}>{t("rx.assign")}</button>
        {differs && <button type="button" className="sx-btn" onClick={() => run(act(matchTransfer, tr.id, chosen, true))}>{t("rx.assignSettle")}</button>}
      </>
    );
  };
  const outgoing = (o: Outgoing) => {
    if (o.returned) return <span className="sx-chip">{t("books.returned")}</span>;
    const p = game.payables.find((x) => x.id === o.matched);
    if (p) return <><span className="sx-chip ok"><Check size={12} aria-hidden /> {p.number}</span><button type="button" className="sx-btn" onClick={() => run(act(unassignPayment, o.id))}>{t("rx.unassign")}</button></>;
    const docs = game.payables.filter(unbooked), chosen = pick[o.id] ?? docs.find((x) => x.number && o.reference.includes(x.number))?.id ?? "";
    return (
      <>
        <select className="sx-btn" aria-label={t("books.col.assignment")} value={chosen} onChange={(e) => setPick({ ...pick, [o.id]: e.target.value })}>
          <option value="">{t("rx.pickDocument")}</option>
          {docs.map((x) => <option key={x.id} value={x.id}>{x.number} · {x.name}</option>)}
        </select>
        <button type="button" className="sx-btn primary" disabled={!chosen} onClick={() => run(act(assignPayment, o.id, chosen))}>{t("rx.assign")}</button>
      </>
    );
  };
  return (
    <>
      <div className="sx-head"><h1>{t("rx.nav.bank")}</h1><div className="sx-actions"><Locked id="match-by-reference" label={t("books.matchByReference")} /><span>{t("books-screens.balance")}</span><b className="num">{euroCents(game.cash)}</b></div></div>
      <Tabs value={view} onPick={(v) => setView(v as "open" | "all")} items={[{ id: "open", label: t("books.view.open"), count: todo.length }, { id: "all", label: t("books.view.all") }]} />
      {shown.length === 0 && <Empty>{t("books.noTransfers")}</Empty>}
      <div className="sx-feed">
        {days.map((d) => (
          <section key={d}>
            <h3>{d}</h3>
            {shown.filter((r) => day(r.hour) === d).map((r) => {
              const amount = r.tr ? r.tr.amount : -r.out!.amount;
              return (
                <div key={r.id} className="sx-feedrow" data-booking={r.id}>
                  <b title={text(r)}>{r.tr ? r.tr.from : r.out!.name}<small>{r.tr ? t(r.tr.reference, r.tr.params) : r.out!.reference}</small></b>
                  <span className={`num${amount < 0 ? " sx-neg" : ""}`}>{euroCents(amount)}</span>
                  {r.tr ? incoming(r.tr) : outgoing(r.out!)}
                </div>
              );
            })}
          </section>
        ))}
      </div>
      {error && <p className="sx-err" role="alert">{error}</p>}
    </>
  );
}
