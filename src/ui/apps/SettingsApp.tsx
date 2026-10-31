import { ChevronRight } from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";
import { canAutomate } from "../../sim/30-market/manual";
import { setCompany } from "../../sim/90-actions/company";
import { setAutoOrders } from "../../sim/90-actions/orders";
import { t } from "../../i18n/en";
import { APPS, appFor, appTitle } from "./registry";
import { CompanyFields } from "./company";
import { LeaderboardSettings } from "./LeaderboardSettings";
import { NOTIFY_TYPES } from "../notify-types";
import { prefOf, useFocus, useStore, type Theme } from "../store";
import { playSound } from "../sounds";
import { exportSave } from "../export-save";
import { LANGS, lang, setLang, type Lang } from "../../i18n/lang";

const THEMES: [Theme, string][] = [["light", t("apps.settings.light")], ["dark", t("apps.settings.dark")], ["auto", t("apps.settings.auto")]];

export function SettingsApp() {
  const { notifyPrefs, setNotifyPref, game, act, theme, setTheme, sound, setSound } = useStore();
  const [name, setName] = useState(game.company.name);
  const [open, setOpen] = useState<string | null>(null);
  const section = useRef<HTMLHeadingElement>(null);
  const root = useRef<HTMLDivElement>(null);
  // The gear in the notification centre opens the Notifications section, with the row of the notification's app expanded.
  useFocus("Settings", (f) => {
    if (f.kind === "section") {
      requestAnimationFrame(() => [...root.current?.querySelectorAll("h2") ?? []].find((h) => h.dataset.section === f.id)?.scrollIntoView({ block: "start" }));
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
    else setName(act(setCompany, { name }).ok ? name.trim() : game.company.name);
  };
  return (
    <div className="settings" ref={root}>
      <h2 data-section="Company">{t("apps.settings.company")}</h2>
      <div className="settings-group settings-company">
        <CompanyFields company={{ ...game.company, name }} onCommit={commitName}
          onChange={(p) => (p.name !== undefined ? setName(p.name) : act(setCompany, p))} />
      </div>
      {canAutomate(game) && <>
        <h2 data-section="Orders">{t("apps.settings.orders")}</h2>
        <div className="settings-group">
          <div className="settings-line">
            <span>{t("apps.settings.autoOrders")}</span>
            <input type="checkbox" role="switch" className="switch" aria-label={t("apps.settings.autoOrders")} checked={game.autoOrders} onChange={(e) => act(setAutoOrders, e.target.checked)} />
          </div>
        </div>
      </>}
      <h2 data-section="Appearance">{t("apps.settings.appearance")}</h2>
      <div className="settings-group settings-line">
        <span>{t("apps.settings.theme")}</span>
        <div className="seg" role="group" aria-label={t("apps.settings.theme")}>
          {THEMES.map(([id, label]) => <button key={id} aria-pressed={theme === id} onClick={() => setTheme(id)}>{label}</button>)}
        </div>
      </div>
      <h2 data-section="Sound">{t("apps.settings.sound")}</h2>
      <div className="settings-group">
        <div className="settings-line">
          <span>{t("apps.settings.soundEffects")}</span>
          <input type="checkbox" role="switch" className="switch" aria-label={t("apps.settings.soundEffects")} checked={sound.on} onChange={(e) => setSound({ on: e.target.checked })} />
        </div>
        <div className="settings-line settings-divide">
          <span>{t("apps.settings.volume")}</span>
          <input type="range" className="settings-volume" aria-label={t("apps.settings.volume")} min={0} max={1} step={0.05} value={sound.volume} disabled={!sound.on}
            onChange={(e) => setSound({ volume: Number(e.target.value) })} onPointerUp={(e) => playSound("ticket", Number(e.currentTarget.value))} />
        </div>
        <div className="settings-line settings-divide">
          <span>{t("apps.settings.ambience")}</span>
          <input type="range" className="settings-volume" aria-label={t("apps.settings.ambience")} min={0} max={1} step={0.05} value={sound.ambience} disabled={!sound.on}
            onChange={(e) => setSound({ ambience: Number(e.target.value) })} />
        </div>
      </div>
      <h2 ref={section} data-section="Notifications">{t("apps.settings.notifications")}</h2>
      <div className="settings-group" role="table" aria-label={t("apps.settings.notifications")}>
        <div className="settings-row settings-cols3 settings-headrow" role="row">
          <span role="columnheader">{t("apps.settings.app")}</span>
          <span role="columnheader">{t("apps.settings.allow")}</span>
          <span role="columnheader">{t("apps.settings.sound")}</span>
        </div>
        {APPS.filter((a) => a.name !== "Settings" && (!a.hidden || NOTIFY_TYPES[a.name])).map((a) => {
          const shown = appFor(game, a.name), title = appTitle(shown);
          const p = prefOf(notifyPrefs, a.name), types = (NOTIFY_TYPES[a.name] ?? []).filter((g) => g.id !== "other"), expanded = open === a.name && types.length > 0;
          return (
            <div className="settings-block" role="rowgroup" data-app={a.name} key={a.name}>
              <div className="settings-row settings-cols3" role="row">
                <span className="settings-app" role="cell">
                  {types.length > 0
                    ? <button className="settings-expand" aria-expanded={expanded} aria-label={t("apps.settings.types", { app: title })} onClick={() => setOpen(expanded ? null : a.name)}><ChevronRight /></button>
                    : <span className="settings-expand" />}
                  <span className="settings-ico" style={{ "--tile": shown.tile } as CSSProperties}><shown.icon /></span>{title}
                </span>
                <span role="cell">
                  <input type="checkbox" role="switch" className="switch" aria-label={t("apps.settings.allowFor", { app: title })}
                    checked={p.allow} onChange={(e) => setNotifyPref(a.name, { allow: e.target.checked })} />
                </span>
                <span role="cell">
                  <input type="checkbox" role="switch" className="switch" aria-label={t("apps.settings.soundFor", { app: title })}
                    checked={p.allow && p.sound} disabled={!p.allow} onChange={(e) => setNotifyPref(a.name, { sound: e.target.checked })} />
                </span>
              </div>
              {expanded && types.map((g) => (
                <div className="settings-type" role="row" key={g.id}>
                  <span role="cell">{g.label}</span>
                  <div className="seg" role="group" aria-label={`${title} ${g.label}`}>
                    {([true, false] as const).map((on) => (
                      <button key={String(on)} aria-pressed={(p.types?.[g.id] !== false) === on} disabled={!p.allow}
                        onClick={() => setNotifyPref(a.name, { types: { ...p.types, [g.id]: on } })}>{on ? t("apps.on") : t("apps.off")}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <h2 data-section="Game">{t("apps.settings.game")}</h2>
      <div className="settings-group">
        <div className="settings-line">
          <span>{t("apps.settings.export")}</span>
          <button className="btn" onClick={() => exportSave(game)}>{t("apps.settings.export")}</button>
        </div>
        <div className="settings-line">
          <span>{t("desktop.menu.language")}</span>
          <select aria-label={t("desktop.menu.language")} value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {Object.entries(LANGS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
      </div>
      <LeaderboardSettings />
    </div>
  );
}
