import { t } from "../../i18n/en";
import { Bell, Moon, Pause, Play, SkipForward, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Confirm } from "./Confirm";
import { Intro, PearMark } from "./Intro";
import { newNote } from "./DesktopIcons";
import { restoreGuide } from "../../sim/90-actions/docs";
import { dateOf, formatClock, SKIP, SPEEDS, type Speed } from "../../sim/00-core/time";
import { euro } from "../../sim/00-core/money";
import { playerAt } from "../../sim/60-infra/handwork";
import { sky } from "../../sim/20-world/weather";
import { SkyIcon } from "../apps/weather/SkyIcon";
import { daylight } from "../world/draw";
import { degrees } from "../apps/weather/WeatherApp";
import { DISCORD_URL, uiSound, useStore, type Win } from "../store";
import { appFor, appTitle } from "../apps/registry";
import { EMBEDDED } from "../embedded";
import { exportSave } from "../export-save";
import { FullscreenButton } from "../FullscreenButton";
import { roomOf } from "../world/World";
import { openMenu } from "./ContextMenu";
import type { MenuEntry } from "./menu";

declare const __BUILD_ID__: string;

interface Props { theme: string; onTheme: () => void; onBell: () => void }

export function SpeedControl({ speed, setSpeed }: { speed: Speed; setSpeed: (s: Speed) => void }) {
  return (
    <div className="speed" role="group" aria-label={t("desktop.menu.speed")}>
      {SPEEDS.map((s: Speed, i) => {
        const label = s === SKIP ? t("desktop.menu.skip") : s ? t("desktop.menu.speedN", { n: s }) : t("desktop.menu.pause");
        return (
          <button key={s} aria-pressed={speed === s} aria-label={label} title={label} onClick={() => setSpeed(s)}>
            {s === SKIP ? <SkipForward className="skip" /> : s ? <span className="arrows">{Array.from({ length: i }, (_, k) => <Play key={k} />)}</span> : <Pause />}
          </button>
        );
      })}
    </div>
  );
}

export function MenuBar({ theme, onTheme, onBell }: Props) {
  const { game, speed, setSpeed, windows, openApp, openConsole, openDoc, act, unseen, toMenu, openNews, deleteProgress, minimize, close, setSurface } = useStore();
  const guideGone = !game.docs.some((d) => d.kind === "guide");
  const docTitle = (id: string) => game.docs.find((d) => d.id === id)?.title ?? "";
  const appName = (w: Win) => (w.console ? t("desktop.menu.console") : appTitle(appFor(game, w.app)));
  const [menu, setMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [intro, setIntro] = useState(false);
  const here = playerAt(game);
  const front = [...windows].filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0];

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  // The front window's menu: what the app offers, then the window controls.
  const appMenu = (w: Win): [string, () => void][] => [
    ...(w.app !== "Settings" ? [[t("desktop.menu.settings"), () => openApp("Settings")]] as [string, () => void][] : []),
    [t("desktop.minimize"), () => minimize(w.id)],
    [t("desktop.close"), () => close(w.id)],
  ];

  const item = (id: string, label: string, items: [string, () => void][], face: ReactNode = label, cls = "") => (
    <div className="mb-menu" onPointerDown={(e) => e.stopPropagation()}>
      <button className={`mb-item ${cls}`} aria-label={label} aria-expanded={menu === id} onClick={() => { if (menu !== id) uiSound("menu"); setMenu(menu === id ? null : id); }}>{face}</button>
      {menu === id && items.length > 0 && (
        <div className="mb-drop" role="menu">
          {items.map(([l, fn], i) => <button key={i} role="menuitem" onClick={() => { fn(); setMenu(null); }}>{l}</button>)}
        </div>
      )}
    </div>
  );

  // Menus with submenus, checkmarks and shortcuts open in the shared menu panel under their title.
  const panel = (id: string, label: string, entries: () => MenuEntry[], cls = "") => (
    <div key={id} className="mb-menu" onPointerDown={(e) => e.stopPropagation()}>
      <button className={`mb-item ${cls}`} aria-label={label} aria-haspopup="menu" onClick={(e) => { setMenu(null); const r = e.currentTarget.getBoundingClientRect(); openMenu(r.left, r.bottom, entries()); }}>{label}</button>
    </div>
  );
  const frontApp = front && !front.console ? appFor(game, front.app) : undefined;
  const extra = frontApp?.menus?.() ?? [];
  // Read when a menu opens, so the entries follow the window's latest state.
  const fresh = (id: string): MenuEntry[] => frontApp?.menus?.().find((m) => m.id === id)?.items ?? [];
  const appList = (): MenuEntry[] => [
    ...fresh("app"), null,
    // An app with its own Preferences drops the shortcut to the game's Settings.
    ...(front ? appMenu(front).filter(([label]) => label !== t("desktop.menu.settings")).map(([label, run]) => ({ label, run })) : []),
  ];
  const windowList = (): MenuEntry[] => [
    ...fresh("window"), null,
    ...windows.map((w) => ({ label: w.doc ? docTitle(w.doc) : w.console ? t("desktop.menu.console") : appName(w), run: () => (w.doc ? openDoc(w.doc) : w.console ? openConsole(w.console) : openApp(w.app)) })),
  ];

  return (
    <header className="menubar" role="menubar">
      {item("raid0", "raid0", [[t("desktop.menu.logout"), () => setSurface("world")], [t("desktop.menu.intro"), () => setIntro(true)], [t("desktop.menu.github"), () => window.open("https://github.com/Thiritin/raid0", "_blank", "noopener")], [t("desktop.menu.discord"), () => window.open(DISCORD_URL, "_blank", "noopener")], [t("desktop.menu.report"), () => window.open(`https://github.com/Thiritin/raid0/issues/new?body=${encodeURIComponent(`\n\nBuild: ${__BUILD_ID__}`)}`, "_blank", "noopener")], [t("desktop.icon.newNote"), () => newNote()], ...(guideGone ? [[t("desktop.menu.restoreGuide"), () => act(restoreGuide)] as [string, () => void]] : []), [t("desktop.menu.whatsNew"), () => openNews(EMBEDDED)], [t("desktop.menu.export"), () => exportSave(game)], [t("desktop.menu.mainMenu"), toMenu], [t("desktop.menu.delete"), () => setConfirm(true)]], <span className="mb-pear"><PearMark /></span>, "mb-logo")}
      {front ? (extra.some((m) => m.id === "app") ? panel("app", appName(front), appList, "mb-app") : item("app", appName(front), appMenu(front), appName(front), "mb-app")) : <span className="mb-item mb-app">raid0</span>}
      {extra.filter((m) => m.id !== "window" && m.id !== "app").map((m) => panel(m.id, m.title, () => fresh(m.id)))}
      {panel("window", t("desktop.menu.window"), windowList)}
      <span className="mb-spacer" />
      <button className="mb-item mb-place" onClick={() => openApp("Weather")}>
        <SkyIcon kind={sky(here.city, game.hour)} night={daylight(dateOf(game.hour).getUTCHours() + game.minute / 60, dateOf(game.hour).getUTCMonth()) < 0.5} />{degrees(here.city, game.hour)} {here.name}
      </button>
      <span className="mb-sep" />
      <button className="mb-item" onClick={() => setSurface("world")}>{roomOf(game).name}</button>
      <span className="mb-sep" />
      <SpeedControl speed={speed} setSpeed={setSpeed} />
      <span className="mb-sep" />
      <button className={`mb-item num${speed === 0 ? " paused" : ""}`} onClick={() => openApp("Calendar")}>{formatClock(game.hour, game.minute)}</button>
      <span className="mb-sep" />
      <button className="mb-item mb-cash num" onClick={() => openApp("Books")}>{euro(game.cash)}</button>
      <button className="mb-item mb-badge" aria-label={unseen ? t("desktop.notif.unseen", { n: unseen }) : t("desktop.notif.title")} onClick={onBell}>
        <Bell />
        {unseen > 0 && <span key={unseen} className="count plop">{unseen > 99 ? "99+" : unseen}</span>}
      </button>
      <button className="mb-item" aria-label={t("desktop.menu.darkMode")} onClick={onTheme}>{theme === "dark" ? <Sun /> : <Moon />}</button>
      <FullscreenButton className="mb-item" />
      {intro && <Intro onClose={() => setIntro(false)} />}
      {confirm && (
        <Confirm
          title={t("desktop.menu.deleteTitle")}
          text={t("desktop.menu.deleteText")}
          action={t("desktop.menu.deleteAction")}
          onCancel={() => setConfirm(false)}
          onConfirm={() => { setConfirm(false); deleteProgress(); }}
        />
      )}
    </header>
  );
}
