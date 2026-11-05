import { useState, type ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import type { Method, Payable, SupplierId } from "../../../../../sim/46-finance/payables";
import type { GameState, LedgerEntry } from "../../../../../sim/50-state";
import type { ActionResult } from "../../../../../sim/90-actions/hardware";
import { defaultMethod, methodsFor } from "../../../../../sim/90-actions/purchase";
import { useStore } from "../../../../store";
import { PayMethods, type Offer } from "./PayMethods";
import "./pay-button.css";

// The method an order form starts on: the sim's default when it is offered, else the first offered one.
export function startMethod(s: GameState, o: Offer): Method | null {
  const on = methodsFor(s, o.supplier, o.lines, o.name), d = defaultMethod(s, o.name ?? "", o.lines);
  return on.includes(d) ? d : on[0] ?? null;
}

// The document an action just issued: the newest payable that was not there before it ran.
export const freshDoc = (before: GameState): Payable | undefined =>
  useStore.getState().game.payables.filter((p) => !before.payables.some((b) => b.id === p.id)).at(-1);

export const feeLine = (s: GameState, amount: number): LedgerEntry[] => [{ hour: s.hour, category: "licenses", key: "", params: {}, amount: -amount }];

// The outcome of an order with a link to its document.
export function OrderDone({ doc, btn }: { doc: Payable; btn: string }) {
  const openApp = useStore((s) => s.openApp);
  return (
    <span className="pay-done" role="status">
      <span>{t(doc.paidAt !== null ? "payA.paid" : "payA.ordered")}</span>
      <button type="button" className={btn} onClick={() => openApp("Preview", { kind: "payable", id: doc.id })}>{t(`purchase.doc.${doc.doc ?? "invoice"}`)}</button>
    </span>
  );
}

// A buy button that asks for the payment method first; a free purchase runs at once. run gets the chosen method.
export function PayButton({ className, children, supplier, name, amount, run, disabled }: {
  className: string; children: ReactNode; supplier: SupplierId; name: string; amount: number; run: (m?: Method) => ActionResult; disabled?: boolean;
}) {
  const game = useStore((s) => s.game);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<Method | null>(null);
  const [doc, setDoc] = useState<Payable | null>(null);
  const lines = feeLine(game, amount);
  if (doc) return <OrderDone doc={doc} btn={className} />;
  if (!open) return <button type="button" className={className} disabled={disabled} onClick={() => (amount > 0 ? setOpen(true) : run())}>{children}</button>;
  const method = pick ?? startMethod(game, { supplier, lines, name });
  const pay = () => {
    const before = useStore.getState().game, r = run(method ?? undefined);
    if (!r.ok) return;
    setOpen(false);
    const d = freshDoc(before);
    if (d) setDoc(d);
  };
  return (
    <span className="pay-sheet">
      <PayMethods game={game} supplier={supplier} lines={lines} name={name} value={method} onChange={setPick} />
      <button type="button" className={className} onClick={() => setOpen(false)}>{t("payA.cancel")}</button>
      <button type="button" className={className} disabled={!method} onClick={pay}>{children}</button>
    </span>
  );
}
