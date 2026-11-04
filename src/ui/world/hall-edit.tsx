// GDD, Own datacenter, Edit mode: the plan board puts the hall's room into edit mode. A flat grid shows on the floor and a parts
// strip runs along the bottom edge. Racks, rows and cooling units are dragged from the strip, moved on the floor and dropped on
// the strip to sell or remove them. Every hovered tile asks the sim's `...Error` check and turns green or red.
import { useEffect, type ReactNode } from "react";
import { create } from "zustand";
import { t } from "../../i18n/en";
import { euro } from "../../sim/00-core/money";
import { yearOf } from "../../sim/00-core/time";
import { coolingSlots, hallSize, rowTiles, wallTiles, zoneTiles, type Facing, type Fixture, type OfficePlan, type Tile } from "../../sim/20-world/layout";
import { RACK_MODELS, rackUnits } from "../../sim/20-world/datacenters";
import { HALL, hallCapacity, hallKw, isHalle } from "../../sim/20-world/properties";
import { coverage } from "../../sim/60-infra/thermal";
import { roomPower } from "../../sim/60-infra/status";
import type { GameState, HallRow, HallZone, Location } from "../../sim/50-state";
import { buyRack, buyRackError, sellRack } from "../../sim/90-actions/hardware";
import { hallAt, layRow, layRowError, moveCooler, moveCoolerError, paintZone, paintZoneError, placeCooler, placeCoolerError, removeCooler, removeCoolerError, removeRow, removeRowError, removeZone, removeZoneError } from "../../sim/90-actions/hall";
import { placeRack, placeRackError } from "../../sim/90-actions/layout";
import { useStore } from "../store";
import { Cooling, pts, onX, Prism, rackHeight, RackBox } from "./draw";
import { iso } from "./grid";

type Pt = { x: number; y: number };
type RowDraft = Omit<HallRow, "id"> & { id?: string };
// What the pointer holds: a rack from the strip or off the floor, a row grabbed at tile `index` (`size` drags its last tile), or a cooling unit.
type Drag =
  | { kind: "rack"; model: string; units: number }
  | { kind: "rack-move"; id: string; units: number; origin: Pt; off: Pt }
  | { kind: "row"; row: RowDraft; index: number; size: boolean; origin: Pt }
  | { kind: "cooler"; from: number | null; origin: Pt }
  | { kind: "zone"; zone: HallZone["kind"]; rowId?: string; from?: number; id?: string; origin: Pt };

interface Edit {
  loc: string;
  drag: Drag | null;
  at: Pt | null;
  onStrip: boolean;
  msg: { text: string; at: Pt; n: number } | null;
  // The zone paint armed on the strip: a drag along a row paints a run of that length.
  brush: HallZone["kind"] | null;
  begin: (loc: string, drag: Drag) => void;
  cancel: () => void;
}

const TURN: Record<Facing, Facing> = { n: "e", e: "s", s: "w", w: "n" };
const tk = (p: Pt) => `${p.x},${p.y}`;
const MSG_MS = 2000, NEW_ROW = 4;
// Positions a zone dragged straight from the strip covers.
const ZONE_LEN: Record<HallZone["kind"], number> = { colo: 4, cage: 4, meetme: 3 };

// The floor tile under the pointer, through the room's own view transform.
function tileAt(e: { clientX: number; clientY: number }): Pt | null {
  const svg = document.querySelector<SVGSVGElement>(".world-svg"), ctm = svg?.getScreenCTM();
  if (!ctm) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return { x: Math.floor((p.x / 32 + p.y / 16) / 2), y: Math.floor((p.y / 16 - p.x / 32) / 2) };
}

// A press on a tall body lands on a floor tile behind it; the rack is the nearer tile whose body covers the pressed point.
function bodyUnder(e: { clientX: number; clientY: number }, p: Pt, has: (q: Pt) => boolean, height: number, half: number): Pt | null {
  const svg = document.querySelector<SVGSVGElement>(".world-svg"), ctm = svg?.getScreenCTM();
  if (!ctm) return null;
  const s = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  for (let k = 0; k <= 3; k++) {
    const q = { x: p.x + k, y: p.y + k }, c = iso(q.x + 0.5, q.y + 0.5);
    if (has(q) && Math.abs(s.x - c.x) <= half && s.y <= c.y + 6 && s.y >= c.y - height) return q;
  }
  return null;
}

const overStrip = (e: { clientX: number; clientY: number }) => !!document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-strip]");

// What dropping the drag at `at` does: the sim's verdict, the tiles it colours and the action to run.
interface Verdict { error: string | null; tiles: Pt[]; run: (() => { ok: boolean; error?: string; params?: Record<string, unknown> }) | null; row?: RowDraft; slot?: number; tile?: Tile }

function slotTiles(f: Fixture): Pt[] {
  return Array.from({ length: Math.max(f.w ?? 1, f.h ?? 1) }, (_, i) => ({ x: f.x + (f.h ? 0 : i), y: f.y + (f.h ? i : 0) }));
}

function nearestSlot(slots: Fixture[], at: Pt): number {
  const d = (f: Fixture) => { const c = slotTiles(f); return Math.min(...c.map((q) => (q.x - at.x) ** 2 + (q.y - at.y) ** 2)); };
  return slots.reduce((best, f, i) => (d(f) < d(slots[best]) ? i : best), 0);
}

export function verdict(game: GameState, locId: string, d: Drag, at: Pt): Verdict {
  const h = hallAt(game, locId);
  if (!h) return { error: "error.unknownLocation", tiles: [], run: null };
  const { attempt } = useStore.getState();
  const plan = { hall: h.hall, sections: [], hour: game.hour, floor: 1, capacity: hallCapacity(h.p) } as OfficePlan;
  const here = (x: Pt) => wallTiles(h.loc, plan).findIndex((q) => q.x === x.x && q.y === x.y) + 1;
  if (d.kind === "rack") {
    const position = here(at);
    return { error: position ? buyRackError(game, locId, d.model as never, position) : "error.tileTaken", tiles: [at], run: position ? () => attempt(buyRack, locId, d.model as never, position) : null };
  }
  if (d.kind === "rack-move") {
    const to = { x: at.x + d.off.x, y: at.y + d.off.y }, tile: Tile = { ...to, facing: "s" };
    return { error: placeRackError(game, d.id, tile), tiles: [to], tile, run: () => attempt(placeRack, d.id, tile) };
  }
  if (d.kind === "row") {
    const along = d.row.facing === "n" || d.row.facing === "s";
    const row: RowDraft = d.size
      ? { ...d.row, length: Math.max(1, 1 + (along ? at.x - d.row.x : at.y - d.row.y)) }
      : { ...d.row, x: along ? at.x - d.index : at.x, y: along ? at.y : at.y - d.index };
    const same = d.row.id && ["x", "y", "length", "facing"].every((k) => row[k as keyof RowDraft] === (h.hall.rows.find((r) => r.id === d.row.id) as never)?.[k]);
    return { error: same ? null : layRowError(game, locId, row), tiles: rowTiles({ ...row, id: "" }), row, run: same ? null : () => attempt(layRow, locId, row) };
  }
  if (d.kind === "zone") {
    if (d.id) return { error: null, tiles: [], run: null };
    const row = d.rowId ? h.hall.rows.find((r) => r.id === d.rowId) : h.hall.rows.find((r) => rowTiles(r).some((q) => tk(q) === tk(at)));
    if (!row) return { error: "error.zoneOutside", tiles: [at], run: null };
    const along = row.facing === "n" || row.facing === "s", idx = Math.max(0, Math.min(row.length - 1, along ? at.x - row.x : at.y - row.y));
    const from = d.rowId ? Math.min(d.from!, idx) : idx, length = d.rowId ? Math.abs(idx - d.from!) + 1 : Math.min(ZONE_LEN[d.zone], row.length - idx);
    const spec = { kind: d.zone, rowId: row.id, from, length };
    return { error: paintZoneError(game, locId, spec), tiles: rowTiles(row).slice(from, from + length), run: () => attempt(paintZone, locId, spec) };
  }
  const slots = coolingSlots(hallSize(hallCapacity(h.p), isHalle(h.p.buildingId)), isHalle(h.p.buildingId)), slot = nearestSlot(slots, at);
  const move = d.from !== null;
  return {
    error: move ? (slot === d.from ? null : moveCoolerError(game, locId, d.from!, slot)) : placeCoolerError(game, locId, slot),
    tiles: slotTiles(slots[slot]), slot,
    run: move ? (slot === d.from ? null : () => attempt(moveCooler, locId, d.from!, slot)) : () => attempt(placeCooler, locId, slot),
  };
}

// Dropping on the strip sells a rack, removes a row or a cooling unit, and puts a new part back.
function stripVerdict(game: GameState, locId: string, d: Drag): { error: string | null; run: (() => { ok: boolean; error?: string; params?: Record<string, unknown> }) | null } {
  const { attempt } = useStore.getState();
  if (d.kind === "rack-move") return { error: null, run: () => attempt(sellRack, d.id) };
  if (d.kind === "row" && d.row.id) { const id = d.row.id; return { error: removeRowError(game, locId, id), run: () => attempt(removeRow, locId, id) }; }
  if (d.kind === "zone" && d.id) { const id = d.id; return { error: removeZoneError(game, locId, id), run: () => attempt(removeZone, locId, id) }; }
  if (d.kind === "cooler" && d.from !== null) { const from = d.from; return { error: removeCoolerError(game, locId, from), run: () => attempt(removeCooler, locId, from) }; }
  return { error: null, run: null };
}

let seq = 0;
export const useEdit = create<Edit>((set, get) => {
  const finish = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("contextmenu", menu);
    window.removeEventListener("keydown", key);
    set({ drag: null, at: null, onStrip: false });
  };
  const move = (e: PointerEvent) => set({ at: tileAt(e) ?? get().at, onStrip: overStrip(e) });
  const turn = () => {
    const d = get().drag;
    if (d?.kind === "row") set({ drag: { ...d, row: { ...d.row, facing: TURN[d.row.facing] } } });
  };
  const menu = (e: Event) => { e.preventDefault(); turn(); };
  const key = (e: KeyboardEvent) => { if (e.key === "r" || e.key === "R") turn(); };
  const up = (e: PointerEvent) => {
    const { drag, loc } = get(), at = tileAt(e) ?? get().at;
    finish();
    if (!drag) return;
    const game = useStore.getState().game;
    const onStrip = overStrip(e);
    if (drag.kind === "zone" && !drag.rowId && !drag.id && onStrip) return set({ brush: get().brush === drag.zone ? null : drag.zone });
    const v = onStrip ? { ...stripVerdict(game, loc, drag), tiles: [] as Pt[] } : at ? verdict(game, loc, drag, at) : null;
    if (!v) return;
    const anchor = onStrip ? (drag.kind === "row" ? { x: drag.row.x, y: drag.row.y } : "origin" in drag ? drag.origin : at!) : at!;
    let error = v.error;
    if (!error && v.run) { const r = v.run(); if (!r.ok) error = r.error ?? "error.badRow"; }
    if (error) {
      const n = ++seq;
      set({ msg: { text: t(error), at: anchor, n } });
      setTimeout(() => { if (get().msg?.n === n) set({ msg: null }); }, MSG_MS);
    }
  };
  return {
    loc: "", drag: null, at: null, onStrip: false, msg: null, brush: null,
    begin: (loc, drag) => {
      set({ loc, drag, msg: null });
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("contextmenu", menu);
      window.addEventListener("keydown", key);
    },
    cancel: finish,
  };
});

const Quad = ({ p, cls }: { p: Pt; cls: string }) => <polygon className={cls} points={pts(iso(p.x, p.y), iso(p.x + 1, p.y), iso(p.x + 1, p.y + 1), iso(p.x, p.y + 1))} pointerEvents="none" />;

// The grid, the hot positions and the layer that catches presses on the floor, for the room's depth-sorted things.
export function editThings(game: GameState, loc: Location, plan: OfficePlan, size: { w: number; h: number }, tiles: Record<string, Tile>, push: (depth: number, node: ReactNode) => void): void {
  const hall = plan.hall;
  if (!hall) return;
  const lines: string[] = [];
  for (let x = 0; x <= size.w; x++) lines.push(`M${pts(iso(x, 0))} L${pts(iso(x, size.h))}`);
  for (let y = 0; y <= size.h; y++) lines.push(`M${pts(iso(0, y))} L${pts(iso(size.w, y))}`);
  push(-3, <path key="egrid" className="w-edit-grid" d={lines.join(" ")} pointerEvents="none" />);
  const cov = coverage(game, loc);
  hall.rows.flatMap(rowTiles).forEach((tl, i) => { if (cov[i] === false) push(-1.5, <Quad key={`ehot${tk(tl)}`} p={tl} cls="w-edit-hot" />); });
  push(1e8, <EditLayer key="elayer" game={game} loc={loc} plan={plan} size={size} tiles={tiles} />);
}

function EditLayer({ game, loc, plan, size, tiles }: { game: GameState; loc: Location; plan: OfficePlan; size: { w: number; h: number }; tiles: Record<string, Tile> }) {
  const { drag, at, onStrip, msg, brush, begin, cancel } = useEdit();
  useEffect(() => () => { cancel(); useEdit.setState({ brush: null }); }, [cancel]);
  const hall = plan.hall!, dock = !!plan.dock, slots = coolingSlots(size, dock);
  const byTile = new Map(game.racks.filter((r) => tiles[r.id]).map((r) => [tk(tiles[r.id]), r]));
  const customerAt = new Set(wallTiles(loc, plan).filter((_, i) => hall.customers.some((c) => c.position === i + 1)).map(tk));

  const press = (e: React.PointerEvent) => {
    if (e.button) return;
    const p = tileAt(e);
    if (!p) return;
    const grab = (d: Drag) => { e.stopPropagation(); e.preventDefault(); begin(loc.id, d); useEdit.setState({ at: p }); };
    const inSlot = (q: Pt) => hall.coolers.some((s) => slots[s] && slotTiles(slots[s]).some((r) => tk(r) === tk(q)));
    const cq = bodyUnder(e, p, inSlot, 90, 40);
    const slot = cq ? hall.coolers.find((s) => slots[s] && slotTiles(slots[s]).some((r) => tk(r) === tk(cq))) : undefined;
    if (slot !== undefined) return grab({ kind: "cooler", from: slot, origin: slotTiles(slots[slot])[0] });
    const under = bodyUnder(e, p, (q) => byTile.has(tk(q)), rackHeight(42), 26);
    const rack = under ? byTile.get(tk(under)) : undefined;
    const rowHit = hall.rows.find((r) => rowTiles(r).some((q) => tk(q) === tk(p)));
    if (brush && rowHit) return grab({ kind: "zone", zone: brush, rowId: rowHit.id, from: rowTiles(rowHit).findIndex((q) => tk(q) === tk(p)), origin: p });
    if (rack && !e.shiftKey && !rack.provided) return grab({ kind: "rack-move", id: rack.id, units: rackUnits(rack.model), origin: under ?? p, off: under ? { x: under.x - p.x, y: under.y - p.y } : { x: 0, y: 0 } });
    if (customerAt.has(tk(p)) && !e.shiftKey) return;
    const zoneId = e.shiftKey ? undefined : zoneTiles(loc, plan).find((z) => z.tiles.some((q) => tk(q) === tk(p)))?.id;
    if (zoneId) return grab({ kind: "zone", zone: hall.zones.find((z) => z.id === zoneId)!.kind, id: zoneId, origin: p });
    const row = rowHit;
    if (!row) return;
    const index = rowTiles(row).findIndex((q) => tk(q) === tk(p));
    grab({ kind: "row", row, index, size: index === row.length - 1 && row.length > 0, origin: p });
  };

  const v = drag && at && !onStrip ? verdict(game, loc.id, drag, at) : null;
  const tone = v ? (v.error ? "w-edit-bad" : "w-edit-ok") : "";
  const facingAt = (p: Pt): Facing => rowTilesAll(hall.rows).find((q) => q.x === p.x && q.y === p.y)?.facing ?? "s";
  return (
    <g>
      <polygon points={pts(iso(0, 0), iso(size.w, 0), iso(size.w, size.h), iso(0, size.h))} fill="rgba(0,0,0,0)" onPointerDown={press} />
      {/* Units on the far wall stand taller than the floor, so a press on their upper body lands on the wall. */}
      <polygon points={pts(iso(0, 0), iso(size.w, 0), { x: iso(size.w, 0).x, y: iso(size.w, 0).y - 100 }, { x: iso(0, 0).x, y: iso(0, 0).y - 100 })} fill="rgba(0,0,0,0)" onPointerDown={press} />
      {v && v.tiles.map((p) => <Quad key={tk(p)} p={p} cls={tone} />)}
      {v && drag && (
        <g className="w-edit-ghost" pointerEvents="none">
          {(drag.kind === "rack" || drag.kind === "rack-move") && at && <RackBox tile={{ ...v.tiles[0], facing: facingAt(v.tiles[0]) }} units={drag.units} items={[]} leds={[]} zoomed={false} />}
          {drag.kind === "row" && v.tiles.map((p) => <RackBox key={tk(p)} tile={{ ...p, facing: v.row!.facing }} units={42} items={[]} leds={[]} zoomed={false} />)}
          {drag.kind === "cooler" && v.slot !== undefined && <Cooler f={{ ...slots[v.slot], kind: "cooling" }} />}
        </g>
      )}
      {msg && (
        <g pointerEvents="none" transform={`translate(${iso(msg.at.x + 0.5, msg.at.y + 0.5).x} ${iso(msg.at.x + 0.5, msg.at.y + 0.5).y - 58})`}>
          <rect className="w-edit-msg" x={-5 - msg.text.length * 2.6} y="-10" width={10 + msg.text.length * 5.2} height="14" rx="2" />
          <text className="w-edit-msg-t" x="0" y="0">{msg.text}</text>
        </g>
      )}
    </g>
  );
}

const rowTilesAll = (rows: HallRow[]) => rows.flatMap(rowTiles);

// A cooling unit on the far wall faces the room; one on the right wall shows its louvres on the side that faces the viewer.
export function Cooler({ f }: { f: Fixture }) {
  if (!f.h) return <Cooling f={f} />;
  const x0 = f.x + 0.3, x1 = f.x + 0.94, y0 = f.y + 0.06, y1 = f.y + f.h - 0.06, H = 84, len = (y1 - y0) * 32;
  return (
    <>
      <Prism x0={x0} y0={y0} x1={x1} y1={y1} z1={H} tone="w-tone-cool" />
      <g transform={onX(x1, y0, H - 8)}>
        <rect className="w-lcd" x="5" y="0" width="11" height="6" rx="1" />
        {Array.from({ length: 9 }, (_, i) => <rect key={i} className="w-grille" x="4" y={10 + i * 6} width={len - 8} height="3" rx="1" />)}
      </g>
    </>
  );
}

// The floor plan on the wall beside the door; clicking it enters edit mode.
export function PlanBoard({ f }: { f: Fixture }) {
  return (
    <g transform={onX(0, f.y + 0.4, 66)}>
      <rect className="w-plan-frame" x="0" y="0" width="26" height="19" rx="1" />
      <rect className="w-plan-paper" x="2" y="2" width="22" height="15" />
      {[0, 1, 2].map((i) => <rect key={i} className="w-plan-row" x="4" y={4.5 + i * 4} width={i === 1 ? 12 : 16} height="2" />)}
      <rect className="w-plan-cool" x="19" y="4.5" width="3" height="10" />
    </g>
  );
}

const STRIP_H = 56;
function Mini({ children, box }: { children: ReactNode; box: string }) {
  return <svg className="w-parts-art" height={STRIP_H} viewBox={box} aria-hidden>{children}</svg>;
}

// The parts strip along the bottom edge of the room: parts to drag out, the hall's meters, and the way out of edit mode.
export function HallStrip({ loc, onDone }: { loc: Location; onDone: () => void }) {
  const game = useStore((s) => s.game), begin = useEdit((s) => s.begin), onStrip = useEdit((s) => s.onStrip), dragging = useEdit((s) => s.drag), brush = useEdit((s) => s.brush);
  const h = hallAt(game, loc.id);
  if (!h) return null;
  const n = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const used = h.hall.rows.reduce((a, r) => a + r.length, 0), cap = hallCapacity(h.p);
  const heat = roomPower(game, loc).watts / 1000;
  const pick = (d: Drag) => (e: React.PointerEvent) => { if (e.button) return; e.preventDefault(); begin(loc.id, d); };
  const rackBox = `-34 ${-rackHeight(47) - 8} 68 ${rackHeight(47) + 44}`;
  return (
    <div className={`w-parts${onStrip && dragging ? " w-parts-drop" : ""}`} data-strip>
      {RACK_MODELS.filter((m) => m.id !== "shelf").map((m) => (
        <div key={m.id} className="w-parts-item" onPointerDown={pick({ kind: "rack", model: m.id, units: m.units })} role="button" aria-label={t("hall.edit.rack", { u: m.units })}>
          <Mini box={rackBox}><RackBox tile={{ x: 0, y: 0, facing: "s" }} units={m.units} items={[]} leds={[]} zoomed={false} /></Mini>
          <span>{t("hall.edit.rack", { u: m.units })}</span><b className="num">{euro(m.price)}</b>
        </div>
      ))}
      <div className="w-parts-item" onPointerDown={pick({ kind: "row", row: { x: 0, y: 0, length: Math.max(1, Math.min(NEW_ROW, cap - used)), facing: "s" }, index: 0, size: false, origin: { x: 0, y: 0 } })} role="button" aria-label={t("hall.edit.row")}>
        <Mini box="-40 -2 140 66">{[0, 1, 2].map((i) => <polygon key={i} className="w-hall-mark" points={pts(iso(i, 0.2), iso(i + 0.9, 0.2), iso(i + 0.9, 1.1), iso(i, 1.1))} />)}</Mini>
        <span>{t("hall.edit.row")}</span>
      </div>
      <div className="w-parts-item" onPointerDown={pick({ kind: "cooler", from: null, origin: { x: 0, y: 0 } })} role="button" aria-label={t("hall.edit.cooler")}>
        <Mini box="-30 -92 100 140"><Cooling f={{ x: 0, y: 0, w: 2 }} /></Mini>
        <span>{t("hall.edit.cooler")}</span><b className="num">{euro(HALL.cooling.price)}</b>
      </div>
      {(["colo", "cage", "meetme"] as const).filter((z) => z !== "cage" || yearOf(game.hour) >= HALL.zones.cage.from).map((z) => (
        <div key={z} className={`w-parts-item${brush === z ? " w-parts-on" : ""}`} onPointerDown={pick({ kind: "zone", zone: z, origin: { x: 0, y: 0 } })} role="button" aria-pressed={brush === z} aria-label={t(`hall.edit.${z}`)}>
          <Mini box="-40 -2 140 66">{[0, 1, 2].map((i) => <polygon key={i} className={`w-zone-${z}`} points={pts(iso(i, 0.2), iso(i + 1, 0.2), iso(i + 1, 1.2), iso(i, 1.2))} />)}{z !== "colo" && <polygon className="w-zone-fence" points={pts(iso(0, 0.2), iso(3, 0.2), iso(3, 1.2), iso(0, 1.2))} />}</Mini>
          <span>{t(`hall.edit.${z}`)}</span>{z !== "colo" && <b className="num">{euro(z === "cage" ? HALL.zones.cage.perPosition : HALL.zones.meetme.price)}</b>}
        </div>
      ))}
      <div className="w-parts-meters num">
        <span>{t("hall.edit.kw", { used: n(heat), max: n(hallKw(h.p)) })}</span>
        <span>{t("hall.edit.cooling", { cool: n(h.hall.coolers.length * HALL.cooling.kw), heat: n(heat) })}</span>
        <span>{t("hall.edit.places", { used: n(used), cap: n(cap) })}</span>
      </div>
      <button className="w-parts-done" onClick={onDone}>{t("hall.edit.done")}</button>
    </div>
  );
}
