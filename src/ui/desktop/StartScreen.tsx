import { t } from "../../i18n/en";
import { Network } from "lucide-react";
import { useRef, useState } from "react";
import { euro } from "../../sim/00-core/money";
import { weeklyChallenge } from "../../sim/10-catalog/challenges";
import { twistLabel, useBoard } from "../leaderboard";
import { useStore } from "../store";
import { Intro } from "./Intro";

export function StartScreen() {
  const { startGame, startChallenge, importSave } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [intro, setIntro] = useState(false);
  const week = weeklyChallenge(new Date());
  const top = useBoard(week.id)?.netWorth.slice(0, 3) ?? [];
  return (
    <main className="start">
      <span className="start-logo"><Network /></span>
      <h1>Backbone</h1>
      <div className="start-actions">
        <button className="btn primary" autoFocus onClick={startGame}>{t("desktop.newGame")}</button>
        <button className="btn" onClick={startChallenge}>{t("desktop.start.weekly")}</button>
        <button className="btn" onClick={() => file.current?.click()}>{t("desktop.start.import")}</button>
      </div>
      <div className="start-challenge">
        <span>{week.id} · {twistLabel(week.twist)}</span>
        {top.length > 0 && <ol>
          {top.map((e, i) => (
            <li key={i}><span className="start-swatch" style={{ background: e.color }} />{e.company}<span className="num">{euro(e.netWorth!)}</span></li>
          ))}
        </ol>}
      </div>
      <button className="start-intro" onClick={() => setIntro(true)}>{t("desktop.start.intro")}</button>
      {intro && <Intro onClose={() => setIntro(false)} />}
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) importSave(await f.text());
      }} />
    </main>
  );
}
