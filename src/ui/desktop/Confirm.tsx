import { t } from "../../i18n/en";
import { TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { create } from "zustand";
import { createPortal } from "react-dom";
import { uiSound } from "../store";

interface Props { title: string; text: string; action: string; onCancel: () => void; onConfirm: () => void }

export function Confirm({ title, text, action, onCancel, onConfirm }: Props) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancel.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onCancel]);

  return createPortal(
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="alert" role="alertdialog" aria-modal="true" aria-labelledby="alert-title" aria-describedby="alert-text">
        <span className="alert-icon"><TriangleAlert /></span>
        <h2 id="alert-title">{title}</h2>
        <p id="alert-text">{text}</p>
        <div className="alert-actions">
          <button ref={cancel} className="btn" onClick={onCancel}>{t("desktop.cancel")}</button>
          <button className="btn danger-fill" onClick={() => { uiSound("trash"); onConfirm(); }}>{action}</button>
        </div>
      </div>
    </div>,
    document.querySelector(".desktop")!,
  );
}

// A confirmation asked from outside a component, such as a context menu entry; ConfirmHost on the desktop shows it.
export interface Ask { title: string; text: string; action: string; run: () => void }
export const useAsk = create<{ ask: Ask | null }>(() => ({ ask: null }));
export const ask = (a: Ask) => useAsk.setState({ ask: a });

export function ConfirmHost() {
  const a = useAsk((s) => s.ask), close = useCallback(() => useAsk.setState({ ask: null }), []);
  return a && <Confirm title={a.title} text={a.text} action={a.action} onCancel={close} onConfirm={() => { close(); a.run(); }} />;
}
