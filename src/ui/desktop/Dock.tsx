import { Fragment } from "react";
import type { CSSProperties } from "react";
import { APPS } from "../apps/registry";
import { useStore } from "../store";

export function Dock() {
  const { windows, openApp } = useStore();
  return (
    <nav className="dock" aria-label="Apps">
      {APPS.map((a, i) => (
        <Fragment key={a.name}>
          {(i === 4 || i === 8) && <span className="dock-divider" />}
          <button className={`dock-app${windows.some((w) => w.app === a.name) ? " running" : ""}`} onClick={() => openApp(a.name)} aria-label={a.name}>
            <span className="tip">{a.name}</span>
            <span className="dock-tile" style={{ "--tile": a.tile } as CSSProperties}><a.icon /></span>
            <span className="dot" />
          </button>
        </Fragment>
      ))}
    </nav>
  );
}
