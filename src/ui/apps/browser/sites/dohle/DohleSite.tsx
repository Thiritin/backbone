import { useState } from "react";
import { t } from "../../../../../i18n/en";
import { euro } from "../../../../../sim/00-core/money";
import { yearOf } from "../../../../../sim/00-core/time";
import type { GameState } from "../../../../../sim/50-state";
import { DOHLE_HOST, smallLimit, taxNumber } from "../../../../../sim/80-business/tax";
import { answerQuestionnaire } from "../../../../../sim/90-actions/tax";
import { useStore } from "../../../../store";
import { paperDay } from "../../../FormDoc";
import "./dohle.css";

type Go = (url: string) => void;

// A jackdaw on a branch, grey nape and pale eye.
const Jackdaw = (
  <svg viewBox="0 0 46 40" aria-hidden="true">
    <path d="M6 34h34" stroke="#8a6d3b" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M12 30c0-9 5-16 13-17 3-5 9-6 12-2l5 1-5 2c1 7-3 14-10 16l-5 1-3 3-1-3Z" fill="#111" />
    <path d="M25 13c3-4 8-5 11-2-1 4-5 6-9 6Z" fill="#7d8590" />
    <circle cx="35" cy="12.5" r="1.6" fill="#e8eef5" />
    <path d="M16 30l-2 4M20 31l-1 3" stroke="#111" strokeWidth="1.5" />
  </svg>
);

function Questionnaire({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const year = yearOf(game.hour), tax = game.tax;
  const [expected, setExpected] = useState("");
  const [small, setSmall] = useState(false);
  if (tax.answered !== null) {
    const number = taxNumber(game);
    return (
      <section className="dh-box">
        <header>{t("ui-tax.dohle.questionnaire")}</header>
        <table>
          <tbody>
            <tr><th>{t("ui-tax.dohle.company")}</th><td>{game.company.name}</td></tr>
            <tr><th>{t("ui-tax.dohle.sentOn")}</th><td>{paperDay(tax.answered)}</td></tr>
            <tr><th>{t("ui-tax.dohle.expected", { year: tax.since })}</th><td>{euro(tax.expected)}</td></tr>
            <tr><th>{t("ui-tax.dohle.rule")}</th><td>{t(tax.small ? "ui-tax.dohle.ruleSmall" : "ui-tax.dohle.ruleStandard")}</td></tr>
            <tr><th>{t("ui-tax.dohle.taxNumber")}</th><td>{number ?? t("ui-tax.dohle.pending")}</td></tr>
          </tbody>
        </table>
      </section>
    );
  }
  return (
    <form className="dh-box" onSubmit={(e) => { e.preventDefault(); act(answerQuestionnaire, Number(expected), small); }}>
      <header>{t("ui-tax.dohle.questionnaire")}</header>
      <table>
        <tbody>
          <tr><th>{t("ui-tax.dohle.company")}</th><td>{game.company.name}</td></tr>
          <tr>
            <th><label htmlFor="dh-expected">{t("ui-tax.dohle.expected", { year })}</label></th>
            <td><input id="dh-expected" type="number" min={0} step={100} required value={expected} onChange={(e) => setExpected(e.target.value)} /> €</td>
          </tr>
          <tr><th>{t("ui-tax.dohle.limit", { year })}</th><td>{euro(smallLimit(year))}</td></tr>
          <tr>
            <th>{t("ui-tax.dohle.rule")}</th>
            <td>
              <label><input type="radio" name="dh-rule" checked={!small} onChange={() => setSmall(false)} /> {t("ui-tax.dohle.ruleStandard")}</label>
              <label><input type="radio" name="dh-rule" checked={small} onChange={() => setSmall(true)} /> {t("ui-tax.dohle.ruleSmall")}</label>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="dh-buttons"><button type="submit">{t("ui-tax.dohle.send")}</button></div>
    </form>
  );
}

function Body({ game, path }: { game: GameState; path: string }) {
  const page = path.replace(/\/$/, "");
  if (page === "/erfassung") return <><h1>{t("ui-tax.dohle.questionnaire")}</h1><Questionnaire game={game} /></>;
  return (
    <>
      <h1>{t("ui-tax.dohle.welcome")}</h1>
      <p>{t("ui-tax.dohle.welcomeText")}</p>
    </>
  );
}

// docs/design/plans/tax-office.md: DOHLE, the tax administration's filing site.
export function DohleSite({ game, path, go }: { game: GameState; path: string; go: Go }) {
  const tabs: [string, string][] = [[t("ui-tax.dohle.home"), "/"], [t("ui-tax.dohle.questionnaire"), "/erfassung/"]];
  return (
    <div className="dh">
      <div className="dh-page">
        <div className="dh-head">
          {Jackdaw}
          <div>
            <div className="dh-title">DOHLE</div>
            <div className="dh-sub">{t("ui-tax.dohle.subtitle")}</div>
          </div>
        </div>
        <nav className="dh-tabs">
          {tabs.map(([label, p]) => (
            <a key={p} href={`#www.${DOHLE_HOST}${p}`} aria-current={p === path || undefined} onClick={(e) => { e.preventDefault(); go(`www.${DOHLE_HOST}${p}`); }}>{label}</a>
          ))}
        </nav>
        <div className="dh-main"><Body game={game} path={path} /></div>
        <div className="dh-foot">
          <span>{t("ui-tax.dohle.foot")}</span>
        </div>
      </div>
    </div>
  );
}
