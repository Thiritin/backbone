import type { GameState } from "../src/sim/50-state";
import { startGame, welcomeFriends } from "../src/sim/90-actions/start";
import { fillLines } from "../src/sim/80-business/website";

// A cluster with its panel and platform already installed, as an old save loads it; returns the cluster id.
export function installed(s: GameState, clusterId: string, panel = "freepanel", platform = "proxmocks"): string {
  s.clusters = s.clusters.map((c) => (c.id === clusterId ? { ...c, panel, platform } : c));
  return clusterId;
}

// A new company after the setup: FreePanel and Proxmocks installed on the basement server, the friends moved in and
// every line they sell on the website.
export function readyGame(seed: number): GameState {
  const s = startGame(seed), id = installed(s, s.clusters[0].id);
  welcomeFriends(s, id);
  return fillLines(s, undefined);
}
