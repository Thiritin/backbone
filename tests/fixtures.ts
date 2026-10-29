import { hourOf } from "../src/sim/00-core/time";
import { modelById } from "../src/sim/10-catalog/hardware";
import type { Resources } from "../src/sim/10-catalog/products";
import { device, type GameState } from "../src/sim/50-state";
import { buyCart as buyCartReal, buyDevice as buyDeviceReal } from "../src/sim/90-actions/hardware";
import { addNode, createPanelVm, installHypervisor, installPanel, workload } from "../src/sim/90-actions/clusters";
import { startGame, welcomeFriends } from "../src/sim/90-actions/start";
import { fillLines } from "../src/sim/80-business/website";
import { derivedDomain } from "../src/sim/30-customers/domains";
import { register } from "../src/sim/30-customers/registry";
import { nodeName } from "../src/sim/30-customers/hostnames";

const done = (s: GameState, id: string, patch: Partial<GameState["clusters"][number]>) => {
  s.clusters = s.clusters.map((c) => (c.id === id ? { ...c, ...patch, switching: null } : c));
  return id;
};
const must = (r: { ok: boolean; id?: string; error?: string }): string => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};

// Moves a game that started in 2005 on to the first day of the year, for software that is not on the market at the start.
export const skipTo = (s: GameState, year: number): void => { s.hour += hourOf(new Date(Date.UTC(year, 0, 1))); };

export const BASEMENT_SERVER = "dev3";

// A running workload on every server without one, so it draws its rated power instead of the idle power.
export const runServers = (s: GameState): void => {
  const busy = new Set(s.workloads.map((w) => w.deviceId));
  for (const d of s.devices) if (modelById(d.model).server && !busy.has(d.id)) s.workloads = [...s.workloads, workload(s, "", { deviceId: d.id })];
};

// The basement server and switch new games used to start with, cabled to the home router and paid from the savings, on the
// business DSL line with an own /24 announced there; suites that are not about the first server or addresses start from it.
export function withServer(s: GameState): GameState {
  s.cash -= 2500;
  s.homeLine = { id: "dsl-16-biz", next: null };
  s.ips = { ...s.ips, blocks: [{ id: "blk-test", prefix: "185.1.0.0/24", size: 256, locationId: "loc1", boughtAt: 0 }] };
  s.devices.unshift(device("dev3", "g1-compute", "Dwell", "rack2", 1, null, "fra1-srv-01", 2500), device("dev4", "sw-8", "Sysko", "rack2", 24, null, "fra1-sw-01", 60));
  s.devices[0].hostname = nodeName(s);
  s.cables.push(
    { id: "cab6", a: { device: "dev3", port: 0 }, b: { device: "dev4", port: 0 }, kind: "copper", color: null },
    { id: "cab7", a: { device: "dev4", port: 7 }, b: { device: "dev5", port: 0 }, kind: "copper", color: null },
  );
  return s;
}

// The servers with the hypervisor already installed, joined into one cluster under the name; returns the cluster id.
export function hypervisor(s: GameState, deviceIds: string[], name?: string, platform = "proxmocks"): string {
  const [id] = deviceIds.map((d) => done(s, must(installHypervisor(s, d, platform)), { platform }));
  for (const d of deviceIds.slice(1)) must({ ...addNode(s, id, d), id });
  return name ? done(s, id, { name }) : id;
}
// Installs the cluster's hypervisor on the server, already done, and joins it to the cluster.
export function join(s: GameState, clusterId: string, deviceId: string) {
  hypervisor(s, [deviceId], undefined, s.clusters.find((c) => c.id === clusterId)!.platform!);
  must({ ...addNode(s, clusterId, deviceId), id: clusterId });
}

// A panel VM on a hypervisor cluster with its panel already installed; returns the panel host id.
export const panelVm = (s: GameState, clusterId: string, panel = "freepanel", size?: Resources): string =>
  done(s, must(createPanelVm(s, clusterId, panel, size)), { panel });

// A bare-metal panel host on a free mounted server with its panel already installed; returns the panel host id.
export const panelServer = (s: GameState, deviceId: string, panel = "freepanel"): string => done(s, must(installPanel(s, deviceId, panel)), { panel });

// The company has learned Provisioning automation and switched on Place orders automatically.
export const automate = (s: GameState): GameState => {
  s.unlocks = [...new Set([...s.unlocks, "products", "provisioning"])];
  s.autoOrders = true;
  return s;
};

// The basement server as the hypervisor cluster "Basement 1" with Proxmocks installed; returns the cluster id.
export const basement = (s: GameState): string => hypervisor(s, [BASEMENT_SERVER], "Basement 1");

// A new company after the setup: Proxmocks on the starting basement server with a FreePanel VM, the friends moved in and every
// line they sell on the website.
export function readyGame(seed: number): GameState {
  const s = withServer(startGame(seed));
  welcomeFriends(s, panelVm(s, basement(s)));
  return withCompany(fillLines(s, undefined));
}

// The company has signed with NameCheep, owns its derived domain and books Hosted Exchange for the owner, which a game needs
// before it can go online; suites that are not about domains or email start from it.
export function withCompany(s: GameState): GameState {
  s.registrar = { id: "nameCheep", since: 0, tier: 0, billed: true, transfer: null };
  const name = derivedDomain(s);
  s.company = { ...s.company, domain: name, mail: { kind: "external", provider: "hostedExchange", seats: 1 } };
  register(s, name, null, false);
  return s;
}

// Purchases that land at once, so a test can mount what it bought in the same hour. Tests of the delivery wait use the real
// actions from src/sim/90-actions/hardware.
const landing = <T extends unknown[], R>(buy: (s: GameState, ...a: T) => R) => (s: GameState, ...a: T): R => {
  const moving = new Set(s.devices.filter((d) => d.arriveAt !== null).map((d) => d.id));
  const r = buy(s, ...a);
  for (const d of s.devices) if (d.arriveAt !== null && !moving.has(d.id)) Object.assign(d, { store: d.transitTo, transitTo: null, arriveAt: null });
  return r;
};
export const buyDevice = landing(buyDeviceReal);
export const buyCart = landing(buyCartReal);
