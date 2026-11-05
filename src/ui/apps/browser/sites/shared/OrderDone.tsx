import { useState } from "react";
import { t } from "../../../../../i18n/en";
import type { Method, SupplierId } from "../../../../../sim/46-finance/payables";
import type { GameState, LedgerEntry } from "../../../../../sim/50-state";
import type { ActionResult } from "../../../../../sim/90-actions/hardware";
import { defaultMethod, methodsFor } from "../../../../../sim/90-actions/purchase";
import { useStore } from "../../../../store";
import { PayMethods, type Offer } from "./PayMethods";
import "./order-done.css";

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

// The chosen method while methodsFor still offers it, else the supplier's default, else the first one offered.
export function pickMethod(s: GameState, o: Offer, chosen: Method | null): Method {
  const on = methodsFor(s, o.supplier, o.lines, o.name);
  if (chosen && on.includes(chosen)) return chosen;
  const d = defaultMethod(s, o.name ?? "", o.lines);
  return on.includes(d) ? d : on[0];
}

// Runs an order and returns its result with the payable it issued, the last one added to the books.
export function track(run: () => ActionResult): ActionResult & { payable?: string } {
  const n = useStore.getState().game.payables.length, r = run();
  return r.ok ? { ...r, payable: useStore.getState().game.payables[n]?.id } : r;
}

// Payment for one order of `amount` from a supplier: the method picker, the method to pass to the action, and the payable
// the last placed order issued.
export function useOrder(game: GameState, supplier: SupplierId, name: string, amount: number) {
  const [chosen, setChosen] = useState<Method | null>(null);
  const [payable, setPayable] = useState<string | null>(null);
  const lines: LedgerEntry[] = [{ hour: game.hour, category: "", key: "", params: {}, amount: -amount }];
  const method = pickMethod(game, { supplier, lines, name }, chosen);
  return {
    method, payable,
    picker: <PayMethods game={game} supplier={supplier} lines={lines} name={name} value={method} onChange={setChosen} />,
    done: payable && <OrderDone game={game} payable={payable} />,
    place: (run: () => ActionResult) => { const r = track(run); if (r.ok && r.payable) setPayable(r.payable); return r; },
  };
}
