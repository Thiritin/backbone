import { FileText } from "lucide-react";
import { useState } from "react";
import { t } from "../../i18n/en";
import { LOCALE } from "../../i18n/lang";
import { euroCents } from "../../sim/00-core/money";
import { supplierHost, type Payable } from "../../sim/46-finance/payables";
import { INPUT_CATEGORIES, vatRate } from "../../sim/80-business/tax";
import { useFocus, useStore, type Focus } from "../store";
import { formatDay } from "./billing/format";
import { ownAddress } from "../../sim/30-customers/addresses";
import { Page } from "./books/InvoicesTab";
import "./books/books.css";

// The document viewer: opens the document a Focus names; kind "payable" is a supplier's invoice.
export function PreviewApp() {
  const game = useStore((s) => s.game);
  const [doc, setDoc] = useState<Pick<Focus, "kind" | "id"> | null>(null);
  useFocus("Preview", (f) => setDoc(f));
  const p = doc?.kind === "payable" ? game.payables.find((x) => x.id === doc.id) : undefined;
  if (!p) return <div className="fin-empty"><FileText />{t("preview.none")}</div>;
  return (
    <div className="books-preview">
      <Page game={game} title={t("books.invoice", { number: p.number })} from={`${p.name} · www.${supplierHost(p.name)}`} to={ownAddress(game)}
        items={p.lines.map((l) => ({ serviceId: null, key: l.key, params: l.params, amount: -l.amount }))} footer={<PayableFoot p={p} />} />
    </div>
  );
}

function PayableFoot({ p }: { p: Payable }) {
  const rate = vatRate(p.issuedAt);
  // Prices are gross, so the VAT is the share the input-tax lines carry.
  const vat = -p.lines.filter((l) => INPUT_CATEGORIES.includes(l.category)).reduce((n, l) => n + l.amount, 0) * rate / (1 + rate);
  return (
    <>
      <span className="num">{t("preview.issuedOn", { date: formatDay(p.issuedAt) })}</span>
      <span className="num">{p.paidAt !== null ? t("books.paidOn", { date: formatDay(p.paidAt) }) : t("books.dueOn", { date: formatDay(p.dueAt) })}</span>
      {vat > 0 && <span className="num">{t("preview.vat", { rate: rate.toLocaleString(LOCALE, { style: "percent" }), amount: euroCents(vat) })}</span>}
    </>
  );
}
