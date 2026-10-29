import type { GameState } from "../sim/50-state";
import { startGame } from "../sim/90-actions/start";
import { changeKeys, type ChangelogDay } from "./changelog";

declare const __CHANGELOG__: ChangelogDay[];

// The changelog this build was made with.
export const EMBEDDED = __CHANGELOG__;

// A new company has seen every entry of this build, so only later entries show up for it.
export const newCompany = (seed: number): GameState => ({ ...startGame(seed), seenChanges: changeKeys(EMBEDDED) });
