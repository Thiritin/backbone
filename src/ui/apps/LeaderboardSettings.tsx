import { useState } from "react";
import { euro } from "../../sim/00-core/money";
import { dateOf } from "../../sim/00-core/time";
import { challengeById, weeklyChallenge } from "../../sim/10-catalog/challenges";
import { SCORE_END, scores, type Scores } from "../../sim/80-business/scores";
import { runFile, runFileName, type Entry } from "../../sim/92-run/run";
import { BUILD_ID, twistLabel, useBoard } from "../leaderboard";
import { useStore } from "../store";
import { LOCALE } from "../../i18n/lang";
import { t } from "../../i18n/en";

const BY: [keyof Scores, string][] = [["netWorth", t("apps.board.netWorth")], ["level3", t("apps.board.level3")], ["happiness", t("apps.board.happiness")]];
const MINE: [keyof Scores, string][] = [["netWorth", t("apps.board.netWorthEnd")], ["level3", t("apps.board.level3Reached")], ["happiness", t("apps.board.meanHappiness")]];
const day = (hour: number) => dateOf(hour).toLocaleDateString(LOCALE, { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const show = (k: keyof Scores, v: number | null) =>
  v === null ? (k === "happiness" ? t("apps.none") : t("apps.board.notReached")) : k === "netWorth" ? euro(v) : k === "level3" ? day(v) : t("apps.board.ofHundred", { n: v });

// Settings, Leaderboard: this game's scores, the run export and the board of its challenge (this week's for a free game).
export function LeaderboardSettings() {
  const game = useStore((s) => s.game);
  const [by, setBy] = useState<keyof Scores>("netWorth");
  const challenge = (game.challenge && challengeById(game.challenge)) || weeklyChallenge(new Date());
  const board = useBoard(challenge.id);
  const mine = scores(game);
  const done = game.hour >= SCORE_END || game.gameOver !== null;
  const exportRun = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(runFile(game, BUILD_ID))], { type: "application/json" }));
    a.download = runFileName(game);
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const rows: Entry[] = board?.[by] ?? [];
  return (
    <>
      <h2 data-section="Leaderboard">{t("apps.board.leaderboard")}</h2>
      <div className="settings-group">
        <div className="settings-line"><span>{t("apps.board.challenge")}</span><span>{game.challenge ? `${challenge.id} · ${twistLabel(challenge.twist)}` : t("apps.none")}</span></div>
        {MINE.map(([k, label]) => (
          <div className="settings-line settings-divide" key={k}><span>{label}</span><span className={mine[k] === null ? undefined : "num"}>{show(k, mine[k])}</span></div>
        ))}
        <div className="settings-line settings-divide">
          <span>{t("apps.board.runFile")}</span>
          <button className="btn" disabled={!done} onClick={exportRun}>{t("apps.board.export")}</button>
        </div>
      </div>
      <div className="settings-line lb-head">
        <span>{challenge.id}</span>
        <div className="seg" role="group" aria-label={t("apps.board.rankBy")}>
          {BY.map(([k, label]) => <button key={k} aria-pressed={by === k} onClick={() => setBy(k)}>{label}</button>)}
        </div>
      </div>
      <div className="settings-group" role="table" aria-label={t("apps.board.leaderboard")}>
        <div className="settings-row lb-row settings-headrow" role="row">
          <span role="columnheader">{t("apps.board.company")}</span>
          <span role="columnheader">{t("apps.board.seed")}</span>
          {BY.map(([k, label]) => <span role="columnheader" key={k}>{label}</span>)}
        </div>
        {rows.length === 0 && <div className="settings-row lb-row" role="row"><span role="cell">{t("apps.board.noRuns")}</span></div>}
        {rows.map((e, i) => (
          <div className="settings-row lb-row" role="row" key={i}>
            <span role="cell" className="lb-company"><span className="num">{i + 1}</span><span className="start-swatch" style={{ background: e.color }} />{e.company}</span>
            <span role="cell" className="num">{e.seed}</span>
            {BY.map(([k]) => <span role="cell" className={e[k] === null ? undefined : "num"} key={k}>{show(k, e[k])}</span>)}
          </div>
        ))}
      </div>
    </>
  );
}
