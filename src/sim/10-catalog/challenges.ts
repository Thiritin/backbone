import { hashRng } from "../00-core/rng";

// One twist per weekly challenge, from what a new game can already start with.
export type Twist = { kind: "line"; line: string } | { kind: "dc"; dc: string } | { kind: "cash"; cash: number };
export interface Challenge { id: string; seed: number; twist: Twist }

// Week w of a year plays CHALLENGES[w % 3]: a home line already in, one datacenter with free space, or less starting cash.
export const CHALLENGES: Twist[] = [
  { kind: "line", line: "sdsl-2" },
  { kind: "dc", dc: "hetzler-park" },
  { kind: "cash", cash: 2000 },
];

// ISO 8601 week of a date in UTC: weeks start on Monday and week 1 holds the year's first Thursday.
export function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const year = t.getUTCFullYear();
  return { year, week: Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7) };
}

export const challengeFor = (year: number, week: number): Challenge => ({
  id: `${year}-W${String(week).padStart(2, "0")}`,
  seed: hashRng(year, week, 0xc4a1).s,
  twist: CHALLENGES[week % CHALLENGES.length],
});

export const weeklyChallenge = (now: Date): Challenge => {
  const { year, week } = isoWeek(now);
  return challengeFor(year, week);
};

export function challengeById(id: string): Challenge | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(id);
  return m && +m[2] >= 1 && +m[2] <= 53 ? challengeFor(+m[1], +m[2]) : null;
}
