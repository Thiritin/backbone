import { dateOf } from "../../../sim/00-core/time";
import { sky, temperature } from "../../../sim/20-world/weather";

export type Palette = "bare" | "blossom" | "fresh" | "full" | "autumn" | "falling";
const RING: Palette[] = ["blossom", "fresh", "full", "autumn", "falling", "bare"];
// Day of the year (0 = 1 Jan) each palette begins on: 1 Mar, 16 Apr, 1 Jun, 1 Sep, 1 Nov, 1 Dec.
const START = [59, 105, 151, 243, 304, 334];
const BLEND = 21;

const dayOfYear = (hour: number): number => { const d = dateOf(hour); return Math.min(364, Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000)); };

// The palette of the day and the fraction (0 to 1) it has blended into the next one over its last 21 days.
export function leafPhase(hour: number): { now: Palette; next: Palette; mix: number } {
  const day = dayOfYear(hour);
  const k = START.reduce((a, s, i) => (day >= s ? i : a), 5);
  const d = day < START[0] ? day + 365 : day, end = k === 5 ? START[0] + 365 : START[k + 1];
  return { now: RING[k], next: RING[(k + 1) % 6], mix: Math.max(0, 1 - (end - d) / BLEND) };
}

// Leaf tones per palette are tokens in site.css (--lf-<palette>-t/l/r); bare reuses the full tones, its leaves are hidden.
const tone = (p: Palette, k: "t" | "l" | "r") => `var(--lf-${p === "bare" ? "full" : p}-${k})`;
const mixOf = (a: string, b: string, p: number) => (p <= 0 ? a : `color-mix(in oklch, ${b} ${Math.round(p * 100)}%, ${a})`);

// CSS variables for the site root, written once per in-game day.
export function leafVars(hour: number): Record<string, string | number> {
  const { now, next, mix } = leafPhase(hour);
  const o = now === "bare" ? mix : next === "bare" ? 1 - mix : 1;
  return { "--leaf-t": mixOf(tone(now, "t"), tone(next, "t"), mix), "--leaf-l": mixOf(tone(now, "l"), tone(next, "l"), mix), "--leaf-r": mixOf(tone(now, "r"), tone(next, "r"), mix), "--leaf-o": +o.toFixed(2), "--bare-o": +(1 - o).toFixed(2) };
}

const memo = new Map<string, number>();
// Snow lying on the ground: a walk over the last 14 days, snow adds, warmth and rain take away. A pure function of date and city.
export function snowCover(city: string, hour: number): number {
  const day = Math.floor(hour / 24), key = `${city}:${day}`, hit = memo.get(key);
  if (hit !== undefined) return hit;
  let c = 0;
  for (let k = 13; k >= 0; k--) {
    const h = (day - k) * 24 + 12, s = sky(city, h);
    c = s === "snow" ? c + 0.4 : s === "rain" ? c - 0.5 : temperature(city, h) > 2 ? c - 0.25 : c;
    c = Math.min(1, Math.max(0, c));
  }
  if (memo.size > 400) memo.clear();
  memo.set(key, c);
  return c;
}

// 0 none, 1 patches, 2 caps everywhere, 3 white ground.
export const snowStep = (c: number): 0 | 1 | 2 | 3 => (c < 0.15 ? 0 : c < 0.5 ? 1 : c < 0.85 ? 2 : 3);

// The site root's classes: the season's lawn and tree tones, the snow step.
export function seasonClasses(city: string, hour: number): string {
  const { now, next, mix } = leafPhase(hour), p = mix > 0.5 ? next : now, step = snowStep(snowCover(city, hour));
  const lit = p === "bare" ? "ws-bare" : p === "autumn" || p === "falling" ? "ws-autumn" : "ws-summer";
  return `${lit}${p === "blossom" || p === "fresh" ? " ws-spring" : ""}${step ? ` ws-sn${step}` : ""}${step === 3 ? " ws-snow" : ""}`;
}

export type Era = "boxy" | "round" | "electric";
export const era = (hour: number): Era => { const y = dateOf(hour).getUTCFullYear(); return y < 2012 ? "boxy" : y < 2020 ? "round" : "electric"; };
