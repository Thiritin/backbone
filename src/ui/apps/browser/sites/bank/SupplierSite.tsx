import type { CSSProperties } from "react";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { euroCents } from "../../../../../sim/00-core/money";
import { dateOf, yearOf } from "../../../../../sim/00-core/time";
import { bankById } from "../../../../../sim/10-catalog/banks";
import { groupIban, ibanEra, ownIban } from "../../../../../sim/46-finance/bank";
import { overdue } from "../../../../../sim/46-finance/payables";
import type { GameState } from "../../../../../sim/50-state";
import { setMandate } from "../../../../../sim/90-actions/bank";
import "./bank-site.css";
import { usePageAct } from "../../pageAct";

const day = (hour: number) => dateOf(hour).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const SKIN = { "--bar": "#3c4a5c", "--accent": "#6b7f99", "--bg": "#f2f2ee" } as CSSProperties;

// A supplier's customer portal: its invoices, and the direct debit mandate.
export function SupplierSite({ game, name }: { game: GameState; name: string }) {
  const act = usePageAct();
  const bills = game.payables.filter((p) => p.name === name).reverse();
  const b = game.bank, on = !!b?.mandates.includes(name);
  return (
    <div className="bks" style={SKIN}>
      <header className="bks-head">
        <span className="bks-logo" aria-hidden>{name.charAt(0).toUpperCase()}</span>
        <span className="bks-name">{name}</span>
      </header>
      <main className="bks-main">
        <section className="bks-box">
          <h2>{t("bank.supplier.mandate")}</h2>
          <table className="bks-table">
            <tbody>
              {b && <tr><td>{ibanEra(game) ? t("bank.site.iban") : t("bank.site.number")}</td><td className="r num">{ibanEra(game) ? groupIban(ownIban(game)) : `${b.number} / ${bankById(b.id)!.code}`}</td></tr>}
              <tr><td>{t("bank.pay.status")}</td><td className="r">{t(on ? "bank.supplier.active" : "bank.supplier.inactive")}</td></tr>
            </tbody>
          </table>
          {b && <p><button className="bks-btn primary" onClick={() => act(setMandate, name, !on)}>{t(on ? "bank.supplier.cancel" : "bank.supplier.setUp")}</button></p>}
        </section>
        <table className="bks-table bks-rows">
          <thead><tr><th>{t("bank.pay.number")}</th><th>{t("bank.pay.due")}</th><th className="r">{t("bank.site.amount")}</th><th>{t("bank.pay.status")}</th></tr></thead>
          <tbody>
            {bills.map((p) => (
              <tr key={p.id}><td className="num">{p.number}</td><td className="num">{day(p.dueAt)}</td><td className="r num">{euroCents(p.amount)}</td><td className={overdue(game, p) ? "neg" : undefined}>{t(p.paidAt !== null ? "bank.pay.paid" : overdue(game, p) ? "bank.pay.overdue" : "bank.pay.open")}</td></tr>
            ))}
          </tbody>
        </table>
      </main>
      <footer className="bks-foot">{t("bank.site.footer", { name, year: yearOf(game.hour) })}</footer>
    </div>
  );
}
