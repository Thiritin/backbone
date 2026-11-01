import { authCode } from "../src/sim/30-customers/registry";
import type { Address } from "../src/sim/30-customers/addresses";
import { mailedAddress } from "../src/sim/30-customers/addresses";
import { sendInvoice } from "../src/sim/90-actions/billing";
import { MODULE_IDS } from "../src/sim/10-catalog/shops";
import { hourOf } from "../src/sim/00-core/time";
import { componentParts, fits, genOf, modelById, type FormFactor, type PartSpec } from "../src/sim/10-catalog/hardware";
import type { Resources } from "../src/sim/10-catalog/products";
import { device, deviceDefaults, newGame as blankGame, type GameState } from "../src/sim/50-state";
import { START_CASH } from "../src/sim/10-catalog/economy";

// Games with the savings already in hand and no bank account, the way every game started before the account came first.
const funded = (s: GameState): GameState => { s.cash = START_CASH; return s; };
export const newGame = (seed: number): GameState => funded(blankGame(seed));
export const startGame = (seed: number): GameState => funded(startBlank(seed));
import { buyCart as buyCartReal, buyDevice as buyDeviceReal, type CartLine } from "../src/sim/90-actions/hardware";
import { addNode, createPanelVm, installHypervisor, installPanel, workload } from "../src/sim/90-actions/clusters";
import { startGame as startBlank, welcomeFriends } from "../src/sim/90-actions/start";
import { fillLines } from "../src/sim/80-business/website";
import { derivedDomain } from "../src/sim/30-customers/domains";
import { register } from "../src/sim/30-customers/registry";
import { nodeName } from "../src/sim/30-customers/hostnames";
import { setMachine, type Cluster } from "../src/sim/60-infra/cluster";
import { assignedKey, assignKey, isLicensed, issueKey, panelMachine } from "../src/sim/60-infra/licence";
import { topTier } from "../src/sim/10-catalog/licence-tiers";
import { UI_LOOKS, versionsOf } from "../src/sim/10-catalog/software-versions";
import { portPeers } from "../src/sim/60-infra/status";
import { setPortShare } from "../src/sim/90-actions/lan";
import { imageOf, serverOsAt, type OsImage, type ServerOsId } from "../src/sim/10-catalog/server-os";
import { softwareById } from "../src/sim/10-catalog/platforms";
import { yearOf } from "../src/sim/00-core/time";
import { STARTER_APPS } from "../src/sim/10-catalog/store";
import { legacyRegistration } from "../src/sim/80-business/office";

// The cluster's install is finished, on its machines too.
const done = (s: GameState, id: string, patch: Partial<GameState["clusters"][number]>) => {
  const c = s.clusters.find((x) => x.id === id)!;
  for (const m of c.vm ? [c.vm] : c.nodes.map((n) => n.deviceId)) {
    setMachine(s, m, (x) => ({ software: x.software.map((sw) => (sw.doneAt !== null && sw.doneAt > s.hour ? { ...sw, doneAt: s.hour } : sw)) }));
  }
  s.clusters = s.clusters.map((x) => (x.id === id ? { ...x, ...patch, switching: null } : x));
  // A licensed panel holds a key, for its top tier when it has tiers.
  const host = panelMachine(c), panel = patch.panel;
  if (host && panel && isLicensed(panel) && !assignedKey(s, host, panel)) assignKey(s, issueKey(s, panel, topTier(panel)?.id ?? null).id, host);
  return id;
};
const must = (r: { ok: boolean; id?: string; error?: string }): string => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};

// Moves a game that started in 2005 on to the first day of the year, for software that is not on the market at the start.
export const skipTo = (s: GameState, year: number): void => { s.hour += hourOf(new Date(Date.UTC(year, 0, 1))); };

export const BASEMENT_SERVER = "dev3";
// The flat's router (dev5) on the basement rack's top shelf with its DSL port on the line jack (dev6).
export function routerOnLine(s: GameState, slot = 23): GameState {
  Object.assign(s.devices.find((d) => d.id === "dev5")!, { store: null, rackId: "rack2", slot });
  s.cables.push({ id: "cab-line", a: { device: "dev6", port: 0 }, b: { device: "dev5", port: 4 }, kind: "copper", color: null });
  return s;
}

// The machine has the OS installed and booted, as the installer leaves it; returns the machine id.
export function bootedMachine(s: GameState, id: string, os: ServerOsId = "lunix"): string {
  setMachine(s, id, () => ({ os: { id: os, version: serverOsAt(os, yearOf(s.hour)).version, installedAt: s.hour } }));
  return id;
}
// The image of the OS's newest version of the game year.
export const isoOf = (s: GameState, os: ServerOsId = "lunix"): OsImage => imageOf(os, serverOsAt(os, yearOf(s.hour)).version);
// The OS image downloaded, as its site's Download ISO leaves it.
export const withImage = (s: GameState, os: ServerOsId = "lunix"): void => { if (!s.media.images.includes(isoOf(s, os))) s.media.images.push(isoOf(s, os)); };
// The USB stick written with the OS and plugged into the server.
export function withStick(s: GameState, deviceId: string, os: ServerOsId = "lunix"): void {
  withImage(s, os);
  s.media.stick = { os: isoOf(s, os), in: deviceId };
}
// The server cabled to a free port of the basement switch, which reaches the home router and its live line.
export function withNetwork(s: GameState, id: string): void {
  const sw = s.devices.find((d) => modelById(d.model).kind === "switch")!;
  s.cables.push({ id: `cab-net-${id}`, a: { device: id, port: 0 }, b: { device: sw.id, port: portPeers(s, sw.id).findIndex((p) => !p) }, kind: "copper", color: null });
}
const bootedFor = (s: GameState, id: string, softwareId: string) => bootedMachine(s, id, softwareById(softwareId).os[0]);

// A running workload on every server without one, so it draws its rated power instead of the idle power.
export const runServers = (s: GameState): void => {
  const busy = new Set(s.workloads.map((w) => w.deviceId));
  for (const d of s.devices) if (modelById(d.model).server && !busy.has(d.id)) s.workloads = [...s.workloads, workload(s, "", { deviceId: d.id })];
};

// The basement server and switch new games used to start with, cabled to the home router and paid from the savings, on the
// business DSL line with an own /24 announced there and the router's web port shared with the server; suites that are not about the first server or addresses start from it.
export function withServer(s: GameState): GameState {
  s.cash -= 2500;
  s.homeLine = { id: "dsl-16-biz", next: null };
  s.ips = { ...s.ips, blocks: [{ id: "blk-test", prefix: "185.1.0.0/24", size: 256, locationId: "loc1", boughtAt: 0 }] };
  s.devices.unshift(device("dev3", "g1-compute", "Dwell", "rack2", 1, null, "fra1-srv-01", 2500), device("dev4", "sw-8", "Sysko", "rack2", 24, null, "fra1-sw-01", 60));
  s.devices[0].hostname = nodeName(s);
  routerOnLine(s);
  s.cables.push(
    { id: "cab6", a: { device: "dev3", port: 0 }, b: { device: "dev4", port: 0 }, kind: "copper", color: null },
    { id: "cab7", a: { device: "dev4", port: 7 }, b: { device: "dev5", port: 0 }, kind: "copper", color: null },
  );
  setPortShare(s, "dev5", "dev3", "web");
  return s;
}

// The basement router's one web share moved to the machine.
export function shareWith(s: GameState, id: string): void {
  const r = s.devices.find((d) => d.id === "dev5")!;
  r.lan = { ...r.lan!, shares: [] };
  if (!setPortShare(s, "dev5", id, "web").ok) throw new Error(`no share for ${id}`);
}

// The servers with the hypervisor already installed, joined into one cluster under the name; returns the cluster id.
export function hypervisor(s: GameState, deviceIds: string[], name?: string, platform = "proxmocks"): string {
  const [id] = deviceIds.map((d) => done(s, must(installHypervisor(s, bootedFor(s, d, platform), platform)), { platform }));
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
export const named = (s: GameState, id: string, name: string): string => done(s, id, { name });
export const panelServer = (s: GameState, deviceId: string, panel = "freepanel"): string => done(s, must(installPanel(s, bootedFor(s, deviceId, panel), panel)), { panel });

// The company has learned Provisioning automation and switched on Place orders automatically.
export const automate = (s: GameState): GameState => {
  s.unlocks = [...new Set([...s.unlocks, "products", "provisioning"])];
  s.autoOrders = true;
  s.shop = { ...s.shop, modules: Object.fromEntries(MODULE_IDS.map((m) => [m, 0])) };
  return s;
};

// The basement server as the hypervisor cluster "Basement 1" with Proxmocks installed; returns the cluster id.
export const basement = (s: GameState): string => hypervisor(s, [BASEMENT_SERVER], "Basement 1");

// The company is registered at the trade office and has the starter apps, as every game before the office opened.
export function registered(s: GameState): GameState {
  s.registration = legacyRegistration(s.seed);
  s.installed = [...new Set([...s.installed, ...STARTER_APPS])];
  return s;
}

// A new company after the setup: Proxmocks on the starting basement server with a FreePanel VM, the friends moved in and every
// line they sell on the website.
export function readyGame(seed: number): GameState {
  const s = withServer(startGame(seed));
  welcomeFriends(s, panelVm(s, basement(s)));
  return withCompany(fillLines(s, undefined));
}

// The company has signed with NameCheep, owns its derived domain with the website online on it and books Hosted Exchange for the owner, which a game needs
// before it can go online; suites that are not about domains or email start from it.
export function withCompany(s: GameState): GameState {
  s.registrar = { id: "nameCheep", since: 0, tier: 0, billed: true, transfer: null };
  const name = derivedDomain(s);
  s.company = { ...s.company, domain: name, mail: { kind: "external", provider: "hostedExchange", seats: 1 } };
  register(s, name, null, false);
  s.marketing = { ...s.marketing, siteReady: 0, launched: true };
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
// A server without CPUs, RAM, drives and GPUs (one power supply), plus the extras given: the empty chassis that installs are tested on.
export function buyBare(s: GameState, modelId: string, brand: string, qty: number, loc: string, rest: { extras?: NonNullable<CartLine["extras"]> } = {}) {
  const r = buyDevice(s, modelId, brand, qty, loc);
  if (!r.ok) return r;
  const m = modelById(modelId);
  let psu = 0;
  const kept = componentParts(m).filter((p) => !["cpu", "ram", "hdd", "ssd", "nvme", "gpu"].includes(p.kind) && (p.kind !== "psu" || psu++ < 1));
  const board = kept.find((p) => p.kind === "board")?.vendor;
  const extras = (rest.extras ?? []).flatMap((e) => Array.from({ length: e.qty }, (): PartSpec => ({ kind: e.kind, ...(e.size !== undefined ? { size: e.size } : {}), ...(e.ff ? { ff: e.ff as FormFactor } : {}), ...(e.kind === "cpu" ? { vendor: board, gen: genOf(m) } : {}) })));
  const parts = [...kept, ...extras], error = fits(m, parts);
  if (error) return { ok: false as const, error };
  Object.assign(s.devices.find((d) => d.id === r.id)!, deviceDefaults(modelId, s.hour, parts));
  return r;
}
export const buyCart = landing(buyCartReal);

// Clears competitors out of every datacenter, so any space fits.
export const freeFloor = (s: GameState): GameState => { s.dcs = Object.fromEntries(Object.keys(s.dcs).map((id) => [id, { others: 0 }])); return s; };

// Sends every draft invoice as the player does in Books; the payments then settle them as if matched on arrival (books.test.ts covers matching).
export const sendDrafts = (s: GameState) => {
  for (const i of s.invoices) if (i.status === "draft" && sendInvoice(s, i.id).ok) delete i.bank;
};

// The address the order email of a ticket signs with, as the player enters it in Books.
export const mailed = (s: GameState, ticketId: string) => {
  const r = s.sales.requests.find((x) => x.kind === "order" && x.ticketId === ticketId);
  return r && mailedAddress(s.seed, r);
};

// The owner and transfer code the player enters on the registrar's form for a ticket: the customer record and the code
// from the order email.
export const owner = (s: GameState, ticketId: string): [Address | undefined, string | undefined] => {
  const r = s.sales.requests.find((x) => x.kind === "order" && x.ticketId === ticketId);
  return [s.customers.find((c) => c.id === r?.customerId)?.address, r?.owned ? authCode(s.seed, r.id) : undefined];
};

// The version just before a console's late look and the first version with it.
export function lateVersions(product: string): [string, string] {
  const vs = versionsOf(product).map((x) => x.version), from = UI_LOOKS[product].find(([, look]) => look === "late")![0];
  return [vs[vs.indexOf(from) - 1], from];
}
// Sets the version the software runs on a cluster's machine.
export const pinVersion = (s: GameState, c: Cluster, product: string, version: string): void =>
  setMachine(s, panelMachine(c)!, (m) => ({ software: m.software.map((x) => (x.id === product ? { ...x, version } : x)) }));
