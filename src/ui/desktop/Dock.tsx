import { Fragment } from "react";
import type { CSSProperties } from "react";
import { APPS, appByName } from "../apps/registry";
import { useStore } from "../store";
import { bounce, rememberSlot } from "./motion";

export function Dock() {
  const { windows, openApp, game } = useStore();
  const minimized = windows.filter((w) => w.minimized);

  return (
    <nav className="dock" aria-label="Apps">
      {APPS.filter((a) => !a.hidden).map((a, i) => {
        const win = windows.find((w) => w.app === a.name);
        const badge = a.badge?.(game) ?? 0;
        return (
          <Fragment key={a.name}>
            {i > 0 && i % 4 === 0 && <span className="dock-divider" />}
            <button
              className={`dock-app${win ? " running" : ""}`}
              aria-label={badge ? `${a.name}, ${badge} open` : a.name}
              onClick={(e) => {
                if (!win) bounce(e.currentTarget.querySelector(".dock-tile")!);
                if (win?.minimized) rememberSlot(win.id);
                openApp(a.name);
              }}
            >
              <span className="tip">{a.name}</span>
              <span className="dock-tile" style={{ "--tile": a.tile } as CSSProperties}><a.icon /></span>
              <span className="dot" />
              {badge > 0 && <span className="count">{badge > 99 ? "99+" : badge}</span>}
            </button>
          </Fragment>
        );
      })}
      {minimized.length > 0 && <span className="dock-divider" />}
      {minimized.map((w) => {
        const app = appByName(w.app);
        return (
          <button key={w.id} className="dock-app" aria-label={`Restore ${w.app}`} onClick={() => { rememberSlot(w.id); openApp(w.app); }}>
            <span className="tip">{w.app}</span>
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
