import { Fragment, useState } from "react";
import { euroCents } from "../../../../../../sim/00-core/money";
import { taxFor } from "../../../../../../sim/46-finance/finance";
import { DOHLE_NAME, monthsOf, vatBetween, type TaxReturn } from "../../../../../../sim/80-business/tax";
import { connectDohle, submitTaxReturn } from "../../../../../../sim/90-actions/tax";
import type { ActionResult } from "../../../../../../sim/90-actions/hardware";
import { t } from "../../../../../../i18n/en";
import { period } from "../../../../../../i18n/tax";
import { useStore } from "../../../../../store";
import { paperDay } from "../../../../FormDoc";
import { useVatReturns } from "../../../data";
import { useBooks } from "../../../view";
import { Card, Chip, Empty } from "../ui";

// Steuern: the advance VAT returns with their Umsatzsteuer, Vorsteuer and Differenz, the tax portal link and the yearly return's submit.
export function Steuern() {
  const game = useBooks(), act = useStore((s) => s.act), { available, linked, certs } = useVatReturns();
  const [doc, setDoc] = useState(certs[0]?.id ?? "");
  const [error, setError] = useState("");
  const [shown, setShown] = useState<string | null>(null);
  const run = (r: ActionResult) => setError(r.ok ? "" : t(r.error, r.params));
  const rows = [...game.tax.returns].reverse();
  const split = (r: TaxReturn) => r.kind === "vat" ? vatBetween(game, r.from, r.to) : null;
  return (
    <>
      <div className="sx-head">
        <h1>{t("rx.nav.steuern")}</h1>
        <div className="sx-actions">
          {available && (linked ? <Chip tone="ok">{DOHLE_NAME}: {t("ui-tax.books.connected")}</Chip> : !certs.length ? null : (
            <>
              <label>{t("ui-tax.dohle.certificate")} <select className="sx-btn" value={doc} onChange={(e) => setDoc(e.target.value)}>{certs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
              <button type="button" className="sx-btn primary" disabled={!doc} onClick={() => run(act(connectDohle, doc))}>{t("ui-tax.books.connect")}</button>
            </>
          ))}
        </div>
      </div>
      {rows.length === 0 ? <Empty>{t("ui-tax.formular.none")}</Empty> : (
        <table className="sx-table">
          <thead><tr><th>{t("ui-tax.formular.return")}</th><th>{t("ui-tax.formular.period")}</th><th>{t("ui-tax.formular.due")}</th><th className="r">{t("ui-tax.returns.owed")}</th><th>{t("bank.pay.status")}</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => {
              const v = split(r), owing = v ? v.payable : taxFor(game, r.year).tax, over = r.filedAt === null && game.hour >= r.dueAt;
              return (
                <Fragment key={r.id}>
                  <tr tabIndex={v ? 0 : undefined} onClick={() => v && setShown(shown === r.id ? null : r.id)}>
                    <td>{t(`ui-tax.formular.kind.${r.kind}`)}</td><td>{period({ from: r.from, months: monthsOf(r) })}</td><td className="num">{paperDay(r.dueAt - 24)}</td>
                    <td className="r num">{euroCents(owing)}</td>
                    <td><Chip tone={r.filedAt !== null ? "ok" : over ? "warn" : undefined}>{r.filedAt !== null ? t("rx.submitted") : over ? t("bank.pay.overdue") : t("bank.pay.open")}</Chip></td>
                    <td className="r">{r.kind === "year" && r.filedAt === null && linked && <button type="button" className="sx-btn primary" onClick={(e) => { e.stopPropagation(); run(act(submitTaxReturn, r.id)); }}>{t("ui-tax.books.submit")}</button>}</td>
                  </tr>
                  {v && shown === r.id && (
                    <tr key={`${r.id}-d`}><td colSpan={6}>
                      <Card><table className="sx-table"><tbody>
                        <tr><td>{t("rx.outputVat")}</td><td className="r num">{euroCents(v.output)}</td></tr>
                        <tr><td>{t("rx.inputVat")}</td><td className="r num">{euroCents(v.input)}</td></tr>
                        <tr><td><b>{t("rx.difference")}</b></td><td className="r num"><b>{euroCents(v.payable)}</b></td></tr>
                      </tbody></table></Card>
                    </td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
      {error && <p className="sx-err" role="alert">{error}</p>}
    </>
  );
}
