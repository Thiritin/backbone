import { t } from "../../i18n/en";
import { Fragment } from "react";
import type { CSSProperties } from "react";
import { APPS, appFor, appTitle } from "../apps/registry";
import { appMenu } from "../apps/ApplicationsApp";
import { useStore } from "../store";
import { menuOn } from "./ContextMenu";
import { bounce, rememberSlot } from "./motion";

export function Dock() {
  const { windows, openApp, openDoc, game } = useStore();
  const minimized = windows.filter((w) => w.minimized);

  return (
    <nav className="dock" aria-label={t("desktop.dock.apps")}>
      {APPS.filter((a) => !a.hidden && game.installed.includes(a.name) && (!game.undocked.includes(a.name) || windows.some((w) => w.app === a.name))).map((a, i) => {
        const win = windows.find((w) => w.app === a.name);
        const badge = a.badge?.(game) ?? 0;
        const shown = appFor(game, a.name);
        return (
          <Fragment key={a.name}>
            {i > 0 && i % 4 === 0 && <span className="dock-divider" />}
            <button
              className={`dock-app${win ? " running" : ""}`}
              aria-label={badge ? t("desktop.dock.open", { name: appTitle(shown), n: badge }) : appTitle(shown)}
              onClick={(e) => {
                if (!win) bounce(e.currentTarget.querySelector(".dock-tile")!);
                if (win?.minimized) rememberSlot(win.id);
                openApp(a.name);
              }}
              onContextMenu={menuOn(() => appMenu(a.name))}
            >
              <span className="tip">{appTitle(shown)}</span>
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
          <button key={w.id} className="dock-app" aria-label={t("desktop.dock.restore", { name: appTitle(app) })} onClick={() => { rememberSlot(w.id); if (w.doc) openDoc(w.doc); else openApp(w.app); }}>
            <span className="tip">{appTitle(app)}</span>
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
