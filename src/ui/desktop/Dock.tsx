import { t } from "../../i18n/en";
import { Fragment, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import { APPS, appFor, appTitle, listed } from "../apps/registry";
import { appMenu, APP, dragApp, dropTarget, trashApp } from "../apps/ApplicationsApp";
import { uiSound, useStore } from "../store";
import { unreadBadge } from "../../sim/43-pear-mail/view";
import { deskUrl } from "../apps/browser/sites/desk/DeskSite";
import { deskStatus } from "../../sim/40-support/desk";
import { menuOn } from "./ContextMenu";
import { bounce, rememberSlot } from "./motion";

export function Dock() {
  const { windows, openApp, openDoc, game } = useStore();
  const minimized = windows.filter((w) => w.minimized);
  const [over, setOver] = useState(false);
  const deskDown = !!deskUrl(game) && deskStatus(game) === "down";
  // New mail bounces the Pear Mail tile and plays the new mail sound, with its window open or closed.
  const mail = game.installed.includes("Pear Mail") ? unreadBadge(game) : 0, seen = useRef(mail);
  useEffect(() => {
    if (mail > seen.current) {
      const tile = document.querySelector('.dock-app[data-app="Pear Mail"] .dock-tile');
      if (tile) bounce(tile);
      uiSound("post");
    }
    seen.current = mail;
  }, [mail]);

  return (
    <nav className="dock" aria-label={t("desktop.dock.apps")}>
      {APPS.filter((a) => listed(game, a) && (!game.undocked.includes(a.name) || windows.some((w) => w.app === a.name))).map((a, i) => {
        const win = windows.find((w) => w.app === a.name);
        const badge = a.badge?.(game) ?? 0;
        const shown = appFor(game, a.name);
        return (
          <Fragment key={a.name}>
            {i > 0 && i % 4 === 0 && <span className="dock-divider" />}
            <button
              className={`dock-app${win ? " running" : ""}`}
              data-app={a.name}
              aria-label={badge ? t("desktop.dock.open", { name: appTitle(shown), n: badge }) : appTitle(shown)}
              onClick={(e) => {
                if (!win) bounce(e.currentTarget.querySelector(".dock-tile")!);
                if (win?.minimized) rememberSlot(win.id);
                openApp(a.name);
              }}
              onContextMenu={menuOn(() => appMenu(a.name))}
              draggable={!!dragApp(a.name)}
              onDragStart={dragApp(a.name)}
            >
              <span className="tip">{appTitle(shown)}</span>
              <span className="dock-tile" style={{ "--tile": shown.tile } as CSSProperties}><shown.icon /></span>
              <span className="dot" />
              {a.name === "Support" && deskDown && <span className="warn" />}
              {a.dot?.(game) && <span className="notice" />}
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
      <span className="dock-divider" />
      <button className={`dock-app${over ? " drop" : ""}`} aria-label={t("apps.finder.trash")} onClick={() => openApp("Applications", { kind: "folder", id: "trash" })} {...dropTarget(APP, trashApp, setOver)}>
        <span className="tip">{t("apps.finder.trash")}</span>
        <span className="dock-tile dock-trash"><Trash2 /></span>
        <span className="dot" />
      </button>
    </nav>
  );
}
