import { t } from "../../../i18n/en";
import { modelById } from "../../../sim/10-catalog/hardware";
import { rackUnits } from "../../../sim/20-world/datacenters";
import type { Fixture, Tile } from "../../../sim/20-world/layout";
import type { Device, End, GameState, Location } from "../../../sim/50-state";
import { cableColor } from "../../art/fronts";
import { devName, portName } from "../../apps/hw";
import { at3, JACK_Z, rackHeight, WALL } from "../draw";

// Overhead tray height; every cable between racks, or from a rack to the wall socket, climbs to it.
const TRAY = WALL - 6;

export const endName = (g: GameState, e: End) => {
  const d = g.devices.find((x) => x.id === e.device);
  return d ? `${d.panel ? t("locations-1.carrierPanel") : devName(d)} ${portName(modelById(d.model), e.port)}` : "";
};

// In the basement the line ends at the wall socket.
const wallPoint = (fx: Record<string, Fixture>) => {
  const f = fx.jack;
  return f && (f.y === 0 ? { x: f.x + 0.5, y: 0, z: JACK_Z - 4 } : { x: 0, y: f.y + 0.5, z: JACK_Z - 4 });
};

// Cables between two racks or a rack and the wall socket, one line each: up from the rack top, along the far wall's tray, and down at the other end. In a datacenter the carrier panel sits in the patch panel of the player's first rack, so a cross-connect from another rack runs to that one.
export function RoomCables({ game, loc, tiles, fx, onOpen }: { game: GameState; loc: Location; tiles: Record<string, Tile>; fx: Record<string, Fixture>; onOpen: (rackId: string, end: End) => void }) {
  const wall = wallPoint(fx);
  const first = game.racks.filter((r) => r.locationId === loc.id && tiles[r.id]).sort((a, b) => a.position - b.position)[0];
  const where = (d: Device | undefined) => {
    if (!d) return null;
    const tile = d.rackId ? tiles[d.rackId] : undefined, rack = tile && game.racks.find((r) => r.id === d.rackId);
    if (tile && rack) return { x: tile.x + 0.5, y: tile.y + 0.5, z: rackHeight(rackUnits(rack.model)), rack: rack.id };
    if (d.panel !== loc.id) return null;
    if (wall) return { ...wall, rack: null };
    return first ? { x: tiles[first.id].x + 0.5, y: tiles[first.id].y + 0.5, z: rackHeight(rackUnits(first.model)), rack: first.id } : null;
  };
  const dev = new Map(game.devices.map((d) => [d.id, d]));
  const runs = game.cables.flatMap((c) => {
    const a = where(dev.get(c.a.device)), b = where(dev.get(c.b.device));
    return a && b && a.rack !== b.rack && (a.rack || b.rack) ? [{ c, a, b }] : [];
  });
  return (
    <g className="w-cables">
      {runs.map(({ c, a, b }, i) => {
        const lane = 0.12 + (i % 10) * 0.035;
        const d = [[a.x, a.y, a.z], [a.x, a.y, TRAY], [a.x, lane, TRAY], [b.x, lane, TRAY], [b.x, b.y, TRAY], [b.x, b.y, b.z]]
          .map(([x, y, z], k) => { const p = at3(x, y, z); return `${k ? "L" : "M"}${p.x} ${p.y}`; }).join("");
        // The nearer rack end opens.
        const [near, end] = !b.rack || (a.rack && a.x + a.y >= b.x + b.y) ? [a.rack!, c.a] : [b.rack, c.b];
        return (
          <g key={c.id} className="w-cable" data-cable={c.id} role="button" aria-label={`${endName(game, c.a)} ↔ ${endName(game, c.b)}`}
            onClick={(e) => { e.stopPropagation(); onOpen(near, end); }}>
            <title>{`${endName(game, c.a)} ↔ ${endName(game, c.b)}`}</title>
            <path className="w-cable-hit" d={d} />
            <path className="w-cable-line" d={d} stroke={cableColor(c)} />
          </g>
        );
      })}
    </g>
  );
}
