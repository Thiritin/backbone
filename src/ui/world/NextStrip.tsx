import { X } from "lucide-react";
import { t } from "../../i18n/en";
import { cardBoard } from "../../sim/checklist";
import { cardOf } from "../apps/guide";
import { openStep } from "../apps/GuideApp";
import { useStore } from "../store";

// The room's version of the next-step card: it follows the same board and goes away with the card.
export function NextStrip() {
  const game = useStore((s) => s.game), win = useStore((s) => s.windows.find((w) => w.app === "Getting started")), close = useStore((s) => s.close);
  const { cards, done, wait, current } = cardBoard(game);
  const shown = current ?? cards[done.indexOf(false)];
  if (!win || !shown) return null;
  const { title, text, step } = cardOf(game, shown);
  return (
    <aside className="w-next" data-next={shown.id}>
      <div className="w-next-text"><b>{title}</b><span>{text}</span></div>
      {wait[cards.indexOf(shown)] ? <span className="w-next-wait">{t("guide.next.waiting")}</span> : <button className="btn primary" onClick={() => openStep(game, shown, step)}>{t("apps.open")}</button>}
      <button className="w-next-x" aria-label={t("apps.close")} onClick={() => close(win.id)}><X size={14} /></button>
    </aside>
  );
}
