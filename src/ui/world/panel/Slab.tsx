import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { t } from "../../../i18n/en";
import { reduced } from "../../desktop/motion";
import "../rack/rack.css";

export const SLIDE_MS = 180;

// The centred popup every object in the room opens, filling the room or sized to its content. Escape goes to onBack first when it returns true, then closes.
export function Slab({ title, head, onClose, onBack, size = "full", className = "", data, children }: {
  title: string; head?: ReactNode; onClose: () => void; onBack?: () => boolean; size?: "full" | "content"; className?: string; data?: Record<string, string>; children: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null), closing = useRef(false);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    setShown(false);
    setTimeout(onClose, reduced() ? 0 : SLIDE_MS);
  };
  const live = useRef({ close, onBack });
  live.current = { close, onBack };
  useEffect(() => { const id = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(id); }, []);
  useEffect(() => {
    // Escape belongs to whatever sits above the panel first.
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || (e.target as HTMLElement).closest?.("input, textarea, select")) return;
      if ([...document.querySelectorAll("[role=dialog], [role=alertdialog], [role=menu]")].some((el) => el !== ref.current && !ref.current?.contains(el))) return;
      if (!live.current.onBack?.()) live.current.close();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const attrs = Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [`data-${k}`, v]));
  return (
    <>
      <div className={`wr-veil${shown ? " in" : ""}`} onPointerDown={close} />
      <div ref={ref} className={`wr-panel${size === "content" ? " wr-fit" : ""} ${className}${shown ? " in" : ""}`} role="dialog" aria-label={title} {...attrs}>
        <div className="wr-head">
          <h2>{title}</h2>
          {head}
          <button className="wr-x" aria-label={t("locations-2.close")} onClick={close}><X /></button>
        </div>
        {children}
      </div>
    </>
  );
}
