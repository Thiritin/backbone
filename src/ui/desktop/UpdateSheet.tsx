import { t } from "../../i18n/en";
import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ChangelogDay } from "../changelog";
import { ChangeList } from "./ChangeList";

interface Props { changes: ChangelogDay[]; onLater: () => void }

const MAX_ITEMS = 12;

// The sheet shown when a newer build is deployed, with what changed since this one; windows and the game survive the reload.
export function UpdateSheet({ changes, onLater }: Props) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onLater();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onLater]);

  return createPortal(
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="alert" role="alertdialog" aria-modal="true" aria-labelledby="update-title" aria-describedby="update-text">
        <span className="alert-icon"><RefreshCw /></span>
        <h2 id="update-title">{t("desktop.update.title")}</h2>
        <p id="update-text">{t("desktop.update.text")}</p>
        <ChangeList changes={changes} max={MAX_ITEMS} />
        <div className="alert-actions">
          <button className="btn" onClick={onLater}>{t("desktop.later")}</button>
          <button className="btn primary" autoFocus onClick={() => window.location.reload()}>{t("desktop.update.reload")}</button>
        </div>
      </div>
    </div>,
    document.querySelector(".desktop")!,
  );
}
