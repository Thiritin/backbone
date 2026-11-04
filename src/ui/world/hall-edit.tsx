// GDD, Own datacenter, Edit mode: the plan board puts the hall's room into edit mode. A flat grid shows on the floor and a parts
// strip runs along the bottom edge. Racks, zones and cooling units are dragged from the strip, moved on the floor, turned with R
// and dropped on the strip to sell or remove them. Every hovered tile asks the sim's editHallError check and turns green or red.
import { useEffect, type ReactNode } from "react";
import { create } from "zustand";
import { t } from "../../i18n/en";
import { euro } from "../../sim/00-core/money";
import { yearOf } from "../../sim/00-core/time";
import { footprint, type Facing, type Fixture, type OfficePlan, type Tile } from "../../sim/20-world/layout";
import { RACK_MODELS, rackUnits } from "../../sim/20-world/datacenters";
import { HALL, hallCapacity, hallKw, hallSpots, zoneSpots } from "../../sim/20-world/properties";
import { roomPower } from "../../sim/60-infra/status";
import type { GameState, HallZone, Location } from "../../sim/50-state";
import { hallAt, editHall, editHallError, type HallEdit } from "../../sim/90-actions/hall";
import { useStore } from "../store";
import { Cooling, pts, onX, Prism, rackHeight, RackBox } from "./draw";
import { iso } from "./grid";

type Pt = { x: number; y: number };
// What the pointer holds: a new part from the strip, or a rack, zone or cooling unit grabbed off the floor.
type Drag =
  | { kind: "rack"; model: string; units: number; facing: Facing }
  | { kind: "rack-move"; id: string; units: number; origin: Pt; off: Pt; facing: Facing }
  | { kind: "zone"; zone: HallZone["kind"]; id?: string; origin: Pt; facing: Facing }
  | { kind: "cooler"; id: string | null; origin: Pt; facing: Facing };

interface Edit {
  loc: string;
  drag: Drag | null;
  at: Pt | null;
  onStrip: boolean;
  msg: { text: string; at: Pt; n: number } | null;
  begin: (loc: string, drag: Drag) => void;
  cancel: () => void;
}

const TURN: Record<Facing, Facing> = { n: "e", e: "s", s: "w", w: "n" };
const tk = (p: Pt) => `${p.x},${p.y}`;
const MSG_MS = 2000;
// Tiles a zone dragged straight from the strip covers.
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

// What dropping the drag at `at` does: the sim's verdict, the tiles it colours and the edit to run.
interface Verdict { error: string | null; tiles: Pt[]; edit: HallEdit }

function editOf(d: Drag, at: Pt): { edit: HallEdit; tiles: Pt[] } {
  if (d.kind === "rack") return { edit: { place: [{ kind: "rack", model: d.model as never, ...at, facing: d.facing }] }, tiles: [at] };
  if (d.kind === "rack-move") { const to = { x: at.x + d.off.x, y: at.y + d.off.y }; return { edit: { move: [{ ref: `rack:${d.id}`, ...to, facing: d.facing }] }, tiles: [to] }; }
  if (d.kind === "zone") {
    const zone = { x: at.x, y: at.y, length: ZONE_LEN[d.zone], facing: d.facing } as HallZone;
    return { edit: d.id ? { move: [{ ref: `zone:${d.id}`, ...at, facing: d.facing }] } : { place: [{ kind: "zone", zone: d.zone, length: zone.length, ...at, facing: d.facing }] }, tiles: zoneSpots(zone) };
  }
  const tiles = footprint("crac", { ...at, facing: d.facing }, false);
  return { edit: d.id ? { move: [{ ref: `item:${d.id}`, ...at, facing: d.facing }] } : { place: [{ kind: "crac", ...at, facing: d.facing, area: "hall" }] }, tiles };
}

export function verdict(game: GameState, locId: string, d: Drag, at: Pt): Verdict {
  const { edit, tiles } = editOf(d, at);
  return { error: editHallError(game, locId, edit)?.key ?? null, tiles, edit };
}

// Dropping on the strip sells a rack or removes a zone or a cooling unit.
function stripEdit(d: Drag): HallEdit | null {
  if (d.kind === "rack-move") return { remove: [`rack:${d.id}`] };
  if (d.kind === "zone" && d.id) return { remove: [`zone:${d.id}`] };
  if (d.kind === "cooler" && d.id) return { remove: [`item:${d.id}`] };
  return null;
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
    if (d) set({ drag: { ...d, facing: TURN[d.facing] } });
  };
  const menu = (e: Event) => { e.preventDefault(); turn(); };
  const key = (e: KeyboardEvent) => { if (e.key === "r" || e.key === "R") turn(); };
  const up = (e: PointerEvent) => {
    const { drag, loc } = get(), at = tileAt(e) ?? get().at;
    finish();
    if (!drag) return;
    const onStrip = overStrip(e), edit = onStrip ? stripEdit(drag) : at ? editOf(drag, at).edit : null;
    if (!edit) return;
    const anchor = onStrip && "origin" in drag ? drag.origin : at!;
    const r = useStore.getState().attempt(editHall, loc, edit);
    if (!r.ok) {
      const n = ++seq;
      set({ msg: { text: t(r.error ?? "error.occupied"), at: anchor ?? { x: 0, y: 0 }, n } });
      setTimeout(() => { if (get().msg?.n === n) set({ msg: null }); }, MSG_MS);
    }
  };
  return {
    loc: "", drag: null, at: null, onStrip: false, msg: null,
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

// The grid and the layer that catches presses on the floor, for the room's depth-sorted things.
export function editThings(game: GameState, loc: Location, plan: OfficePlan, size: { w: number; h: number }, tiles: Record<string, Tile>, push: (depth: number, node: ReactNode) => void): void {
  if (!plan.hall) return;
  const lines: string[] = [];
  for (let x = 0; x <= size.w; x++) lines.push(`M${pts(iso(x, 0))} L${pts(iso(x, size.h))}`);
  for (let y = 0; y <= size.h; y++) lines.push(`M${pts(iso(0, y))} L${pts(iso(size.w, y))}`);
  push(-3, <path key="egrid" className="w-edit-grid" d={lines.join(" ")} pointerEvents="none" />);
  push(1e8, <EditLayer key="elayer" game={game} loc={loc} plan={plan} size={size} tiles={tiles} />);
}

function EditLayer({ game, loc, plan, size, tiles }: { game: GameState; loc: Location; plan: OfficePlan; size: { w: number; h: number }; tiles: Record<string, Tile> }) {
  const { drag, at, onStrip, msg, begin, cancel } = useEdit();
  useEffect(() => () => { cancel(); }, [cancel]);
  const hall = plan.hall!, dock = !!plan.dock;
  const byTile = new Map(game.racks.filter((r) => tiles[r.id]).map((r) => [tk(tiles[r.id]), r]));
  const cracs = hall.items.filter((i) => i.kind === "crac").map((i) => ({ i, pts: footprint("crac", i, dock) }));
  const customerAt = new Set(hall.customers.flatMap((c) => (c.tile ? [tk(c.tile)] : [])));

  const press = (e: React.PointerEvent) => {
    if (e.button) return;
    const p = tileAt(e);
    if (!p) return;
    const grab = (d: Drag) => { e.stopPropagation(); e.preventDefault(); begin(loc.id, d); useEdit.setState({ at: p }); };
    const cq = bodyUnder(e, p, (q) => cracs.some((c) => c.pts.some((r) => tk(r) === tk(q))), 90, 40);
    const crac = cq ? cracs.find((c) => c.pts.some((r) => tk(r) === tk(cq))) : undefined;
    if (crac) return grab({ kind: "cooler", id: crac.i.id, origin: crac.pts[0], facing: crac.i.facing });
    const under = bodyUnder(e, p, (q) => byTile.has(tk(q)), rackHeight(42), 26);
    const rack = under ? byTile.get(tk(under)) : undefined;
    if (rack && !e.shiftKey && !rack.provided) return grab({ kind: "rack-move", id: rack.id, units: rackUnits(rack.model), origin: under ?? p, off: under ? { x: under.x - p.x, y: under.y - p.y } : { x: 0, y: 0 }, facing: tiles[rack.id].facing });
    if (customerAt.has(tk(p)) && !e.shiftKey) return;
    const zone = hall.zones.find((z) => zoneSpots(z).some((q) => tk(q) === tk(p)));
    if (zone) grab({ kind: "zone", zone: zone.kind, id: zone.id, origin: p, facing: zone.facing });
  };

  const v = drag && at && !onStrip ? verdict(game, loc.id, drag, at) : null;
  const tone = v ? (v.error ? "w-edit-bad" : "w-edit-ok") : "";
  return (
    <g>
      <polygon points={pts(iso(0, 0), iso(size.w, 0), iso(size.w, size.h), iso(0, size.h))} fill="rgba(0,0,0,0)" onPointerDown={press} />
      {/* Units on the far wall stand taller than the floor, so a press on their upper body lands on the wall. */}
      <polygon points={pts(iso(0, 0), iso(size.w, 0), { x: iso(size.w, 0).x, y: iso(size.w, 0).y - 100 }, { x: iso(0, 0).x, y: iso(0, 0).y - 100 })} fill="rgba(0,0,0,0)" onPointerDown={press} />
      {v && v.tiles.map((p) => <Quad key={tk(p)} p={p} cls={tone} />)}
      {v && drag && (
        <g className="w-edit-ghost" pointerEvents="none">
          {(drag.kind === "rack" || drag.kind === "rack-move") && <RackBox tile={{ ...v.tiles[0], facing: drag.facing }} units={drag.units} items={[]} leds={[]} zoomed={false} />}
          {drag.kind === "zone" && v.tiles.map((p) => <polygon key={tk(p)} className={`w-zone-${drag.zone}`} points={pts(iso(p.x, p.y), iso(p.x + 1, p.y), iso(p.x + 1, p.y + 1), iso(p.x, p.y + 1))} />)}
          {drag.kind === "cooler" && <Cooler f={{ x: v.tiles[0].x, y: v.tiles[0].y, ...(drag.facing === "n" || drag.facing === "s" ? { w: 2 } : { h: 2 }), kind: "cooling" }} />}
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
  const game = useStore((s) => s.game), begin = useEdit((s) => s.begin), onStrip = useEdit((s) => s.onStrip), dragging = useEdit((s) => s.drag);
  const h = hallAt(game, loc.id);
  if (!h) return null;
  const n = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const cap = hallCapacity(h.p), used = hallSpots(h.hall, Object.fromEntries(game.racks.filter((r) => r.locationId === loc.id).map((r) => [r.id, r.tile ?? null])));
  const heat = roomPower(game, loc).watts / 1000, cracs = h.hall.items.filter((i) => i.kind === "crac").length;
  const pick = (d: Drag) => (e: React.PointerEvent) => { if (e.button) return; e.preventDefault(); begin(loc.id, d); };
  const rackBox = `-34 ${-rackHeight(47) - 8} 68 ${rackHeight(47) + 44}`;
  return (
    <div className={`w-parts${onStrip && dragging ? " w-parts-drop" : ""}`} data-strip>
      {RACK_MODELS.filter((m) => m.id !== "shelf").map((m) => (
        <div key={m.id} className="w-parts-item" onPointerDown={pick({ kind: "rack", model: m.id, units: m.units, facing: "s" })} role="button" aria-label={t("hall.edit.rack", { u: m.units })}>
          <Mini box={rackBox}><RackBox tile={{ x: 0, y: 0, facing: "s" }} units={m.units} items={[]} leds={[]} zoomed={false} /></Mini>
          <span>{t("hall.edit.rack", { u: m.units })}</span><b className="num">{euro(m.price)}</b>
        </div>
      ))}
      <div className="w-parts-item" onPointerDown={pick({ kind: "cooler", id: null, origin: { x: 0, y: 0 }, facing: "s" })} role="button" aria-label={t("hall.edit.cooler")}>
        <Mini box="-30 -92 100 140"><Cooling f={{ x: 0, y: 0, w: 2 }} /></Mini>
        <span>{t("hall.edit.cooler")}</span><b className="num">{euro(HALL.items.crac.price)}</b>
      </div>
      {(["colo", "cage", "meetme"] as const).filter((z) => z !== "cage" || yearOf(game.hour) >= HALL.zones.cage.from).map((z) => (
        <div key={z} className="w-parts-item" onPointerDown={pick({ kind: "zone", zone: z, origin: { x: 0, y: 0 }, facing: "s" })} role="button" aria-label={t(`hall.edit.${z}`)}>
          <Mini box="-40 -2 140 66">{[0, 1, 2].map((i) => <polygon key={i} className={`w-zone-${z}`} points={pts(iso(i, 0.2), iso(i + 1, 0.2), iso(i + 1, 1.2), iso(i, 1.2))} />)}{z !== "colo" && <polygon className="w-zone-fence" points={pts(iso(0, 0.2), iso(3, 0.2), iso(3, 1.2), iso(0, 1.2))} />}</Mini>
          <span>{t(`hall.edit.${z}`)}</span>{z !== "colo" && <b className="num">{euro(z === "cage" ? HALL.zones.cage.perPosition : HALL.zones.meetme.price)}</b>}
        </div>
      ))}
      <div className="w-parts-meters num">
        <span>{t("hall.edit.kw", { used: n(heat), max: n(hallKw(h.p)) })}</span>
        <span>{t("hall.edit.cooling", { cool: n(cracs * (HALL.items.crac.kw as number)), heat: n(heat) })}</span>
        <span>{t("hall.edit.places", { used: n(used), cap: n(cap) })}</span>
      </div>
      <button className="w-parts-done" onClick={onDone}>{t("hall.edit.done")}</button>
    </div>
  );
}
