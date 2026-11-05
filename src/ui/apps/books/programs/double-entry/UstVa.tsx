import { useState } from "react";
import { euroCents } from "../../../../../sim/00-core/money";
import { monthsOf, revenueBetween, vatBetween } from "../../../../../sim/80-business/tax";
import { connectDohle, submitTaxReturn } from "../../../../../sim/90-actions/tax";
import { period } from "../../../../../i18n/tax";
import { t } from "../../../../../i18n/en";
import { useStore } from "../../../../store";
import { BooksTax } from "../../TaxTab";
import { useBooks } from "../../view";

// The advance VAT return: the form's key figures for a period, then the returns to send through the tax portal.
export function UstVa() {
  const game = useBooks(), act = useStore((s) => s.act);
  const periods = game.tax.returns.filter((r) => r.kind === "vat").slice().reverse();
  const [id, setId] = useState(periods.find((r) => r.filedAt === null)?.id ?? periods[0]?.id ?? "");
  const r = periods.find((x) => x.id === id);
  const v = r && vatBetween(game, r.from, r.to), gross = r ? revenueBetween(game, r.from, r.to) : 0;
  return (
    <div className="de-page de-scroll">
      {r && v && (
        <>
          <div className="de-bar">
            <label>{t("ui-tax.formular.period")}
              <select value={id} onChange={(e) => setId(e.target.value)}>{periods.map((x) => <option key={x.id} value={x.id}>{period({ from: x.from, months: monthsOf(x) })}</option>)}</select>
            </label>
          </div>
          <table className="table de-table de-kz">
            <thead><tr><th>{t("books-de.vat.kz")}</th><th /><th className="r">{t("books-de.vat.base")}</th><th className="r">{t("books-de.vat.tax")}</th></tr></thead>
            <tbody>
              <tr><td className="num">81</td><td>{t("books-de.vat.k81")}</td><td className="r num">{euroCents(gross - v.output)}</td><td className="r num">{euroCents(v.output)}</td></tr>
              <tr><td className="num">66</td><td>{t("books-de.vat.k66")}</td><td /><td className="r num">{euroCents(v.input)}</td></tr>
              <tr className="de-sum"><td className="num">83</td><td>{t("books-de.vat.k83")}</td><td /><td className="r num">{euroCents(v.payable)}</td></tr>
            </tbody>
          </table>
        </>
      )}
      <BooksTax game={game} connect={(doc) => act(connectDohle, doc)} submit={(x) => act(submitTaxReturn, x)} />
    </div>
  );
}
