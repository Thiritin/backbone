import { useId, type ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { cardReady } from "../../../../../sim/46-finance/bank";
import type { Method, SupplierId } from "../../../../../sim/46-finance/payables";
import type { GameState, LedgerEntry } from "../../../../../sim/50-state";
import { methodsFor } from "../../../../../sim/90-actions/purchase";
import "./pay-methods.css";

export const ALL_METHODS: Method[] = ["cash", "transfer", "onAccount", "card", "debit"];

export interface PayOption { method: Method; label: string; off: string | null }
export interface Offer { supplier: SupplierId; lines: LedgerEntry[]; name?: string }
// One row of the radio list: a method, or an extra offer such as a lease, by id.
export interface PayRow { id: string; label: ReactNode; detail?: ReactNode; off: string | null }

// Why a method is not offered; the sim's methodsFor decides, this only words it.
function reason(s: GameState, m: Method): string {
  if (m === "cash") return t("payE.off.noCash");
  if (m === "transfer") return t("purchase.off.noBank");
  if (m === "card") return t(cardReady(s) ? "purchase.off.cardLimit" : "purchase.off.noCard");
  if (m === "debit") return t("purchase.off.noMandate");
  return t("purchase.off.noInvoice");
}

// Every method with its label; off is the outcome text of an unavailable one. Before a bank account exists, cash is the only
// one, and it is off while the cash is short of the total.
export function payOptions(s: GameState, o: Offer): PayOption[] {
  const short = s.cash < -o.lines.reduce((n, l) => n + l.amount, 0);
  const on = methodsFor(s, o.supplier, o.lines, o.name).filter((m) => m !== "cash" || !short);
  return ALL_METHODS.filter((m) => (m === "cash") === !s.bank)
    .map((method) => ({ method, label: t(`purchase.method.${method}`), off: on.includes(method) ? null : reason(s, method) }));
}

// The payment rows of an order as one radio group.
export function PayMethods({ rows, value, onChange }: { rows: PayRow[]; value: string | null; onChange: (id: string) => void }) {
  const group = useId();
  return (
    <fieldset className="pay-methods">
      <legend>{t("checkout.paymentMethod")}</legend>
      {rows.map((r) => (
        <label key={r.id} className={r.off ? "off" : undefined}>
          <input type="radio" name={group} checked={value === r.id} disabled={!!r.off} onChange={() => onChange(r.id)} />
          <span>{r.label}</span>{r.off ? <small>{r.off}</small> : r.detail && <small>{r.detail}</small>}
        </label>
      ))}
    </fieldset>
  );
}
