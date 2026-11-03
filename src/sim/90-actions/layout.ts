import { freeRackTiles, officePlan, rackTiles, type Tile } from "../20-world/layout";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";

// The facing follows the wall, so only x and y of the asked tile count.
export function placeRack(s: GameState, rackId: string, tile: Tile): ActionResult {
  const rack = s.racks.find((r) => r.id === rackId);
  if (!rack) return { ok: false, error: "error.unknownRack" };
  const loc = s.locations.find((l) => l.id === rack.locationId)!;
  const plan = officePlan(s, loc), free = freeRackTiles(loc, s.racks, plan).find((t) => t.x === tile.x && t.y === tile.y && (t.floor ?? 1) === (tile.floor ?? 1));
  if (!free) return { ok: false, error: "error.tileTaken" };
  // Pin the room's computed tiles so the others stay put once this one moves.
  const tiles = rackTiles(loc, s.racks, plan);
  for (const r of s.racks) if (tiles[r.id]) r.tile = tiles[r.id];
  rack.tile = free;
  return { ok: true, id: rack.id };
}
