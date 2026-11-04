import { ALL_DATACENTERS, datacenterById } from "../../../sim/20-world/datacenters";
import type { GameState, Location } from "../../../sim/50-state";
import { fnv1a, pick, siteClass, type SiteClass } from "./layout";

// What surrounds a site: the garden of the basement, or one of the three compound settings.
export type Setting = "suburb" | "industrial" | "nowhere" | "business";
export type UtilKind = "subst" | "gen" | "tank" | "cont" | "pallet" | "dock" | "rail" | "cooling";

// The setting of a location from data the game already has; the seed breaks ties.
export function settingOf(loc: Location, game: GameState): Setting {
  if (loc.space === "basement") return "suburb";
  if (loc.space === "office") return "business";
  const cls = siteClass(loc, game), seed = fnv1a(`${loc.id}:${cls}`);
  if (loc.space === "hall") {
    const hub = ALL_DATACENTERS.some((d) => d.city === loc.city && d.carriers >= 4);
    if (cls === "S") return "industrial";
    return !hub ? "nowhere" : pick(seed, 1, 2) ? "industrial" : "nowhere";
  }
  const dc = loc.dc ? datacenterById(loc.dc) : null;
  if (!dc) return "business";
  if (dc.green) return "nowhere";
  if (dc.size === "large") return dc.exchange?.onSite || dc.carriers >= 4 ? "industrial" : "business";
  if (dc.size === "medium") return pick(seed, 2, 10) < 6 ? "industrial" : "business";
  return "business";
}

export interface Compound {
  // Which security the plot has: a double fence, one fence around the lot, or only the facility edge of a rented room.
  fence: "double" | "single" | "edge";
  // Extra plot reach in tiles on the three outer sides.
  reach: number;
  guard: boolean;
  util: UtilKind[];
  // Variant picks for the neighbours and scenery.
  turbine: boolean; solar: boolean; farm: boolean; siding: boolean; slide: boolean;
}

// The modules of a compound by setting and size class. Larger classes only add to the smaller one.
export function compoundOf(setting: Setting, cls: SiteClass, seed: number, edge = false): Compound {
  const m = cls !== "S", l = cls === "L";
  const util: UtilKind[] = [];
  if (setting === "industrial") util.push("cont", "pallet", "dock", ...(m ? (["subst", "gen", "tank"] as const) : []), ...(l ? (["cooling", "tank", "cont"] as const) : []));
  if (setting === "nowhere") util.push("gen", ...(m ? (["subst", "tank", "pallet"] as const) : []), ...(l ? (["cooling", "tank"] as const) : []));
  if (setting === "business") util.push("gen", ...(m ? (["cooling", "pallet"] as const) : []), ...(l ? (["subst", "tank"] as const) : []));
  const siding = setting === "industrial" && m && pick(seed, 11, 2) === 1;
  return {
    fence: edge ? "edge" : setting === "business" ? "single" : "double",
    reach: l ? 12 : m ? 6 : 0, guard: l,
    util: edge ? [] : siding ? [...util, "rail"] : util,
    turbine: pick(seed, 12, 2) === 0, solar: pick(seed, 13, 2) === 0, farm: pick(seed, 14, 2) === 0, siding, slide: pick(seed, 15, 2) === 0,
  };
}
