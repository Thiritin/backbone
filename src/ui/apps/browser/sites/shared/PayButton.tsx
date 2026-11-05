import { useState, type ReactNode } from "react";
import type { Method, SupplierId } from "../../../../../sim/46-finance/payables";
import type { ActionResult } from "../../../../../sim/90-actions/hardware";
import { useStore } from "../../../../store";
import { PayStep } from "./PayStep";

// A buy button that opens the payment step below it; a free purchase runs at once.
export function PayButton({ className, children, supplier, name, amount, run, disabled, onDone }: {
  className: string; children: ReactNode; supplier: SupplierId; name: string; amount: number; run: (m?: Method) => ActionResult;
  disabled?: boolean; onDone?: (payable?: string) => void;
}) {
  const game = useStore((s) => s.game);
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className={className} disabled={disabled} onClick={() => (amount > 0 ? setOpen(true) : run())}>{children}</button>;
  return <PayStep game={game} buy={{ supplier, name, amount, run }} onClose={() => setOpen(false)} onDone={onDone} />;
}
