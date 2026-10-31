// game-servers plan 3.1 and 3.2: the game behind a game server service, its players and full-at-peak mark.
import { yearOf } from "../00-core/time";
import { GAME_UNIT, latestRelease, pickTitle, slotsFor, titleById } from "../10-catalog/games";
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
    auto: panel === "pterodaktyl" || year >= 2011, seenFull: -1,
  }];
}

// Players online: the slots times the workload's load; a service that sells RAM has as many slots as its RAM holds of the title.
export function playersOf(s: GameState, serviceId: string, hour: number = s.hour): { players: number; slots: number } | null {
  const g = gameOf(s, serviceId), w = workloadsOf(s, serviceId)[0], t = g && titleById(g.title);
  if (!g || !w || !t) return null;
  const slots = g.slots ?? slotsFor(t, (w.promised ?? w).ramGb);
  return { players: Math.round(slots * workloadLoad(s, w, hour)), slots };
}

// Marks the servers that filled up this hour.
export function gamesTick(s: GameState): void {
  if (!s.gameServers.length) return;
  s.gameServers = s.gameServers.map((g) => {
    const p = s.services.find((v) => v.id === g.serviceId)?.endedAt === null ? playersOf(s, g.serviceId) : null;
    return p && p.players >= p.slots ? { ...g, seenFull: s.hour } : g;
  });
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
