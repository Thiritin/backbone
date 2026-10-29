import { useEffect } from "react";
import { createPortal } from "react-dom";
import { appInSentence } from "../apps/registry";
import type { ChangelogDay } from "../changelog";
import { useStore } from "../store";
import { ChangeList } from "./ChangeList";
import { PearMark } from "./Intro";

// The Pear OS update sheet: what changed since the save last saw the game, or the whole changelog from the logo menu.
export function WhatsNew({ changes }: { changes: ChangelogDay[] }) {
  const { game, openApp, closeNews } = useStore();

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && closeNews();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [closeNews]);

  return createPortal(
    <div className="alert-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="alert welcome whats-new" role="dialog" aria-modal="true" aria-labelledby="news-title">
        <PearMark />
        <h2 id="news-title">Pear OS update</h2>
        <ChangeList changes={changes} appOf={(text) => appInSentence(game, text)} onOpen={(app) => { openApp(app); closeNews(); }} />
        <div className="alert-actions">
          <button className="btn primary" autoFocus onClick={closeNews}>Done</button>
        </div>
      </div>
    </div>,
    document.querySelector(".desktop")!,
  );
}
