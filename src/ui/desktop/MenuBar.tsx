import { Bell, Cloud, CloudRain, CloudSnow, CloudSun, Moon, Pause, Play, SkipForward, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { serialize } from "../../sim/91-save/save";
import { Confirm } from "./Confirm";
import { Intro } from "./Intro";
import { newNote } from "./DesktopIcons";
import { restoreGuide } from "../../sim/90-actions/docs";
import { dateOf, formatClock, SKIP, SPEEDS, type Speed } from "../../sim/00-core/time";
import { euro } from "../../sim/00-core/money";
import { playerAt } from "../../sim/60-infra/handwork";
import { drive, travelTo } from "../../sim/90-actions/travel";
import { useStore, type Win } from "../store";
import { CompanyMark } from "../apps/company";
import { appFor } from "../apps/registry";
import { EMBEDDED } from "../embedded";

interface Props { theme: string; onTheme: () => void; onBell: () => void }

export function MenuBar({ theme, onTheme, onBell }: Props) {
  const { game, speed, setSpeed, windows, openApp, openDoc, act, unseen, importSave, openNews, deleteProgress, minimize, close } = useStore();
  const guideGone = !game.docs.some((d) => d.kind === "guide");
  const docTitle = (id: string) => game.docs.find((d) => d.id === id)?.title ?? "";
  const [menu, setMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [intro, setIntro] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const here = playerAt(game);
  const front = [...windows].filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0];

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  const exportSave = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([serialize(game)], { type: "application/json" }));
    a.download = `backbone-${dateOf(game.hour).toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // The front window's menu: what the app offers, then the window controls.
  const appMenu = (w: Win): [string, () => void][] => [
    ...(w.app === "Support" ? [["Change provider…", () => openApp("Support", { kind: "mailSetup", id: "" })]] as [string, () => void][] : []),
    ...(w.app !== "Settings" ? [["Settings…", () => openApp("Settings")]] as [string, () => void][] : []),
    ["Minimize", () => minimize(w.id)],
    ["Close", () => close(w.id)],
  ];

  const item = (label: string, items: [string, () => void][], face: ReactNode = label, cls = "") => (
    <div className="mb-menu" onPointerDown={(e) => e.stopPropagation()}>
      <button className={`mb-item ${cls}`} aria-label={label} aria-expanded={menu === label} onClick={() => setMenu(menu === label ? null : label)}>{face}</button>
      {menu === label && items.length > 0 && (
        <div className="mb-drop" role="menu">
          {items.map(([l, fn], i) => <button key={i} role="menuitem" onClick={() => { fn(); setMenu(null); }}>{l}</button>)}
        </div>
      )}
    </div>
  );

  return (
    <header className="menubar" role="menubar">
      {item("Backbone", [["Introduction…", () => setIntro(true)], ["Backbone on GitHub", () => window.open("https://github.com/Thiritin/backbone", "_blank", "noopener")], ["New note", () => newNote()], ...(guideGone ? [["Restore Getting started", () => act(restoreGuide)] as [string, () => void]] : []), ["What's new", () => openNews(EMBEDDED)], ["Export save…", exportSave], ["Import save…", () => file.current?.click()], ["Delete progress…", () => setConfirm(true)]], <CompanyMark company={game.company} className="mb-mark" />, "mb-logo")}
      {front ? item(appFor(game, front.app).name, appMenu(front), appFor(game, front.app).name, "mb-app") : <span className="mb-item mb-app">Backbone</span>}
      {item("Window", windows.map((w) => (w.doc ? [docTitle(w.doc), () => openDoc(w.doc!)] : [appFor(game, w.app).name, () => openApp(w.app)]) as [string, () => void]))}
      <span className="mb-spacer" />
      {item("Location", game.locations.flatMap((l) => {
        const d = l.id !== here.id && drive(game, l.id);
        return d ? [[`${l.name}, ${d.hours} h, ${euro(d.fee)}`, () => act(travelTo, l.id)] as [string, () => void]] : [];
      }), <span className="mb-place"><Weather city={here.city} hour={game.hour} />{here.name}</span>)}
      <span className="mb-sep" />
      <div className="speed" role="group" aria-label="Game speed">
        {SPEEDS.map((s: Speed, i) => {
          const label = s === SKIP ? "Skip to next event" : s ? `${s}× speed` : "Pause";
          return (
            <button key={s} aria-pressed={speed === s} aria-label={label} title={label} onClick={() => setSpeed(s)}>
              {s === SKIP ? <SkipForward className="skip" /> : s ? <span className="arrows">{Array.from({ length: i }, (_, k) => <Play key={k} />)}</span> : <Pause />}
            </button>
          );
        })}
      </div>
      <span className="mb-sep" />
      <span className="mb-item num">{formatClock(game.hour, game.minute)}</span>
      <span className="mb-sep" />
      <span className="mb-item mb-cash num">{euro(game.cash)}</span>
      <button className="mb-item mb-badge" aria-label={unseen ? `Notifications, ${unseen} new` : "Notifications"} onClick={onBell}>
        <Bell />
        {unseen > 0 && <span key={unseen} className="count plop">{unseen > 99 ? "99+" : unseen}</span>}
      </button>
      <button className="mb-item" aria-label="Toggle dark mode" onClick={onTheme}>{theme === "dark" ? <Sun /> : <Moon />}</button>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) importSave(await f.text());
      }} />
      {intro && <Intro onClose={() => setIntro(false)} />}
      {confirm && (
        <Confirm
          title="Delete all progress?"
          text="Your company and its save are removed from this browser. Export a save first to keep a copy."
          action="Delete"
          onCancel={() => setConfirm(false)}
          onConfirm={() => { setConfirm(false); deleteProgress(); }}
        />
      )}
    </header>
  );
}

// Today's weather in a city: a pick per city and day, with snow only in winter.
function Weather({ city, hour }: { city: string; hour: number }) {
  const day = Math.floor(hour / 24), month = dateOf(hour).getUTCMonth();
  let h = day;
  for (const c of city) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const icons = month < 2 || month === 11 ? [Sun, Cloud, CloudSnow, CloudSnow, Cloud] : [Sun, Sun, CloudSun, Cloud, CloudRain];
  const Icon = icons[h % icons.length];
  return <Icon />;
}
