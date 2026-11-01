// game-servers plan 3.3 to 3.6: what the player does to a game server.
import { t } from "../../i18n/en";
import { yearOf } from "../00-core/time";
import { IMPORT_LAG, latestRelease, modById, titleById, weightAt, WRITE_COST, WRITE_DAYS } from "../10-catalog/games";
import { bump, cancelCustomer, isFinal, type Ticket } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { daemonOf, freePorts, nodeOf } from "../60-infra/daemons";
import { gameOf, latestVersion, type GameServer, type Restart } from "../60-infra/games";
import { importOpen, offered, panelOf } from "../60-infra/titles";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// The live game server and its customer, or the error.
function target(s: GameState, serviceId: string): { g: GameServer; c: GameState["customers"][number] } | string {
  const v = s.services.find((x) => x.id === serviceId), g = gameOf(s, serviceId), c = v && s.customers.find((x) => x.id === v.customerId);
  return !v || v.endedAt !== null || !g || !c ? "error.noGame" : { g, c };
}

function patch(s: GameState, serviceId: string, change: Partial<GameServer>): ActionResult {
  s.gameServers = s.gameServers.map((g) => (g.serviceId === serviceId ? { ...g, ...change } : g));
  return { ok: true, id: serviceId };
}

// Brings a crashed server back and clears its memory.
export function restartGame(s: GameState, serviceId: string): ActionResult {
  const r = target(s, serviceId);
  return typeof r === "string" ? fail(r) : patch(s, serviceId, { crashedAt: null, leak: 0 });
}

export function setAutoRestart(s: GameState, serviceId: string, auto: boolean): ActionResult {
  const r = target(s, serviceId);
  return typeof r === "string" ? fail(r) : patch(s, serviceId, { auto });
}

export function setRestartSchedule(s: GameState, serviceId: string, every: Restart["every"], hour: number, day: number): ActionResult {
  const r = target(s, serviceId);
  if (typeof r === "string") return fail(r);
  const whole = (n: number, max: number) => Number.isInteger(n) && n >= 0 && n <= max;
  if (!["off", "daily", "weekly"].includes(every) || !whole(hour, 23) || !whole(day, 6)) return fail("error.restartSchedule");
  return patch(s, serviceId, { restart: { every, hour, day } });
}

// Moves to the newest release and drops the mods that no longer run on it.
export function updateGameVersion(s: GameState, serviceId: string): ActionResult {
  const r = target(s, serviceId);
  if (typeof r === "string") return fail(r);
  const version = latestVersion(s, r.g);
  return patch(s, serviceId, { version, crashedAt: null, leak: 0, mods: r.g.mods.filter((id) => (modById(id)?.works ?? 0) >= version) });
}

// Holds a customer on another release of their title; mods that need a different one stay installed and break.
export function setGameVersion(s: GameState, serviceId: string, version: number): ActionResult {
  const r = target(s, serviceId);
  if (typeof r === "string") return fail(r);
  if (!titleById(r.g.title) || !Number.isInteger(version) || version < 0 || version > latestVersion(s, r.g)) return fail("error.gameVersion");
  return patch(s, serviceId, { version, crashedAt: null, leak: 0 });
}

const MOD_HAPPY_CAP = 5;

export function installMod(s: GameState, serviceId: string, modId: string): ActionResult {
  const r = target(s, serviceId), m = modById(modId);
  if (typeof r === "string") return fail(r);
  if (!m) return fail("error.unknownMod");
  if (!m.titles.includes(r.g.title)) return fail("error.modTitle");
  if (r.g.mods.includes(modId)) return fail("error.modInstalled");
  if (m.works < r.g.version) return fail("error.modVersion");
  const held = r.g.mods.reduce((n, id) => n + (modById(id)?.happy ?? 0), 0);
  bump(r.c, Math.max(0, Math.min(m.happy, MOD_HAPPY_CAP - held)));
  return patch(s, serviceId, { mods: [...r.g.mods, modId] });
}

export function removeMod(s: GameState, serviceId: string, modId: string): ActionResult {
  const r = target(s, serviceId);
  if (typeof r === "string") return fail(r);
  return r.g.mods.includes(modId) ? patch(s, serviceId, { mods: r.g.mods.filter((id) => id !== modId) }) : fail("error.modNotInstalled");
}

const CHANGE_HAPPY = 3;

// The open ticket in which a game server's customer asks to move to another title.
export const switchTicket = (s: GameState, serviceId: string): Ticket | undefined =>
  s.tickets.find((t) => t.serviceId === serviceId && t.kind === "upgrade" && t.topic === "switchTitle" && !isFinal(t));

const settle = (s: GameState, id: string, outcome: "accepted" | "declined") => {
  s.tickets = s.tickets.map((t) => (t.id === id ? { ...t, status: "closed", outcome, updatedAt: s.hour, unread: false, work: null } : t));
};

// Moves the customer to the title they asked for: slots follow the RAM they held, mods are dropped and the newest version is installed.
export function changeTitle(s: GameState, serviceId: string, titleId: string): ActionResult {
  const r = target(s, serviceId), to = titleById(titleId), year = yearOf(s.hour);
  if (typeof r === "string") return fail(r);
  const from = titleById(r.g.title), tk = switchTicket(s, serviceId);
  if (!to || !from) return fail("error.unknownTitle");
  if (!tk || r.g.switchTo !== to.id) return fail("error.noSwitchRequest");
  if (to.id === from.id || weightAt(to, year) <= 0 || year > to.fade) return fail("error.titleChange");
  if (!offered(s, panelOf(s, serviceId) ?? "", to.id)) return fail("error.titleNotOffered");
  bump(r.c, CHANGE_HAPPY);
  settle(s, tk.id, "accepted");
  const slots = r.g.slots === null ? null : Math.max(1, Math.min(to.slots[1], Math.floor((r.g.slots * from.perSlot.ramGb) / to.perSlot.ramGb + 1e-9)));
  return patch(s, serviceId, { title: to.id, slots, version: latestRelease(to, year), mods: [], crashedAt: null, leak: 0, switchTo: null });
}

// The customer takes the game server to a host that runs the new title; their other services stay.
export function declineTitleSwitch(s: GameState, ticketId: string): ActionResult {
  const tk = s.tickets.find((t) => t.id === ticketId && t.kind === "upgrade" && t.topic === "switchTitle" && !isFinal(t)), g = tk?.serviceId ? gameOf(s, tk.serviceId) : null;
  const c = tk && s.customers.find((x) => x.id === tk.customerId);
  if (!tk || !g || !c) return fail("error.ticketDone");
  settle(s, tk.id, "declined");
  s.services = s.services.map((v) => (v.id === g.serviceId && v.endedAt === null ? { ...v, endedAt: s.hour } : v));
  if (!s.services.some((v) => v.customerId === c.id && v.endedAt === null)) cancelCustomer(s, c);
  return patch(s, g.serviceId, { switchTo: null });
}

const known = (panel: string, titleId: string) => panel in IMPORT_LAG && !!titleById(titleId);

// Adds a community config or egg to a panel once the community has written one.
export function importTitle(s: GameState, panel: string, titleId: string): ActionResult {
  if (!known(panel, titleId) || offered(s, panel, titleId) || s.gameTitles[panel]?.[titleId]) return fail("error.titleImport");
  if (!importOpen(s, panel, titleById(titleId)!)) return fail("error.titleNotYet");
  s.gameTitles = { ...s.gameTitles, [panel]: { ...s.gameTitles[panel], [titleId]: { since: s.hour } } };
  return { ok: true, id: titleId };
}

// Pays for a config written in-house; the title is on sale once it is done.
export function writeTitleConfig(s: GameState, panel: string, titleId: string): ActionResult {
  const g = titleById(titleId);
  if (!known(panel, titleId) || offered(s, panel, titleId) || s.gameTitles[panel]?.[titleId] || yearOf(s.hour) < g!.from) return fail("error.titleImport");
  const cost = WRITE_COST[panel];
  if (s.cash < cost) return fail("error.noCash");
  s.cash -= cost;
  s.ledger = [...s.ledger, { hour: s.hour, category: "fees", key: "ledger.titleConfig", params: { title: t(`games.title.${titleId}`) }, amount: -cost }];
  s.gameTitles = { ...s.gameTitles, [panel]: { ...s.gameTitles[panel], [titleId]: { since: s.hour, readyAt: s.hour + WRITE_DAYS[panel] * 24 } } };
  return { ok: true, id: titleId };
}

// Brings a node's daemon back at once.
export function restartDaemon(s: GameState, nodeKey: string): ActionResult {
  const d = daemonOf(s, nodeKey);
  if (!d) return fail("error.noDaemon");
  s.daemons = { ...s.daemons, [nodeKey]: { ...d, state: "online", since: s.hour } };
  return { ok: true, id: nodeKey };
}

// Moves a node's daemon to its panel's release.
export function updateDaemon(s: GameState, nodeKey: string): ActionResult {
  const d = daemonOf(s, nodeKey), c = s.clusters.find((x) => x.panel === "pterodaktyl" && (x.vm === nodeKey || x.nodes.some((n) => n.deviceId === nodeKey)));
  if (!d || !c) return fail("error.noDaemon");
  s.daemons = { ...s.daemons, [nodeKey]: { ...d, version: c.version } };
  return { ok: true, id: nodeKey };
}

export function addAllocation(s: GameState, serviceId: string): ActionResult {
  const r = target(s, serviceId), n = nodeOf(s, serviceId);
  if (typeof r === "string") return fail(r);
  if (!r.g.ports.length || !n) return fail("error.noAllocation");
  const port = freePorts(s, n.key)[0];
  return port === undefined ? fail("error.noAllocation") : patch(s, serviceId, { ports: [...r.g.ports, port] });
}

// A server keeps at least its game port.
export function removeAllocation(s: GameState, serviceId: string, port: number): ActionResult {
  const r = target(s, serviceId);
  if (typeof r === "string") return fail(r);
  return r.g.ports.length > 1 && r.g.ports.includes(port) ? patch(s, serviceId, { ports: r.g.ports.filter((p) => p !== port) }) : fail("error.allocationRemove");
}
