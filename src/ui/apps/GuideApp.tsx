import { Check } from "lucide-react";
import { t } from "../../i18n/en";
import { cardBoard, checkDone, nextGoal } from "../../sim/checklist";
import { cardOf, type Step } from "./guide";
import { playerAt } from "../../sim/60-infra/handwork";
import { wikiUrl } from "./browser/sites/wiki/articles";
import { useStore } from "../store";

const LIST_H = 470, CARD_H = 250;
// The card grows to hold the list when it is unfolded.
const fit = (open: boolean) => useStore.setState(({ windows }) => ({ windows: windows.map((w) => (w.app === "Getting started" ? { ...w, h: open ? LIST_H : CARD_H } : w)) }));
import "./checklist/checklist.css";

// The next-step card: the current step, one button that opens it, progress, and the whole list folded away.
export function GuideApp() {
  const game = useStore((s) => s.game);
  const openApp = useStore((s) => s.openApp), openDoc = useStore((s) => s.openDoc);
  const { cards, done, wait, current } = cardBoard(game);
  const left = done.indexOf(false), shown = current ?? cards[left];
  const finished = done.filter(Boolean).length;
  if (!shown) return <article className="guide next"><h2>{t("guide.next.done")}</h2></article>;
  // A mounting step walks the player to the rack in the room instead of opening Locations.
  const open = (step: Step) => {
    const home = game.locations.find((l) => l.space === "basement"), goal = nextGoal(game, shown);
    if ((goal === "mountServer" || goal === "mountRouter") && home && playerAt(game).id === home.id) useStore.setState({ surface: "world", seek: goal === "mountRouter" ? "rack:shelf" : "rack:rack" });
    else openApp(step.app, step.focus);
  };
  const { title, text, step } = cardOf(game, shown);
  const waits = wait[cards.indexOf(shown)];
  const parts = shown.goals.filter((g) => checkDone(game, g)).length;
  return (
    <article className="guide next">
      <div className="next-head"><h2>{title}</h2><span className="next-count">{finished}/{cards.length}</span></div>
      <div className="next-bar" role="progressbar" aria-valuemin={0} aria-valuemax={cards.length} aria-valuenow={finished}><i style={{ width: `${(finished / cards.length) * 100}%` }} /></div>
      <p>{text}</p>
      <div className="next-actions">
        {waits ? <span className="next-wait">{t("guide.next.waiting")}</span> : <button className="btn primary" onClick={() => open(step)}>{t("apps.open")}</button>}
        {shown.goals.length > 1 && !waits && <span className="next-count num">{parts}/{shown.goals.length}</span>}
        {shown.id === "payBill" && game.docs.some((d) => d.id === "tans") && <button className="btn" onClick={() => openDoc("tans")}>{t("doc.tans")}</button>}
        <button className="btn" onClick={() => openApp("Browser", { kind: "url", id: wikiUrl("Help:Playing_the_game") })}>{t("guide.help")}</button>
      </div>
      <details className="next-all" onToggle={(e) => fit(e.currentTarget.open)}>
        <summary>{t("guide.next.all")}</summary>
        <ol className="guide-steps">
          {cards.map((c, i) => (
            <li key={c.id} className={`chk-row${done[i] ? " done" : ""}${c === shown ? " cur" : ""}`}>
              <span className={`chk-box${done[i] ? " done" : ""}`}>{done[i] && <Check />}</span>
              <div className="grow"><span className="cus-strong">{cardOf(game, c).title}</span></div>
              {wait[i] && <span className="cus-dim">{t("guide.next.waiting")}</span>}
            </li>
          ))}
        </ol>
      </details>
    </article>
  );
}
