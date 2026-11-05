import { t } from "../../../../../i18n/en";
import { cardReady } from "../../../../../sim/46-finance/bank";
import type { Method, SupplierId } from "../../../../../sim/46-finance/payables";
import type { GameState, LedgerEntry } from "../../../../../sim/50-state";
import { methodsFor } from "../../../../../sim/90-actions/purchase";
import "./pay-methods.css";

export const ALL_METHODS: Method[] = ["cash", "transfer", "onAccount", "card", "debit"];

export interface PayOption { method: Method; label: string; off: string | null }
export interface Offer { supplier: SupplierId; lines: LedgerEntry[]; name?: string }

// Why a method is not offered; the sim's methodsFor decides, this only words it.
function reason(s: GameState, m: Method): string {
  if (m === "card") return t(cardReady(s) ? "purchase.off.cardLimit" : "purchase.off.noCard");
  if (m === "debit") return t("purchase.off.noMandate");
  return t("purchase.off.noInvoice");
}

// Every method with its label; off is the outcome text of an unavailable one. Before a bank account exists, cash is the only one.
export function payOptions(s: GameState, o: Offer): PayOption[] {
  const on = methodsFor(s, o.supplier, o.lines, o.name);
  return ALL_METHODS.filter((m) => (m === "cash") === !s.bank)
    .map((method) => ({ method, label: t(`purchase.method.${method}`), off: on.includes(method) ? null : reason(s, method) }));
}

// The payment methods of an order as a radio group for apps outside the browser.
export function PayMethods({ game, supplier, lines, name, value, onChange }: {
  game: GameState; supplier: SupplierId; lines: LedgerEntry[]; name?: string; value: Method | null; onChange: (m: Method) => void;
}) {
  return (
    <fieldset className="pay-methods">
      <legend>{t("checkout.paymentMethod")}</legend>
      {payOptions(game, { supplier, lines, name }).map((o) => (
        <label key={o.method} className={o.off ? "off" : undefined}>
          <input type="radio" name="pay-method" checked={value === o.method} disabled={!!o.off} onChange={() => onChange(o.method)} />
          <span>{o.label}</span>{o.off && <small>{o.off}</small>}
        </label>
      ))}
    </fieldset>
  );
}
