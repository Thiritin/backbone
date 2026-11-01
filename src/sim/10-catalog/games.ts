// game-servers plan 3.1: punned game titles, the unit each panel sells and the slot conversion.
import { hashRng, rand } from "../00-core/rng";
import type { Resources } from "./products";

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
}

export const NEVER = 9999;
const title = (id: string, from: number, fade: number, weight: number, perSlot: [number, number, number], releases: number[], leak = false): GameTitle =>
  ({ id, from, fade, weight, perSlot: { vcpu: perSlot[0], ramGb: perSlot[1], diskGb: perSlot[2] }, slots: [12, 32], releases, leak });

export const GAME_TITLES: GameTitle[] = [
  title("counterstrife", 2005, 2012, 3, [0.04, 0.025, 0.02], [2005, 2008, 2011]),
  title("quackiii", 2005, 2010, 1, [0.03, 0.02, 0.02], [2005, 2007]),
  title("battlefeld", 2005, 2011, 1.5, [0.05, 0.035, 0.03], [2005, 2009]),
  title("warcrafty", 2006, 2014, 1, [0.09, 0.07, 0.05], [2006, 2008, 2010, 2012]),
  title("teamfortune", 2008, 2018, 2, [0.05, 0.03, 0.03], [2008, 2011, 2014, 2017]),
  title("blockcraft", 2010, NEVER, 4, [0.05, 0.08, 0.03], [2010, 2013, 2016, 2019, 2022], true),
  title("terrarea", 2012, 2022, 1, [0.03, 0.03, 0.02], [2012, 2015, 2020]),
  title("rost", 2014, NEVER, 2, [0.12, 0.1, 0.08], [2014, 2017, 2020, 2023], true),
  title("arkaic", 2016, 2024, 1.5, [0.14, 0.14, 0.1], [2016, 2019, 2022], true),
  title("fiveem", 2017, NEVER, 1.5, [0.08, 0.06, 0.05], [2017, 2020, 2023]),
  title("valhome", 2021, NEVER, 1.5, [0.1, 0.09, 0.06], [2021, 2023]),
  title("pallworld", 2024, NEVER, 1.5, [0.12, 0.12, 0.08], [2024]),
];

export const titleById = (id: string): GameTitle | undefined => GAME_TITLES.find((x) => x.id === id);

// What a panel sells: slots (TCAdmen), RAM (MultiKraft) or RAM and a CPU limit (Pterodaktyl). Anything else is no game panel.
export const GAME_UNIT: Record<string, "slots" | "ram" | "ramCpu"> = { tcadmen: "slots", multikraft: "ram", pterodaktyl: "ramCpu" };

// The share of new orders a title takes in a year: none before it arrives, full until it fades, then 25 percent less a year down to a tenth.
export const weightAt = (g: GameTitle, year: number): number =>
  year < g.from ? 0 : g.weight * (year <= g.fade ? 1 : Math.max(0.1, 0.75 ** (year - g.fade)));

export function pickTitle(seed: number, key: number, year: number): string {
  const live = GAME_TITLES.filter((g) => weightAt(g, year) > 0);
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
