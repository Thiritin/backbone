import { t } from "../../../../../i18n/en";
import type { GameState } from "../../../../../sim/50-state";
import { useStore } from "../../../../store";

// Opens a payable's document (invoice, receipt, credit note or order confirmation) in Preview.
export const openPayable = (id: string) => useStore.getState().openApp("Preview", { kind: "payable", id });

// The outcome of an order: "Ordered" or "Paid" by the payable's state, and a button that opens its document.
export function OrderDone({ game, payable }: { game: GameState; payable: string }) {
  const p = game.payables.find((x) => x.id === payable);
  if (!p) return null;
  return (
    <span className="order-done">
      {t(p.paidAt !== null ? "purchase.done.paid" : "purchase.done.ordered")}{" "}
      <button type="button" className="btn sm" onClick={() => openPayable(p.id)}>{t(`purchase.doc.${p.doc ?? "invoice"}`)}</button>
    </span>
  );
}
