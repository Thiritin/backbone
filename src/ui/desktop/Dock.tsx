import { Fragment } from "react";
import type { CSSProperties } from "react";
import { APPS, appFor } from "../apps/registry";
import { useStore } from "../store";
import { bounce, rememberSlot } from "./motion";

export function Dock() {
  const { windows, openApp, openDoc, game } = useStore();
  const minimized = windows.filter((w) => w.minimized);
  const badges = game.installed.includes("dockBadges");

  return (
    <nav className="dock" aria-label="Apps">
      {APPS.filter((a) => !a.hidden && game.installed.includes(a.name)).map((a, i) => {
        const win = windows.find((w) => w.app === a.name);
        const badge = (badges && a.badge?.(game)) || 0;
        const shown = appFor(game, a.name);
        return (
          <Fragment key={a.name}>
            {i > 0 && i % 4 === 0 && <span className="dock-divider" />}
            <button
              className={`dock-app${win ? " running" : ""}`}
              aria-label={badge ? `${shown.name}, ${badge} open` : shown.name}
              onClick={(e) => {
                if (!win) bounce(e.currentTarget.querySelector(".dock-tile")!);
                if (win?.minimized) rememberSlot(win.id);
                openApp(a.name);
              }}
            >
              <span className="tip">{shown.name}</span>
              <span className="dock-tile" style={{ "--tile": shown.tile } as CSSProperties}><shown.icon /></span>
              <span className="dot" />
              {badge > 0 && <span className="count">{badge > 99 ? "99+" : badge}</span>}
            </button>
          </Fragment>
        );
      })}
      {minimized.length > 0 && <span className="dock-divider" />}
      {minimized.map((w) => {
        const app = appFor(game, w.app);
        return (
          <button key={w.id} className="dock-app" aria-label={`Restore ${app.name}`} onClick={() => { rememberSlot(w.id); if (w.doc) openDoc(w.doc); else openApp(w.app); }}>
            <span className="tip">{app.name}</span>
            <span className="dock-mini" data-min={w.id}>
              <span className="mini-win" />
              <span className="mini-badge" style={{ "--tile": app.tile } as CSSProperties}><app.icon /></span>
            </span>
            <span className="dot" />
          </button>
        );
      })}
    </nav>
  );
}
