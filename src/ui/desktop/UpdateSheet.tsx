import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ChangelogDay } from "../changelog";

interface Props { changes: ChangelogDay[]; onLater: () => void }

const MAX_ITEMS = 12;

// The sheet shown when a newer build is deployed, with what changed since this one; windows and the game survive the reload.
export function UpdateSheet({ changes, onLater }: Props) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onLater();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onLater]);

  const total = changes.reduce((n, d) => n + d.items.length, 0);
  let left = MAX_ITEMS;
  const shown = changes.map((d) => { const items = d.items.slice(0, Math.max(0, left)); left -= items.length; return { date: d.date, items }; }).filter((d) => d.items.length > 0);

  return createPortal(
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="alert" role="alertdialog" aria-modal="true" aria-labelledby="update-title" aria-describedby="update-text">
        <span className="alert-icon"><RefreshCw /></span>
        <h2 id="update-title">Update available</h2>
        <p id="update-text">A newer version of the game is online. Reload to use it; your game and open windows are kept.</p>
        {shown.length > 0 && (
          <div className="update-changes">
            {shown.map((d) => (
              <section key={d.date}>
                <h3>{d.date}</h3>
                <ul>{d.items.map((i) => <li key={i}>{i}</li>)}</ul>
              </section>
            ))}
            {total > MAX_ITEMS && <p className="update-more">{total - MAX_ITEMS} more changes</p>}
          </div>
        )}
        <div className="alert-actions">
          <button className="btn" onClick={onLater}>Later</button>
          <button className="btn primary" autoFocus onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    </div>,
    document.querySelector(".desktop")!,
  );
}
