import { t } from "../../../i18n/en";
import { checkDone, guideSteps, TUTORIAL } from "../../../sim/checklist";
import type { GameState } from "../../../sim/50-state";
import { stepOf, type StepId } from "../../apps/guide";
import { appByName, appTitle } from "../../apps/registry";
import { useStore } from "../../store";
import { Slab } from "./Slab";
import "./corkboard.css";

export interface Card { id: StepId; done: boolean }
export interface Board { cards: Card[]; under: StepId[]; current?: StepId }
export interface Spot { id: string; name: string }

const FIRST: readonly string[] = TUTORIAL;

// The current chapter's cards; once the first chapter is done, the later steps are pinned over it.
export function boardOf(s: GameState): Board {
  const shown = guideSteps(s), first = shown.filter((id) => FIRST.includes(id));
  const over = first.every((id) => checkDone(s, id));
  const cards = (over ? shown.filter((id) => !FIRST.includes(id)) : first).map((id) => ({ id, done: checkDone(s, id) }));
  return { cards, under: over ? first : [], current: cards.find((c) => !c.done)?.id };
}

// Steps done in the room, by what the player walks to: a fixture id, or "rack" for the room's first rack.
export const ROOM_STEP: Partial<Record<StepId, string>> = { payBill: "letterbox", mountServer: "rack", mountRouter: "shelf" };

export function CorkboardPanel({ title, spot, onGlow, onClose }: {
  title: string; spot: (key: string) => Spot | null; onGlow: (id: string) => void; onClose: () => void;
}) {
  const game = useStore((s) => s.game), openApp = useStore((s) => s.openApp);
  const { cards, under, current } = boardOf(game);
  const line = (id: StepId) => {
    const step = stepOf(game, id), at = ROOM_STEP[id] && spot(ROOM_STEP[id]!);
    return at
      ? <button className="cb-do" data-go={at.id} onClick={() => { onClose(); onGlow(at.id); }}>{t("world.board.walk", { place: at.name })}</button>
      : <button className="cb-do" data-app={step.app} onClick={() => { onClose(); openApp(step.app, step.focus); }}>{t("world.board.sit", { app: appTitle(appByName(step.app)) })}</button>;
  };
  return (
    <Slab title={title} onClose={onClose} data={{ corkboard: "" }}>
      <div className="wp-scene"><div className="cb-board">
        {under.length > 0 && <ol className="cb-cards cb-under" aria-hidden>{under.map((id) => <li key={id} className="cb-card done"><b>{stepOf(game, id).title}</b></li>)}</ol>}
        <ol className="cb-cards">
          {cards.map(({ id, done }, i) => {
            const step = stepOf(game, id), cur = id === current;
            return (
              <li key={id} className={`cb-card${done ? " done" : ""}${cur ? " cur" : ""}`} data-step={id} data-done={done} style={{ rotate: `${((i * 37) % 7 - 3) * 0.4}deg` }}>
                <i className="cb-pin" />
                <b>{step.title}</b>
                <span>{step.text}</span>
                {done && <svg className="cb-tick" viewBox="0 0 24 24" aria-hidden><path d="M4 13l5 5L20 6" /></svg>}
                {cur && line(id)}
              </li>
            );
          })}
        </ol>
      </div></div>
    </Slab>
  );
}
