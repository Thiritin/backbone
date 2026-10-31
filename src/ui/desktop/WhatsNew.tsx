import { t } from "../../i18n/en";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ChangelogDay } from "../changelog";
import { useStore } from "../store";
import { ChangeList } from "./ChangeList";
import { PearMark } from "./Intro";

// The whole changelog, opened from the logo menu.
export function WhatsNew({ changes }: { changes: ChangelogDay[] }) {
  const closeNews = useStore((s) => s.closeNews);
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => setHost(document.querySelector(".desktop")), []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && closeNews();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [closeNews]);

  return host && createPortal(
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="alert welcome whats-new" role="dialog" aria-modal="true" aria-labelledby="news-title">
        <PearMark />
        <h2 id="news-title">{t("desktop.news.title")}</h2>
        <ChangeList changes={changes} />
        <div className="alert-actions">
          <button className="btn primary" autoFocus onClick={closeNews}>{t("desktop.done")}</button>
        </div>
      </div>
    </div>,
    host,
  );
}
