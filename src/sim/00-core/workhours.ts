import { dateOf } from "./time";

// A customer's clock: business hours only, or around the clock.
export type Clock = "business" | "always";
export interface Patience { hours: number; clock: Clock }

export const BUSINESS_DAY = 8;
const WEEK = 168;

// Business hours run Monday to Friday, 9 to 17; staff work them too.
// ponytail: no holidays or sick days; add them when staffing has to cover absences.
export function isWorkHour(hour: number): boolean {
  const d = dateOf(hour), h = d.getUTCHours(), day = d.getUTCDay();
  return day >= 1 && day <= 5 && h >= 9 && h < 17;
}

// The week repeats every 168 hours, so a prefix count over one week answers any span without a loop.
const prefix = [0];
for (let i = 0; i < WEEK; i++) prefix.push(prefix[i] + (isWorkHour(i) ? 1 : 0));
const before = (hour: number): number => {
  const w = Math.floor(hour / WEEK);
  return w * prefix[WEEK] + prefix[hour - w * WEEK];
};

// Share of calendar hours that are business hours, for the headless balance model.
export const WORK_SHARE = prefix[WEEK] / WEEK;

export const counts = (clock: Clock, hour: number): boolean => clock === "always" || isWorkHour(hour);

// Hours in [from, to) that count on the clock.
export const hoursOn = (clock: Clock, from: number, to: number): number =>
  to <= from ? 0 : clock === "always" ? to - from : before(to) - before(from);

// The hour at which n hours on the clock have passed since from.
export function addHoursOn(clock: Clock, from: number, n: number): number {
  if (clock === "always") return from + n;
  let h = from;
  for (let left = n; left > 0; h++) if (isWorkHour(h)) left--;
  return h;
}
