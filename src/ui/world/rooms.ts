import type { Fixture } from "../../sim/20-world/layout";

export type Use = "desktop" | "storage" | "power" | "door" | "post" | "scan" | "stairs";

// What using a fixture kind does. Wall ones, and flat marks on the floor, are drawn behind everything standing; top ones hang over the room; the rest are depth-sorted with the racks.
// A fixture without a label is clutter, hidden from assistive tech.
export interface FixtureArt { label?: string; use?: Use; wall?: boolean; top?: boolean; depth?: number }

export const ART: Record<string, FixtureArt> = {
  // The scanner stands on the desk top, so it sorts after the desk at the next column.
  scanner: { label: "world.obj.scanner", use: "scan", depth: 1.01 },
  desk: { label: "world.obj.desk" },
  pc: { label: "world.obj.pc", use: "desktop", depth: 0.002 },
  fusebox: { label: "world.obj.fusebox", use: "power", wall: true },
  shelf: { label: "world.obj.shelf", use: "storage" },
  fan: { label: "world.obj.fan", wall: true },
  letterbox: { label: "world.obj.letterbox", use: "post", wall: true },
  door: { label: "world.obj.door", use: "door", wall: true },
  window: { wall: true },
  hygrometer: { wall: true },
  jack: { wall: true },
  duct: { wall: true },
  switch: { wall: true },
  mat: { wall: true },
  drain: { wall: true },
  lamp: { top: true },
  boiler: {},
  washer: {},
  dryer: {},
  chair: {},
  cart: {},
  extinguisher: { label: "world.obj.extinguisher" },
  cooling: { label: "world.obj.cooling" },
  pdu: { label: "world.obj.pdu", use: "power" },
  noc: { label: "world.obj.noc", use: "desktop" },
  dock: { label: "world.obj.dock", wall: true },
  // The office room. The stairwell door switches floors; the partition and its code door sort with the room, one piece per row.
  stairs: { label: "world.obj.stairs", use: "stairs", wall: true }, bossdesk: { label: "world.obj.pc", use: "desktop" }, owindow: { wall: true }, whiteboard: { wall: true },
  tray: { wall: true }, tube: { top: true }, kitchen: {}, printer: {}, reception: {}, plant: {}, bin: {}, partition: { depth: 0.5 }, codedoor: { depth: 0.5 },
  "odesk-s": {}, "odesk-n": {}, "ochair-s": {}, "ochair-n": {}, buckets: {}, ladder: {}, toolbox: {},
};

export const artOf = (id: string, f: Fixture): FixtureArt => ART[f.kind ?? id];
