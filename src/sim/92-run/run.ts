import type { Company, GameState, LogEntry } from "../50-state";
import { nowMinutes } from "../00-core/time";
import { tickMinute } from "../88-tick/tick";
import { runAction } from "../90-actions/index";
import { startChallenge, startGame } from "../90-actions/start";
import { SCORE_END, scores, type Scores } from "../80-business/scores";
import { metrics } from "../metrics";

// A run file: what anyone needs to replay a game and check the scores it claims.
export interface RunFile { version: string; seed: number; city: string; challenge: string | null; actions: LogEntry[]; claimed: Scores }

// A leader's customers and net worth once a week, for the desktop widget: [hour, customers, net worth].
export type Ghost = [number, number, number][];
export interface Entry extends Scores { company: string; color: string; logo: string; seed: number }
export interface Board { netWorth: Entry[]; level3: Entry[]; happiness: Entry[]; ghost: Ghost }
// leaderboard.json: boards by build id, then by challenge id ("free" for games without one).
export type Leaderboard = Record<string, Record<string, Board>>;
export interface Verified { version: string; challenge: string | null; company: Pick<Company, "name" | "color" | "logo">; seed: number; scores: Scores; ghost: Ghost }

export const runFile = (s: GameState, version: string): RunFile => ({
  version, seed: s.seed, city: s.locations[0].city, challenge: s.challenge, actions: s.log.filter((e) => e.hour < SCORE_END), claimed: scores(s),
});

export const runFileName = (s: GameState): string =>
  `${s.company.name.normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "company"}-${s.seed}.run.json`;

// Starts the game from the run's seed and challenge, applies each action at its minute with the ticks in between, and plays
// on to until, the end of 2007 by default. Throws when the run cannot have come from this game.
export function replay(run: RunFile, each?: (s: GameState) => void, until = SCORE_END): GameState {
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

// The claimed scores against the replayed ones, within their rounding: whole euros and tenths of a happiness point.
export function mismatches(claimed: Scores, got: Scores): string[] {
  const off = (a: number | null, b: number | null, by: number) => (a === null) !== (b === null) || (a !== null && b !== null && Math.abs(a - b) > by);
  return [
    off(claimed.netWorth, got.netWorth, 1) && `net worth ${claimed.netWorth} claimed, ${got.netWorth} replayed`,
    off(claimed.level3, got.level3, 0) && `level 3 at hour ${claimed.level3} claimed, ${got.level3} replayed`,
    off(claimed.happiness, got.happiness, 0.1) && `happiness ${claimed.happiness} claimed, ${got.happiness} replayed`,
  ].filter((x): x is string => !!x);
}

export function verify(run: RunFile): { verified: Verified; errors: string[] } {
  const ghost: Ghost = [];
  const s = replay(run, (g) => {
    if (g.hour % 168 === 0 && g.hour <= SCORE_END) {
      const m = metrics(g);
      ghost.push([g.hour, m.customers, Math.round(m.netWorth)]);
    }
  });
  const got = scores(s);
  const { name, color, logo } = s.company;
  return { verified: { version: run.version, challenge: run.challenge, company: { name, color, logo }, seed: run.seed, scores: got, ghost }, errors: mismatches(run.claimed, got) };
}

const TOP = 50;
const entry = (r: Verified): Entry => ({ company: r.company.name, color: r.company.color, logo: r.company.logo, seed: r.seed, ...r.scores });

// Top 50 per build and challenge by each score; the ghost is the net worth leader's.
export function buildLeaderboard(runs: Verified[]): Leaderboard {
  const groups: Record<string, Record<string, Verified[]>> = {};
  for (const r of runs) ((groups[r.version] ??= {})[r.challenge ?? "free"] ??= []).push(r);
  const out: Leaderboard = {};
  for (const [version, byChallenge] of Object.entries(groups)) {
    for (const [challenge, here] of Object.entries(byChallenge)) {
      const top = (k: keyof Scores, dir: 1 | -1) => here.filter((r) => r.scores[k] !== null).sort((a, b) => dir * (a.scores[k]! - b.scores[k]!)).slice(0, TOP);
      const byWorth = top("netWorth", -1);
      (out[version] ??= {})[challenge] = { netWorth: byWorth.map(entry), level3: top("level3", 1).map(entry), happiness: top("happiness", -1).map(entry), ghost: byWorth[0]?.ghost ?? [] };
    }
  }
  return out;
}
