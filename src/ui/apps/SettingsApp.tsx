import { useState, type CSSProperties } from "react";
import { setCompany } from "../../sim/90-actions/company";
import { APPS } from "./registry";
import { CompanyFields } from "./company";
import { EmailSettings } from "./EmailSettings";
import { prefOf, useStore, type Theme } from "../store";
import { playSound } from "../sounds";

const THEMES: [Theme, string][] = [["light", "Light"], ["dark", "Dark"], ["auto", "Automatic"]];

export function SettingsApp() {
  const { notifyPrefs, setNotifyPref, game, act, theme, setTheme, sound, setSound } = useStore();
  const [name, setName] = useState(game.company.name);
  const commitName = () => {
    if (name.trim() === game.company.name) setName(game.company.name);
    else setName(act((s) => setCompany(s, { name })).ok ? name.trim() : game.company.name);
  };
  return (
    <div className="settings">
      <h2>Company</h2>
      <div className="settings-group settings-company">
        <CompanyFields company={{ ...game.company, name }} onCommit={commitName}
          onChange={(p) => (p.name !== undefined ? setName(p.name) : act((s) => setCompany(s, p)))} />
      </div>
      <EmailSettings />
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
      <h2>Notifications</h2>
      <div className="settings-group" role="table" aria-label="Notifications">
        <div className="settings-row settings-cols3 settings-headrow" role="row">
          <span role="columnheader">App</span>
          <span role="columnheader">Allow</span>
          <span role="columnheader">Sound</span>
        </div>
        {APPS.filter((a) => !a.hidden && a.name !== "Settings").map((a) => {
          const p = prefOf(notifyPrefs, a.name);
          return (
            <div className="settings-row settings-cols3" role="row" key={a.name}>
              <span className="settings-app" role="cell">
                <span className="settings-ico" style={{ "--tile": a.tile } as CSSProperties}><a.icon /></span>{a.name}
              </span>
              <span role="cell">
                <input type="checkbox" role="switch" className="switch" aria-label={`Allow ${a.name} notifications`}
                  checked={p.allow} onChange={(e) => setNotifyPref(a.name, { allow: e.target.checked })} />
              </span>
              <span role="cell">
                <input type="checkbox" role="switch" className="switch" aria-label={`Play a sound for ${a.name} notifications`}
                  checked={p.allow && p.sound} disabled={!p.allow} onChange={(e) => setNotifyPref(a.name, { sound: e.target.checked })} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
