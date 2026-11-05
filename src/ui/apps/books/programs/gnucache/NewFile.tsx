import { useState } from "react";
import type { Chart, TaxMethod } from "../../../../../sim/80-business/books-guide";
import { LOCALE } from "../../../../../i18n/lang";
import { t } from "../../../../../i18n/en";
import type { CompanyChoice } from "../../guide/CompanyForm";

const CHARTS: Chart[] = ["skr03", "skr04"];
const METHODS: TaxMethod[] = ["soll", "ist", "euer"];
const month = (m: number) => new Intl.DateTimeFormat(LOCALE, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2000, m - 1, 1)));
const PAGES = ["p1", "p2", "p3", "p4", "p5"];

// The new-file assistant: introduction, currency, category template, hierarchy options and the closing page. Applying it
// creates the company the install guide's company, chart and VAT method steps wait for.
export function NewFile({ onApply, onCancel }: { onApply: (c: CompanyChoice) => void; onCancel: () => void }) {
  const [page, setPage] = useState(0);
  const [form, setForm] = useState<CompanyChoice>({ chart: "skr03", fiscalStart: 1, method: "euer" });
  const last = page === PAGES.length - 1;
  return (
    <div className="gc-modal">
      <div className="gc-dialog gc-assistant" role="dialog" aria-label={t("gc.nf.title")}>
        <div className="gc-dtitle">{t("gc.nf.title")}</div>
        <div className="gc-assist-body">
          <aside className="gc-banner"><b>{t(`gc.nf.${PAGES[page]}`)}</b></aside>
          <div className="gc-assist-page">
            {page === 0 && <p>{t("gc.nf.intro")}</p>}
            {page === 1 && <label>{t("gc.nf.p2")}<select defaultValue="eur"><option value="eur">{t("gc.nf.eur")}</option></select></label>}
            {page === 2 && <label>{t("bkguide.field.chart")}<select value={form.chart} onChange={(e) => setForm({ ...form, chart: e.target.value as Chart })}>{CHARTS.map((c) => <option key={c} value={c}>{t(`bkguide.chart.${c}`)}</option>)}</select></label>}
            {page === 3 && (
              <>
                <label>{t("bkguide.field.fiscalStart")}<select value={form.fiscalStart} onChange={(e) => setForm({ ...form, fiscalStart: +e.target.value })}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{month(i + 1)}</option>)}</select></label>
                <label>{t("bkguide.field.method")}<select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as TaxMethod })}>{METHODS.map((m) => <option key={m} value={m}>{t(`bkguide.method.${m}`)}</option>)}</select></label>
              </>
            )}
            {page === 4 && <p>{t("gc.nf.finish")}</p>}
          </div>
        </div>
        <div className="gc-buttons">
          <button onClick={onCancel}>{t("gc.btn.cancel")}</button>
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>{t("gc.btn.back")}</button>
          {last ? <button className="gc-default" onClick={() => onApply(form)}>{t("gc.btn.apply")}</button> : <button className="gc-default" onClick={() => setPage(page + 1)}>{t("gc.btn.forward")}</button>}
        </div>
      </div>
    </div>
  );
}
