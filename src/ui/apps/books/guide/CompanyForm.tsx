import { useState } from "react";
import type { Chart, TaxMethod } from "../../../../sim/80-business/books-guide";
import { LOCALE } from "../../../../i18n/lang";
import { t } from "../../../../i18n/en";

const CHARTS: Chart[] = ["skr03", "skr04"];
const METHODS: TaxMethod[] = ["soll", "ist", "euer"];
const month = (m: number) => new Intl.DateTimeFormat(LOCALE, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2000, m - 1, 1)));
export interface CompanyChoice { chart: Chart; fiscalStart: number; method: TaxMethod }

// The program's company assistant: chart of accounts, start of the fiscal year and how VAT is accounted.
export function CompanyForm({ chart = true, onCreate }: { chart?: boolean; onCreate: (c: CompanyChoice) => void }) {
  const [form, setForm] = useState<CompanyChoice>({ chart: "skr03", fiscalStart: 1, method: "euer" });
  return (
    <span className="bg-field">
      {chart && <label>{t("bkguide.field.chart")}<select value={form.chart} onChange={(e) => setForm({ ...form, chart: e.target.value as Chart })}>{CHARTS.map((c) => <option key={c} value={c}>{t(`bkguide.chart.${c}`)}</option>)}</select></label>}
      <label>{t("bkguide.field.fiscalStart")}<select value={form.fiscalStart} onChange={(e) => setForm({ ...form, fiscalStart: +e.target.value })}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{month(i + 1)}</option>)}</select></label>
      <label>{t("bkguide.field.method")}<select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as TaxMethod })}>{METHODS.map((m) => <option key={m} value={m}>{t(`bkguide.method.${m}`)}</option>)}</select></label>
      <button type="button" className="btn primary bg-do" onClick={() => onCreate(form)}>{t("bkguide.do.company")}</button>
    </span>
  );
}
