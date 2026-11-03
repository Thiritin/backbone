import { t } from "../../../i18n/en";
import { modelById } from "../../../sim/10-catalog/hardware";
import { rackUnits } from "../../../sim/20-world/datacenters";
import type { Fixture, Tile } from "../../../sim/20-world/layout";
import type { Device, End, GameState, Location } from "../../../sim/50-state";
import { portPeers } from "../../../sim/60-infra/status";
import { connect } from "../../../sim/90-actions/hardware";
import { cableColor } from "../../art/fronts";
import { devName, portName } from "../../apps/hw";
import { useStore } from "../../store";
import { at3, rackHeight, WALL } from "../draw";
import { Slab } from "../panel/Slab";

// Overhead tray height; every cable between racks or to the wall panel climbs to it.
const TRAY = WALL - 6;

export const endName = (g: GameState, e: End) => {
  const d = g.devices.find((x) => x.id === e.device);
  return d ? `${d.panel ? t("locations-1.carrierPanel") : devName(d)} ${portName(modelById(d.model), e.port)}` : "";
};

// The carrier panel hangs on the cross-connect fixture; the basement has none, so its line jack sits by the fuse box.
// ponytail: one wall point per room, give the basement jack its own fixture if it gets drawn.
const wallPoint = (fx: Record<string, Fixture>) => {
  const f = fx.xconnect ?? fx.fusebox;
  if (!f) return null;
  return f.y === 0 ? { x: f.x + (f.w ?? 1) / 2, y: 0, z: WALL * 0.5 } : { x: 0, y: f.y + 0.5, z: WALL * 0.5 };
};

// Cables between two racks or a rack and the wall panel, one line each: up from the rack top, along the far wall's tray, and down at the other end.
export function RoomCables({ game, loc, tiles, fx, onOpen }: { game: GameState; loc: Location; tiles: Record<string, Tile>; fx: Record<string, Fixture>; onOpen: (rackId: string, end: End) => void }) {
  const wall = wallPoint(fx);
  const where = (d: Device | undefined) => {
    if (!d) return null;
    const tile = d.rackId ? tiles[d.rackId] : undefined, rack = tile && game.racks.find((r) => r.id === d.rackId);
    if (tile && rack) return { x: tile.x + 0.5, y: tile.y + 0.5, z: rackHeight(rackUnits(rack.model)), rack: rack.id };
    return d.panel === loc.id && wall ? { ...wall, rack: null } : null;
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

// The cross-connect panel as a cable target: every carrier panel port of the room, free ones take the cable in hand.
export function JackPanel({ loc, hand, onHand, onClose }: { loc: Location; hand: End; onHand: (e: End | null) => void; onClose: () => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const devs = game.devices.filter((d) => d.panel === loc.id);
  return (
    <Slab title={t("world.obj.xconnect")} head={<span className="wr-num">{endName(game, hand)}</span>} onClose={onClose} onBack={() => { onHand(null); return true; }} className="wp-panel" data={{ "jack-panel": loc.id }}>
      <div className="wp-list">
        {devs.map((d) => {
          const m = modelById(d.model), peers = portPeers(game, d.id);
          return (
            <div key={d.id} className="wp-card">
              <div className="wp-card-h"><strong>{devName(d)}</strong></div>
              <div className="seg wrap">
                {m.ports.map((_, i) => (
                  <button key={i} className="num" disabled={!!peers[i]} title={peers[i] ? endName(game, peers[i]!) : t("locations-1.free")}
                    onClick={() => { if (act(connect, hand, { device: d.id, port: i }).ok) { onHand(null); onClose(); } }}>{portName(m, i)}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Slab>
  );
}
