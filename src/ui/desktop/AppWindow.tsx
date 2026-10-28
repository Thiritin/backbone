import type { CSSProperties, PointerEvent as RPointerEvent } from "react";
import { appByName } from "../apps/registry";
import { useStore, type Win } from "../store";

const MIN_W = 420, MIN_H = 280, MENUBAR = 30;

function drag(e: RPointerEvent, onMove: (dx: number, dy: number) => void) {
  const x0 = e.clientX, y0 = e.clientY;
  const move = (ev: PointerEvent) => onMove(ev.clientX - x0, ev.clientY - y0);
  const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

export function AppWindow({ win, front }: { win: Win; front: boolean }) {
  const { focus, close, minimize, toggleZoom, place } = useStore();
  const app = appByName(win.app);
  const box: CSSProperties = win.zoomed
    ? { left: 8, top: MENUBAR + 8, right: 8, bottom: 96, zIndex: win.z }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z };

  return (
    <section className={`window${front ? " front" : ""}`} style={box} aria-label={win.app} onPointerDown={() => focus(win.id)}>
      <div
        className="titlebar"
        onDoubleClick={() => toggleZoom(win.id)}
        onPointerDown={(e) => {
          if (win.zoomed || (e.target as HTMLElement).closest("button")) return;
          drag(e, (dx, dy) => place(win.id, { x: Math.max(-win.w + 120, win.x + dx), y: Math.max(MENUBAR, win.y + dy) }));
        }}
      >
        <div className="lights">
          <button aria-label="Close" onClick={() => close(win.id)} />
          <button aria-label="Minimize" onClick={() => minimize(win.id)} />
          <button aria-label="Zoom" onClick={() => toggleZoom(win.id)} />
        </div>
        <h1>{win.app}</h1>
      </div>
      <div className="win-body">
        <div className="app-empty">
          <span className="app-empty-tile" style={{ "--tile": app.tile } as CSSProperties}><app.icon /></span>
          <h2>{win.app}</h2>
          <p>{app.about}</p>
        </div>
      </div>
      {!win.zoomed && (
        <span
          className="resize"
          aria-hidden="true"
          onPointerDown={(e) => {
            e.stopPropagation();
            focus(win.id);
            drag(e, (dx, dy) => place(win.id, { w: Math.max(MIN_W, win.w + dx), h: Math.max(MIN_H, win.h + dy) }));
          }}
        />
      )}
    </section>
  );
}
