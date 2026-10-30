import type { Look } from "../../../../sim/10-catalog/sites";

// The look a site or console wears in a year: the last era started by then, the first one before any.
export const eraOf = (eras: { from: number; look: Look }[], year: number): Look =>
  [...eras].reverse().find((e) => e.from <= year)?.look ?? eras[0].look;
