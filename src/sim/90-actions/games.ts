// game-servers plan 3.3 to 3.6: what the player does to a game server.
import { yearOf } from "../00-core/time";
import { latestRelease, modById, titleById, weightAt } from "../10-catalog/games";
import { bump } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { gameOf, latestVersion, type GameServer, type Restart } from "../60-infra/games";
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

// Moves the customer to a title that is still current: slots follow the RAM they held, mods are dropped and the newest version is installed.
export function changeTitle(s: GameState, serviceId: string, titleId: string): ActionResult {
  const r = target(s, serviceId), to = titleById(titleId), year = yearOf(s.hour);
  if (typeof r === "string") return fail(r);
  const from = titleById(r.g.title);
  if (!to || !from) return fail("error.unknownTitle");
  if (to.id === from.id || weightAt(to, year) <= 0 || year > to.fade) return fail("error.titleChange");
  bump(r.c, CHANGE_HAPPY);
  const slots = r.g.slots === null ? null : Math.max(1, Math.min(to.slots[1], Math.floor((r.g.slots * from.perSlot.ramGb) / to.perSlot.ramGb + 1e-9)));
  return patch(s, serviceId, { title: to.id, slots, version: latestRelease(to, year), mods: [], crashedAt: null, leak: 0 });
}
