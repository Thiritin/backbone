// game-servers plan 3.1: punned game titles, the unit each panel sells and the slot conversion.
import { hashRng, rand } from "../00-core/rng";
import { hourOf } from "../00-core/time";
import type { Resources } from "./products";
import { idNum } from "./usage";

export interface GameTitle {
  id: string;
  // The year it arrives and the year its player base starts to shrink.
  from: number; fade: number;
  // Share of new orders while current.
  weight: number;
  perSlot: Resources;
  // Slots an order draws, per server.
  slots: [number, number];
  // Years with a new version.
  releases: number[];
  // Memory grows until a restart.
  leak: boolean;
  // A drifting customer asks to move to the current title of the same genre.
  genre: Genre;
  // Panels that ship the title's config or egg.
  bundled: string[];
}

export type Genre = "shooter" | "strategy" | "sandbox" | "survival" | "roleplay";

export const NEVER = 9999;
const title = (id: string, genre: Genre, bundled: string[], from: number, fade: number, weight: number, perSlot: [number, number, number], releases: number[], leak = false): GameTitle =>
  ({ id, genre, bundled, from, fade, weight, perSlot: { vcpu: perSlot[0], ramGb: perSlot[1], diskGb: perSlot[2] }, slots: [12, 32], releases, leak });
const T = "tcadmen", M = "multikraft", P = "pterodaktyl";

export const GAME_TITLES: GameTitle[] = [
  title("counterstrife", "shooter", [T, P], 2005, 2012, 3, [0.04, 0.025, 0.02], [2005, 2008, 2011]),
  title("quackiii", "shooter", [T], 2005, 2010, 1, [0.03, 0.02, 0.02], [2005, 2007]),
  title("battlefeld", "shooter", [T], 2005, 2011, 1.5, [0.05, 0.035, 0.03], [2005, 2009]),
  title("warcrafty", "strategy", [T], 2006, 2014, 1, [0.09, 0.07, 0.05], [2006, 2008, 2010, 2012]),
  title("teamfortune", "shooter", [T, P], 2008, 2018, 2, [0.05, 0.03, 0.03], [2008, 2011, 2014, 2017]),
  title("blockcraft", "sandbox", [T, M, P], 2010, NEVER, 4, [0.05, 0.08, 0.03], [2010, 2013, 2016, 2019, 2022], true),
  title("terrarea", "sandbox", [], 2012, 2022, 1, [0.03, 0.03, 0.02], [2012, 2015, 2020]),
  title("rost", "survival", [P], 2014, NEVER, 2, [0.12, 0.1, 0.08], [2014, 2017, 2020, 2023], true),
  title("arkaic", "survival", [], 2016, 2024, 1.5, [0.14, 0.14, 0.1], [2016, 2019, 2022], true),
  title("fiveem", "roleplay", [], 2017, NEVER, 1.5, [0.08, 0.06, 0.05], [2017, 2020, 2023]),
  title("valhome", "survival", [], 2021, NEVER, 1.5, [0.1, 0.09, 0.06], [2021, 2023]),
  title("pallworld", "survival", [], 2024, NEVER, 1.5, [0.12, 0.12, 0.08], [2024]),
];

// Titles that need a query port besides the game port.
export const needsQuery = (g: GameTitle): boolean => ["rost", "fiveem", "arkaic"].includes(g.id);

export const titleById = (id: string): GameTitle | undefined => GAME_TITLES.find((x) => x.id === id);

// What a panel sells: slots (TCAdmen), RAM (MultiKraft) or RAM and a CPU limit (Pterodaktyl). Anything else is no game panel.
export const GAME_UNIT: Record<string, "slots" | "ram" | "ramCpu"> = { tcadmen: "slots", multikraft: "ram", pterodaktyl: "ramCpu" };

// The share of new orders a title takes in a year: none before it arrives, full until it fades, then 25 percent less a year down to a tenth.
export const weightAt = (g: GameTitle, year: number): number =>
  year < g.from ? 0 : g.weight * (year <= g.fade ? 1 : Math.max(0.1, 0.75 ** (year - g.fade)));

// economy.md, Happiness and churn: after a title fades, its players online fall 30 percent a year down to 15 percent.
export const interestAt = (g: GameTitle, year: number): number => (year <= g.fade ? 1 : Math.max(0.15, 0.7 ** (year - g.fade)));

// The current title of the same genre with the most new orders, which a drifting customer asks to move to.
export function successorOf(g: GameTitle, year: number): GameTitle | undefined {
  const next = GAME_TITLES.filter((x) => x.id !== g.id && x.genre === g.genre && weightAt(x, year) > 0 && year <= x.fade);
  return next.sort((a, b) => weightAt(b, year) - weightAt(a, year))[0];
}

// game-servers plan 3.5: a community config or egg shows up some months after the game; writing your own costs money and days.
export const IMPORT_LAG: Record<string, number> = { tcadmen: 0.5, pterodaktyl: 0.25 };
export const WRITE_COST: Record<string, number> = { tcadmen: 400, pterodaktyl: 200 };
export const WRITE_DAYS: Record<string, number> = { tcadmen: 5, pterodaktyl: 3 };

// With `allowed`, only those titles; when none of them is out, any.
export function pickTitle(seed: number, key: number, year: number, allowed?: (id: string) => boolean): string {
  const out = GAME_TITLES.filter((g) => weightAt(g, year) > 0), only = allowed ? out.filter((g) => allowed(g.id)) : out, live = only.length ? only : out;
  let x = rand(hashRng(seed, key, 977)) * live.reduce((n, g) => n + weightAt(g, year), 0);
  for (const g of live) if ((x -= weightAt(g, year)) < 0) return g.id;
  return live[live.length - 1].id;
}

// The index of the newest release a title has in a year.
export const latestRelease = (g: GameTitle, year: number): number => Math.max(0, g.releases.filter((y) => y <= year).length - 1);

// Slots that fit the RAM, at least one and at most the title's range.
export const slotsFor = (g: GameTitle, ramGb: number): number => Math.max(1, Math.min(g.slots[1], Math.floor(ramGb / g.perSlot.ramGb + 1e-9)));

export const resourcesOf = (g: GameTitle, slots: number): Resources =>
  ({ vcpu: slots * g.perSlot.vcpu, ramGb: slots * g.perSlot.ramGb, diskGb: slots * g.perSlot.diskGb });

// game-servers plan 3.4: an installable mod. `works` is the newest version index it runs on; `weight` counts as that many mods for crashes.
export interface GameMod { id: string; titles: string[]; load: number; leak: number; happy: number; works: number; weight: number }
const mod = (id: string, titles: string[], load: number, happy: number, works: number, leak = 0, weight = 1): GameMod => ({ id, titles, load, leak, happy, works, weight });
export const MODS: GameMod[] = [
  mod("sourcemud", ["counterstrife", "teamfortune"], 1.05, 1, 1),
  mod("metamix", ["counterstrife", "teamfortune", "battlefeld"], 1.05, 1, 2),
  mod("bukkaboo", ["blockcraft"], 1.1, 2, 2, 0.002),
  mod("essentiel", ["blockcraft"], 1.03, 1, 3),
  mod("worldedik", ["blockcraft", "terrarea"], 1.05, 1, 3),
  mod("oxidize", ["rost"], 1.1, 2, 1),
  mod("carbonara", ["rost", "arkaic"], 1.1, 1, 1),
  mod("fiveemfw", ["fiveem"], 1.2, 2, 1),
  mod("modpack", ["blockcraft", "terrarea"], 1.4, 3, 2, 0, 3),
];
export const modById = (id: string): GameMod | undefined => MODS.find((m) => m.id === id);

// Each January 1 plus up to 90 days a title's release ships, the same date in every save.
export const releaseHour = (g: GameTitle, index: number): number =>
  hourOf(new Date(Date.UTC(g.releases[index], 0, 1))) + 24 * Math.floor(rand(hashRng(idNum(g.id), 31, index)) * 91);

// The newest release that is out at an hour; -1 before the first.
export function releasedAt(g: GameTitle, hour: number): number {
  let n = -1;
  g.releases.forEach((_, i) => { if (releaseHour(g, i) <= hour) n = i; });
  return n;
}
