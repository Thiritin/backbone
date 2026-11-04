import { freeRackTiles, officePlan, rackTiles, wallTiles, type Tile } from "../20-world/layout";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";
import { darken } from "./hall";

const freeTile = (s: GameState, rack: GameState["racks"][number], tile: Tile) => {
  const loc = s.locations.find((l) => l.id === rack.locationId)!, plan = officePlan(s, loc);
  return { loc, plan, free: freeRackTiles(loc, s.racks, plan).find((t) => t.x === tile.x && t.y === tile.y && (t.floor ?? 1) === (tile.floor ?? 1)) };
};

// Why a rack cannot stand on a tile, or null. In an own hall a rack that is still on its way cannot be moved again.
export function placeRackError(s: GameState, rackId: string, tile: Tile): string | null {
  const rack = s.racks.find((r) => r.id === rackId);
  if (!rack) return "error.unknownRack";
  const { loc, free } = freeTile(s, rack, tile);
  if (loc.space === "hall" && rack.arriveAt !== null) return "error.rackMoving";
  return free ? null : "error.tileTaken";
}

// The facing follows the wall, so only x and y of the asked tile count. A hall rack with devices is dark for two hours.
export function placeRack(s: GameState, rackId: string, tile: Tile): ActionResult {
  const error = placeRackError(s, rackId, tile);
  if (error) return { ok: false, error };
  const rack = s.racks.find((r) => r.id === rackId)!, { loc, plan, free } = freeTile(s, rack, tile);
  // In an own hall the tile is the position.
  if (loc.space === "hall") {
    rack.position = wallTiles(loc, plan).findIndex((t) => t.x === free!.x && t.y === free!.y) + 1;
    darken(s, rack);
    return { ok: true, id: rack.id };
  }
  // Pin the room's computed tiles so the others stay put once this one moves.
  const tiles = rackTiles(loc, s.racks, plan);
  for (const r of s.racks) if (tiles[r.id]) r.tile = tiles[r.id];
  rack.tile = free!;
  return { ok: true, id: rack.id };
}
