import { hourOfMonth } from "../../../../sim/00-core/time";
// The look a site or console wears in a year: the last era started by then, the first one before any.
export const eraOf = <L extends string>(eras: { from: number; look: L }[], year: number): L =>
  [...eras].reverse().find((e) => e.from <= year)?.look ?? eras[0].look;
// The same by month, for redesigns that landed in a named month.
export const eraAtHour = <L extends string>(eras: { from: string; look: L }[], hour: number): L =>
  [...eras].reverse().find((e) => hourOfMonth(e.from) <= hour)?.look ?? eras[0].look;
