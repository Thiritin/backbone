import { t } from "../../i18n/en";
import { TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
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
