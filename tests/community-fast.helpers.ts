import { communityTick } from "../src/sim/80-business/sponsoring";
import { type GameState } from "../src/sim/50-state";
import { readyGame, ticketOf } from "./community.helpers";

// Requests, lapses and 50% answers live in the community step alone, so waiting on them skips the rest of the tick.
export const communityTo = (s: GameState, hour: number) => { while (s.hour < hour) { s.hour++; communityTick(s); } };
export const awaitRequests = (s: GameState, n: number) => { while (s.sponsorships.length < n) { s.hour++; communityTick(s); } };

const firstRequest = new Map<string, GameState>();

// The first request of a new company, optionally swapped for another event.
export function asked(seed: number, event?: string, roomy = true): GameState {
  const key = `${seed}:${roomy}`;
  if (!firstRequest.has(key)) {
    const g = readyGame(seed);
    if (roomy) for (const c of g.devices.find((d) => d.id === "dev3")!.components) if (c.kind === "ram") c.size = 16;
    awaitRequests(g, 1);
    firstRequest.set(key, g);
  }
  const s = structuredClone(firstRequest.get(key)!);
  if (event) {
    s.sponsorships[0].event = event;
    ticketOf(s).topic = event;
  }
  return s;
}
