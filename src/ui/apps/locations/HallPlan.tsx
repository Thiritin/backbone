import { t } from "../../../i18n/en";
import { siteAreas } from "../../../sim/20-world/layout";
import { HALL, hallKw, hallSpots, hallCapacity, isHalle, stepTile, zoneSpots } from "../../../sim/20-world/properties";
import { airflow } from "../../../sim/60-infra/airflow";
import { hallBackupMinutes } from "../../../sim/60-infra/incidents";
import { roomPower } from "../../../sim/60-infra/status";
import type { GameState, HallItemKind, Property } from "../../../sim/50-state";
import { cityCarriers } from "../../../sim/90-actions/hall";
import { itemTiles } from "../../world/hall-annex";
import { Facts } from "./ui";
import "./hall-plan.css";

const T = 14;
const ITEM: Partial<Record<HallItemKind, string>> = { crac: "crac", vent: "vent", containment: "contain", transformer: "xfmr", switchgear: "xfmr", generator: "xfmr", ups: "batt", battery: "batt", nocdesk: "noc" };

// The hall's floor plan, read only: every area with its items, the racks with their facing and service front, and the hall's values.
// Everything is changed in the room.
export function HallPlan({ game, p }: { game: GameState; p: Property }) {
  const hall = p.hall!, loc = game.locations.find((l) => l.id === hall.locationId)!, halle = isHalle(p.buildingId);
  const areas = siteAreas(game, loc), air = airflow(game, loc);
  const mine = game.racks.filter((r) => r.locationId === loc.id), cap = hallCapacity(p);
  const used = hallSpots(hall, Object.fromEntries(mine.map((r) => [r.id, r.tile ?? null])));
  const W = Math.max(...areas.map((a) => a.rect.x + a.rect.w)), H = Math.max(...areas.map((a) => a.rect.y + a.rect.h));
  const n = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const tick = (q: { x: number; y: number }, f: "n" | "e" | "s" | "w") => { const c = { x: (q.x + 0.5) * T, y: (q.y + 0.5) * T }, e = stepTile({ x: 0, y: 0 }, f, 1); return `M${c.x} ${c.y}L${c.x + e.x * T * 0.45} ${c.y + e.y * T * 0.45}`; };
  const sold = [...hall.customers.flatMap((c) => (c.tile ? [c.tile] : [])), ...(hall.exchange?.tile ? [hall.exchange.tile] : [])];
  const cracs = hall.items.filter((i) => i.kind === "crac").length, load = roomPower(game, loc).watts / 1000;
  const carriers = cityCarriers(loc.city).filter((c) => hall.carriers.includes(c.id)).map((c) => c.name).join(", ") || "0";
  return (
    <div className="hall-plan">
      <svg className="hp-svg" viewBox={`0 0 ${W * T} ${H * T}`} role="img" aria-label={t("hall.rows")}>
        {areas.map((a) => <rect key={a.id} className={`hp-area hp-${a.floor}`} x={a.rect.x * T} y={a.rect.y * T} width={a.rect.w * T} height={a.rect.h * T} />)}
        {hall.zones.map((z) => zoneSpots(z).map((q) => <rect key={`${z.id}${q.x},${q.y}`} className={`hp-zone hp-zone-${z.kind}`} x={q.x * T} y={q.y * T} width={T} height={T} />))}
        {mine.filter((r) => r.tile).map((r) => { const f = stepTile(r.tile!, r.tile!.facing, 1); return <rect key={`f${r.id}`} className="hp-front" x={f.x * T} y={f.y * T} width={T} height={T} />; })}
        {hall.items.map((i) => itemTiles(i, areas, halle).map((q) => <rect key={`${i.id}${q.x},${q.y}`} className={`hp-item hp-${ITEM[i.kind] ?? "item"}`} x={q.x * T + 1} y={q.y * T + 1} width={T - 2} height={T - 2} />))}
        {mine.filter((r) => r.tile).map((r) => <g key={r.id}><rect className="hp-rack" x={r.tile!.x * T + 1.5} y={r.tile!.y * T + 1.5} width={T - 3} height={T - 3} /><path className="hp-tick" d={tick(r.tile!, r.tile!.facing)} /></g>)}
        {sold.map((q) => <rect key={`s${q.x},${q.y}`} className="hp-rack hp-sold" x={q.x * T + 1.5} y={q.y * T + 1.5} width={T - 3} height={T - 3} />)}
      </svg>
      <div className="hp-meters num">
        <span>{t("hall.positionsUsed", { used, cap })}</span>
        <span>{t("hall.edit.kw", { used: n(load), max: n(hallKw(p)) })}</span>
        <span>{t("hall.edit.cooling", { cool: n(air.effective), heat: n(load) })}</span>
        <span>{t("hall.edit.efficiency", { v: n(air.efficiency * 100) })}</span>
        <span>{t("hall.edit.pue", { v: air.pue.toFixed(2) })}</span>
        <span>{t("hall.board.runtime", { min: n(hallBackupMinutes(game, hall, air.load)) })}</span>
      </div>
      <Facts rows={[
        [t("hall.cooling"), <span className="num">{cracs} · {cracs * Number(HALL.items.crac.kw)} kW</span>],
        [t("hall.carriers"), <span>{carriers}</span>],
      ]} />
    </div>
  );
}
