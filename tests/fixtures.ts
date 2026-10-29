import type { Resources } from "../src/sim/10-catalog/products";
import { device, type GameState } from "../src/sim/50-state";
import { addNode, createCluster, createPanelVm, installPanel } from "../src/sim/90-actions/clusters";
import { startGame, welcomeFriends } from "../src/sim/90-actions/start";
import { fillLines } from "../src/sim/80-business/website";

const done = (s: GameState, id: string, patch: Partial<GameState["clusters"][number]>) => {
  s.clusters = s.clusters.map((c) => (c.id === id ? { ...c, ...patch, switching: null } : c));
  return id;
};
const must = (r: { ok: boolean; id?: string; error?: string }): string => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};

export const BASEMENT_SERVER = "dev3";

// The basement server and switch new games used to start with, cabled to the home router and paid from the savings; suites
// that are not about the first server start from it.
export function withServer(s: GameState): GameState {
  s.cash -= 2500;
  s.devices.unshift(device("dev3", "g1-compute", "Dwell", "rack2", 1, null, "fra1-srv-01", 2500), device("dev4", "sw-8", "Sysko", "rack2", 24, null, "fra1-sw-01", 60));
  s.cables.push(
    { id: "cab6", a: { device: "dev3", port: 0 }, b: { device: "dev4", port: 0 }, kind: "copper", color: null },
    { id: "cab7", a: { device: "dev4", port: 7 }, b: { device: "dev5", port: 0 }, kind: "copper", color: null },
  );
  return s;
}

// A hypervisor cluster with its hypervisor already installed, as an old save loads it; returns the cluster id.
export const installed = (s: GameState, clusterId: string, platform = "proxmocks"): string => done(s, clusterId, { platform });

// A panel VM on a hypervisor cluster with its panel already installed; returns the panel host id.
export const panelVm = (s: GameState, clusterId: string, panel = "freepanel", size?: Resources): string =>
  done(s, must(createPanelVm(s, clusterId, panel, size)), { panel });

// A bare-metal panel host on a free mounted server with its panel already installed; returns the panel host id.
export const panelServer = (s: GameState, deviceId: string, panel = "freepanel"): string => done(s, must(installPanel(s, deviceId, panel)), { panel });

// The basement server as the hypervisor cluster "Basement 1" with Proxmocks installed; returns the cluster id.
export function basement(s: GameState): string {
  const id = installed(s, must(createCluster(s, "loc1", "Basement 1")));
  must({ ...addNode(s, id, BASEMENT_SERVER), id });
  return id;
}

// A new company after the setup: Proxmocks on the starting basement server with a FreePanel VM, the friends moved in and every
// line they sell on the website.
export function readyGame(seed: number): GameState {
  const s = withServer(startGame(seed));
  welcomeFriends(s, panelVm(s, basement(s)));
  return fillLines(s, undefined);
}
