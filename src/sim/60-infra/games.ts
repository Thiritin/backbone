// game-servers plan 3.1 and 3.2: the game behind a game server service, its players and full-at-peak mark.
import { hashRng, rand } from "../00-core/rng";
import { dateOf, yearOf } from "../00-core/time";
import { bump, createTicket } from "../40-support/tickets";
import { GAME_UNIT, latestRelease, modById, pickTitle, releaseHour, releasedAt, slotsFor, titleById } from "../10-catalog/games";
import { idNum } from "../10-catalog/usage";
import type { GameState } from "../50-state";
import { workloadsOf } from "./cluster";
import { workloadPerf } from "../85-products/products";
import { workloadLoad } from "./usage";

export interface GameServer {
  serviceId: string;
  title: string;
  // Null when the service sells RAM.
  slots: number | null;
  version: number;
  auto: boolean;
  // The hour the server last had every slot taken; -1 for never.
  seenFull: number;
  // The hour it crashed and has not been restarted since; null while it runs.
  crashedAt: number | null;
  crashes: number;
  // Memory grown since the last restart, 0 to 1.
  leak: number;
  mods: string[];
  restart: Restart;
}

export interface Restart { every: "off" | "daily" | "weekly"; hour: number; day: number }
export const NO_RESTART: Restart = { every: "off", hour: 4, day: 1 };

// Saves from before crashes and mods get the defaults.
export function fillGames(s: GameState): GameState {
  s.gameServers = s.gameServers.map((g) => ({ ...({ crashedAt: null, crashes: 0, leak: 0, mods: [], restart: NO_RESTART } as Partial<GameServer>), ...g } as GameServer));
  return s;
}

// A gameServer service without an entry is a legacy one and shows RAM only.
export const gameOf = (s: GameState, serviceId: string): GameServer | null => s.gameServers.find((g) => g.serviceId === serviceId) ?? null;

// Records the game on a freshly placed game server service; a hypervisor cluster sells RAM and gets none.
export function createGameServer(s: GameState, serviceId: string, titleId?: string): void {
  const w = workloadsOf(s, serviceId)[0], panel = s.clusters.find((c) => c.id === w?.clusterId)?.panel, unit = panel ? GAME_UNIT[panel] : undefined;
  if (!w || !panel || !unit) return;
  const year = yearOf(s.hour), g = titleById(titleId ?? "") ?? titleById(pickTitle(s.seed, idNum(serviceId), year))!;
  s.gameServers = [...s.gameServers, {
    serviceId, title: g.id, slots: unit === "slots" ? slotsFor(g, (w.promised ?? w).ramGb) : null, version: latestRelease(g, year),
    auto: panel === "pterodaktyl" || year >= 2011, seenFull: -1, crashedAt: null, crashes: 0, leak: 0, mods: [], restart: NO_RESTART,
  }];
}

// Players online: the slots times the workload's load; a service that sells RAM has as many slots as its RAM holds of the title.
export function playersOf(s: GameState, serviceId: string, hour: number = s.hour): { players: number; slots: number } | null {
  const g = gameOf(s, serviceId), w = workloadsOf(s, serviceId)[0], t = g && titleById(g.title);
  if (!g || !w || !t) return null;
  const slots = g.slots ?? slotsFor(t, (w.promised ?? w).ramGb);
  return { players: Math.round(slots * workloadLoad(s, w, hour)), slots };
}

export const CRASH_BASE = 0.0008, LEAK_TITLE = 0.01, AUTO_PENALTY = 0.2, PEAK_PENALTY = 0.5;
// Release waves: a customer left on an old version loses 0.15 happiness an hour-day after a month, up to 12 per release.
export const OUTDATED_GRACE = 30, OUTDATED_DRAIN = 0.15, OUTDATED_CAP = 12, WAVE_DAYS = 14, WAVE_CHANCE = 0.25;

export const gameCrashed = (s: GameState, serviceId: string): boolean => gameOf(s, serviceId)?.crashedAt != null;

// How many mods count against the crash chance, and how many of them no longer run on the server's version.
export const brokenMods = (g: GameServer): number => g.mods.filter((id) => (modById(id)?.works ?? 0) < g.version).length;
export const modCount = (g: GameServer): number => g.mods.reduce((n, id) => n + (modById(id)?.weight ?? 1), 0);

// What mods multiply a game server's resource use by.
export const modLoad = (s: GameState, serviceId: string): number => gameOf(s, serviceId)?.mods.reduce((n, id) => n * (modById(id)?.load ?? 1), 1) ?? 1;

// The newest version a server's title has out now.
export const latestVersion = (s: GameState, g: GameServer): number => Math.max(g.version, releasedAt(titleById(g.title)!, s.hour));
export const outdated = (s: GameState, g: GameServer): boolean => g.version < latestVersion(s, g);

// Evenings and weekend afternoons are when the players are on.
export const isPeak = (hour: number, day: number): boolean => (hour >= 17 && hour <= 22) || ((day === 0 || day === 6) && hour >= 12 && hour < 17);

export function crashChance(s: GameState, g: GameServer): number {
  const w = workloadsOf(s, g.serviceId)[0], slow = w && workloadPerf(s, w, "gameServer") < 0.9;
  return CRASH_BASE * (1 + 0.25 * modCount(g)) * (1 + 2 * brokenMods(g)) * (1 + 2 * g.leak) * (slow ? 2 : 1);
}

// Per hour: the full mark, the schedule, memory growth, crashes and the release waves.
export function gamesTick(s: GameState): void {
  if (!s.gameServers.length) return;
  const d = dateOf(s.hour), hour = d.getUTCHours(), day = d.getUTCDay();
  s.gameServers = s.gameServers.map((g0) => {
    const v = s.services.find((x) => x.id === g0.serviceId), c = v && s.customers.find((x) => x.id === v.customerId), t = titleById(g0.title);
    if (!v || v.endedAt !== null || !c || !t) return g0;
    let g = g0;
    const r = g.restart;
    if (r.every !== "off" && r.hour === hour && (r.every === "daily" || r.day === day)) {
      g = { ...g, crashedAt: null, leak: 0 };
      if (isPeak(hour, day)) bump(c, -PEAK_PENALTY);
    }
    if (g.crashedAt === null) {
      g = { ...g, leak: Math.min(1, g.leak + (t.leak ? LEAK_TITLE : 0) + g.mods.reduce((n, id) => n + (modById(id)?.leak ?? 0), 0)) };
      if (rand(hashRng(s.seed, idNum(g.serviceId), s.hour)) < crashChance(s, g)) {
        g = { ...g, crashes: g.crashes + 1, leak: 0, crashedAt: g.auto ? null : s.hour };
        if (g.auto) bump(c, -AUTO_PENALTY);
      }
    }
    const p = g.crashedAt === null ? playersOf(s, g.serviceId) : null;
    if (p && p.players >= p.slots) g = { ...g, seenFull: s.hour };
    gameWave(s, g, c);
    return g;
  });
}

// An outdated server writes in once in four, on a day of the first two weeks, and then drains happiness after a month.
function gameWave(s: GameState, g: GameServer, c: GameState["customers"][number]): void {
  const t = titleById(g.title)!, latest = releasedAt(t, s.hour);
  if (g.version >= latest) return;
  const days = (s.hour - releaseHour(t, latest)) / 24, x = rand(hashRng(s.seed, idNum(g.serviceId), 5000 + latest));
  if (x < WAVE_CHANCE && Math.floor((x / WAVE_CHANCE) * WAVE_DAYS * 24) === Math.floor(days * 24)) createTicket(s, c, "howTo", g.serviceId, "gameVersion");
  if (days > OUTDATED_GRACE && days <= OUTDATED_GRACE + OUTDATED_CAP / OUTDATED_DRAIN) bump(c, -OUTDATED_DRAIN / 24);
}

// economy.md, Happiness and churn: a customer whose game server filled up in the last week asks for more three times as often.
export const FULL_HOURS = 7 * 24, FULL_BOOST = 3;
export const fullServer = (s: GameState, customerId: string): GameServer | undefined =>
  s.gameServers.find((g) => g.seenFull >= 0 && s.hour - g.seenFull <= FULL_HOURS && s.services.some((v) => v.id === g.serviceId && v.customerId === customerId && v.endedAt === null));
export const fullBoost = (s: GameState, customerId: string): number => (fullServer(s, customerId) ? FULL_BOOST : 1);

// An accepted upgrade of a slot server grows its slots with the RAM, in steps of four.
export function growSlots(s: GameState, serviceId: string, ratio: number): void {
  s.gameServers = s.gameServers.map((g) => (g.serviceId === serviceId && g.slots !== null ? { ...g, slots: Math.min(32, Math.ceil((g.slots * ratio) / 4) * 4) } : g));
}
