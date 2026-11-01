import { useEffect, useRef, useState } from "react";
import { formatClock, MS_PER_HOUR, SPEEDS } from "../../sim/00-core/time";
import { playerAt } from "../../sim/60-infra/handwork";
import { t } from "../../i18n/en";
import { clockCarry, loadedFromSave, useStore } from "../store";
import { AppWindow } from "./AppWindow";
import { Banners, NotificationCenter } from "./Banners";
import { DesktopIcons } from "./DesktopIcons";
import { Dock } from "./Dock";
import { GameOver } from "./GameOver";
import { SkillSheet } from "../apps/research/SkillSheet";
import { MenuBar } from "./MenuBar";
import { StartScreen } from "./StartScreen";
import { EarlyAccess } from "./EarlyAccess";
import { latestOs } from "../../sim/10-catalog/os";
import { wallpaperSvg } from "./wallpaper";
import { Widgets } from "./Widgets";
import { AlertSheet } from "./AlertSheet";
import { WhatsNew } from "./WhatsNew";
import { ContextMenuHost } from "./ContextMenu";
import { Searchlight } from "../search/Searchlight";
import { Switcher } from "./Switcher";
import { UpdateSheet } from "./UpdateSheet";
import { OsUpdateSheet } from "./OsUpdateSheet";
import { watchUpdates } from "../update";
import type { ChangelogDay } from "../changelog";

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
  const os = useStore((s) => s.game.os);
  // The main menu shows the 2018 desktop behind it.
  useEffect(() => { document.documentElement.dataset.os = started ? os : "yosemite"; }, [os, started]);
  // Web pages and vendor consoles follow the year, whatever the player has installed.
  const era = useStore((s) => latestOs(s.game.hour).id);
  useEffect(() => { document.documentElement.dataset.era = era; }, [era]);
  const wallpaper = useStore((s) => s.wallpaper);
  const photo = !started || wallpaper.pick === "map" ? null
    : wallpaper.pick === "custom" ? wallpaper.custom
    : `${import.meta.env.BASE_URL}wallpapers/${wallpaper.pick === "os" ? os : wallpaper.pick}.webp`;

  return (
    <div className="desktop">
      {photo
        ? <div className="wallpaper-host photo" style={{ backgroundImage: `url(${photo})` }} />
        : <div className="wallpaper-host" dangerouslySetInnerHTML={{ __html: wallpaperSvg() }} />}
      {started ? <Shell theme={theme} onTheme={() => setTheme(theme === "dark" ? "light" : "dark")} /> : <StartScreen />}
      <EarlyAccess />
    </div>
  );
}

function Shell({ theme, onTheme }: { theme: string; onTheme: () => void }) {
  const { windows, speed, setSpeed, advance, save, notify, clearUnseen, news, explain, setExplain, alert } = useStore();
  const gameOver = useStore((s) => s.game.gameOver);
  const [update, setUpdate] = useState<ChangelogDay[] | null>(null);
  const dismissed = useRef<number | null>(null);

  useEffect(() => watchUpdates((changes) => setUpdate(changes), () => dismissed.current), []);
  const [center, setCenter] = useState(false);
  const carry = clockCarry;

  useEffect(() => {
    if (!loadedFromSave || greeted) return;
    greeted = true;
    notify("Settings", t("save.loaded.title"), t("save.loaded.text"));
  }, [notify]);

  // Clock: whole game minutes from real time × speed; leftovers carry into the next frame.
  useEffect(() => {
    if (!speed) return;
    let last = performance.now(), raf = 0;
    const frame = (now: number) => {
      carry.current += ((now - last) * speed) / MS_PER_HOUR;
      last = now;
      const minutes = Math.floor(carry.current * 60);
      if (minutes > 0) { carry.current -= minutes / 60; advance(Math.min(minutes, 24 * 60) / 60); }
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

  // Space pauses; 1 to 3 pick 1×, 2× and 4×, and 4 skips ahead.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (useStore.getState().game.player.until > useStore.getState().game.hour) return;
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
      <div className="live-only" inert={speed === 0}>
        <DesktopIcons />
        <Widgets />
        <div className="windows">{windows.map((w) => <AppWindow key={w.id} win={w} front={!w.minimized && w.z === frontZ} />)}</div>
        {center ? <NotificationCenter onClose={() => setCenter(false)} /> : <Banners />}
        <Dock />
      </div>
      {speed === 0 && <div className="paused-veil">{t("desktop.paused")}</div>}
      {news && <WhatsNew changes={news} />}
      {alert && <AlertSheet alert={alert} />}
      {gameOver !== null && <GameOver hour={gameOver} />}
      {gameOver === null && <OsUpdateSheet />}
      {update && <UpdateSheet changes={update} onLater={() => { dismissed.current = Date.now(); setUpdate(null); }} />}
      {explain && <SkillSheet key={explain} id={explain} onClose={() => setExplain(null)} />}
      <ContextMenuHost />
      <Searchlight />
      <Switcher />
      <AwayLock />
    </>
  );
}

// Hours pass quickly while the player drives or works on site, and the computer takes no input until they are done.
const AWAY_MS_PER_HOUR = 150;

function AwayLock() {
  const game = useStore((s) => s.game), advance = useStore((s) => s.advance);
  const away = game.player.until > game.hour && game.gameOver === null;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!away) return;
    (document.activeElement as HTMLElement | null)?.blur();
    ref.current?.focus();
    const id = setInterval(() => advance(1), AWAY_MS_PER_HOUR);
    return () => clearInterval(id);
  }, [away, advance]);
  if (!away) return null;
  const { until, doing } = game.player, place = playerAt(game).name;
  const label = t(doing === "travel" ? "desktop.awayTravel" : "desktop.awayWork", { place });
  return (
    <div ref={ref} className="away-lock" role="alertdialog" aria-label={label} tabIndex={-1}>
      <strong>{label}</strong>
      <span className="num">{t("desktop.awayUntil", { time: formatClock(Math.floor(until), Math.round((until % 1) * 60)) })}</span>
    </div>
  );
}
