import { useEffect, useRef, useState, type ReactNode } from "react";
import { t } from "../../../i18n/en";
import { reduced } from "../../desktop/motion";
import "../rack/rack.css";

export const SLIDE_MS = 180;

// The dimmed room with one object drawn large in the middle. Escape goes to onBack first when it returns true, then closes.
export function Slab({ title, onClose, onBack, className = "", data, children }: {
  title: string; onClose: () => void; onBack?: () => boolean; className?: string; data?: Record<string, string>; children: ReactNode;
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
      <div ref={ref} className={`wr-panel ${className}${shown ? " in" : ""}`} role="dialog" aria-label={title} {...attrs}
        onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
        {children}
        <button className="wr-x" aria-label={t("locations-2.close")} onClick={close}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect className="wr-x-plate" x="1" y="1" width="22" height="22" /><circle className="wr-x-screw" cx="4.5" cy="4.5" r="1.2" /><circle className="wr-x-screw" cx="19.5" cy="19.5" r="1.2" /><path className="wr-x-mark" d="M8 8 16 16 M16 8 8 16" /></svg>
        </button>
      </div>
    </>
  );
}
