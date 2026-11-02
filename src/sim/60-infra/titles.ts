// game-servers plan 3.5: which titles each game panel offers, and the leads lost to titles no panel offers.
import { hourOf, yearOf } from "../00-core/time";
import { GAME_TITLES, GAME_UNIT, IMPORT_LAG, pickTitle, titleById, type GameTitle } from "../10-catalog/games";
import type { GameState } from "../50-state";
import { workloadsOf } from "./cluster";

// The hour a title was added, and while a written config is not done, the hour it will be.
export interface TitleEntry { since: number; readyAt?: number }

export type TitleStatus = "offered" | "writing" | "import" | "write" | "none";

const LOST_HOURS = 90 * 24;

// The game panel a game server runs on.
export const panelOf = (s: GameState, serviceId: string): string | undefined => s.clusters.find((c) => c.id === workloadsOf(s, serviceId)[0]?.clusterId)?.panel ?? undefined;

// A title the panel ships, was given, or already runs (saves from before the catalogue) is offered.
export function offered(s: GameState, panel: string, titleId: string): boolean {
  const t = titleById(titleId), e = s.gameTitles[panel]?.[titleId];
  if (!t || yearOf(s.hour) < t.from) return false;
  if (t.bundled.includes(panel) || (e && (e.readyAt ?? 0) <= s.hour)) return true;
  return s.gameServers.some((g) => g.title === titleId && panelOf(s, g.serviceId) === panel && s.services.some((v) => v.id === g.serviceId && v.endedAt === null));
}

// What the player can do about a title on a panel. MultiKraft runs Blockcraft and nothing else.
export function titleStatus(s: GameState, panel: string, t: GameTitle): TitleStatus {
  if (offered(s, panel, t.id)) return "offered";
  if (s.gameTitles[panel]?.[t.id]) return "writing";
  if (!(panel in IMPORT_LAG) || yearOf(s.hour) < t.from) return "none";
  return importOpen(s, panel, t) ? "import" : "write";
}

// The panel's community lag has passed since the title arrived.
export const importOpen = (s: GameState, panel: string, t: GameTitle): boolean =>
  panel in IMPORT_LAG && s.hour >= hourOf(new Date(Date.UTC(t.from, 0, 1))) + IMPORT_LAG[panel] * 8760;

// Titles out by now, for the catalogue table.
export const titlesOut = (s: GameState): GameTitle[] => GAME_TITLES.filter((t) => yearOf(s.hour) >= t.from);

export const playerPanels = (s: GameState): string[] => [...new Set(s.clusters.map((c) => c.panel).filter((p): p is string => !!p && p in GAME_UNIT))];

// A lead for a title none of the player's panels offers goes elsewhere and is counted for 90 days.
// ponytail: the lead's title is drawn again at provisioning among the offered ones; carry it on the request if the two draws need to agree.
export function gameLeadLost(s: GameState): boolean {
  const panels = playerPanels(s), id = pickTitle(s.seed, s.hour * 1000 + s.nextId, yearOf(s.hour));
  if (!panels.length || panels.some((p) => offered(s, p, id))) return false;
  s.gameLost = { ...s.gameLost, [id]: [...(s.gameLost[id] ?? []).filter((h) => s.hour - h < LOST_HOURS), s.hour] };
  return true;
}
export const lostLeads = (s: GameState, titleId: string): number => (s.gameLost[titleId] ?? []).filter((h) => s.hour - h < LOST_HOURS).length;
