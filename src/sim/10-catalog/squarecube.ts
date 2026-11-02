// docs/design/plans/webmail-server.md, 4.1: what each Squarecube version offers. Screens ask this table and never
// compare versions themselves.
export type SquarecubeSkin = "classic" | "barry" | "plastic";
export interface SquarecubeFeatures {
  vcard: boolean; plugins: boolean; threads: boolean; groups: boolean; copy: boolean; filters: boolean; csvImport: boolean; password: boolean;
  vacation: boolean; multiFolderSearch: boolean; collected: boolean; darkTheme: boolean; skins: SquarecubeSkin[];
}

const num = (v: string): number => { const [a, b] = v.split(".").map(Number); return a * 100 + (b || 0); };

export function squarecubeFeatures(version: string): SquarecubeFeatures {
  const v = num(version), from = (x: string) => v >= num(x);
  const skins: SquarecubeSkin[] = from("1.7") ? ["plastic"] : from("1.4") ? ["plastic", "barry"] : from("1.0") ? ["barry"] : from("0.8") ? ["barry", "classic"] : ["classic"];
  return {
    vcard: from("0.2"), plugins: from("0.3"), threads: from("0.4"), groups: from("0.4"), copy: from("0.4"), filters: from("0.4"),
    csvImport: from("0.9"), password: from("0.4"), vacation: from("1.0"), multiFolderSearch: from("1.1"), collected: from("1.5"), darkTheme: from("1.5"), skins,
  };
}
