import { useState } from "react";
import { t } from "../../../../../i18n/en";
import type { Method, SupplierId } from "../../../../../sim/46-finance/payables";
import type { GameState } from "../../../../../sim/50-state";
import type { ActionResult } from "../../../../../sim/90-actions/hardware";
import { useOrder } from "./OrderDone";

// A purchase waiting for its payment method: run places it with the chosen one.
export interface Purchase { supplier: SupplierId; name: string; amount: number; run: (m: Method) => ActionResult }

// The step between a buy button and the order: the method picker, then the outcome with its document. An order billed
// later, such as a provider cable, has no document yet.
export function PayStep({ game, buy, onClose }: { game: GameState; buy: Purchase; onClose: () => void }) {
  const o = useOrder(game, buy.supplier, buy.name, buy.amount);
  const [placed, setPlaced] = useState(false);
  if (placed) return <div className="pay-step">{o.done || t("purchase.done.ordered")}</div>;
  return (
    <div className="pay-step">
      {o.picker}
      <p className="pay-step-buttons">
        <button type="button" className="btn" onClick={onClose}>{t("desktop.cancel")}</button>
        <button type="button" className="btn primary" onClick={() => o.place(() => buy.run(o.method)).ok && setPlaced(true)}>{t("checkout.placeOrder")}</button>
      </p>
    </div>
  );
}
