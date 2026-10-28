import { useEffect, useRef, useState } from "react";
import { MS_PER_HOUR, SPEEDS } from "../../sim/00-core/time";
import { t } from "../../i18n/en";
import { loadedFromSave, useStore } from "../store";
import { AppWindow } from "./AppWindow";
import { Banners, NotificationCenter } from "./Banners";
import { Dock } from "./Dock";
import { MenuBar } from "./MenuBar";
import { wallpaperSvg } from "./wallpaper";

const THEME_KEY = "backbone.theme";
const AUTOSAVE_MS = 15_000;
let greeted = false;

function initialTheme(): string {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
  } catch {
    // Storage blocked; fall back to the system setting.
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function Desktop() {
  const { windows, speed, setSpeed, advance, save, notify } = useStore();
  const [theme, setTheme] = useState(initialTheme);
  const [center, setCenter] = useState(false);
  const carry = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* not persisted */ }
  }, [theme]);

  useEffect(() => {
    if (!loadedFromSave || greeted) return;
    greeted = true;
    notify("Finance", t("save.loaded.title"), t("save.loaded.text"));
  }, [notify]);

  // Clock: whole game hours from real time × speed; leftovers carry into the next frame.
  useEffect(() => {
    if (!speed) return;
    let last = performance.now(), raf = 0;
    const frame = (now: number) => {
      carry.current += ((now - last) * speed) / MS_PER_HOUR;
      last = now;
      const hours = Math.floor(carry.current);
      if (hours > 0) { carry.current -= hours; advance(Math.min(hours, 24)); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [speed, advance]);

  useEffect(() => {
    const id = setInterval(() => save(true), AUTOSAVE_MS);
    const flush = () => save(true);
    window.addEventListener("pagehide", flush);
    return () => { clearInterval(id); window.removeEventListener("pagehide", flush); };
  }, [save]);

  // Space pauses; 1 to 4 pick 1×, 2×, 4× and 8×.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      if (e.code === "Space") { e.preventDefault(); setSpeed(speed ? 0 : 1); }
      const n = Number(e.key);
      if (n >= 1 && n <= 4) setSpeed(SPEEDS[n]);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [speed, setSpeed]);

  const visible = windows.filter((w) => !w.minimized);
  const frontZ = Math.max(0, ...visible.map((w) => w.z));

  return (
    <div className="desktop">
      <div className="wallpaper-host" dangerouslySetInnerHTML={{ __html: wallpaperSvg() }} />
      <MenuBar theme={theme} onTheme={() => setTheme(theme === "dark" ? "light" : "dark")} onBell={() => setCenter(!center)} />
      <div className="windows">{visible.map((w) => <AppWindow key={w.id} win={w} front={w.z === frontZ} />)}</div>
      {center ? <NotificationCenter onClose={() => setCenter(false)} /> : <Banners />}
      <Dock />
    </div>
  );
}
