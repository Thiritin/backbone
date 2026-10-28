import { newGame, SAVE_VERSION, type GameState } from "../50-state";

// ponytail: plain JSON in localStorage; compress once saves approach the ~5 MB limit.
export const serialize = (state: GameState): string => JSON.stringify(state);

// Old saves keep loading: every field missing from a save takes its new-game default.
export function deserialize(raw: string): GameState {
  const data = JSON.parse(raw) as Partial<GameState>;
  if (typeof data.seed !== "number") throw new Error("save has no seed");
  const base = newGame(data.seed);
  return {
    ...base, ...data, rng: { ...base.rng, ...data.rng }, version: SAVE_VERSION,
    billingRules: { ...base.billingRules, ...data.billingRules },
    customers: (data.customers ?? []).map((c) => ({ ...c, history: c.history ?? [] })),
    invoices: (data.invoices ?? []).map((i) => ({ ...i, suspendedAt: i.suspendedAt ?? (i.suspended ? data.hour ?? 0 : null) })),
  };
}
