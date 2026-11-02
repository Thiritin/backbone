import { t } from "../../i18n/en";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { appFor, appTitle } from "../apps/registry";
import { useStore, type Win } from "../store";
import { rememberSlot } from "./motion";

type Shown = { order: Win[]; at: number } | null;

const stacked = (ws: Win[]) => [...ws].sort((a, b) => Number(a.minimized) - Number(b.minimized) || b.z - a.z);

function raise(w: Win) {
  const { openApp, openDoc, openConsole } = useStore.getState();
  if (w.minimized) rememberSlot(w.id);
  if (w.doc) openDoc(w.doc);
  else if (w.console) openConsole(w.console);
  else openApp(w.app);
}

// Cmd+Tab or Alt+Tab cycles the open windows while held, and releasing Cmd or Alt raises the picked one.
export function Switcher() {
  const [shown, setShown] = useState<Shown>(null);
  const live = useRef<Shown>(null);

  useEffect(() => {
    const show = (s: Shown) => { live.current = s; setShown(s); };
    const down = (e: KeyboardEvent) => {
      const cur = live.current;
      if (e.key === "Tab" && (e.metaKey || e.altKey)) {
        const order = cur?.order ?? stacked(useStore.getState().windows);
        if (!order.length) return;
        e.preventDefault();
        e.stopPropagation();
        show({ order, at: ((cur?.at ?? 0) + (e.shiftKey ? -1 : 1) + order.length) % order.length });
      } else if (e.key === "Escape" && cur) {
        e.preventDefault();
        e.stopPropagation();
        show(null);
      }
    };
    const up = (e: KeyboardEvent) => {
      const cur = live.current;
      if (!cur || e.metaKey || e.altKey) return;
      show(null);
      raise(cur.order[cur.at]);
    };
    const cancel = () => show(null);
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", cancel);
    };
  }, []);

  if (!shown) return null;
  const { game } = useStore.getState();
  const label = (w: Win) => (w.doc ? game.docs.find((d) => d.id === w.doc)?.title ?? "" : w.console ? t("desktop.menu.console") : appTitle(appFor(game, w.app)));
  return (
    <div className="switcher" role="listbox" aria-label={t("desktop.switcher")}>
      <div className="switch-row">
        {shown.order.map((w, i) => {
          const app = appFor(game, w.app);
          return (
            <span key={w.id} className="switch-app" role="option" aria-selected={i === shown.at} aria-label={label(w)}>
              <span className="dock-tile" style={{ "--tile": app.tile } as CSSProperties}><app.icon /></span>
            </span>
          );
        })}
      </div>
      <strong>{label(shown.order[shown.at])}</strong>
    </div>
  );
}
