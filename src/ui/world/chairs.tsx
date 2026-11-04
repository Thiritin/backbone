import type { ReactNode } from "react";
import { hallCapacity, isHalle } from "../../sim/20-world/properties";
import type { GameState, Location } from "../../sim/50-state";
import { areasOf, footprint, hallSize, seatsAt } from "../../sim/20-world/layout";
import { OfficeChair } from "./office";

// Draw depth of whoever sits at a hall seat: just in front of its desk when the sitter looks away from the viewer, just behind it otherwise,
// so a desk never hides the person in front of it. The chair sits a hair below the sitter.
export function seatDepth(game: GameState, loc: Location, at: { x: number; y: number }, chair = false): number | null {
  const q = seatsAt(game, loc).find((s) => s.x === at.x && s.y === at.y && s.sectionId.startsWith("noc:"));
  const p = game.properties.find((x) => x.hall?.locationId === loc.id);
  const d = q && p?.hall?.items.find((i) => `noc:${i.id}` === q.sectionId);
  if (!q || !p || !d) return null;
  const rect = areasOf(hallSize(hallCapacity(p), isHalle(p.buildingId)), p.hall!.noc).find((a) => a.id === d.area)?.rect;
  const far = Math.max(...footprint(d.kind, d, isHalle(p.buildingId), rect).map((t) => t.x + t.y)) + 0.5;
  return far + (q.facing === "n" || q.facing === "w" ? 0.05 : -0.05) - (chair ? 0.001 : 0);
}

// One office chair on every seat of an own hall (hall and NOC room alike) and at the terminal desk of a share or cage, backrest away from the desk. A removed desk has no seat, so no chair.
export function seatChairs(game: GameState, loc: Location): { depth: number; node: ReactNode }[] {
  if (loc.space !== "hall" && loc.space !== "share" && loc.space !== "cage") return [];
  return seatsAt(game, loc).map((q) => ({
    depth: seatDepth(game, loc, q, true) ?? q.x + q.y - 0.01,
    node: <OfficeChair key={`chair-${q.sectionId}-${q.index}`} cx={q.x + 0.5} cy={q.y + 0.5} facing={q.facing} />,
  }));
}
