import { t } from "../../i18n/en";
import { Bell, Moon, Pause, Play, SkipForward, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Confirm } from "./Confirm";
import { Intro } from "./Intro";
import { newNote } from "./DesktopIcons";
import { restoreGuide } from "../../sim/90-actions/docs";
import { formatClock, SKIP, SPEEDS, type Speed } from "../../sim/00-core/time";
import { euro } from "../../sim/00-core/money";
import { playerAt } from "../../sim/60-infra/handwork";
import { sky } from "../../sim/20-world/weather";
import { SkyIcon } from "../apps/weather/SkyIcon";
import { degrees } from "../apps/weather/WeatherApp";
import { DISCORD_URL, uiSound, useStore, type Win } from "../store";
import { CompanyMark } from "../apps/company";
import { appFor, appTitle } from "../apps/registry";
import { EMBEDDED } from "../embedded";
import { BUILD_ID } from "../leaderboard";
import { exportSave } from "../export-save";
import { leaveImmersive, useImmersive } from "./immersive";

interface Props { theme: string; onTheme: () => void; onBell: () => void }

export function MenuBar({ theme, onTheme, onBell }: Props) {
  const { game, speed, setSpeed, windows, openApp, openConsole, openDoc, act, unseen, toMenu, openNews, deleteProgress, minimize, close } = useStore();
  const guideGone = !game.docs.some((d) => d.kind === "guide");
  const docTitle = (id: string) => game.docs.find((d) => d.id === id)?.title ?? "";
  const appName = (w: Win) => (w.console ? t("desktop.menu.console") : appTitle(appFor(game, w.app)));
  const [menu, setMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [intro, setIntro] = useState(false);
  const immersive = useImmersive();
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
    ...(w.app === "Support" ? [[t("desktop.menu.changeProvider"), () => openApp("Support", { kind: "mailSetup", id: "" })]] as [string, () => void][] : []),
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

  return (
    <header className="menubar" role="menubar">
      {item("backbone", "Backbone", [[t("desktop.menu.intro"), () => setIntro(true)], [t("desktop.menu.github"), () => window.open("https://github.com/Thiritin/backbone", "_blank", "noopener")], [t("desktop.menu.discord"), () => window.open(DISCORD_URL, "_blank", "noopener")], [t("desktop.menu.report"), () => window.open(`https://github.com/Thiritin/backbone/issues/new?body=${encodeURIComponent(`\n\nBuild: ${BUILD_ID}`)}`, "_blank", "noopener")], [t("desktop.icon.newNote"), () => newNote()], ...(guideGone ? [[t("desktop.menu.restoreGuide"), () => act(restoreGuide)] as [string, () => void]] : []), [t("desktop.menu.whatsNew"), () => openNews(EMBEDDED)], [t("desktop.menu.export"), () => exportSave(game)], [t("desktop.menu.mainMenu"), toMenu], [t("desktop.menu.delete"), () => setConfirm(true)], ...(immersive ? [[t("desktop.menu.logout"), () => { leaveImmersive(); toMenu(); }] as [string, () => void]] : [])], <CompanyMark company={game.company} className="mb-mark" />, "mb-logo")}
      {front ? item("app", appName(front), appMenu(front), appName(front), "mb-app") : <span className="mb-item mb-app">Backbone</span>}
      {item("window", t("desktop.menu.window"), windows.map((w) => (w.doc ? [docTitle(w.doc), () => openDoc(w.doc!)] : w.console ? [t("desktop.menu.console"), () => openConsole(w.console!)] : [appName(w), () => openApp(w.app)]) as [string, () => void]))}
      <span className="mb-spacer" />
      <button className="mb-item mb-place" onClick={() => openApp("Weather")}>
        <SkyIcon kind={sky(here.city, game.hour)} />{degrees(here.city, game.hour)} {here.name}
      </button>
      <span className="mb-sep" />
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
      <span className="mb-sep" />
      <button className="mb-item num" onClick={() => openApp("Calendar")}>{formatClock(game.hour, game.minute)}</button>
      <span className="mb-sep" />
      <button className="mb-item mb-cash num" onClick={() => openApp("Books")}>{euro(game.cash)}</button>
      <button className="mb-item mb-badge" aria-label={unseen ? t("desktop.notif.unseen", { n: unseen }) : t("desktop.notif.title")} onClick={onBell}>
        <Bell />
        {unseen > 0 && <span key={unseen} className="count plop">{unseen > 99 ? "99+" : unseen}</span>}
      </button>
      <button className="mb-item" aria-label={t("desktop.menu.darkMode")} onClick={onTheme}>{theme === "dark" ? <Sun /> : <Moon />}</button>
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
