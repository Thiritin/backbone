import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import { euroCents } from "../../../sim/00-core/money";
import { dateOf } from "../../../sim/00-core/time";
import { bankOf, ibanEra } from "../../../sim/46-finance/bank";
import { overdue, supplierAccount, supplierCode, supplierIban, type Payable } from "../../../sim/46-finance/payables";
import type { GameState } from "../../../sim/50-state";
import { useStore } from "../../store";

const day = (hour: number) => dateOf(hour).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const left = (p: Payable) => Math.round((p.amount - p.sent) * 100) / 100;

// The bank's transfer form, filled in for the invoice.
export function payUrl(s: GameState, p: Payable): string {
  const iban = ibanEra(s), q = new URLSearchParams({
    payable: p.id, name: p.name, account: iban ? supplierIban(p.supplier) : supplierAccount(p.supplier), ...(iban ? {} : { code: supplierCode }), amount: left(p).toFixed(2), reference: p.number,
  });
  return `www.${bankOf(s)!.host}/banking/transfer?${q}`;
}

export function Payables({ game }: { game: GameState }) {
  const openApp = useStore((s) => s.openApp);
  const rows = [...game.payables].reverse();
  const status = (p: Payable) => p.paidAt !== null ? t("bank.pay.paid") : p.sent >= p.amount - 0.005 ? t("bank.pay.sent") : overdue(game, p) ? t("bank.pay.overdue") : t("bank.pay.open");
  return (
    <div className="fin-scroll">
      <table className="table">
        <thead><tr><th>{t("bank.pay.supplier")}</th><th>{t("bank.pay.number")}</th><th>{t("bank.pay.due")}</th><th className="r">{t("misc.amount")}</th><th>{t("bank.pay.status")}</th><th /></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td className="num">{p.number}</td>
              <td className="num">{day(p.dueAt)}</td>
              <td className="r num">{euroCents(p.amount)}</td>
              <td className={overdue(game, p) ? "neg" : undefined}>{status(p)}</td>
              <td className="r">{p.paidAt === null && left(p) > 0 && game.bank && <button className="btn" onClick={() => openApp("Browser", { kind: "url", id: payUrl(game, p) })}>{t("bank.pay.pay")}</button>}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6}>{t("bank.pay.none")}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
