import { Mail, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { euroCents } from "../../../../../../sim/00-core/money";
import { dueStep, invoiceTotal, isUnpaid, type Invoice } from "../../../../../../sim/45-billing/billing";
import { ownAddress } from "../../../../../../sim/30-customers/addresses";
import { stepError } from "../../../../../../sim/30-market/manual";
import { requestName } from "../../../../../../sim/30-market/market";
import { orderOf } from "../../../../../../sim/30-market/orders";
import type { Quote } from "../../../../../../sim/30-market/quotes";
import { setupFee } from "../../../../../../sim/30-market/spec";
import { sells } from "../../../../../../sim/10-catalog/bookkeeping";
import { currentVendor, hasFeature } from "../../../../../../sim/80-business/bookkeeping";
import { vatRate } from "../../../../../../sim/80-business/tax";
import { sendInvoice, sendReminder } from "../../../../../../sim/90-actions/billing";
import type { ActionResult } from "../../../../../../sim/90-actions/hardware";
import { attachQuote, convertQuote, createQuote, deleteQuote, editQuote } from "../../../../../../sim/90-actions/orders";
import { t } from "../../../../../../i18n/en";
import { useStore } from "../../../../../store";
import { More } from "../../../../More";
import { PriceField } from "../../../../sales/PriceField";
import { formatDay } from "../../../../billing/format";
import { invoiceMenu, InvoiceDialog, type Asking } from "../../../InvoiceMenu";
import { addressLines, statusLabel } from "../../../InvoicesTab";
import { BooksLocked } from "../../../Locked";
import { useBooks } from "../../../view";
import { DocumentEditor } from "../DocumentEditor";
import { Chip, Empty, Tabs } from "../ui";

const TONE = { draft: undefined, open: "accent", overdue: "warn", paid: "ok", writtenOff: undefined } as const;
type Filter = "all" | "open" | "overdue" | "paid";
const KEEP: Record<Filter, (i: Invoice) => boolean> = { all: () => true, open: isUnpaid, overdue: (i) => i.status === "overdue", paid: (i) => i.status === "paid" };
const total = (q: Quote) => q.lines.reduce((n, l) => n + l.amount, 0);

// Rechnungen and Angebote: a filtered list and the document editor of the selected row.
export function Documents({ kind, focus, q, go }: { kind: "invoice" | "quote"; focus: string | null; q: string; go: (s: string) => void }) {
  return kind === "invoice" ? <Invoices focus={focus} q={q} /> : <Quotes focus={focus} q={q} go={go} />;
}

function Invoices({ focus, q }: { focus: string | null; q: string }) {
  const game = useBooks(), act = useStore((s) => s.act);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(focus);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState("");
  const name = (id: string) => game.customers.find((c) => c.id === id)?.name ?? id;
  const all = [...game.invoices].reverse().filter((i) => !q || `${i.number} ${name(i.customerId)}`.toLowerCase().includes(q.toLowerCase()));
  const list = all.filter(KEEP[filter]);
  const inv = game.invoices.find((i) => i.id === selected) ?? list[0];
  const ready = game.quotes.filter((x) => x.status === "accepted" && x.origin === "books");
  const run = (r: ActionResult) => { setError(r.ok ? "" : t(r.error, r.params)); return r; };
  const from = () => {
    const r = run(act(convertQuote, quote || ready[0].id));
    if (r.ok) setSelected(r.id!);
  };
  const c = inv && game.customers.find((x) => x.id === inv.customerId);
  const step = inv && dueStep(inv, game.hour);
  return (
    <>
      <div className="sx-head">
        <h1>{t("rx.nav.rechnungen")}</h1>
        <div className="sx-actions">
          {ready.length > 1 && <select className="sx-btn" aria-label={t("rx.fromQuote")} value={quote || ready[0].id} onChange={(e) => setQuote(e.target.value)}>{ready.map((x) => <option key={x.id} value={x.id}>{x.number}</option>)}</select>}
          <button type="button" className="sx-btn primary" disabled={!ready.length} onClick={from}>{t("rx.newInvoice")}</button>
        </div>
      </div>
      <Tabs value={filter} onPick={(f) => setFilter(f as Filter)} items={(["all", "open", "overdue", "paid"] as Filter[]).map((f) => ({ id: f, label: t(`rx.filter.${f}`), count: f === "all" ? 0 : all.filter(KEEP[f]).length }))} />
      {list.length === 0 ? <Empty>{t("books.noInvoices")}</Empty> : (
        <table className="sx-table">
          <thead><tr><th>{t("books.col.number")}</th><th>{t("books.col.customer")}</th><th>{t("rx.col.date")}</th><th>{t("bank.pay.due")}</th><th className="r">{t("books.col.amount")}</th><th>{t("books.col.status")}</th></tr></thead>
          <tbody>
            {list.slice(0, 50).map((i) => (
              <tr key={i.id} className={i.id === inv?.id ? "sel" : ""} tabIndex={0} onClick={() => setSelected(i.id)} onKeyDown={(e) => e.key === "Enter" && setSelected(i.id)}>
                <td className="num">{i.number}</td><td>{name(i.customerId)}</td><td className="num">{formatDay(i.issuedAt)}</td>
                <td className="num">{i.status === "draft" ? "" : formatDay(i.dueAt)}</td><td className="r num">{euroCents(invoiceTotal(i))}</td>
                <td><Chip tone={TONE[i.status]}>{statusLabel(i)}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {inv && (
        <DocumentEditor title={t("rx.invoice")} number={inv.number} status={<Chip tone={TONE[inv.status]}>{statusLabel(inv)}</Chip>}
          from={[game.company.name, ownAddress(game).street].join(" · ")} rate={vatRate(inv.issuedAt)}
          contact={{ name: c?.name ?? "", lines: c ? addressLines(c.address) : [] }}
          dates={[[t("rx.col.date"), formatDay(inv.issuedAt)], [t("bank.pay.due"), inv.status === "draft" ? "" : formatDay(inv.dueAt)], ...(inv.paidAt !== null ? [[t("rx.paidOn"), formatDay(inv.paidAt)] as [string, string]] : [])]}
          lines={inv.lines.map((l) => ({ text: t(l.key, l.params), amount: l.amount }))}
          actions={
            <>
              {inv.status === "draft" && <>
                <button type="button" className="sx-btn" onClick={() => run(act(sendInvoice, inv.id))}><Send aria-hidden />{t("rx.asPdf")}</button>
                <button type="button" className="sx-btn primary" onClick={() => run(act(sendInvoice, inv.id))}><Mail aria-hidden />{t("rx.byEmail")}</button>
              </>}
              {isUnpaid(inv) && <button type="button" className="sx-btn" onClick={() => setAsking({ inv, what: "markPaid" })}>{t("books.menu.markPaid")}</button>}
              {inv.status !== "draft" && isUnpaid(inv) && (hasFeature(game, "dunning")
                ? <button type="button" className="sx-btn" disabled={step === null} onClick={() => run(act(sendReminder, inv.id))}>{t("rx.dunning")}</button>
                : currentVendor(game) && sells(currentVendor(game)!, "dunning") && <BooksLocked label={t("rx.dunning")} />)}
              <More label={inv.number} entries={() => invoiceMenu(inv, game.hour, setAsking)} />
            </>
          } />
      )}
      {error && <p className="sx-err" role="alert">{error}</p>}
      {asking && <InvoiceDialog asking={asking} onClose={() => setAsking(null)} />}
    </>
  );
}

const quotable = (game: ReturnType<typeof useBooks>) => game.tickets.filter((tk) => orderOf(game, tk) && !stepError(game, tk, "quote"));

function Quotes({ focus, q, go }: { focus: string | null; q: string; go: (s: string) => void }) {
  const game = useBooks(), act = useStore((s) => s.act);
  const [selected, setSelected] = useState<string | null>(focus);
  const [ticket, setTicket] = useState("");
  const [error, setError] = useState("");
  const open = quotable(game);
  const name = (x: Quote) => game.customers.find((c) => c.id === x.customerId)?.name ?? "";
  const list = [...game.quotes].reverse().filter((x) => !q || `${x.number} ${name(x)}`.toLowerCase().includes(q.toLowerCase()));
  const sel = game.quotes.find((x) => x.id === selected) ?? list[0];
  const run = (r: ActionResult) => { setError(r.ok ? "" : t(r.error, r.params)); return r; };
  const create = () => { const r = run(act(createQuote, ticket || open[0].id)); if (r.ok) setSelected(r.id!); };
  const tk = sel && game.tickets.find((x) => x.id === sel.ticketId), order = tk && orderOf(game, tk);
  const draft = sel?.status === "draft" && sel.origin === "books";
  const c = sel && game.customers.find((x) => x.id === sel.customerId);
  return (
    <>
      <div className="sx-head">
        <h1>{t("rx.nav.angebote")}</h1>
        <div className="sx-actions">
          <select className="sx-btn" aria-label={t("pkg.order")} value={ticket || open[0]?.id || ""} disabled={!open.length} onChange={(e) => setTicket(e.target.value)}>
            {open.map((x) => { const r = orderOf(game, x)!; return <option key={x.id} value={x.id}>{[requestName(r), r.domain].filter(Boolean).join(" · ")}</option>; })}
          </select>
          <button type="button" className="sx-btn primary" disabled={!open.length} onClick={create}>{t("rx.newQuote")}</button>
        </div>
      </div>
      {list.length === 0 ? <Empty>{t("orderSteps.noQuotes")}</Empty> : (
        <table className="sx-table">
          <thead><tr><th>{t("books.col.number")}</th><th>{t("orderSteps.col.recipient")}</th><th className="r">{t("books.col.amount")}</th><th>{t("books.col.status")}</th></tr></thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id} className={x.id === sel?.id ? "sel" : ""} tabIndex={0} onClick={() => setSelected(x.id)} onKeyDown={(e) => e.key === "Enter" && setSelected(x.id)}>
                <td className="num">{x.number}</td><td>{name(x)}</td><td className="r num">{euroCents(total(x))}</td><td><Chip tone={x.status === "accepted" ? "ok" : x.status === "sent" ? "accent" : undefined}>{t(`orderSteps.status.${x.status}`)}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sel && (
        <DocumentEditor key={sel.id} title={t("rx.quote")} number={sel.number} status={<Chip>{t(`orderSteps.status.${sel.status}`)}</Chip>}
          from={[game.company.name, ownAddress(game).street].join(" · ")} rate={vatRate(game.hour)}
          contact={{ name: c?.name ?? (order ? requestName(order) : ""), lines: c ? addressLines(c.address) : [] }}
          dates={[[t("rx.col.date"), formatDay(sel.sentAt ?? sel.createdAt ?? game.hour)]]}
          lines={sel.lines.map((l) => ({ text: t(l.key, l.params), amount: l.amount }))}
          fields={draft && order ? (
            <div className="sx-doc-grid">
              <PriceField value={sel.monthly} reference={order.reference} onChange={(m) => m > 0 && run(act(editQuote, sel.id, m, sel.setup))} />
              <PriceField value={sel.setup} reference={setupFee(game, order.product)} label={t("support.setupFee")} onChange={(f) => f >= 0 && run(act(editQuote, sel.id, sel.monthly, f))} />
            </div>
          ) : undefined}
          actions={
            <>
              <button type="button" className="sx-btn primary" disabled={!draft || !sel.ticketId} onClick={() => run(act(attachQuote, sel.id, sel.ticketId!))}><Send aria-hidden />{t("orderSteps.send")}</button>
              <button type="button" className="sx-btn" disabled={sel.status !== "accepted" || sel.origin !== "books"} onClick={() => { const r = run(act(convertQuote, sel.id)); if (r.ok) go("rechnungen"); }}>{t("orderSteps.carryForward")}</button>
              <button type="button" className="sx-btn" disabled={!draft} onClick={() => { if (run(act(deleteQuote, sel.id)).ok) setSelected(null); }}><Trash2 aria-hidden />{t("orderSteps.delete")}</button>
            </>
          } />
      )}
      {error && <p className="sx-err" role="alert">{error}</p>}
    </>
  );
}
