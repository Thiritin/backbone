import { Eye } from "lucide-react";
import { useState, type ReactNode } from "react";
import { euroCents } from "../../../../../sim/00-core/money";
import { t } from "../../../../../i18n/en";

export interface DocLine { text: string; amount: number }

// The editor of a sales document: contact card, dates, line items with the tax split, a toggled preview and the program's actions.
// Prices are gross; the net and tax lines are derived from the rate. fields holds the editable inputs a draft quote has.
export function DocumentEditor({ title, number, status, contact, dates, lines, rate, fields, actions, from }: {
  title: string; number: string; status: ReactNode; contact: { name: string; lines: string[] }; dates: [string, string][];
  lines: DocLine[]; rate: number; fields?: ReactNode; actions: ReactNode; from: string;
}) {
  const [preview, setPreview] = useState(false);
  const gross = lines.reduce((n, l) => n + l.amount, 0), net = Math.round((gross / (1 + rate)) * 100) / 100, tax = Math.round((gross - net) * 100) / 100;
  const pct = `${Math.round(rate * 100)} %`;
  return (
    <section className="sx-doc sx-card" aria-label={title}>
      <div className="sx-head">
        <h1>{title} <span className="num">{number}</span></h1>{status}
        <div className="sx-actions">
          <button type="button" className="sx-btn" aria-pressed={preview} onClick={() => setPreview(!preview)}><Eye aria-hidden />{t("rx.preview")}</button>
          {actions}
        </div>
      </div>
      <div className="sx-doc-grid">
        <div className="sx-field"><span>{t("rx.contact")}</span><div className="sx-contact"><b>{contact.name}</b>{contact.lines.filter((l) => l !== contact.name).map((l) => <div key={l}>{l}</div>)}</div></div>
        {dates.map(([k, v]) => <div key={k} className="sx-field"><span>{k}</span><div className="sx-contact num">{v}</div></div>)}
        <div className="sx-field"><span>{t("rx.taxRate")}</span><div className="sx-contact num">{pct}</div></div>
      </div>
      {fields}
      <table>
        <thead><tr><th>{t("books.col.item")}</th><th className="r">{t("books.col.amount")}</th></tr></thead>
        <tbody>{lines.map((l, n) => <tr key={n}><td>{l.text}</td><td className="r num">{euroCents(l.amount)}</td></tr>)}</tbody>
        <tfoot>
          <tr><td>{t("rx.net")}</td><td className="r num">{euroCents(net)}</td></tr>
          <tr><td>{t("rx.vat", { rate: pct })}</td><td className="r num">{euroCents(tax)}</td></tr>
          <tr><td>{t("rx.gross")}</td><td className="r num">{euroCents(gross)}</td></tr>
        </tfoot>
      </table>
      {preview && (
        <article className="sx-card sx-preview" aria-label={t("rx.preview")}>
          <small>{from}</small>
          <h2>{title} {number}</h2>
          <address>{[...new Set([contact.name, ...contact.lines])].map((l) => <div key={l}>{l}</div>)}</address>
          {lines.map((l, n) => <div key={n} className="sx-head"><span>{l.text}</span><b className="num" style={{ marginLeft: "auto" }}>{euroCents(l.amount)}</b></div>)}
        </article>
      )}
    </section>
  );
}
