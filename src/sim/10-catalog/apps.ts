// economy.md, Security advisories, Customer applications: what web hosting customers run and how they keep it up to date.
import { hashRng, rand } from "../00-core/rng";
import type { Budget, Skill } from "./economy";
import type { Rates } from "./products";

export type App = "wordpass" | "joomlah" | "drupel" | "static";
export const CMS: App[] = ["wordpass", "joomlah", "drupel"];
export const APP_NAME: Record<App, string> = { wordpass: "WordPass", joomlah: "Joomlah", drupel: "Drupel", static: "Static HTML" };

// Share of static sites and of WordPass among web hosting customers at each keyframe year; the rest splits Joomlah 3 : Drupel 1.
const SHARES: [year: number, plain: number, wordpass: number][] = [[2005, 0.6, 0.2], [2010, 0.35, 0.4], [2015, 0.2, 0.6], [2020, 0.15, 0.7]];

export function appShares(year: number): Record<App, number> {
  const k = SHARES.findIndex(([y]) => year < y), [a, b] = k < 0 ? [SHARES[SHARES.length - 1], SHARES[SHARES.length - 1]] : [SHARES[Math.max(0, k - 1)], SHARES[Math.max(0, k)]];
  const at = a[0] === b[0] ? 0 : Math.min(1, Math.max(0, (year - a[0]) / (b[0] - a[0])));
  const [stat, wordpass] = [a[1] + (b[1] - a[1]) * at, a[2] + (b[2] - a[2]) * at], rest = 1 - stat - wordpass;
  return { static: stat, wordpass, joomlah: rest * 0.75, drupel: rest * 0.25 };
}

// The app a new web hosting service runs, fixed by the seed and a key.
export function drawApp(seed: number, key: number, year: number): App {
  const shares = appShares(year), r = rand(hashRng(seed, key, 217));
  let sum = 0;
  for (const app of CMS) { sum += shares[app]; if (r < sum) return app; }
  return "static";
}

// Share of customers by skill who update by themselves within a week of a patch; WordPass patches itself from the year
// it got automatic minor updates (WordPress 3.7, 2013).
export const SELF_UPDATE: Record<Skill, number> = { high: 0.8, medium: 0.4, low: 0.1 };
export const AUTO_UPDATE: Record<Skill, number> = { high: 0.95, medium: 0.7, low: 0.4 };
export const AUTO_UPDATE_FROM = 2013;
export const SELF_UPDATE_DAYS = 7;
export const selfUpdateShare = (app: App, skill: Skill, patchYear: number): number =>
  (app === "wordpass" && patchYear >= AUTO_UPDATE_FROM ? AUTO_UPDATE : SELF_UPDATE)[skill];

// Customers of medium or high skill clean a defaced site up themselves with this chance, within these days.
export const SELF_CLEAN = 0.5;
export const SELF_CLEAN_DAYS = 3;
export const HACKS_TO_LEAVE = 3;
export const CLEAN_MINUTES = 30;

// Notifying takes this many minutes per batch of customers; of those who would not update themselves, this share asks for help.
export const NOTIFY_MINUTES = 30;
export const NOTIFY_BATCH = 10;
export const ASK_SHARE = 0.5;
// What a customer who asks for help would pay for: the one-off update, managed updates, or nothing (shares by budget; the rest refuses).
export const WISH: Record<Budget, { once: number; managed: number }> = { low: { once: 0.8, managed: 0 }, medium: { once: 0.7, managed: 0.2 }, high: { once: 0.55, managed: 0.35 } };
export type Wish = "once" | "managed" | "refuse";
export const FREE_MINUTES = 20;

// Monthly or one-off price in euros per site: the market's, flat over the years (multiplier 1).
export const UPDATE_PRICE = { updateOnce: 49, updates: 5 } as const;
export const updatePrice = (rates: Rates | undefined, unit: keyof typeof UPDATE_PRICE): number => rates?.[unit] ?? UPDATE_PRICE[unit];
