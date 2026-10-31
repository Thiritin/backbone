import { t } from "../../i18n/en";
import { useRef, useState } from "react";
import { euro } from "../../sim/00-core/money";
import { weeklyChallenge } from "../../sim/10-catalog/challenges";
import { LANGS, lang, setLang, type Lang } from "../../i18n/lang";
import { EMBEDDED } from "../embedded";
import { twistLabel, useBoard } from "../leaderboard";
import { useStore } from "../store";
import { ChangeList } from "./ChangeList";
import { Intro } from "./Intro";
import { MenuBackdrop } from "./MenuBackdrop";
import "./menu.css";

export function StartScreen() {
  const { startGame, startChallenge, importSave, canContinue, continueGame } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [intro, setIntro] = useState(false);
  const [settings, setSettings] = useState(false);
  const week = weeklyChallenge(new Date());
  const top = useBoard(week.id)?.netWorth.slice(0, 3) ?? [];
  return (
    <main className="menu">
      <MenuBackdrop />
      <h1 className="menu-title"><img className="menu-logo" src="favicon.svg" alt="" width={56} height={56} />Backbone</h1>
      <nav className="menu-bars">
        {canContinue && <button className="btn primary" autoFocus onClick={continueGame}>{t("desktop.start.continue")}</button>}
        <button className={`btn${canContinue ? "" : " primary"}`} autoFocus={!canContinue} onClick={startGame}>{t("desktop.newGame")}</button>
        <button className="btn" onClick={startChallenge}><span>{t("desktop.start.weekly")}<small>{week.id} · {twistLabel(week.twist)}</small></span></button>
        <button className="btn" onClick={() => file.current?.click()}>{t("desktop.start.import")}</button>
        <button className="btn" onClick={() => setIntro(true)}>{t("desktop.start.intro")}</button>
        <button className="btn" onClick={() => setSettings(true)}>{t("desktop.start.settings")}</button>
      </nav>
      <aside className="menu-news">
        {top.length > 0 && <ol className="menu-board">
          {top.map((e, i) => (
            <li key={i}><span className="start-swatch" style={{ background: e.color }} />{e.company}<span className="num">{euro(e.netWorth!)}</span></li>
          ))}
        </ol>}
        <h2>{t("desktop.start.news")}</h2>
        <ChangeList changes={EMBEDDED} />
      </aside>
      {settings && (
        <div className="alert-backdrop" onPointerDown={() => setSettings(false)}>
          <div className="alert" role="dialog" aria-modal="true" aria-label={t("desktop.start.settings")} onPointerDown={(e) => e.stopPropagation()}>
            <h2>{t("desktop.start.settings")}</h2>
            <label className="settings-line menu-lang">
              <span>{t("desktop.menu.language")}</span>
              <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
                {Object.entries(LANGS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <div className="alert-actions"><button className="btn primary" autoFocus onClick={() => setSettings(false)}>{t("desktop.done")}</button></div>
          </div>
        </div>
      )}
      {intro && <Intro onClose={() => setIntro(false)} />}
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) importSave(await f.text());
      }} />
    </main>
  );
}
