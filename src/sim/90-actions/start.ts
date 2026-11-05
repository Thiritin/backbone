import { newGame, type GameState } from "../50-state";
import { challengeById } from "../10-catalog/challenges";
import { capacityAt, datacenterById } from "../20-world/datacenters";
import { EARLY_HOURS } from "../10-catalog/used";
import { monthListings } from "../80-business/used";

// economy/starting-state.md, Starting state: an empty basement rack. The player buys the first server and sets it up as a panel server or
// a hypervisor with a panel VM; the first order email arrives within two weeks of that panel host going online.

// Monday 3 January 2005, 08:00, when the trade office opens.
export const OPEN_HOUR = 56;

// The tick fills the used market at each month start after the first, so January's listings come with the new game,
// all of them up from the first hour.
function opened(seed: number): GameState {
  const s = newGame(seed);
  s.used = monthListings(s).map((l) => ({ ...l, postedAt: s.hour - EARLY_HOURS }));
  s.hour = OPEN_HOUR;
  return s;
}

export const startGame = (seed: number): GameState => opened(seed);

// A weekly challenge: its seed plus its twist (10-catalog/challenges.ts). A datacenter twist fills every other datacenter.
export function startChallenge(id: string): GameState {
  const c = challengeById(id);
  if (!c) throw new Error(`unknown challenge ${id}`);
  const s = opened(c.seed);
  s.challenge = c.id;
  const t = c.twist;
  if (t.kind === "line") s.homeLine = { id: t.line, next: null };
  if (t.kind === "dc") s.dcs = Object.fromEntries(Object.keys(s.dcs).map(datacenterById).map((dc) => [dc.id, dc.id === t.dc ? s.dcs[dc.id] : { others: capacityAt(dc, 2005) }]));
  return s;
}
