import { Bell, Inbox, Moon, Network, Pause, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { formatClock, SPEEDS, type Speed } from "../../sim/00-core/time";
import { euro } from "../../sim/00-core/money";
import { useStore } from "../store";

interface Props { theme: string; onTheme: () => void; onBell: () => void }

export function MenuBar({ theme, onTheme, onBell }: Props) {
  const { game, speed, setSpeed, windows, save, newCompany, openApp } = useStore();
  const [menu, setMenu] = useState<string | null>(null);
  const front = [...windows].filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0];

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  const item = (label: string, items: [string, () => void][]) => (
    <div className="mb-menu" onPointerDown={(e) => e.stopPropagation()}>
      <button className="mb-item" aria-expanded={menu === label} onClick={() => setMenu(menu === label ? null : label)}>{label}</button>
      {menu === label && items.length > 0 && (
        <div className="mb-drop" role="menu">
          {items.map(([l, fn]) => <button key={l} role="menuitem" onClick={() => { fn(); setMenu(null); }}>{l}</button>)}
        </div>
      )}
    </div>
  );

  return (
    <header className="menubar" role="menubar">
      <span className="mb-item mb-logo" title="Backbone"><Network /></span>
      <span className="mb-item mb-app">{front?.app ?? "Backbone"}</span>
      {item("File", [["New company", newCompany], ["Save", () => save()]])}
      {item("Window", windows.map((w) => [w.app, () => openApp(w.app)] as [string, () => void]))}
      <span className="mb-spacer" />
      <div className="speed" role="group" aria-label="Game speed">
        {SPEEDS.map((s: Speed) => (
          <button key={s} aria-pressed={speed === s} aria-label={s ? `${s}× speed` : "Pause"} onClick={() => setSpeed(s)}>
            {s ? `${s}×` : <Pause />}
          </button>
        ))}
      </div>
      <span className="mb-sep" />
      <span className="mb-item num">{formatClock(game.hour)}</span>
      <span className="mb-sep" />
      <span className="mb-item mb-cash num">{euro(game.cash)}</span>
      <button className="mb-item" aria-label="Open Support" onClick={() => openApp("Support")}><Inbox /></button>
      <button className="mb-item" aria-label="Notifications" onClick={onBell}><Bell /></button>
      <button className="mb-item" aria-label="Toggle dark mode" onClick={onTheme}>{theme === "dark" ? <Sun /> : <Moon />}</button>
    </header>
  );
}
