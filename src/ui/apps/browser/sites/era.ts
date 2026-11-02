// The look a site or console wears in a year: the last era started by then, the first one before any.
export const eraOf = <L extends string>(eras: { from: number; look: L }[], year: number): L =>
  [...eras].reverse().find((e) => e.from <= year)?.look ?? eras[0].look;
