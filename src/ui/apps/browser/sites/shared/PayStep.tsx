import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { euroPrice } from "../../../../../sim/00-core/money";
import type { Method, SupplierId } from "../../../../../sim/46-finance/payables";
import type { GameState, LedgerEntry } from "../../../../../sim/50-state";
import type { ActionResult } from "../../../../../sim/90-actions/hardware";
import { OrderDone, startMethod, track } from "./OrderDone";
import { PayMethods, payOptions, type PayRow } from "./PayMethods";
import "./pay-step.css";

// A purchase waiting for its payment method: run places it with the chosen one. extra rows (lease offers) follow the
// methods in the same list and place the order through runExtra. A cardOnly purchase takes the card or an extra row.
export interface Purchase {
  supplier: SupplierId; name: string; amount: number; run: (m: Method) => ActionResult;
  cardOnly?: boolean; extra?: PayRow[]; runExtra?: (id: string) => ActionResult;
}

export const orderLines = (s: GameState, amount: number): LedgerEntry[] => [{ hour: s.hour, category: "", key: "", params: {}, amount: -amount }];

// The method rows of a purchase followed by its extra rows.
export function payRows(s: GameState, buy: Purchase): PayRow[] {
  const methods = payOptions(s, { supplier: buy.supplier, lines: orderLines(s, buy.amount), name: buy.name })
    .map((o) => ({ id: o.method, label: o.label, off: o.off ?? (buy.cardOnly && o.method !== "card" ? t("payA.off.cardOnly") : null) }));
  return [...methods, ...(buy.extra ?? [])];
}

// The row a purchase starts on: the chosen one while it is offered, else the sim's default method, else the first open row.
export function startRow(s: GameState, buy: Purchase, rows: PayRow[], chosen: string | null): string | null {
  const open = (id: string | null) => !!id && rows.some((r) => r.id === id && !r.off);
  if (open(chosen)) return chosen;
  const d = startMethod(s, { supplier: buy.supplier, lines: orderLines(s, buy.amount), name: buy.name });
  return open(d) ? d : rows.find((r) => !r.off)?.id ?? null;
}

// The payment step of every purchase: the method list, the total, and one confirm button that places the order, then
// the outcome with a link to its document. onDone gets the issued payable and replaces the outcome when given.
export function PayStep({ game, buy, onClose, onDone, onPick }: {
  game: GameState; buy: Purchase; onClose: () => void; onDone?: (payable?: string) => void; onPick?: (id: string) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ payable?: string } | null>(null);
  if (placed) return <div className="pay-step">{placed.payable ? <OrderDone game={game} payable={placed.payable} /> : t("purchase.done.ordered")}</div>;
  const rows = payRows(game, buy), pick = startRow(game, buy, rows, chosen);
  const extra = buy.extra?.some((r) => r.id === pick);
  const place = () => {
    if (!pick) return;
    const r = track(() => (extra ? buy.runExtra!(pick) : buy.run(pick as Method)));
    if (!r.ok) return;
    if (onDone) onDone(r.payable);
    else setPlaced({ payable: r.payable });
  };
  return (
    <div className="pay-step">
      <PayMethods rows={rows} value={pick} onChange={(id) => { setChosen(id); onPick?.(id); }} />
      <p className="pay-step-sum"><span>{t("checkout.total")}</span><strong>{euroPrice(buy.amount)}</strong></p>
      <p className="pay-step-buttons">
        <button type="button" className="btn" onClick={onClose}>{t("desktop.cancel")}</button>
        <button type="button" className="btn primary" disabled={!pick} onClick={place}>{t(pick === "cash" ? "payD.pay" : "checkout.placeOrder")}</button>
      </p>
    </div>
  );
}
