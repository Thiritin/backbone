import { hashRng, rand } from "../00-core/rng";
import { dateOf } from "../00-core/time";
import type { Product, Profile } from "../30-customers/customers";

// Values from docs/design/economy.md, section "Usage curves and overcommit": hour of day and the share of booked capacity in use.
type Keys = [number, number][];
export type CurveId = "game" | "shop" | "blog" | "news" | "business" | "backup" | "vpn" | "dev" | "enterprise";

export const CURVES: Record<CurveId, { weekday: Keys; weekend: Keys }> = {
  game: { weekday: [[0, 0.15], [16, 0.15], [20, 0.45], [23, 0.3]], weekend: [[0, 0.6], [3, 0.2], [8, 0.2], [12, 0.9], [18, 1], [23, 0.9]] },
  shop: { weekday: [[0, 0.1], [6, 0.15], [9, 0.55], [13, 0.7], [17, 0.6], [20, 0.75], [22, 0.3], [23, 0.12]], weekend: [[0, 0.1], [10, 0.5], [15, 0.6], [20, 0.8], [22, 0.3]] },
  blog: { weekday: [[0, 0.15], [7, 0.3], [12, 0.45], [19, 0.6], [22, 0.5], [23, 0.2]], weekend: [[0, 0.2], [10, 0.4], [19, 0.55], [23, 0.2]] },
  news: { weekday: [[0, 0.1], [5, 0.3], [7, 0.9], [9, 0.7], [12, 0.6], [18, 0.5], [22, 0.3]], weekend: [[0, 0.1], [9, 0.7], [12, 0.5], [22, 0.25]] },
  business: { weekday: [[0, 0.05], [7, 0.2], [9, 0.6], [12, 0.5], [17, 0.5], [19, 0.15]], weekend: [[0, 0.1]] },
  backup: { weekday: [[0, 0.4], [1, 1], [5, 1], [7, 0.05]], weekend: [[0, 0.4], [1, 1], [5, 1], [7, 0.05]] },
  vpn: { weekday: [[0, 0.2], [8, 0.3], [19, 0.7], [23, 0.4]], weekend: [[0, 0.4], [14, 0.7], [22, 0.7]] },
  dev: { weekday: [[0, 0.1], [10, 0.3], [18, 0.3], [21, 0.2]], weekend: [[0, 0.15]] },
  enterprise: { weekday: [[0, 0.3], [8, 0.6], [18, 0.6], [22, 0.35]], weekend: [[0, 0.3]] },
};

const BY_PRODUCT: Partial<Record<Product, CurveId>> = { gameServer: "game", vpn: "vpn", storage: "backup", dedicated: "enterprise" };
const BY_PROFILE: Record<Profile, CurveId> = {
  private: "blog", gamer: "game", hobbyDev: "dev", soleProp: "business", smallBiz: "business", agency: "news", office: "business", onlineShop: "shop", enterprise: "enterprise",
};
export const curveFor = (product: Product, profile: Profile): CurveId => BY_PRODUCT[product] ?? BY_PROFILE[profile];

// Straight lines between keyframes; the last keyframe holds until midnight.
function at(keys: Keys, h: number): number {
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1][0] <= h) i++;
  const [h0, v0] = keys[i], next = keys[i + 1];
  return next ? v0 + ((next[1] - v0) * (h - h0)) / (next[0] - h0) : v0;
}

// Load from 0 to 1 at a game hour. Fridays from 18:00 count as weekend for game servers and VPNs.
export function curveLoad(id: CurveId, hour: number): number {
  const d = dateOf(hour), day = d.getUTCDay(), h = d.getUTCHours();
  const weekend = day === 0 || day === 6 || (day === 5 && h >= 18 && (id === "game" || id === "vpn"));
  return at(CURVES[id][weekend ? "weekend" : "weekday"], h);
}

// economy.md, "Usage curves and overcommit": traffic, night jobs and growth.
// Share of a service's traffic that flows whatever its load; game servers send ticks to every connected player all night.
export const TRAFFIC_FLOOR: Partial<Record<Product, number>> = { gameServer: 0.5, vpn: 0.2, dedicated: 0.2, colocation: 0.3 };
// A customer's own night job (backups, batch runs) adds this much load for an hour and ships this many hours of average traffic.
export const JOB_CPU = 0.5;
export const JOB_TRAFFIC = 2;
// Share of customers whose job starts at a new time every night.
export const JOB_RANDOM = 1 / 6;
// The player's cluster backups run at 02:00 and ship this share of each workload's used disk to the target.
export const BACKUP_HOUR = 2;
export const BACKUP_CHANGED = 0.1;
// Yearly growth of disk use (share of booked) and of CPU demand (share of the first year's), by share of customers.
export const GROWTH: [share: number, perYear: number][] = [[0.3, 0.02], [0.5, 0.15], [0.2, 0.5]];

export const idNum = (id: string): number => [...id].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 0x01000193), 0x811c9dc5);
const JOB_SALT = -1, DISK_SALT = -2, CPU_SALT = -3;

const weeks = new Map<CurveId, number[]>();
// A curve's loads over one week, sorted.
function week(id: CurveId): number[] {
  if (!weeks.has(id)) weeks.set(id, Array.from({ length: 168 }, (_, h) => curveLoad(id, h)).sort((a, b) => a - b));
  return weeks.get(id)!;
}
export const weekAverage = (id: CurveId): number => week(id).reduce((n, v) => n + v, 0) / 168;
export const weekMedian = (id: CurveId): number => week(id)[84];

// Share of the hour a customer's night job runs: it starts on a half hour from 00:00 to 05:30 and lasts an hour.
export function nightJob(seed: number, customerId: string, hour: number): number {
  const day = Math.floor(hour / 24), h = hour - day * 24, r = hashRng(seed, idNum(customerId), JOB_SALT);
  const pick = rand(r) < JOB_RANDOM ? rand(hashRng(seed, idNum(customerId), day)) : rand(r);
  const start = Math.floor(pick * 12) / 2;
  return Math.max(0, Math.min(h + 1, start + 1) - Math.max(h, start));
}

// Disk and CPU grow at rates drawn separately: a big database and a busy shop are different customers.
export function growthRate(seed: number, customerId: string, kind: "disk" | "cpu"): number {
  let r = rand(hashRng(seed, idNum(customerId), kind === "disk" ? DISK_SALT : CPU_SALT));
  for (const [share, perYear] of GROWTH) if ((r -= share) < 0) return perYear;
  return GROWTH[GROWTH.length - 1][1];
}

// A service's traffic this hour relative to its monthly average: the floor plus its activity (curve with ±20% jitter) plus
// its night job, scaled so a week averages 1.
export function trafficShape(seed: number, v: { id: string; product: Product; customerId: string }, profile: Profile, hour: number): number {
  const id = curveFor(v.product, profile), floor = TRAFFIC_FLOOR[v.product] ?? 0;
  const active = Math.min(1, curveLoad(id, hour) * (1 + 0.4 * (rand(hashRng(seed, idNum(v.id), hour)) - 0.5)));
  const mean = floor + (1 - floor) * weekAverage(id) + JOB_TRAFFIC / 24;
  return (floor + (1 - floor) * active + JOB_TRAFFIC * nightJob(seed, v.customerId, hour)) / mean;
}
