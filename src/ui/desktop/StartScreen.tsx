import { t } from "../../i18n/en";
import { ChevronLeft } from "lucide-react";
import { useRef, useState } from "react";
import { weeklyChallenge } from "../../sim/10-catalog/challenges";
import { LANGS, lang, setLang, type Lang } from "../../i18n/lang";
import { versionLabel } from "../changelog";
import { EMBEDDED } from "../embedded";
import { twistLabel } from "../leaderboard";
import { isNew, loadSeen, markRead, saveSeen } from "../news-seen";
import { useStore, type Theme } from "../store";
import { Intro } from "./Intro";
import { MenuBackdrop } from "./MenuBackdrop";
import "./menu.css";

const THEMES: [Theme, string][] = [["light", t("apps.settings.light")], ["dark", t("apps.settings.dark")], ["auto", t("apps.settings.auto")]];

function News() {
  const [seen, setSeen] = useState(() => loadSeen(EMBEDDED[0]?.version ?? 0));
  const read = (version: number) => {
    const next = markRead(seen, version);
    if (next !== seen) { setSeen(next); saveSeen(next); }
  };
  return (
    <aside className="menu-news">
      <h2>{t("desktop.start.news")}</h2>
      <div className="menu-versions">
        {EMBEDDED.map((d, n) => {
          const fresh = isNew(seen, d.version ?? 0);
          return (
            <details key={d.date} open={n === 0 || undefined}>
              <summary onClick={() => read(d.version ?? 0)}>
                <span>{t("desktop.changes.version", { version: versionLabel(d.date) })}</span>
                <small>{d.date}</small>
                {fresh && <b className="menu-new">{t("desktop.start.new")}</b>}
              </summary>
              <ul>{d.items.map((i) => <li key={i}>{i}</li>)}</ul>
            </details>
          );
        })}
      </div>
    </aside>
  );
}

function SettingsPage({ onBack }: { onBack: () => void }) {
  const { theme, setTheme } = useStore();
  return (
    <section className="menu-page">
      <button className="btn ghost" onClick={onBack}><ChevronLeft />{t("desktop.start.back")}</button>
      <h2>{t("desktop.start.settings")}</h2>
      <div className="settings-group">
        <div className="settings-line">
          <span>{t("desktop.menu.language")}</span>
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {Object.entries(LANGS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div className="settings-line">
          <span>{t("apps.settings.theme")}</span>
          <div className="seg" role="group" aria-label={t("apps.settings.theme")}>
            {THEMES.map(([id, label]) => <button key={id} aria-pressed={theme === id} onClick={() => setTheme(id)}>{label}</button>)}
          </div>
        </div>
      </div>
    </section>
  );
}

export function StartScreen() {
  const { startGame, startChallenge, importSave, canContinue, continueGame } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [intro, setIntro] = useState(false);
  const [page, setPage] = useState<"main" | "settings">("main");
  const week = weeklyChallenge(new Date());
  return (
    <main className="menu">
      <MenuBackdrop />
      <h1 className="menu-title"><img className="menu-logo" src="favicon.svg" alt="" width={56} height={56} />Backbone</h1>
      {page === "settings" ? <SettingsPage onBack={() => setPage("main")} /> : <>
        <nav className="menu-bars">
          {canContinue && <button className="btn primary" autoFocus onClick={continueGame}>{t("desktop.start.continue")}</button>}
          <button className={`btn${canContinue ? "" : " primary"}`} autoFocus={!canContinue} onClick={startGame}>{t("desktop.newGame")}</button>
          <button className="btn" onClick={startChallenge}><span>{t("desktop.start.weekly")}<small>{week.id} · {twistLabel(week.twist)}</small></span></button>
          <button className="btn" onClick={() => file.current?.click()}>{t("desktop.start.import")}</button>
          <button className="btn" onClick={() => setIntro(true)}>{t("desktop.start.intro")}</button>
          <button className="btn" onClick={() => setPage("settings")}>{t("desktop.start.settings")}</button>
        </nav>
        <News />
      </>}
      {intro && <Intro onClose={() => setIntro(false)} />}
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) importSave(await f.text());
      }} />
    </main>
  );
}
