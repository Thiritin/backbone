import { PSelect, PBtn } from "./ui";
import { useState } from "react";
import { t } from "../../../../../../i18n/en";
import { euroCents } from "../../../../../../sim/00-core/money";
import type { Cycle } from "../../../../../../sim/10-catalog/cycles";
import { cyclesFor } from "../../../../../../sim/30-market/cycles";
import { stepError } from "../../../../../../sim/30-market/manual";
import { requestName } from "../../../../../../sim/30-market/market";
import { orderOf } from "../../../../../../sim/30-market/orders";
import type { Quote } from "../../../../../../sim/30-market/quotes";
import { setupFee } from "../../../../../../sim/30-market/spec";
import type { GameState } from "../../../../../../sim/50-state";
import { attachQuote, convertQuote, createQuote, deleteQuote, editQuote, setQuoteCycle } from "../../../../../../sim/90-actions/orders";
import { useStore } from "../../../../../store";
import { formatDay } from "../../../../billing/format";
import { QuotePill } from "../../../../books/QuotesTab";
import { PriceField } from "../../../../sales/PriceField";
import type { ScreenProps } from "./nav";
import { CYCLE_LABEL } from "./ProductEdit";

const orderFor = (game: GameState, q: Quote) => {
  const tk = game.tickets.find((x) => x.id === q.ticketId);
  return tk && orderOf(game, tk);
};
const total = (q: Quote) => q.lines.reduce((n, l) => n + l.amount, 0);

// Billing > Quotes: the shop's quotes for order requests, from draft to sent, accepted and converted to an invoice.
export function Quotes({ game, id }: ScreenProps & { id?: string }) {
  const act = useStore((s) => s.act);
  // An order with a Books draft from before the shop is quoted from that draft in Books.
  const open = game.tickets.filter((tk) => orderOf(game, tk) && !stepError(game, tk, "quote") && !game.quotes.some((q) => q.ticketId === tk.id && q.status === "draft" && q.origin === "books"));
  const [ticket, setTicket] = useState(""), [selected, setSelected] = useState<string | null>(id ?? null);
  const list = game.quotes.filter((q) => q.origin === "shop").reverse();
  const q = list.find((x) => x.id === selected), picked = open.find((tk) => tk.id === (ticket || open[0]?.id)), asked = picked && orderOf(game, picked)!.thread[0];
  const name = (x: Quote) => game.customers.find((c) => c.id === x.customerId)?.name ?? (orderFor(game, x) ? requestName(orderFor(game, x)!) : "");
  const create = () => {
    const r = act(createQuote, ticket || open[0]?.id);
    if (r.ok) setSelected(r.id!);
  };
  return (
    <div className="pt-screen">
      <div className="pt-form">
        <PSelect aria-label={t("pkg.order")} value={ticket || open[0]?.id || ""} onChange={(e) => setTicket(e.target.value)} disabled={!open.length}>
          {open.map((tk) => { const r = orderOf(game, tk)!; return <option key={tk.id} value={tk.id}>{[requestName(r), r.domain].filter(Boolean).join(" · ")}</option>; })}
        </PSelect>
        <PBtn disabled={!open.length} onClick={create}>{t("shop-admin.newQuote")}</PBtn>
      </div>
      {asked && <p>{t(asked.key, asked.params)}</p>}
      <table className="pt-table">
        <thead><tr><th>{t("books.col.number")}</th><th>{t("shop-admin.client")}</th><th>{t("shop-admin.date")}</th><th>{t("shop-admin.total")}</th><th>{t("shop-admin.status")}</th></tr></thead>
        <tbody>
          {list.map((x) => (
            <tr key={x.id} className={x.id === selected ? "on" : undefined}>
              <td className="num"><a href="#" onClick={(e) => { e.preventDefault(); setSelected(x.id); }}>{x.number}</a></td>
              <td>{name(x)}</td>
              <td className="num">{formatDay(x.createdAt ?? x.sentAt ?? game.hour)}</td>
              <td className="num">{euroCents(total(x))}</td>
              <td><QuotePill q={x} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {q && <QuoteEdit key={q.id} game={game} q={q} onGone={() => setSelected(null)} />}
    </div>
  );
}

function QuoteEdit({ game, q, onGone }: { game: GameState; q: Quote; onGone: () => void }) {
  const act = useStore((s) => s.act);
  const r = orderFor(game, q), draft = q.status === "draft";
  const [monthly, setMonthly] = useState(q.monthly), [setup, setSetup] = useState(q.setup);
  const edit = (m: number, f: number) => {
    setMonthly(m);
    setSetup(f);
    if (m > 0 && f >= 0) act(editQuote, q.id, m, f);
  };
  const cycles = r ? cyclesFor(game, r.product) : [];
  return (
    <section className="pt-group">
      {draft && r && (
        <div className="pt-form">
          <PriceField value={monthly} reference={r.reference} onChange={(m) => edit(m, setup)} />
          <PriceField value={setup} reference={setupFee(game, r.product)} onChange={(f) => edit(monthly, f)} label={t("support.setupFee")} />
          {cycles.length > 1 && (
            <PSelect aria-label={t("shop-store.cycle")} value={q.cycle ?? "monthly"} onChange={(e) => act(setQuoteCycle, q.id, e.target.value === "monthly" ? null : (e.target.value as Cycle))}>
              {cycles.map((c) => <option key={c} value={c}>{CYCLE_LABEL[c]}</option>)}
            </PSelect>
          )}
        </div>
      )}
      <div className="pt-form">
        <PBtn disabled={!draft || !q.ticketId} onClick={() => act(attachQuote, q.id, q.ticketId!)}>{t("orderSteps.send")}</PBtn>
        <PBtn disabled={q.status !== "accepted"} onClick={() => act(convertQuote, q.id)}>{t("shop-admin.convertQuote")}</PBtn>
        <PBtn disabled={!draft} onClick={() => { if (act(deleteQuote, q.id).ok) onGone(); }}>{t("orderSteps.delete")}</PBtn>
      </div>
    </section>
  );
}
