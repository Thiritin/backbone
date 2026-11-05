import { X } from "lucide-react";
import { t } from "../../i18n/en";
import { cardBoard, checkDone } from "../../sim/checklist";
import { cardOf } from "../apps/guide";
import { openStep } from "../apps/GuideApp";
import { useStore } from "../store";

// The room's version of the next-step card: it follows the same board and shows the same text and progress.
// Closed, it leaves a small chip that brings it back.
export function NextStrip() {
  const game = useStore((s) => s.game), on = useStore((s) => s.guideStrip), set = useStore((s) => s.setGuideStrip);
  const { cards, done, wait, current } = cardBoard(game);
  const shown = current ?? cards[done.indexOf(false)];
  if (!shown) return null;
  if (!on) return <button className="w-next-chip" onClick={() => set(true)}>{t("doc.guide")}</button>;
  const { title, text, step } = cardOf(game, shown);
  const parts = shown.goals.filter((g) => checkDone(game, g)).length, waits = wait[cards.indexOf(shown)];
  return (
    <aside className="w-next" data-next={shown.id}>
      <div className="w-next-text"><b>{title}{shown.goals.length > 1 && !waits && <span className="w-next-n num">{parts}/{shown.goals.length}</span>}</b><span>{text}</span></div>
      {waits ? <span className="w-next-wait">{t("guide.next.waiting")}</span> : <button className="btn primary" onClick={() => openStep(game, shown, step)}>{t("apps.open")}</button>}
      <button className="w-next-x" aria-label={t("apps.close")} onClick={() => set(false)}><X size={14} /></button>
    </aside>
  );
}
