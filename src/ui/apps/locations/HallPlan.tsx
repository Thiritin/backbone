import { t } from "../../../i18n/en";
import { hallSize } from "../../../sim/20-world/layout";
import { HALL, hallCapacity, hallKw, hallSpots, isHalle, zoneSpots } from "../../../sim/20-world/properties";
import { roomPower } from "../../../sim/60-infra/status";
import type { GameState, Property } from "../../../sim/50-state";
import { cityCarriers } from "../../../sim/90-actions/hall";
import { Facts } from "./ui";

const ARROW = { n: "↑", e: "→", s: "↓", w: "←" } as const;

// The hall's floor plan, read only: its zones and racks drawn small, and the hall's values. Everything is changed in the room.
export function HallPlan({ game, p }: { game: GameState; p: Property }) {
  const hall = p.hall!, size = hallSize(hallCapacity(p), isHalle(p.buildingId)), loc = game.locations.find((l) => l.id === hall.locationId)!;
  const mine = game.racks.filter((r) => r.locationId === loc.id), cap = hallCapacity(p);
  const used = hallSpots(hall, Object.fromEntries(mine.map((r) => [r.id, r.tile ?? null])));
  const key = (q: { x: number; y: number }) => `${q.x},${q.y}`;
  const racks = new Map(mine.filter((r) => r.tile).map((r) => [key(r.tile!), r.tile!.facing]));
  const zoneOf = new Map(hall.zones.flatMap((z) => zoneSpots(z).map((q) => [key(q), { kind: z.kind, facing: q.facing }] as const)));
  const sold = new Set([...hall.customers.flatMap((c) => (c.tile ? [key(c.tile)] : [])), ...(hall.exchange?.tile ? [key(hall.exchange.tile)] : [])]);
  const cages = new Set(hall.customers.flatMap((c) => hall.zones.filter((z) => z.id === c.zoneId && z.kind === "cage").flatMap(zoneSpots).map(key)));
  const cracs = hall.items.filter((i) => i.kind === "crac").length;
  return (
    <div className="hall-plan">
      <div className="loc-row">
        <span className="loc-k">{t("hall.rows")}</span>
        <span className="num">{t("hall.positionsUsed", { used, cap })}</span>
      </div>
      <div className="hall-grid" style={{ gridTemplateColumns: `repeat(${size.w}, 1fr)` }} role="img" aria-label={t("hall.rows")}>
        {Array.from({ length: size.w * size.h }, (_, k) => {
          const x = k % size.w, y = Math.floor(k / size.w), id = key({ x, y }), facing = racks.get(id) ?? zoneOf.get(id)?.facing, zone = zoneOf.get(id)?.kind;
          if (!facing) return <span key={k} className="hall-tile" />;
          const filled = racks.has(id) || sold.has(id) || cages.has(id);
          return <span key={k} className={`hall-tile row${filled ? " filled" : ""}${zone ? ` zone-${zone}` : ""}`}>{ARROW[facing]}</span>;
        })}
      </div>
      <Facts rows={[
        [t("hall.cooling"), <span className="num">{cracs}</span>],
        [t("hall.coolingKw"), <span className="num">{cracs * (HALL.items.crac.kw as number)} kW</span>],
        [t("hall.transformer"), <span className="num">{t("hall.kw", { used: (roomPower(game, loc).watts / 1000).toFixed(1), kw: hallKw(p) })}</span>],
        [t("hall.carriers"), <span>{cityCarriers(loc.city).filter((c) => hall.carriers.includes(c.id)).map((c) => c.name).join(", ") || "0"}</span>],
      ]} />
    </div>
  );
}
