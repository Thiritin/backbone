import { ChevronRight } from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";
import { setCompany } from "../../sim/90-actions/company";
import { APPS, appFor } from "./registry";
import { CompanyFields } from "./company";
import { NOTIFY_TYPES } from "../notify-types";
import { prefOf, useFocus, useStore, type Theme } from "../store";
import { playSound } from "../sounds";

const THEMES: [Theme, string][] = [["light", "Light"], ["dark", "Dark"], ["auto", "Automatic"]];

export function SettingsApp() {
  const { notifyPrefs, setNotifyPref, game, act, theme, setTheme, sound, setSound } = useStore();
  const [name, setName] = useState(game.company.name);
  const [open, setOpen] = useState<string | null>(null);
  const section = useRef<HTMLHeadingElement>(null);
  const root = useRef<HTMLDivElement>(null);
  // The gear in the notification centre opens the Notifications section, with the row of the notification's app expanded.
  useFocus("Settings", (f) => {
    if (f.kind === "section") {
      requestAnimationFrame(() => [...root.current?.querySelectorAll("h2") ?? []].find((h) => h.textContent === f.id)?.scrollIntoView({ block: "start" }));
      return;
    }
    if (f.kind !== "notifications") return;
    setOpen(f.id || null);
    // The expanded rows exist after the next render.
    requestAnimationFrame(() => {
      const row = f.id ? section.current?.parentElement?.querySelector(`[data-app="${f.id}"]`) : null;
      (row ? row.lastElementChild : section.current)?.scrollIntoView({ block: row ? "nearest" : "start" });
    });
  });
  const commitName = () => {
    if (name.trim() === game.company.name) setName(game.company.name);
    else setName(act((s) => setCompany(s, { name })).ok ? name.trim() : game.company.name);
  };
  return (
    <div className="settings" ref={root}>
      <h2>Company</h2>
      <div className="settings-group settings-company">
        <CompanyFields company={{ ...game.company, name }} onCommit={commitName}
          onChange={(p) => (p.name !== undefined ? setName(p.name) : act((s) => setCompany(s, p)))} />
      </div>
      <h2>Appearance</h2>
      <div className="settings-group settings-line">
        <span>Theme</span>
        <div className="seg" role="group" aria-label="Theme">
          {THEMES.map(([t, label]) => <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)}>{label}</button>)}
        </div>
      </div>
      <h2>Sound</h2>
      <div className="settings-group">
        <div className="settings-line">
          <span>Sound effects</span>
          <input type="checkbox" role="switch" className="switch" aria-label="Sound effects" checked={sound.on} onChange={(e) => setSound({ on: e.target.checked })} />
        </div>
        <div className="settings-line settings-divide">
          <span>Volume</span>
          <input type="range" className="settings-volume" aria-label="Volume" min={0} max={1} step={0.05} value={sound.volume} disabled={!sound.on}
            onChange={(e) => setSound({ volume: Number(e.target.value) })} onPointerUp={(e) => playSound("ticket", Number(e.currentTarget.value))} />
        </div>
      </div>
      <h2 ref={section}>Notifications</h2>
      <div className="settings-group" role="table" aria-label="Notifications">
        <div className="settings-row settings-cols3 settings-headrow" role="row">
          <span role="columnheader">App</span>
          <span role="columnheader">Allow</span>
          <span role="columnheader">Sound</span>
        </div>
        {APPS.filter((a) => a.name !== "Settings" && (!a.hidden || NOTIFY_TYPES[a.name])).map((a) => {
          const shown = appFor(game, a.name);
          const p = prefOf(notifyPrefs, a.name), types = (NOTIFY_TYPES[a.name] ?? []).filter((g) => g.id !== "other"), expanded = open === a.name && types.length > 0;
          return (
            <div className="settings-block" role="rowgroup" data-app={a.name} key={a.name}>
              <div className="settings-row settings-cols3" role="row">
                <span className="settings-app" role="cell">
                  {types.length > 0
                    ? <button className="settings-expand" aria-expanded={expanded} aria-label={`${shown.name} notification types`} onClick={() => setOpen(expanded ? null : a.name)}><ChevronRight /></button>
                    : <span className="settings-expand" />}
                  <span className="settings-ico" style={{ "--tile": shown.tile } as CSSProperties}><shown.icon /></span>{shown.name}
                </span>
                <span role="cell">
                  <input type="checkbox" role="switch" className="switch" aria-label={`Allow ${shown.name} notifications`}
                    checked={p.allow} onChange={(e) => setNotifyPref(a.name, { allow: e.target.checked })} />
                </span>
                <span role="cell">
                  <input type="checkbox" role="switch" className="switch" aria-label={`Play a sound for ${shown.name} notifications`}
                    checked={p.allow && p.sound} disabled={!p.allow} onChange={(e) => setNotifyPref(a.name, { sound: e.target.checked })} />
                </span>
              </div>
              {expanded && types.map((g) => (
                <div className="settings-type" role="row" key={g.id}>
                  <span role="cell">{g.label}</span>
                  <div className="seg" role="group" aria-label={`${a.name} ${g.label}`}>
                    {([true, false] as const).map((on) => (
                      <button key={String(on)} aria-pressed={(p.types?.[g.id] !== false) === on} disabled={!p.allow}
                        onClick={() => setNotifyPref(a.name, { types: { ...p.types, [g.id]: on } })}>{on ? "On" : "Off"}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
