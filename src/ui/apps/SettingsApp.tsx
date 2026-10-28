import { useState, type CSSProperties } from "react";
import { setCompany } from "../../sim/90-actions/company";
import { APPS } from "./registry";
import { CompanyFields } from "./company";
import { DEFAULT_PREF, useStore, type Theme } from "../store";

const THEMES: [Theme, string][] = [["light", "Light"], ["dark", "Dark"], ["auto", "Automatic"]];

export function SettingsApp() {
  const { notifyPrefs, setNotifyPref, game, act, theme, setTheme } = useStore();
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
      <h2>Appearance</h2>
      <div className="settings-group settings-line">
        <span>Theme</span>
        <div className="seg" role="group" aria-label="Theme">
          {THEMES.map(([t, label]) => <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)}>{label}</button>)}
        </div>
      </div>
      <h2>Notifications</h2>
      <div className="settings-group" role="table" aria-label="Notifications">
        <div className="settings-row settings-headrow" role="row">
          <span role="columnheader">App</span>
          <span role="columnheader">Allow</span>
        </div>
        {APPS.filter((a) => !a.hidden && a.name !== "Settings").map((a) => {
          const p = notifyPrefs[a.name] ?? DEFAULT_PREF;
          return (
            <div className="settings-row" role="row" key={a.name}>
              <span className="settings-app" role="cell">
                <span className="settings-ico" style={{ "--tile": a.tile } as CSSProperties}><a.icon /></span>{a.name}
              </span>
              <span role="cell">
                <input type="checkbox" role="switch" className="switch" aria-label={`Allow ${a.name} notifications`}
                  checked={p.allow} onChange={(e) => setNotifyPref(a.name, { allow: e.target.checked })} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
