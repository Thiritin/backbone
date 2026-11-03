import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { t } from "../../../i18n/en";
import { atDesk } from "../../../sim/40-support/letters";
import { scanLetter } from "../../../sim/90-actions/post";
import { reduced } from "../../desktop/motion";
import { paperDay } from "../../apps/FormDoc";
import { useStore } from "../../store";
import { SLIDE_MS } from "../rack/RackPanel";
import "../rack/rack.css";
import "./scan.css";

// The scanner beside the desk: the fetched letters not yet in DocuWhere, one click files one.
export function ScanPanel({ onClose }: { onClose: () => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null), closing = useRef(false);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    setShown(false);
    setTimeout(onClose, reduced() ? 0 : SLIDE_MS);
  };
  const live = useRef(close);
  live.current = close;
  useEffect(() => { const id = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(id); }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if ([...document.querySelectorAll("[role=dialog], [role=alertdialog], [role=menu]")].some((el) => el !== ref.current && !ref.current?.contains(el))) return;
      live.current();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const letters = atDesk(game).filter((l) => !l.scanned).reverse();
  const scan = (id: string) => {
    const r = act(scanLetter, id);
    setDone(r.ok ? t("world.scan.done") : t(r.error));
  };
  return (
    <>
      <div className={`wr-veil${shown ? " in" : ""}`} onPointerDown={close} />
      <div ref={ref} className={`wr-panel ws-panel${shown ? " in" : ""}`} role="dialog" aria-label={t("world.obj.scanner")} data-scan-panel>
        <div className="wr-head">
          <h2>{t("world.obj.scanner")}</h2>
          {done && <span className="wr-num" role="status">{done}</span>}
          <button className="wr-x" aria-label={t("locations-2.close")} onClick={close}><X /></button>
        </div>
        <div className="ws-list" role="list">
          {letters.map((l) => (
            <button key={l.id} role="listitem" className="ws-row" onClick={() => scan(l.id)}>
              <strong>{l.from}</strong>
              <span>{t(`letter.${l.topic}.subject`, l.params)}</span>
              <small>{paperDay(l.at)}</small>
            </button>
          ))}
          {!letters.length && <div className="ws-none">{t("world.scan.none")}</div>}
        </div>
      </div>
    </>
  );
}
