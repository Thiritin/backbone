// game-servers plan 3.1 and 3.2: the game behind a game server service, its players and full-at-peak mark.
import { yearOf } from "../00-core/time";
import { GAME_UNIT, NEVER, latestRelease, modById, pickTitle, releasedAt, slotsFor, titleById } from "../10-catalog/games";
import { idNum } from "../10-catalog/usage";
import type { GameState } from "../50-state";
import { workloadsOf } from "./cluster";
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

export const gameCrashed = (s: GameState, serviceId: string): boolean => gameOf(s, serviceId)?.crashedAt != null;

// How many mods count against the crash chance, and how many of them no longer run on the server's version.
export const brokenMods = (g: GameServer): number => g.mods.filter((id) => (modById(id)?.works ?? 0) < g.version).length;
export const modCount = (g: GameServer): number => g.mods.reduce((n, id) => n + (modById(id)?.weight ?? 1), 0);

// The newest version a server's title has out now.
export const latestVersion = (s: GameState, g: GameServer): number => Math.max(g.version, releasedAt(titleById(g.title)!, s.hour));
export const outdated = (s: GameState, g: GameServer): boolean => g.version < latestVersion(s, g);

// economy.md, Happiness and churn: a customer whose game server filled up in the last week asks for more three times as often.
export const FULL_HOURS = 7 * 24, FULL_BOOST = 3;
export const fullServer = (s: GameState, customerId: string): GameServer | undefined =>
  s.gameServers.find((g) => g.seenFull >= 0 && s.hour - g.seenFull <= FULL_HOURS && s.services.some((v) => v.id === g.serviceId && v.customerId === customerId && v.endedAt === null));
export const fullBoost = (s: GameState, customerId: string): number => (fullServer(s, customerId) ? FULL_BOOST : 1);

// An accepted upgrade of a slot server grows its slots with the RAM, in steps of four.
export function growSlots(s: GameState, serviceId: string, ratio: number): void {
  s.gameServers = s.gameServers.map((g) => (g.serviceId === serviceId && g.slots !== null ? { ...g, slots: Math.min(32, Math.ceil((g.slots * ratio) / 4) * 4) } : g));
}

// The Titles summary: how many live servers play each title and whether the title has faded.
export function titleCounts(s: GameState): { title: string; count: number; faded: boolean }[] {
  const year = yearOf(s.hour), n = new Map<string, number>();
  for (const g of s.gameServers) if (s.services.some((v) => v.id === g.serviceId && v.endedAt === null)) n.set(g.title, (n.get(g.title) ?? 0) + 1);
  return [...n].map(([title, count]) => ({ title, count, faded: year > (titleById(title)?.fade ?? NEVER) })).sort((a, b) => b.count - a.count);
}
