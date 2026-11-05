import { t } from "../../../i18n/en";
import { cardBoard, CHAPTER1, nextGoal, type Card as Chapter } from "../../../sim/checklist";
import type { GameState } from "../../../sim/50-state";
import { cardOf, type StepId } from "../../apps/guide";
import { appByName, appTitle } from "../../apps/registry";
import { useStore } from "../../store";
import { Slab } from "./Slab";
import "./corkboard.css";

export interface Card { id: string; card: Chapter; done: boolean; wait: boolean }
export interface Board { cards: Card[]; under: number; current?: string }
export interface Spot { id: string; name: string }

// The current chapter's cards; once the first chapter is done, the later steps are pinned over it.
export function boardOf(s: GameState): Board {
  const b = cardBoard(s);
  const cards = b.cards.map((c, i) => ({ id: c.id, card: c, done: b.done[i], wait: b.wait[i] }));
  return { cards, under: b.cards[0]?.chapter === 2 ? CHAPTER1.length : 0, current: b.current?.id };
}

// Steps done in the room, by what the player walks to: a fixture id, or "rack" for the room's first rack.
export const ROOM_STEP: Partial<Record<StepId, string>> = { payBill: "letterbox", mountServer: "rack", mountRouter: "shelf" };

export function CorkboardPanel({ title, spot, onGlow, onClose }: {
  title: string; spot: (key: string) => Spot | null; onGlow: (id: string) => void; onClose: () => void;
}) {
  const game = useStore((s) => s.game), openApp = useStore((s) => s.openApp);
  const { cards, under, current } = boardOf(game);
  const line = (card: Chapter) => {
    const { step } = cardOf(game, card), at = ROOM_STEP[nextGoal(game, card)] && spot(ROOM_STEP[nextGoal(game, card)]!);
    return at
      ? <button className="cb-do" data-go={at.id} onClick={() => { onClose(); onGlow(at.id); }}>{t("world.board.walk", { place: at.name })}</button>
      : <button className="cb-do" data-app={step.app} onClick={() => { onClose(); openApp(step.app, step.focus); }}>{t("world.board.sit", { app: appTitle(appByName(step.app)) })}</button>;
  };
  return (
    <Slab title={title} onClose={onClose} data={{ corkboard: "" }}>
      <div className="wp-scene"><div className="cb-board">
        {under > 0 && <ol className="cb-cards cb-under" aria-hidden>{CHAPTER1.map((c) => <li key={c.id} className="cb-card done"><b>{t(`guide.card.${c.id}`)}</b></li>)}</ol>}
        <ol className="cb-cards">
          {cards.map(({ id, card, done, wait }, i) => {
            const { title, text } = cardOf(game, card), cur = id === current;
            return (
              <li key={id} className={`cb-card${done ? " done" : ""}${cur ? " cur" : ""}`} data-step={id} data-done={done} data-wait={wait} style={{ rotate: `${((i * 37) % 7 - 3) * 0.4}deg` }}>
                <i className="cb-pin" />
                <b>{title}</b>
                <span>{text}</span>
                {wait && <em className="cb-wait">{t("guide.next.waiting")}</em>}
                {done && <svg className="cb-tick" viewBox="0 0 24 24" aria-hidden><path d="M4 13l5 5L20 6" /></svg>}
                {cur && line(card)}
              </li>
            );
          })}
        </ol>
      </div></div>
    </Slab>
  );
}
