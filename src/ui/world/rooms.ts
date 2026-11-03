import type { Fixture } from "../../sim/20-world/layout";
import type { SpaceKind } from "../../sim/50-state";
import { T } from "./grid";

export type Use = "desktop" | "storage" | "network" | "power" | "door" | "post" | "scan" | "none";

// How a fixture kind is drawn and what using it does. dx and dy shift the sprite from the tile's bottom-left corner;
// back ones hang on a wall and are drawn above the floor tiles but behind everything standing, the rest are depth-sorted with racks and the player.
export interface FixtureArt { sprite: string; label: string; use?: Use; solid?: boolean; back?: boolean; dx?: number; dy?: number; depth?: number; frames?: string[] }

export const ART: Record<string, FixtureArt> = {
  scanner: { sprite: "scanner", label: "world.obj.scanner", use: "scan", solid: true },
  desk: { sprite: "desk", label: "world.obj.desk", use: "none", solid: true },
  // The tower stands at the desk's right end, beside the chair.
  pc: { sprite: "pc", label: "world.obj.pc", use: "desktop", solid: true, dx: 16, depth: 0.001 },
  fusebox: { sprite: "fusebox", label: "world.obj.fusebox", solid: true },
  shelf: { sprite: "shelf", label: "world.obj.shelf", use: "storage", solid: true },
  fan: { sprite: "fan", label: "world.obj.fan", back: true, dx: -12, dy: -2 * T + 2 },
  letterbox: { sprite: "letterbox", label: "world.obj.letterbox", use: "post", back: true, dx: 2, dy: -8 },
  door: { sprite: "door-closed", label: "world.obj.door", use: "door", back: true, frames: ["door-closed", "door-half", "door-open"] },
  extinguisher: { sprite: "extinguisher", label: "world.obj.extinguisher", solid: true, back: true },
  xconnect: { sprite: "xconnect", label: "world.obj.xconnect", use: "network", back: true, dy: -T - 28 },
  cooling: { sprite: "cooling", label: "world.obj.cooling", solid: true },
  pdu: { sprite: "pdu", label: "world.obj.pdu", use: "power", solid: true },
  noc: { sprite: "noc", label: "world.obj.noc", use: "desktop", solid: true },
  dock: { sprite: "dock", label: "world.obj.dock", back: true, dy: -T },
};

export const artOf = (id: string, f: Fixture): FixtureArt => ART[f.kind ?? id];

// Wall faces per room kind: the far wall's upper and lower row; rented rooms have cable trays along the top.
export const WALLS: Record<SpaceKind, { wall: string; base: string; trays: boolean }> = {
  basement: { wall: "wall", base: "wall-base", trays: false },
  share: { wall: "fence", base: "fence-base", trays: true },
  cage: { wall: "fence", base: "fence-base", trays: true },
  suite: { wall: "fence", base: "fence-base", trays: true },
};
