import { hourOf } from "../src/sim/00-core/time";
import { REFIT } from "../src/sim/20-world/properties";
import type { Facing } from "../src/sim/20-world/layout";
import type { GameState, Hall, HallItemKind, HallZone, RackModel } from "../src/sim/50-state";
import { editHall, type HallEdit, type HallPlace } from "../src/sim/90-actions/hall";
import { buyBuilding, refitSection } from "../src/sim/90-actions/properties";
import { newGame } from "./fixtures";

export const at = (y: number, m = 3, d = 2, h = 10) => hourOf(new Date(Date.UTC(y, m - 1, d, h)));
export const ok = (r: { ok: boolean; error?: string; id?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };

// An owned Gallushof (2 floors × 2 sections; seed 7 leaves floor 1 free) or the Halle, with floor 1 fitted as a hall and the refit done.
// The Gallushof hall is 16 × 8 tiles: the door at (0, 5), the meet-me door at (0, 3), the transformer room at (16, 0) and the battery room at (16, 4).
export function ownHall(building = "gallushof", year = 2013) {
  const s = newGame(7);
  s.cash = 10_000_000;
  s.hour = at(year);
  const propertyId = ok(buyBuilding(s, building));
  const p = s.properties.find((x) => x.id === propertyId)!;
  const hallId = ok(refitSection(s, propertyId, p.sections.find((x) => x.floor === 1)!.id, "hall"));
  s.hour += 24 * REFIT.hall.days;
  const hall = (): Hall => s.properties.find((x) => x.id === propertyId)!.hall!;
  return { s, propertyId, hallId, hall };
}
export type OwnHall = ReturnType<typeof ownHall>;

export const edit = (e: OwnHall, ed: HallEdit) => editHall(e.s, e.hallId, ed);
export const place = (e: OwnHall, ...p: HallPlace[]) => ok(edit(e, { place: p }));
export const rack = (e: OwnHall, x: number, y: number, facing: Facing = "s", model: RackModel = "rack-42") => place(e, { kind: "rack", model, x, y, facing });
export const zone = (e: OwnHall, kind: HallZone["kind"], x: number, y: number, length: number, facing: Facing = "s") => place(e, { kind: "zone", zone: kind, length, x, y, facing });
// An item on the first spot of its area the sim accepts.
export function item(e: OwnHall, kind: HallItemKind, area: "hall" | "xfmr" | "battery" | "noc" = "hall"): string {
  const size = { hall: [16, 8], xfmr: [6, 4], battery: [6, 4], noc: [8, 5] }[area];
  for (let y = 0; y < size[1]; y++) for (let x = 0; x < size[0]; x++) for (const facing of ["s", "n", "e", "w"] as const) {
    const r = edit(e, { place: [{ kind, x, y, facing, area }] });
    if (r.ok) return r.id!;
  }
  throw new Error(`no spot for ${kind}`);
}
export const customer = (e: OwnHall, n: number, tile: { x: number; y: number; facing: Facing } | null, zoneId: string | null, kw = 3) =>
  ({ id: `c${n}`, name: `Kunde ${n}`, tile, monthly: 100, since: e.s.hour, kw, zoneId, leaveBump: 0 });
export const snapshot = (s: GameState) => JSON.stringify(s);
