import { freeRackTiles, officePlan, rackTiles, type Tile } from "../20-world/layout";
import type { GameState } from "../50-state";
import type { ActionResult } from "./hardware";
import { editHall, editHallError } from "./hall";

const freeTile = (s: GameState, rack: GameState["racks"][number], tile: Tile) => {
  const loc = s.locations.find((l) => l.id === rack.locationId)!, plan = officePlan(s, loc);
  return { loc, plan, free: freeRackTiles(loc, s.racks, plan).find((t) => t.x === tile.x && t.y === tile.y && (t.floor ?? 1) === (tile.floor ?? 1)) };
};

// In an own hall the tile and facing go through editHall.
const hallMove = (rackId: string, tile: Tile) => ({ move: [{ ref: `rack:${rackId}`, x: tile.x, y: tile.y, facing: tile.facing }] });

// Why a rack cannot stand on a tile, or null.
export function placeRackError(s: GameState, rackId: string, tile: Tile): string | null {
  const rack = s.racks.find((r) => r.id === rackId);
  if (!rack) return "error.unknownRack";
  const { loc, free } = freeTile(s, rack, tile);
  if (loc.space === "hall") return editHallError(s, loc.id, hallMove(rackId, tile))?.key ?? null;
  return free ? null : "error.tileTaken";
}

// The facing follows the wall, so only x and y of the asked tile count; in an own hall the tile's facing counts too.
export function placeRack(s: GameState, rackId: string, tile: Tile): ActionResult {
  const rack = s.racks.find((r) => r.id === rackId);
  if (!rack) return { ok: false, error: "error.unknownRack" };
  const loc = s.locations.find((l) => l.id === rack.locationId)!;
  if (loc.space === "hall") {
    const r = editHall(s, loc.id, hallMove(rackId, tile));
    return r.ok ? { ok: true, id: rack.id } : r;
  }
  const error = placeRackError(s, rackId, tile);
  if (error) return { ok: false, error };
  const { plan, free } = freeTile(s, rack, tile);
  // Pin the room's computed tiles so the others stay put once this one moves.
  const tiles = rackTiles(loc, s.racks, plan);
  for (const r of s.racks) if (tiles[r.id]) r.tile = tiles[r.id];
  rack.tile = free!;
  return { ok: true, id: rack.id };
}
