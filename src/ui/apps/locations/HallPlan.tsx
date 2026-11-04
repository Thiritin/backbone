import { RotateCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { t } from "../../../i18n/en";
import { hallSize, rowTiles } from "../../../sim/20-world/layout";
import { euro } from "../../../sim/00-core/money";
import { HALL, hallCapacity, hallKw, isHalle, HALL_ROW, type HallUpgrade } from "../../../sim/20-world/properties";
import { roomPower } from "../../../sim/60-infra/status";
import type { GameState, HallRow, Property } from "../../../sim/50-state";
import { addCooling, buildCarrier, buyHallUpgrade, cityCarriers, layRow, removeRow, rowInUse } from "../../../sim/90-actions/hall";
import { useStore } from "../../store";
import { Facts } from "./ui";

const TURN: Record<HallRow["facing"], HallRow["facing"]> = { s: "w", w: "n", n: "e", e: "s" };
const ARROW: Record<HallRow["facing"], string> = { n: "↑", e: "→", s: "↓", w: "←" };

// The hall's floor plan: a grid of its tiles with the rows on it. A free tile places a row there; a row is picked to turn,
// resize or remove while it holds no racks.
export function HallPlan({ game, p }: { game: GameState; p: Property }) {
  const act = useStore((s) => s.act);
  const hall = p.hall!, size = hallSize(hallCapacity(p), isHalle(p.buildingId)), loc = game.locations.find((l) => l.id === hall.locationId)!;
  const [sel, setSel] = useState<string | null>(null);
  const row = hall.rows.find((r) => r.id === sel), used = hall.rows.reduce((n, r) => n + r.length, 0), cap = hallCapacity(p);
  const at = new Map<string, { r: HallRow; i: number }>();
  for (const r of hall.rows) rowTiles(r).forEach((tile, i) => at.set(`${tile.x},${tile.y}`, { r, i }));
  const racks = new Set(game.racks.filter((r) => r.locationId === loc.id).map((r) => r.position));
  const start = (r: HallRow) => hall.rows.slice(0, hall.rows.indexOf(r)).reduce((n, k) => n + k.length, 0);
  const lay = (patch: Partial<HallRow>) => row && act(layRow, loc.id, { ...row, ...patch });
  const busy = !!row && rowInUse(game, loc.id, row.id);
  // With an empty row picked, a free tile moves it there; otherwise it starts a new row.
  const place = (x: number, y: number) => {
    const res = row && !busy ? act(layRow, loc.id, { ...row, x, y }) : act(layRow, loc.id, { x, y, length: Math.min(HALL_ROW, cap - used), facing: "s" });
    if (res.ok) setSel(res.id ?? null);
  };
  return (
    <div className="hall-plan">
      <div className="loc-row">
        <span className="loc-k">{t("hall.rows")}</span>
        <span className="num">{t("hall.positionsUsed", { used, cap })}</span>
      </div>
      <div className="hall-grid" style={{ gridTemplateColumns: `repeat(${size.w}, 1fr)` }} role="grid" aria-label={t("hall.rows")}>
        {Array.from({ length: size.w * size.h }, (_, k) => {
          const x = k % size.w, y = Math.floor(k / size.w), hit = at.get(`${x},${y}`);
          if (!hit) return <button key={k} className="hall-tile" aria-label={t("hall.placeRow", { x, y })} disabled={used >= cap && (!row || busy)} onClick={() => place(x, y)} />;
          const filled = racks.has(start(hit.r) + hit.i + 1) || hall.customers.some((c) => c.position === start(hit.r) + hit.i + 1);
          return (
            <button key={k} className={`hall-tile row${filled ? " filled" : ""}`} aria-pressed={sel === hit.r.id} onClick={() => setSel(sel === hit.r.id ? null : hit.r.id)}
              aria-label={t("hall.row", { n: hall.rows.indexOf(hit.r) + 1 })}>
              {hit.i === 0 ? ARROW[hit.r.facing] : ""}
            </button>
          );
        })}
      </div>
      <Facts rows={[
        [t("hall.cooling"), <span className="num">{hall.cooling}</span>],
        [t("hall.cooled"), <span className="num">{`${Math.min(cap, hall.cooling * HALL.cooling.positions)} / ${cap}`}</span>],
        [t("hall.transformer"), <span className="num">{t("hall.kw", { used: (roomPower(game, loc).watts / 1000).toFixed(1), kw: hallKw(p) })}</span>],
      ]} />
      <div className="loc-row prop-actions">
        <button className="btn" onClick={() => act(addCooling, loc.id)}>{t("hall.addCooling", { cost: euro(HALL.cooling.price) })}</button>
        {(Object.keys(HALL.upgrades) as HallUpgrade[]).map((k) => (
          <button key={k} className="btn" disabled={hall[k] || (k === "generator" && !hall.ups)} onClick={() => act(buyHallUpgrade, loc.id, k)}>
            {hall[k] ? t(`hall.upgrade.${k}`) : t("hall.build", { what: t(`hall.upgrade.${k}`), cost: euro(HALL.upgrades[k].price), monthly: euro(HALL.upgrades[k].monthly) })}
          </button>
        ))}
      </div>
      <div className="loc-row prop-actions">
        <span className="loc-k">{t("hall.carriers")}</span>
        {cityCarriers(loc.city).map((c) => hall.carriers.includes(c.id)
          ? <span key={c.id} className="loc-chip">{c.name}</span>
          : <button key={c.id} className="btn" onClick={() => act(buildCarrier, loc.id, c.id)}>{t("hall.buildCarrier", { carrier: c.name, cost: euro(HALL.carrierFee) })}</button>)}
      </div>
      {row && (
        <div className="loc-row prop-actions">
          <span className="loc-k">{t("hall.row", { n: hall.rows.indexOf(row) + 1 })}</span>
          <button className="btn" disabled={busy || row.length <= 1} onClick={() => lay({ length: row.length - 1 })}>−</button>
          <span className="num">{row.length}</span>
          <button className="btn" disabled={busy || used >= cap} onClick={() => lay({ length: row.length + 1 })}>+</button>
          <span className="grow" />
          <button className="btn" disabled={busy} onClick={() => lay({ facing: TURN[row.facing] })}><RotateCw />{t("hall.turn")}</button>
          <button className="btn" disabled={busy} onClick={() => act(removeRow, loc.id, row.id).ok && setSel(null)}><Trash2 />{t("hall.removeRow")}</button>
        </div>
      )}
    </div>
  );
}
