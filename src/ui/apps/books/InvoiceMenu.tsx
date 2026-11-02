import { useState } from "react";
import { createPortal } from "react-dom";
import { euroCents } from "../../../sim/00-core/money";
import { dueStep, isUnpaid, owed, STEPS, type Invoice } from "../../../sim/45-billing/billing";
import { cancelDraft, markPaid, reopenInvoice, sendInvoice, sendReminder, suspendServices, writeOff } from "../../../sim/90-actions/billing";
import { t } from "../../../i18n/en";
import { Confirm } from "../../desktop/Confirm";
import type { MenuEntry } from "../../desktop/ContextMenu";
import { useStore } from "../../store";
import { openCustomer } from "../customers/open";
import { formatDay } from "../billing/format";
import { useBooks } from "./view";

export const reminder = (step: number) => STEPS[step].key === "collections" ? t("misc1.billing.toCollections") : t("misc1.billing.sendStep", { step: t(`invoice.step.${STEPS[step].key}`) });

export interface Asking { inv: Invoice; what: "writeOff" | "markPaid" }

// Everything a status allows: send or drop a draft, settle, remind, suspend or write off an open one, reopen a closed one.
export function invoiceMenu(inv: Invoice, hour: number, ask: (a: Asking) => void): MenuEntry[] {
  const { act } = useStore.getState();
  const step = dueStep(inv, hour), unpaid = isUnpaid(inv), draft = inv.status === "draft";
  return [
    draft && { label: t("books.sendPdf"), run: () => act(sendInvoice, inv.id) },
    draft && { label: t("books.menu.cancel"), run: () => act(cancelDraft, inv.id) },
    unpaid && { label: t("books.menu.markPaid"), run: () => ask({ inv, what: "markPaid" }) },
    unpaid && step !== null && { label: reminder(step), run: () => act(sendReminder, inv.id) },
    inv.status === "overdue" && { label: inv.suspended ? t("misc1.billing.resume") : t("misc1.billing.suspend"), run: () => act(suspendServices, inv.id, !inv.suspended) },
    unpaid && { label: t("misc1.billing.writeOffMenu"), run: () => ask({ inv, what: "writeOff" }) },
    (inv.status === "paid" || inv.status === "writtenOff") && { label: t("books.menu.reopen"), run: () => act(reopenInvoice, inv.id) },
    null,
    { label: t("misc1.billing.openCustomer"), run: () => openCustomer(inv.customerId) },
  ];
}

export function InvoiceDialog({ asking, onClose }: { asking: Asking; onClose: () => void }) {
  const game = useBooks(), act = useStore((s) => s.act);
  const { inv } = asking;
  const customer = game.customers.find((c) => c.id === inv.customerId)?.name ?? inv.customerId;
  if (asking.what === "writeOff") {
    return (
      <Confirm title={t("misc1.billing.writeOffTitle", { number: inv.number })} text={t("misc1.billing.writeOffText", { customer, amount: euroCents(owed(inv)) })}
        action={t("misc1.billing.writeOff")} onCancel={onClose} onConfirm={() => { act(writeOff, inv.id); onClose(); }} />
    );
  }
  return <MarkPaid inv={inv} onClose={onClose} />;
}

// The transfers still unmatched, newest first, or no money at all.
function MarkPaid({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const game = useBooks(), act = useStore((s) => s.act);
  const [transfer, setTransfer] = useState<string | null>(null);
  const open = game.transfers.filter((x) => x.matchedAt === null && !x.back && !x.covers).reverse();
  const done = () => { act(markPaid, inv.id, transfer); onClose(); };
  return createPortal(
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="alert books-markpaid" role="dialog" aria-modal="true" aria-labelledby="markpaid-title">
        <h2 id="markpaid-title">{t("books.markPaid.title", { number: inv.number, amount: euroCents(owed(inv)) })}</h2>
        <div className="seg books-markpaid-pick" role="group" aria-label={t("books.markPaid.title", { number: inv.number, amount: euroCents(owed(inv)) })}>
          <button aria-pressed={transfer === null} onClick={() => setTransfer(null)}>{t("books.markPaid.privately")}</button>
          {open.map((x) => (
            <button key={x.id} aria-pressed={transfer === x.id} onClick={() => setTransfer(x.id)}>
              <span className="num">{formatDay(x.hour)}</span> {x.from} <span className="num">{euroCents(x.amount)}</span>
            </button>
          ))}
        </div>
        <div className="alert-actions">
          <button className="btn" onClick={onClose}>{t("desktop.cancel")}</button>
          <button className="btn primary" onClick={done}>{t("books.markPaid.action")}</button>
        </div>
      </div>
    </div>,
    document.querySelector(".desktop")!,
  );
}
