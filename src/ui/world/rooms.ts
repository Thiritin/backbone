import type { Fixture } from "../../sim/20-world/layout";

export type Use = "desktop" | "storage" | "network" | "power" | "door" | "post" | "scan" | "none";

// What using a fixture kind does. Wall ones are drawn on the wall behind everything standing, the rest are depth-sorted with racks and the player.
export interface FixtureArt { label: string; use?: Use; solid?: boolean; wall?: boolean; depth?: number }

export const ART: Record<string, FixtureArt> = {
  scanner: { label: "world.obj.scanner", use: "scan", solid: true, depth: 0.001 },
  desk: { label: "world.obj.desk", use: "none", solid: true },
  pc: { label: "world.obj.pc", use: "desktop", solid: true, depth: 0.002 },
  fusebox: { label: "world.obj.fusebox", solid: true, wall: true },
  shelf: { label: "world.obj.shelf", use: "storage", solid: true },
  fan: { label: "world.obj.fan", wall: true },
  letterbox: { label: "world.obj.letterbox", use: "post", wall: true },
  door: { label: "world.obj.door", use: "door", wall: true },
  extinguisher: { label: "world.obj.extinguisher", solid: true },
  xconnect: { label: "world.obj.xconnect", use: "network", wall: true },
  cooling: { label: "world.obj.cooling", solid: true },
  pdu: { label: "world.obj.pdu", use: "power", solid: true },
  noc: { label: "world.obj.noc", use: "desktop", solid: true },
  dock: { label: "world.obj.dock", wall: true },
};

export const artOf = (id: string, f: Fixture): FixtureArt => ART[f.kind ?? id];
