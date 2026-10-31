import { FilePlus, FileText, Receipt, Send } from "lucide-react";
import { useState } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { mailedAddress } from "../../../sim/30-customers/addresses";
import { invoiceOf, stepError } from "../../../sim/30-market/manual";
import { requestName } from "../../../sim/30-market/market";
import { orderOf } from "../../../sim/30-market/orders";
import { hasHelpdeskLink, type Quote, type QuoteStatus } from "../../../sim/30-market/quotes";
import { setupFee } from "../../../sim/30-market/spec";
import type { GameState } from "../../../sim/50-state";
import { attachQuote, convertQuote, createQuote, editQuote } from "../../../sim/90-actions/orders";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { formatDay } from "../billing/format";
import { PriceField } from "../sales/PriceField";
import { Page } from "./InvoicesTab";

// The drag type of a quote row; the order ticket's attachment strip takes it.
export const QUOTE_DRAG = "application/x-lexwear-quote";
const PILL: Record<QuoteStatus, string> = { draft: "", sent: "accent", accepted: "ok", countered: "warn", declined: "" };
export const QuotePill = ({ q }: { q: Quote }) => <span className={`pill ${PILL[q.status]}`}>{t(`orderSteps.status.${q.status}`)}</span>;

const orderFor = (game: GameState, q: Quote) => {
  const tk = game.tickets.find((x) => x.id === q.ticketId);
  return tk && orderOf(game, tk);
};

// The order tickets that wait for a quote.
const quotable = (game: GameState) => game.tickets.filter((tk) => orderOf(game, tk) && !stepError(game, tk, "quote"));

export function QuotesTab({ focus }: { focus: string | null }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const list = [...game.quotes].reverse(), open = quotable(game);
  const [selected, setSelected] = useState<string | null>(focus ?? list[0]?.id ?? null);
  const [ticket, setTicket] = useState("");
  const q = game.quotes.find((x) => x.id === selected);
  const name = (x: Quote) => game.customers.find((c) => c.id === x.customerId)?.name ?? (orderFor(game, x) ? requestName(orderFor(game, x)!) : "");
  const create = () => {
    const r = act(createQuote, ticket || open[0]?.id);
    if (r.ok) setSelected(r.id!);
  };
  return (
    <>
      <div className="fin-toolbar">
        <label className="books-pick">{t("pkg.order")}
          <select className="field" value={ticket || open[0]?.id || ""} onChange={(e) => setTicket(e.target.value)} disabled={!open.length}>
            {open.map((tk) => { const r = orderOf(game, tk)!; return <option key={tk.id} value={tk.id}>{[requestName(r), r.domain].filter(Boolean).join(" · ")}</option>; })}
          </select>
        </label>
        <button className="btn" disabled={!open.length} onClick={create}><FilePlus />{t("orderSteps.createQuote")}</button>
      </div>
      <div className="books-split">
        <div className="fin-scroll">
          {list.length === 0 ? <div className="fin-empty"><FileText />{t("orderSteps.noQuotes")}</div> : (
            <table className="table fin-table">
              <thead>
                <tr><th>{t("books.col.number")}</th><th>{t("books.col.customer")}</th><th className="r">{t("books.col.monthly")}</th><th>{t("books.col.status")}</th></tr>
              </thead>
              <tbody>
                {list.map((x) => (
                  <tr key={x.id} className={`${x.id === selected ? "sel" : ""}${x.status === "draft" ? " books-drag" : ""}`} onClick={() => setSelected(x.id)} tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setSelected(x.id)} draggable={x.status === "draft"}
                    onDragStart={(e) => { e.dataTransfer.setData(QUOTE_DRAG, x.id); e.dataTransfer.setData("text/plain", t("orderSteps.quote", { number: x.number })); e.dataTransfer.effectAllowed = "copy"; }}>
                    <td className="num">{x.number}</td>
                    <td>{name(x)}</td>
                    <td className="r num">{euroCents(x.monthly)}</td>
                    <td><QuotePill q={x} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {q && <QuotePreview key={q.id} q={q} game={game} />}
      </div>
    </>
  );
}

function QuotePreview({ q, game }: { q: Quote; game: GameState }) {
  const act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const r = orderFor(game, q), c = game.customers.find((x) => x.id === q.customerId);
  const [monthly, setMonthly] = useState(q.monthly), [setup, setSetup] = useState(q.setup);
  const draft = q.status === "draft", inv = r && invoiceOf(game, r);
  const edit = (m: number, f: number) => {
    setMonthly(m);
    setSetup(f);
    if (m > 0 && f >= 0) act(editQuote, q.id, m, f);
  };
  return (
    <div className="books-preview">
      <Page game={game} title={t("orderSteps.quote", { number: q.number })} to={c?.address ?? (r && mailedAddress(game.seed, r))} items={q.lines}
        footer={<><QuotePill q={q} /><span className="num">{formatDay(q.sentAt ?? game.hour)}</span></>} />
      {draft && r && (
        <div className="books-quote-edit">
          <PriceField value={monthly} reference={r.reference} onChange={(m) => edit(m, setup)} />
          <PriceField value={setup} reference={setupFee(game, r.product)} onChange={(f) => edit(monthly, f)} label={t("support.setupFee")} />
        </div>
      )}
      {draft && q.ticketId && hasHelpdeskLink(game) && <button className="btn primary" onClick={() => act(attachQuote, q.id, q.ticketId!)}><Send />{t("orderSteps.sendQuote")}</button>}
      {q.status === "accepted" && (inv
        ? <button className="btn" onClick={() => openApp("Books", { kind: "invoice", id: inv.id })}><Receipt />{t("books.invoice", { number: inv.number })}</button>
        : <button className="btn primary" onClick={() => { const res = act(convertQuote, q.id); if (res.ok) openApp("Books", { kind: "invoice", id: res.id! }); }}><Receipt />{t("orderSteps.convert")}</button>)}
    </div>
  );
}
