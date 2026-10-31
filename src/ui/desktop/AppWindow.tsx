import { t } from "../../i18n/en";
import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as RPointerEvent } from "react";
import { appFor, appTitle } from "../apps/registry";
import { GuideApp } from "../apps/GuideApp";
import { NoteApp, NoteTitle } from "../apps/NoteApp";
import { LocationsApp } from "../apps/locations/LocationsApp";
import { ShopApp } from "../apps/shop/ShopApp";
import { SettingsApp } from "../apps/SettingsApp";
import { ConsoleWindow, consoleTitle } from "../apps/console/ConsoleWindow";
import { useStore, WinContext, type Win } from "../store";
import { animateClose, animateOpen, flip, genie, reduced } from "./motion";

const MIN_W = 420, MIN_H = 280, MENUBAR = 30, DOCK = 80;
const EDGES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;

function drag(e: RPointerEvent, onMove: (dx: number, dy: number, ev: PointerEvent) => void, onUp?: () => void) {
  const x0 = e.clientX, y0 = e.clientY;
  const move = (ev: PointerEvent) => onMove(ev.clientX - x0, ev.clientY - y0, ev);
  const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); onUp?.(); };
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

// A window dragged to a screen edge tiles to a half, to a quarter near a corner, or fills the screen at the top.
export type Snap = "l" | "r" | "tl" | "tr" | "bl" | "br" | "max";
const EDGE = 6, CORNER = 90;

export function snapZone(px: number, py: number, vw: number, vh: number): Snap | null {
  const left = px <= EDGE, right = px >= vw - EDGE;
  if (left || right) {
    const v = py < MENUBAR + CORNER ? "t" : py > vh - DOCK - CORNER ? "b" : "";
    return `${v}${left ? "l" : "r"}` as Snap;
  }
  return py <= MENUBAR ? "max" : null;
}

export function snapBox(z: Snap, vw: number, vh: number) {
  const full = vh - MENUBAR - DOCK, half = z.length === 2;
  const w = z === "max" ? vw : Math.round(vw / 2), h = half ? Math.round(full / 2) : full;
  return { x: z.endsWith("r") ? vw - w : 0, y: z.startsWith("b") ? MENUBAR + full - h : MENUBAR, w, h };
}

const Glyph = {
  close: <svg viewBox="0 0 12 12"><path d="M3.6 3.6l4.8 4.8M8.4 3.6l-4.8 4.8" /></svg>,
  min: <svg viewBox="0 0 12 12"><path d="M2.8 6h6.4" /></svg>,
  enter: <svg viewBox="0 0 12 12"><path d="M3.5 3.5H7L3.5 7zM8.5 8.5H5L8.5 5z" /></svg>,
  exit: <svg viewBox="0 0 12 12"><path d="M5.5 5.5H2.5l3-3zM6.5 6.5h3l-3 3z" /></svg>,
};

const INSET = 6;
function snapStyle(z: Snap): CSSProperties {
  const b = snapBox(z, innerWidth, innerHeight);
  return { left: b.x + INSET, top: b.y + INSET, width: b.w - 2 * INSET, height: b.h - 2 * INSET };
}

export function AppWindow({ win, front }: { win: Win; front: boolean }) {
  const { focus, close, minimize, toggleZoom, place } = useStore();
  const ref = useRef<HTMLElement>(null);
  const last = useRef<DOMRect | null>(null);
  const was = useRef({ minimized: win.minimized, zoomed: win.zoomed });
  const snapped = useRef(false), restore = useRef<{ w: number; h: number } | null>(null);
  const [preview, setPreview] = useState<Snap | null>(null);
  const pv = useRef<HTMLDivElement>(null), pvFrom = useRef<DOMRect | null>(null);
  const game = useStore((s) => s.game);
  const app = appFor(game, win.app);
  const title = win.console ? consoleTitle(game, win.console) : appTitle(app);

  useLayoutEffect(() => { animateOpen(ref.current!); }, []);

  useLayoutEffect(() => {
    const el = ref.current!;
    if (win.minimized !== was.current.minimized) {
      if (win.minimized) genie(el, win.id, false).then(() => { el.style.visibility = "hidden"; });
      else { el.style.visibility = ""; genie(el, win.id, true); }
    } else if ((win.zoomed !== was.current.zoomed || snapped.current) && last.current) {
      flip(el, last.current);
    }
    snapped.current = false;
    was.current = { minimized: win.minimized, zoomed: win.zoomed };
    last.current = el.getBoundingClientRect();
  });

  // The preview grows out of the window on the first zone, then glides between zones.
  useLayoutEffect(() => {
    const el = pv.current;
    if (!el) { pvFrom.current = null; return; }
    const from = pvFrom.current ?? ref.current!.getBoundingClientRect(), to = el.getBoundingClientRect();
    const frame = (r: DOMRect, opacity: number) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, opacity });
    if (!reduced()) el.animate([frame(from, pvFrom.current ? 1 : 0), frame(to, 1)], { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    pvFrom.current = to;
  }, [preview]);

  const closeWin = () => animateClose(ref.current!).then(() => close(win.id));

  const box: CSSProperties = win.zoomed
    ? { left: 0, top: MENUBAR, right: 0, bottom: DOCK, zIndex: win.z }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z };

  return (
    <WinContext.Provider value={{ id: win.id, close: closeWin }}>
    {preview && <div ref={pv} className="snap-preview" aria-hidden style={{ ...snapStyle(preview), zIndex: win.z }} />}
    <section ref={ref} className={`window${front ? " front" : ""}`} style={box} aria-label={title} inert={win.minimized} onPointerDown={() => focus(win.id)}>
      <div
        className="titlebar"
        onDoubleClick={() => toggleZoom(win.id)}
        onPointerDown={(e) => {
          if (win.zoomed) return;
          const x0 = e.clientX;
          let base = { x: win.x, y: win.y, w: win.w, h: win.h }, zone: Snap | null = null;
          drag(e, (dx, dy, ev) => {
            // Pulling a tiled window away gives it back its size, under the same spot of the title bar.
            if (restore.current) {
              const { w, h } = restore.current;
              restore.current = null;
              base = { x: x0 - ((x0 - win.x) * w) / win.w, y: win.y, w, h };
            }
            place(win.id, { ...base, x: Math.max(-base.w + 120, base.x + dx), y: Math.max(MENUBAR, base.y + dy) });
            zone = snapZone(ev.clientX, ev.clientY, innerWidth, innerHeight);
            setPreview(zone);
          }, () => {
            setPreview(null);
            if (!zone) return;
            if (zone === "max") return toggleZoom(win.id);
            restore.current = { w: base.w, h: base.h };
            snapped.current = true;
            place(win.id, snapBox(zone, innerWidth, innerHeight));
          });
        }}
      >
        <div className="lights" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          <button aria-label={t("desktop.close")} onClick={closeWin}>{Glyph.close}</button>
          <button aria-label={t("desktop.minimize")} onClick={() => minimize(win.id)}>{Glyph.min}</button>
          <button aria-label={t("desktop.zoom")} onClick={() => toggleZoom(win.id)}>{win.zoomed ? Glyph.exit : Glyph.enter}</button>
        </div>
        <h1>{win.doc ? <NoteTitle id={win.doc} /> : title}</h1>
      </div>
      <div className="win-body">
        {win.console ? <ConsoleWindow deviceId={win.console} front={front} /> : win.doc ? <NoteApp id={win.doc} /> : win.app === "Settings" ? <SettingsApp /> : win.app === "Getting started" ? <GuideApp /> : win.app === "Locations" ? <LocationsApp /> : win.app === "Shop" ? <ShopApp /> : app.body ? <app.body /> : (
          <div className="app-empty">
            <span className="app-empty-tile" style={{ "--tile": app.tile } as CSSProperties}><app.icon /></span>
            <h2>{appTitle(app)}</h2>
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
    </WinContext.Provider>
  );
}
