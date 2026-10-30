import type { CSSProperties } from "react";
import { addAppLink, setDocked } from "../../sim/90-actions/docs";
import { menuOn } from "../desktop/ContextMenu";
import { useStore } from "../store";
import { APPS, appFor } from "./registry";

export function appMenu(app: string) {
  const { game, act, openApp } = useStore.getState();
  const docked = !game.undocked.includes(app);
  return [
    { label: "Open", run: () => openApp(app) },
    null,
    { label: docked ? "Remove from Dock" : "Keep in Dock", run: () => act(setDocked, app, !docked) },
    { label: "Add to Desktop", run: () => act(addAppLink, app) },
  ];
}

export function ApplicationsApp() {
  const game = useStore((s) => s.game), openApp = useStore((s) => s.openApp);
  return (
    <div className="app-grid">
      {APPS.filter((a) => !a.hidden && game.installed.includes(a.name)).map((a) => {
        const shown = appFor(game, a.name);
        return (
          <button key={a.name} className="app-grid-item" onDoubleClick={() => openApp(a.name)} onKeyDown={(e) => e.key === "Enter" && openApp(a.name)} onContextMenu={menuOn(() => appMenu(a.name))}>
            <span className="dock-tile" style={{ "--tile": shown.tile } as CSSProperties}><shown.icon /></span>
            <span>{shown.name}</span>
          </button>
        );
      })}
    </div>
  );
}
