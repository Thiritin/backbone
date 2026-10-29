import { useEffect, useRef, useState } from "react";
import { MS_PER_HOUR, SPEEDS } from "../../sim/00-core/time";
import { t } from "../../i18n/en";
import { loadedFromSave, useStore } from "../store";
import { AppWindow } from "./AppWindow";
import { Banners, NotificationCenter } from "./Banners";
import { DesktopIcons } from "./DesktopIcons";
import { Dock } from "./Dock";
import { GameOver } from "./GameOver";
import { SkillSheet } from "../apps/research/SkillSheet";
import { MenuBar } from "./MenuBar";
import { StartScreen } from "./StartScreen";
import { wallpaperSvg } from "./wallpaper";
import { Widgets } from "./Widgets";
import { AlertSheet } from "./AlertSheet";
import { Welcome } from "./Welcome";
import { SoftwarePicker } from "../apps/software/Software";
import { ContextMenuHost } from "./ContextMenu";
import { Searchlight } from "../search/Searchlight";

const AUTOSAVE_MS = 15_000;
let greeted = false;

const dark = matchMedia("(prefers-color-scheme: dark)");

export function Desktop() {
  const { started, theme: pref, setTheme } = useStore();
  const [system, setSystem] = useState(dark.matches ? "dark" : "light");
  const theme = pref === "auto" ? system : pref;

  useEffect(() => {
    const follow = () => setSystem(dark.matches ? "dark" : "light");
    dark.addEventListener("change", follow);
    return () => dark.removeEventListener("change", follow);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  return (
    <div className="desktop">
      <div className="wallpaper-host" dangerouslySetInnerHTML={{ __html: wallpaperSvg() }} />
      {started ? <Shell theme={theme} onTheme={() => setTheme(theme === "dark" ? "light" : "dark")} /> : <StartScreen />}
    </div>
  );
}

function Shell({ theme, onTheme }: { theme: string; onTheme: () => void }) {
  const { windows, speed, setSpeed, advance, save, notify, clearUnseen, welcome, explain, setExplain, alert } = useStore();
  const gameOver = useStore((s) => s.game.gameOver);
  const setup = useStore((s) => s.setup);
  const [center, setCenter] = useState(false);
  const carry = useRef(0);

  useEffect(() => {
    if (!loadedFromSave || greeted) return;
    greeted = true;
    notify("Settings", t("save.loaded.title"), t("save.loaded.text"));
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
    const id = setInterval(save, AUTOSAVE_MS);
    window.addEventListener("pagehide", save);
    return () => { clearInterval(id); window.removeEventListener("pagehide", save); };
  }, [save]);

  // Space pauses; 1 to 4 pick 1×, 2×, 4× and 8×.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, [role=alertdialog], [role=dialog], [role=menu]")) return;
      if (e.code === "Space") { e.preventDefault(); setSpeed(speed ? 0 : 1); }
      const n = Number(e.key);
      if (n >= 1 && n <= 4) setSpeed(SPEEDS[n]);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [speed, setSpeed]);

  const frontZ = Math.max(0, ...windows.filter((w) => !w.minimized).map((w) => w.z));
  const toggleCenter = () => { if (!center) clearUnseen(); setCenter(!center); };

  return (
    <>
      <MenuBar theme={theme} onTheme={onTheme} onBell={toggleCenter} />
      <DesktopIcons />
      <Widgets />
      <div className="windows">{windows.map((w) => <AppWindow key={w.id} win={w} front={!w.minimized && w.z === frontZ} />)}</div>
      {center ? <NotificationCenter onClose={() => setCenter(false)} /> : <Banners />}
      <Dock />
      {welcome && <Welcome />}
      {setup && !welcome && <SoftwarePicker key={setup} machineId={setup} />}
      {alert && <AlertSheet alert={alert} />}
      {gameOver !== null && <GameOver hour={gameOver} />}
      {explain && <SkillSheet key={explain} id={explain} onClose={() => setExplain(null)} />}
      <ContextMenuHost />
      <Searchlight />
    </>
  );
}
