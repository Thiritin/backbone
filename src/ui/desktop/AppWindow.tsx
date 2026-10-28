import { useLayoutEffect, useRef } from "react";
import type { CSSProperties, PointerEvent as RPointerEvent } from "react";
import { appByName } from "../apps/registry";
import { GuideApp } from "../apps/GuideApp";
import { LocationsApp } from "../apps/locations/LocationsApp";
import { SettingsApp } from "../apps/SettingsApp";
import { useStore, type Win } from "../store";
import { animateClose, animateOpen, flip, genie } from "./motion";

const MIN_W = 420, MIN_H = 280, MENUBAR = 30, DOCK = 80;
const EDGES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;

function drag(e: RPointerEvent, onMove: (dx: number, dy: number) => void) {
  const x0 = e.clientX, y0 = e.clientY;
  const move = (ev: PointerEvent) => onMove(ev.clientX - x0, ev.clientY - y0);
  const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function resizeBox(win: Win, edge: string, dx: number, dy: number) {
  let { x, y, w, h } = win;
  if (edge.includes("e")) w = Math.max(MIN_W, win.w + dx);
  if (edge.includes("s")) h = Math.max(MIN_H, win.h + dy);
  if (edge.includes("w")) { w = Math.max(MIN_W, win.w - dx); x = win.x + win.w - w; }
  if (edge.includes("n")) {
    h = Math.max(MIN_H, win.h - dy);
    y = Math.max(MENUBAR, win.y + win.h - h);
    h = win.y + win.h - y;
  }
  return { x, y, w, h };
}

const Glyph = {
  close: <svg viewBox="0 0 12 12"><path d="M3.6 3.6l4.8 4.8M8.4 3.6l-4.8 4.8" /></svg>,
  min: <svg viewBox="0 0 12 12"><path d="M2.8 6h6.4" /></svg>,
  enter: <svg viewBox="0 0 12 12"><path d="M3.5 3.5H7L3.5 7zM8.5 8.5H5L8.5 5z" /></svg>,
  exit: <svg viewBox="0 0 12 12"><path d="M5.5 5.5H2.5l3-3zM6.5 6.5h3l-3 3z" /></svg>,
};

export function AppWindow({ win, front }: { win: Win; front: boolean }) {
  const { focus, close, minimize, toggleZoom, place } = useStore();
  const ref = useRef<HTMLElement>(null);
  const last = useRef<DOMRect | null>(null);
  const was = useRef({ minimized: win.minimized, zoomed: win.zoomed });
  const app = appByName(win.app);

  useLayoutEffect(() => { animateOpen(ref.current!); }, []);

  useLayoutEffect(() => {
    const el = ref.current!;
    if (win.minimized !== was.current.minimized) {
      if (win.minimized) genie(el, win.id, false).then(() => { el.style.visibility = "hidden"; });
      else { el.style.visibility = ""; genie(el, win.id, true); }
    } else if (win.zoomed !== was.current.zoomed && last.current) {
      flip(el, last.current);
    }
    was.current = { minimized: win.minimized, zoomed: win.zoomed };
    last.current = el.getBoundingClientRect();
  });

  const box: CSSProperties = win.zoomed
    ? { left: 0, top: MENUBAR, right: 0, bottom: DOCK, zIndex: win.z }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z };

  return (
    <section ref={ref} className={`window${front ? " front" : ""}`} style={box} aria-label={win.app} inert={win.minimized} onPointerDown={() => focus(win.id)}>
      <div
        className="titlebar"
        onDoubleClick={() => toggleZoom(win.id)}
        onPointerDown={(e) => {
          if (win.zoomed) return;
          drag(e, (dx, dy) => place(win.id, { x: Math.max(-win.w + 120, win.x + dx), y: Math.max(MENUBAR, win.y + dy) }));
        }}
      >
        <div className="lights" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          <button aria-label="Close" onClick={() => animateClose(ref.current!).then(() => close(win.id))}>{Glyph.close}</button>
          <button aria-label="Minimize" onClick={() => minimize(win.id)}>{Glyph.min}</button>
          <button aria-label="Zoom" onClick={() => toggleZoom(win.id)}>{win.zoomed ? Glyph.exit : Glyph.enter}</button>
        </div>
        <h1>{win.app}</h1>
      </div>
      <div className="win-body">
        {win.app === "Settings" ? <SettingsApp /> : win.app === "Getting started" ? <GuideApp /> : win.app === "Locations" ? <LocationsApp /> : (
          <div className="app-empty">
            <span className="app-empty-tile" style={{ "--tile": app.tile } as CSSProperties}><app.icon /></span>
            <h2>{win.app}</h2>
            <p>{app.about}</p>
          </div>
        )}
      </div>
      {!win.zoomed && EDGES.map((edge) => (
        <span
          key={edge}
          className={`rz rz-${edge}`}
          aria-hidden="true"
          onPointerDown={(e) => {
            e.stopPropagation();
            focus(win.id);
            drag(e, (dx, dy) => place(win.id, resizeBox(win, edge, dx, dy)));
          }}
        />
      ))}
    </section>
  );
}
