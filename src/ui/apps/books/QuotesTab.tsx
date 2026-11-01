import { FileOutput, FilePen, FilePlus, FileText, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { mailedAddress } from "../../../sim/30-customers/addresses";
import { stepError } from "../../../sim/30-market/manual";
import { requestName } from "../../../sim/30-market/market";
import { orderOf } from "../../../sim/30-market/orders";
import { type Quote, type QuoteStatus } from "../../../sim/30-market/quotes";
import { setupFee } from "../../../sim/30-market/spec";
import type { GameState } from "../../../sim/50-state";
import { attachQuote, convertQuote, createQuote, deleteQuote, editQuote } from "../../../sim/90-actions/orders";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { useBooks } from "./view";
import { formatDay } from "../billing/format";
import { PriceField } from "../sales/PriceField";
import { DocBar, DocButton, DocFoot } from "./DocBar";
import { Page } from "./InvoicesTab";

// The drag type of a quote row; the order ticket's attachment strip takes it.
export const QUOTE_DRAG = "application/x-lexwear-quote";
const PILL: Record<QuoteStatus, string> = { draft: "", sent: "accent", accepted: "ok", countered: "warn", declined: "", invoiced: "" };
export const QuotePill = ({ q }: { q: Quote }) => <span className={`pill ${PILL[q.status]}`}>{t(`orderSteps.status.${q.status}`)}</span>;

const orderFor = (game: GameState, q: Quote) => {
  const tk = game.tickets.find((x) => x.id === q.ticketId);
  return tk && orderOf(game, tk);
};
const dated = (q: Quote) => q.createdAt ?? q.sentAt;
const total = (q: Quote) => q.lines.reduce((n, l) => n + l.amount, 0);
const invoiceNumber = (game: GameState, q: Quote) => game.invoices.find((i) => i.id === q.invoiceId)?.number;

// The order tickets that wait for a quote.
const quotable = (game: GameState) => game.tickets.filter((tk) => orderOf(game, tk) && !stepError(game, tk, "quote"));

// Quotes as a document list: toolbar, list, A4 preview and a footer line.
export function QuotesTab({ focus }: { focus: string | null }) {
  const game = useBooks(), act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const list = [...game.quotes].reverse(), open = quotable(game);
  const [selected, setSelected] = useState<string | null>(focus ?? list[0]?.id ?? null);
  const [ticket, setTicket] = useState(""), [editing, setEditing] = useState(false);
  const q = game.quotes.find((x) => x.id === selected), draft = q?.status === "draft";
  const name = (x: Quote) => game.customers.find((c) => c.id === x.customerId)?.name ?? (orderFor(game, x) ? requestName(orderFor(game, x)!) : "");
  const pick = (id: string | null) => { setSelected(id); setEditing(false); };
  const create = () => {
    const r = act(createQuote, ticket || open[0]?.id);
    if (r.ok) { setSelected(r.id!); setEditing(true); }
  };
  const carry = () => {
    const r = act(convertQuote, q!.id);
    if (r.ok) openApp("Books", { kind: "invoice", id: r.id! });
  };
  return (
    <div className="books-docs">
      <DocBar>
        <DocButton icon={<FilePlus />} label={t("orderSteps.new")} disabled={!open.length} onClick={create} />
        <select className="field books-docbar-pick" aria-label={t("pkg.order")} value={ticket || open[0]?.id || ""} onChange={(e) => setTicket(e.target.value)} disabled={!open.length}>
          {open.map((tk) => { const r = orderOf(game, tk)!; return <option key={tk.id} value={tk.id}>{[requestName(r), r.domain].filter(Boolean).join(" · ")}</option>; })}
        </select>
        <span className="books-docbar-sep" />
        <DocButton icon={<FilePen />} label={t("orderSteps.edit")} disabled={!draft} pressed={editing && draft} onClick={() => setEditing(!editing)} />
        <DocButton icon={<Send />} label={t("orderSteps.send")} disabled={!draft || !q?.ticketId} onClick={() => act(attachQuote, q!.id, q!.ticketId!)} />
        <DocButton icon={<FileOutput />} label={t("orderSteps.carryForward")} disabled={q?.status !== "accepted"} onClick={carry} />
        <DocButton icon={<Trash2 />} label={t("orderSteps.delete")} disabled={!draft} onClick={() => { if (act(deleteQuote, q!.id).ok) pick(null); }} />
      </DocBar>
      <div className="books-split">
        <div className="fin-scroll">
          {list.length === 0 ? <div className="fin-empty"><FileText />{t("orderSteps.noQuotes")}</div> : (
            <table className="table fin-table books-doclist">
              <thead>
                <tr><th>{t("books.col.number")}</th><th>{t("orderSteps.col.date")}</th><th>{t("orderSteps.col.recipient")}</th><th className="r">{t("books.col.amount")}</th><th>{t("books.col.status")}</th></tr>
              </thead>
              <tbody>
                {list.map((x) => (
                  <tr key={x.id} className={`${x.id === selected ? "sel" : ""}${x.status === "draft" ? " books-drag" : ""}`} onClick={() => pick(x.id)} tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && pick(x.id)} draggable={x.status === "draft"}
                    onDragStart={(e) => { e.dataTransfer.setData(QUOTE_DRAG, x.id); e.dataTransfer.setData("text/plain", t("orderSteps.quote", { number: x.number })); e.dataTransfer.effectAllowed = "copy"; }}>
                    <td className="num">{x.number}</td>
                    <td className="num">{dated(x) === null ? "" : formatDay(dated(x)!)}</td>
                    <td>{name(x)}</td>
                    <td className="r num">{euroCents(total(x))}</td>
                    <td><QuotePill q={x} />{x.status === "invoiced" && invoiceNumber(game, x) && <span className="num books-doclist-ref">{invoiceNumber(game, x)}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {q && <QuotePreview key={q.id} q={q} game={game} editing={editing && draft} />}
      </div>
      <DocFoot items={[
        [t("books.tab.quotes"), String(list.length)],
        [t("orderSteps.status.accepted"), String(list.filter((x) => x.status === "accepted").length)],
        [t("books.total"), euroCents(list.reduce((n, x) => n + total(x), 0))],
      ]} />
    </div>
  );
}

function QuotePreview({ q, game, editing }: { q: Quote; game: GameState; editing: boolean }) {
  const act = useStore((s) => s.act);
  const r = orderFor(game, q), c = game.customers.find((x) => x.id === q.customerId), inv = invoiceNumber(game, q);
  const [monthly, setMonthly] = useState(q.monthly), [setup, setSetup] = useState(q.setup);
  const edit = (m: number, f: number) => {
    setMonthly(m);
    setSetup(f);
    if (m > 0 && f >= 0) act(editQuote, q.id, m, f);
  };
  return (
    <div className="books-preview">
      <Page game={game} title={t("orderSteps.quote", { number: q.number })} to={c?.address ?? (r && mailedAddress(game.seed, r))} items={q.lines}
        footer={<><QuotePill q={q} /><span className="num">{inv ? t("books.invoice", { number: inv }) : formatDay(q.sentAt ?? q.createdAt ?? game.hour)}</span></>} />
      {editing && r && (
        <div className="books-quote-edit">
          <PriceField value={monthly} reference={r.reference} onChange={(m) => edit(m, setup)} />
          <PriceField value={setup} reference={setupFee(game, r.product)} onChange={(f) => edit(monthly, f)} label={t("support.setupFee")} />
        </div>
      )}
    </div>
  );
}
