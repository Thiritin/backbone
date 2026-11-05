import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { t } from "../../i18n/en";
import { exportSave } from "../export-save";
import { useStore } from "../store";

declare const __BUILD_ID__: string;

// The in-game menu Escape opens. The game stays paused while it is up.
export function PauseMenu() {
  const { pause, setPause, surface, setSurface, toMenu, game } = useStore();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pause) return;
    const before = document.activeElement as HTMLElement | null;
    const buttons = () => [...box.current!.querySelectorAll("button")];
    buttons()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); useStore.getState().setPause(false); return; }
      const move = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : e.key === "Tab" ? (e.shiftKey ? -1 : 1) : 0;
      if (!move) return;
      e.preventDefault();
      const list = buttons(), i = list.indexOf(document.activeElement as HTMLButtonElement);
      list[(i + move + list.length) % list.length]?.focus();
    };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); before?.focus?.(); };
  }, [pause]);
  if (!pause) return null;
  const run = (fn: () => void) => () => { setPause(false); fn(); };
  return createPortal(
    <div className="alert-backdrop pause-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div ref={box} className="pause-menu" role="dialog" aria-modal="true" aria-label={t("desktop.pause.title")}>
        <button className="btn" onClick={() => setPause(false)}>{t("desktop.pause.resume")}</button>
        <button className="btn" onClick={run(toMenu)}>{t("desktop.pause.saveMenu")}</button>
        <button className="btn" onClick={run(() => exportSave(game))}>{t("desktop.menu.export")}</button>
        {surface === "desktop" && <button className="btn" onClick={run(() => setSurface("world"))}>{t("desktop.menu.logout")}</button>}
        <button className="btn" onClick={run(() => window.open(`https://github.com/Thiritin/raid0/issues/new?body=${encodeURIComponent(`\n\nBuild: ${__BUILD_ID__}`)}`, "_blank", "noopener"))}>{t("desktop.menu.report")}</button>
      </div>
    </div>,
    document.body,
  );
}
