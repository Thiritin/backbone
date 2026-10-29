import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { appInSentence } from "../apps/registry";
import type { ChangelogDay } from "../changelog";
import { useStore } from "../store";
import { ChangeList } from "./ChangeList";
import { PearMark } from "./Intro";

// The Pear OS update sheet: what changed since the save last saw the game, or the whole changelog from the logo menu.
export function WhatsNew({ changes }: { changes: ChangelogDay[] }) {
  const { game, openApp, closeNews } = useStore();
  // The desktop is not in the page yet when a save opens the sheet on the first render.
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
        <h2 id="news-title">Pear OS update</h2>
        <ChangeList changes={changes} appOf={(text) => appInSentence(game, text)} onOpen={(app) => { openApp(app); closeNews(); }} />
        <div className="alert-actions">
          <button className="btn primary" autoFocus onClick={closeNews}>Done</button>
        </div>
      </div>
    </div>,
    host,
  );
}
