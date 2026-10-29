import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { markChangesSeen } from "../../sim/90-actions/changes";
import { changeKeys, type ChangelogDay } from "../changelog";
import { useStore } from "../store";
import { ChangeList } from "./ChangeList";

interface Props { changes: ChangelogDay[]; onLater: () => void }

const MAX_ITEMS = 12;

// The sheet shown when a newer build is deployed, with what changed since this one; windows and the game survive the reload.
export function UpdateSheet({ changes, onLater }: Props) {
  const act = useStore((s) => s.act);
  // The sheet already listed these, so the reloaded build does not show them again as news.
  const reload = () => {
    act(markChangesSeen, changeKeys(changes));
    window.location.reload();
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onLater();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onLater]);

  return createPortal(
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="alert" role="alertdialog" aria-modal="true" aria-labelledby="update-title" aria-describedby="update-text">
        <span className="alert-icon"><RefreshCw /></span>
        <h2 id="update-title">Update available</h2>
        <p id="update-text">A newer version of the game is online. Reload to use it; your game and open windows are kept.</p>
        <ChangeList changes={changes} max={MAX_ITEMS} />
        <div className="alert-actions">
          <button className="btn" onClick={onLater}>Later</button>
          <button className="btn primary" autoFocus onClick={reload}>Reload</button>
        </div>
      </div>
    </div>,
    document.querySelector(".desktop")!,
  );
}
