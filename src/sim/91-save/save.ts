import { newGame, SAVE_VERSION, type GameState } from "../50-state";

// ponytail: plain JSON in localStorage; compress once saves approach the ~5 MB limit.
export const serialize = (state: GameState): string => JSON.stringify(state);

const INFRA = ["nextId", "locations", "racks", "devices", "cables"] as const;

// Old saves keep loading: every field missing from a save takes its new-game default.
// A version 1 save (the basement shelf, or no infrastructure at all) gets the version 2 starting infrastructure.
export function deserialize(raw: string): GameState {
  const data = JSON.parse(raw) as Partial<GameState>;
  if (typeof data.seed !== "number") throw new Error("save has no seed");
  const base = newGame(data.seed);
  if ((data.version ?? 1) < 2) for (const k of INFRA) delete data[k];
  return { ...base, ...data, rng: { ...base.rng, ...data.rng }, version: SAVE_VERSION };
}
