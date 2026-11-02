import { t } from "../../../i18n/en";
import { mailBuild } from "../../../sim/10-catalog/pear-mail";
import { dismissPearWelcome } from "../../../sim/90-actions/pear-mail";
import { PearMailMark } from "../../art/mailmarks";
import { useStore } from "../../store";
import "./pear-mail.css";

export function PearMailApp() {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const build = mailBuild(game.os, game.hour), pm = game.pearMail;
  return (
    <div className="pm" data-build={build.version}>
      <div className="pm-toolbar" />
      <div className="pm-split">
        <aside className="sidebar pm-side" />
        <main className="pm-main"><span className="pm-build">{t("pearMail.build", { version: build.version })}</span></main>
      </div>
      {!pm.welcomed && !pm.accounts.length && (
        <div className="pm-sheet" role="dialog" aria-labelledby="pm-welcome">
          <PearMailMark className="pm-sheet-icon" />
          <h2 id="pm-welcome">{t("pearMail.welcome.title")}</h2>
          <button className="btn primary" onClick={() => act(dismissPearWelcome)}>{t("pearMail.welcome.add")}</button>
        </div>
      )}
    </div>
  );
}
