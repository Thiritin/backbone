import type { CSSProperties } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { bankById } from "../../../../../sim/10-catalog/banks";
import { groupIban, ibanEra, ownIban } from "../../../../../sim/46-finance/bank";
import { payMethod, supplierUrl } from "../../../../../sim/46-finance/payables";
import type { GameState } from "../../../../../sim/50-state";
import { InvoiceTable, PayMethodPanel } from "../shared/SupplierAccount";
import "./bank-site.css";

const SKIN = { "--bar": "#3c4a5c", "--accent": "#6b7f99", "--bg": "#f2f2ee" } as CSSProperties;

// A supplier's customer portal: its invoices and how they are paid.
export function SupplierSite({ game, name, go = () => {} }: { game: GameState; name: string; go?: (url: string) => void }) {
  const b = game.bank;
  return (
    <div className="bks" style={SKIN}>
      <header className="bks-head">
        <span className="bks-logo" aria-hidden>{name.charAt(0).toUpperCase()}</span>
        <span className="bks-name">{name}</span>
        <nav className="bks-top"><a href="#/account" aria-current="page" onClick={(e) => { e.preventDefault(); go(supplierUrl(name)); }}>{t("accounts.myAccount")}</a></nav>
      </header>
      <main className="bks-main">
        {b && (
          <section className="bks-box">
            <h2>{t("accounts.payMethod")}</h2>
            <PayMethodPanel game={game} name={name} title={game.company.name} />
            {payMethod(game, name) === "debit" && (
              <table className="bks-table"><tbody>
                <tr><td>{ibanEra(game) ? t("bank.site.iban") : t("bank.site.number")}</td><td className="r num">{ibanEra(game) ? groupIban(ownIban(game)) : `${b.number} / ${bankById(b.id)!.code}`}</td></tr>
              </tbody></table>
            )}
          </section>
        )}
        <section className="bks-box">
          <h2>{t("accounts.invoices")}</h2>
          <InvoiceTable game={game} name={name} className="bks-table bks-rows" />
        </section>
      </main>
      <footer className="bks-foot">{t("bank.site.footer", { name, year: yearOf(game.hour) })}</footer>
    </div>
  );
}
