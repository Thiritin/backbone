import { Fragment } from "react";
import { Check } from "lucide-react";
import { t } from "../../i18n/en";
import { checkDone, guideSteps } from "../../sim/checklist";
import { STEP_WIKI, stepOf } from "./guide";
import { wikiUrl } from "./browser/sites/wiki/articles";
import { useStore } from "../store";
import "./customers/customers.css";
import "./checklist/checklist.css";

// Text with <kbd>key</kbd> markers as JSX.
const keys = (text: string) => text.split(/<kbd>(.*?)<\/kbd>/).map((part, i) => (i % 2 ? <kbd key={i}>{part}</kbd> : <Fragment key={i}>{part}</Fragment>));

export function GuideApp() {
  const game = useStore((s) => s.game);
  const openApp = useStore((s) => s.openApp);
  return (
    <article className="guide">
      <h2>{t("apps.guide.title")}</h2>
      <p>{t("apps.guide.intro")}</p>
      <h3>{t("apps.guide.firstServer")}</h3>
      <p>{t("apps.guide.friends")}</p>
      <ol className="guide-steps">
        {guideSteps(game).map((id) => {
          const done = checkDone(game, id);
          const step = stepOf(game, id);
          return (
            <li key={id} className={`chk-row${done ? " done" : ""}`}>
              <span className={`chk-box${done ? " done" : ""}`}>{done && <Check />}</span>
              <div className="grow">
                <span className="cus-strong">{step.title}</span>
                <span className="cus-dim">{step.text}</span>
              </div>
              {STEP_WIKI[id] && <button className="btn" onClick={() => openApp("Browser", { kind: "url", id: wikiUrl(STEP_WIKI[id]!) })}>{t("apps.guide.wiki")}</button>}
              {!done && <button className="btn" onClick={() => openApp(step.app, step.focus)}>{t("apps.open")}</button>}
            </li>
          );
        })}
      </ol>
      <p>{t("apps.guide.loans")}</p>
      <h3>{t("apps.guide.time")}</h3>
      <p>{keys(t("apps.guide.timeText"))}</p>
      <h3>{t("apps.guide.windows")}</h3>
      <p>{t("apps.guide.windowsText")}</p>
      <h3>{t("apps.guide.notifications")}</h3>
      <p>{t("apps.guide.notificationsText")}</p>
      <h3>{t("apps.guide.saving")}</h3>
      <p>{t("apps.guide.savingText")}</p>
    </article>
  );
}
