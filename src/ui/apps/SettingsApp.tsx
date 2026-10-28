import type { CSSProperties } from "react";
import { APPS } from "./registry";
import { DEFAULT_PREF, useStore } from "../store";

export function SettingsApp() {
  const { notifyPrefs, setNotifyPref } = useStore();
  return (
    <div className="settings">
      <h2>Notifications</h2>
      <div className="settings-group" role="table" aria-label="Notifications">
        <div className="settings-row settings-headrow" role="row">
          <span role="columnheader">App</span>
          <span role="columnheader">Allow</span>
          <span role="columnheader">Banners</span>
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
              <span role="cell">
                <input type="checkbox" role="switch" className="switch" aria-label={`Show ${a.name} banners`}
                  checked={p.allow && p.banners} disabled={!p.allow} onChange={(e) => setNotifyPref(a.name, { banners: e.target.checked })} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
