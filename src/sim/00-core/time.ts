// Game time is a whole number of hours since 1 Jan 2005 00:00 UTC.
export const START_YEAR = 2005;
const START = Date.UTC(START_YEAR, 0, 1);
const HOUR = 3_600_000;

// Real milliseconds per game hour at 1× (docs/design/economy.md, Clock and pacing).
export const MS_PER_HOUR = 60_000;
export const SPEEDS = [0, 1, 2, 4, 720] as const;
// Skip runs at the fastest pace, 12 game hours a second, until the next event, then drops to 1×.
export const SKIP = 720;
export type Speed = (typeof SPEEDS)[number];

// The simulation ticks every hour; queued hand work, boots and domain registrations land on the minute between ticks.
export const nowMinutes = (s: { hour: number; minute: number }): number => s.hour * 60 + s.minute;
export const nowHours = (s: { hour: number; minute: number }): number => s.hour + s.minute / 60;

export const dateOf = (hour: number): Date => new Date(START + hour * HOUR);

export const hourOf = (d: Date): number => Math.floor((d.getTime() - START) / HOUR);

export const yearOf = (hour: number): number => dateOf(hour).getUTCFullYear();
// Months since year 0, January 0, for comparing against a release month.
export const monthIndexOf = (hour: number): number => { const d = dateOf(hour); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatClock(hour: number, minute = 0): string {
  const d = dateOf(hour);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${hh}:${String(minute).padStart(2, "0")}`;
}

export const isMonthStart = (hour: number): boolean => {
  const d = dateOf(hour);
  return d.getUTCDate() === 1 && d.getUTCHours() === 0;
};
