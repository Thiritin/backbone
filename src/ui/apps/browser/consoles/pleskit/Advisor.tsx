import { t } from "../../../../../i18n/en";
import type { GameState } from "../../../../../sim/50-state";
import type { Cluster } from "../../../../../sim/60-infra/cluster";
import { advisorChecks } from "../../../../../sim/80-business/readouts";

// The Advisor card of the late Pleskit look: a score ring and the findings that lower it.
export function Advisor({ game, c, onFix }: { game: GameState; c: Cluster; onFix: () => void }) {
  const { score, checks } = advisorChecks(game, c), band = score >= 90 ? "ok" : score >= 70 ? "warn" : "bad";
  return (
    <section className="pk-box pk-advisor">
      <h2>{t("readouts.advisor")}</h2>
      <div className="pk-adv-body">
        <div className="pk-ring" data-level={band} style={{ ["--score" as string]: `${score}%` }}><b className="num">{score}</b></div>
        <ul>
          {checks.map((x) => (
            <li key={x.kind}>
              <span>{t(`readouts.adv.${x.kind}`, { n: x.count })}</span>
              <button className="cx-btn" onClick={onFix}>{t("readouts.adv.fix")}</button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
