// Game time is a whole number of hours since 1 Jan 2005 00:00 UTC.
export const START_YEAR = 2005;
const START = Date.UTC(START_YEAR, 0, 1);
const HOUR = 3_600_000;

// Real milliseconds per game hour at 1× (docs/design/economy.md, Clock and pacing).
export const MS_PER_HOUR = 2500;
export const SPEEDS = [0, 1, 2, 4, 8] as const;
export type Speed = (typeof SPEEDS)[number];

export const dateOf = (hour: number): Date => new Date(START + hour * HOUR);

export const hourOf = (d: Date): number => Math.floor((d.getTime() - START) / HOUR);

export const yearOf = (hour: number): number => dateOf(hour).getUTCFullYear();

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatClock(hour: number): string {
  const d = dateOf(hour);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${hh}:00`;
}

export const isMonthStart = (hour: number): boolean => {
  const d = dateOf(hour);
  return d.getUTCDate() === 1 && d.getUTCHours() === 0;
};
