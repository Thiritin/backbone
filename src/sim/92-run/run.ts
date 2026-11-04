import type { GameState, LogEntry } from "../50-state";
import { nowMinutes } from "../00-core/time";
import { tickMinute } from "../88-tick/tick";
import { runAction } from "../90-actions/index";
import { startChallenge, startGame } from "../90-actions/start";

// A run file: what anyone needs to replay a game.
export interface RunFile { version: string; seed: number; city: string; challenge: string | null; actions: LogEntry[] }

export const runFile = (s: GameState, version: string): RunFile => ({
  version, seed: s.seed, city: s.locations[0].city, challenge: s.challenge, actions: s.log,
});

// Starts the game from the run's seed and challenge, applies each action at its minute with the ticks in between, and plays
// on to until. Throws when the run cannot have come from this game.
export function replay(run: RunFile, until: number, each?: (s: GameState) => void): GameState {
  const s = run.challenge ? startChallenge(run.challenge) : startGame(run.seed);
  if (s.seed !== run.seed) throw new Error(`seed ${run.seed} is not the seed of ${run.challenge}`);
  if (s.locations[0].city !== run.city) throw new Error(`city ${run.city} is not ${s.locations[0].city}`);
  const step = () => { tickMinute(s); if (s.minute === 0) each?.(s); };
  run.actions.forEach((e, i) => {
    const at = e.hour * 60 + (e.minute ?? 0);
    if (at < nowMinutes(s)) throw new Error(`action ${i + 1} (${e.name}) is out of order`);
    while (nowMinutes(s) < at) step();
    const r = runAction(s, e.name, e.args);
    if (!r.ok) throw new Error(`action ${i + 1} (${e.name}) failed with ${r.error}`);
  });
  while (s.hour < until && s.gameOver === null) step();
  return s;
}
