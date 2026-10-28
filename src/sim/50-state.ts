import { createRng, type Rng } from "./00-core/rng";
import { START_CASH } from "./10-catalog/economy";

export const SAVE_VERSION = 1;

export interface GameState {
  version: number;
  seed: number;
  rng: Rng;
  hour: number;
  cash: number;
}

export const newGame = (seed: number): GameState => ({ version: SAVE_VERSION, seed, rng: createRng(seed), hour: 0, cash: START_CASH });
