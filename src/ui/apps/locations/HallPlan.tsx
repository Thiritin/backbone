import { t } from "../../../i18n/en";
import { hallSize, rowTiles } from "../../../sim/20-world/layout";
import { HALL, hallCapacity, hallKw, isHalle, zonePositions } from "../../../sim/20-world/properties";
import { roomPower } from "../../../sim/60-infra/status";
import type { GameState, Property } from "../../../sim/50-state";
import { cityCarriers } from "../../../sim/90-actions/hall";
import { Facts } from "./ui";

const ARROW = { n: "↑", e: "→", s: "↓", w: "←" } as const;

// The hall's floor plan, read only: its rows and zones drawn small, and the hall's values. Everything is changed in the room.
export function HallPlan({ game, p }: { game: GameState; p: Property }) {
  const hall = p.hall!, size = hallSize(hallCapacity(p), isHalle(p.buildingId)), loc = game.locations.find((l) => l.id === hall.locationId)!;
  const used = hall.rows.reduce((n, r) => n + r.length, 0), cap = hallCapacity(p);
  const at = new Map<string, { r: (typeof hall.rows)[number]; i: number; position: number }>();
  hall.rows.forEach((r, ri) => {
    const start = hall.rows.slice(0, ri).reduce((n, k) => n + k.length, 0);
    rowTiles(r).forEach((tile, i) => at.set(`${tile.x},${tile.y}`, { r, i, position: start + i + 1 }));
  });
  const racks = new Set(game.racks.filter((r) => r.locationId === loc.id).map((r) => r.position));
  const zoneOf = new Map(hall.zones.flatMap((z) => zonePositions(hall, z).map((q) => [q, z.kind] as const)));
  return (
    <div className="hall-plan">
      <div className="loc-row">
        <span className="loc-k">{t("hall.rows")}</span>
        <span className="num">{t("hall.positionsUsed", { used, cap })}</span>
      </div>
      <div className="hall-grid" style={{ gridTemplateColumns: `repeat(${size.w}, 1fr)` }} role="img" aria-label={t("hall.rows")}>
        {Array.from({ length: size.w * size.h }, (_, k) => {
          const x = k % size.w, y = Math.floor(k / size.w), hit = at.get(`${x},${y}`);
          if (!hit) return <span key={k} className="hall-tile" />;
          const filled = racks.has(hit.position) || hall.customers.some((c) => c.position === hit.position) || hall.exchange?.position === hit.position, zone = zoneOf.get(hit.position);
          return <span key={k} className={`hall-tile row${filled ? " filled" : ""}${zone ? ` zone-${zone}` : ""}`}>{hit.i === 0 ? ARROW[hit.r.facing] : ""}</span>;
        })}
      </div>
      <Facts rows={[
        [t("hall.cooling"), <span className="num">{hall.coolers.length}</span>],
        [t("hall.coolingKw"), <span className="num">{hall.coolers.length * HALL.cooling.kw} kW</span>],
        [t("hall.transformer"), <span className="num">{t("hall.kw", { used: (roomPower(game, loc).watts / 1000).toFixed(1), kw: hallKw(p) })}</span>],
        [t("hall.carriers"), <span>{cityCarriers(loc.city).filter((c) => hall.carriers.includes(c.id)).map((c) => c.name).join(", ") || "0"}</span>],
      ]} />
    </div>
  );
}
