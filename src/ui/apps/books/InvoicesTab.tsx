import { Receipt, Send } from "lucide-react";
import { useState } from "react";
import { euroCents } from "../../../sim/00-core/money";
import { addressFor, type Address } from "../../../sim/30-customers/addresses";
import { invoiceTotal, type Invoice, type InvoiceStatus } from "../../../sim/45-billing/billing";
import type { GameState } from "../../../sim/50-state";
import { sendInvoice } from "../../../sim/90-actions/billing";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { formatDay } from "../billing/format";
import { monthYear } from "../support/labels";
import { Locked } from "./Locked";

const PILL: Record<InvoiceStatus, string> = { draft: "", open: "accent", overdue: "warn", paid: "ok", writtenOff: "" };
export const statusLabel = (i: Invoice) => t(`books.status.${i.status === "open" ? "sent" : i.status}`);
export const StatusPill = ({ inv }: { inv: Invoice }) => <span className={`pill ${PILL[inv.status]}`}>{statusLabel(inv)}</span>;

export function InvoicesTab({ focus }: { focus: string | null }) {
  const game = useStore((s) => s.game);
  const list = [...game.invoices].reverse();
  const [selected, setSelected] = useState<string | null>(focus ?? list.find((i) => i.status === "draft")?.id ?? list[0]?.id ?? null);
  const inv = game.invoices.find((i) => i.id === selected);
  const name = (id: string) => game.customers.find((c) => c.id === id)?.name ?? id;
  return (
    <>
      <div className="fin-toolbar"><Locked id="monthly-run" label={t("books.monthlyRun")} /></div>
      <div className="books-split">
        <div className="fin-scroll">
          {list.length === 0 ? <div className="fin-empty"><Receipt />{t("books.noInvoices")}</div> : (
            <table className="table fin-table">
              <thead>
                <tr><th>{t("books.col.number")}</th><th>{t("books.col.customer")}</th><th>{t("books.col.period")}</th><th className="r">{t("books.col.amount")}</th><th>{t("books.col.status")}</th></tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <tr key={i.id} className={i.id === selected ? "sel" : ""} onClick={() => setSelected(i.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setSelected(i.id)}>
                    <td className="num">{i.number}</td>
                    <td>{name(i.customerId)}</td>
                    <td className="num">{monthYear(i.issuedAt)}</td>
                    <td className="r num">{euroCents(invoiceTotal(i))}</td>
                    <td><StatusPill inv={i} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {inv && <Preview inv={inv} game={game} />}
      </div>
    </>
  );
}

const lines = (a: Address) => [a.company, a.contact, a.street, `${a.zip} ${a.city}`].filter(Boolean) as string[];

// The invoice as an A4 page, scaled to the pane.
function Preview({ inv, game }: { inv: Invoice; game: GameState }) {
  const act = useStore((s) => s.act);
  const c = game.customers.find((x) => x.id === inv.customerId);
  const own = addressFor(game.seed, 0, game.registration?.owner ?? game.company.name, game.company.name, game.locations[0]?.city ?? "Frankfurt");
  return (
    <div className="books-preview">
      <article className="books-a4" aria-label={t("books.invoice", { number: inv.number })}>
        <header>
          <h2>{t("books.invoice", { number: inv.number })}</h2>
          <p className="books-from">{[game.company.name, own.street, `${own.zip} ${own.city}`].join(" · ")}</p>
        </header>
        {c && <address>{lines(c.address).map((l) => <div key={l}>{l}</div>)}</address>}
        <table>
          <thead><tr><th>{t("books.col.item")}</th><th className="r">{t("books.col.amount")}</th></tr></thead>
          <tbody>
            {inv.lines.map((l, n) => <tr key={n}><td>{t(l.key, l.params)}</td><td className="r num">{euroCents(l.amount)}</td></tr>)}
            <tr className="books-total"><td>{t("books.total")}</td><td className="r num">{euroCents(invoiceTotal(inv))}</td></tr>
          </tbody>
        </table>
        <footer>
          {inv.status === "draft" ? <span>{formatDay(inv.issuedAt)}</span> : (
            <><StatusPill inv={inv} /><span className="num">{inv.paidAt !== null ? t("books.paidOn", { date: formatDay(inv.paidAt) }) : t("books.dueOn", { date: formatDay(inv.dueAt) })}</span></>
          )}
        </footer>
      </article>
      {inv.status === "draft" && <button className="btn primary" onClick={() => act(sendInvoice, inv.id)}><Send />{t("books.sendPdf")}</button>}
    </div>
  );
}
