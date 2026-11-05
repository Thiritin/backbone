import { t } from "../../../../../i18n/en";
import type { Method } from "../../../../../sim/46-finance/payables";
import type { GameState } from "../../../../../sim/50-state";
import type { ActionResult } from "../../../../../sim/90-actions/hardware";
import { defaultMethod, methodsFor } from "../../../../../sim/90-actions/purchase";
import { useStore } from "../../../../store";
import type { Offer } from "./PayMethods";
import "./order-done.css";

// Opens a payable's document (invoice, receipt, credit note or order confirmation) in Preview.
export const openPayable = (id: string) => useStore.getState().openApp("Preview", { kind: "payable", id });

// The outcome of an order: "Ordered" or "Paid" by the payable's state, and a button that opens its document.
export function OrderDone({ payable, btn = "btn sm" }: { payable: string; btn?: string }) {
  const p = useStore((s) => s.game.payables.find((x) => x.id === payable));
  if (!p) return null;
  return (
    <span className="order-done" role="status">
      {t(p.paidAt !== null && p.doc !== "contract" ? "purchase.done.paid" : "purchase.done.ordered")}{" "}
      <DocButton payable={payable} btn={btn} />
    </span>
  );
}

// The button that opens a payable's document, named by the document's kind.
export function DocButton({ payable, btn = "btn sm" }: { payable?: string; btn?: string }) {
  const p = useStore((s) => s.game.payables.find((x) => x.id === payable));
  if (!p) return null;
  return <button type="button" className={btn} onClick={() => openPayable(p.id)}>{t(`purchase.doc.${p.doc ?? "invoice"}`)}</button>;
}

// The chosen method while methodsFor still offers it, else the supplier's default, else the first one offered.
export function startMethod(s: GameState, o: Offer, chosen: Method | null = null): Method | null {
  const on = methodsFor(s, o.supplier, o.lines, o.name);
  if (chosen && on.includes(chosen)) return chosen;
  const d = defaultMethod(s, o.name ?? "", o.lines);
  return on.includes(d) ? d : on[0] ?? null;
}

// Runs an order and returns its result with the payable it issued: the newest one that was not in the books before.
export function track(run: () => ActionResult): ActionResult & { payable?: string } {
  const before = new Set(useStore.getState().game.payables.map((p) => p.id)), r = run();
  return r.ok ? { ...r, payable: useStore.getState().game.payables.filter((p) => !before.has(p.id)).at(-1)?.id } : r;
}
