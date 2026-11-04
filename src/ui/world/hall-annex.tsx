// GDD, Own datacenter, In the room: the annex rooms and everything placed in the hall, drawn from the layout. Floors, cut-away
// walls with doorways, power gear, cooling, delivered crates, the NOC lettering, and the trays and light rails over the runs.
import type { ReactNode } from "react";
import { t } from "../../i18n/en";
import { areaAt, footprint, intake, siteAreas, type Area, type OfficePlan, type Tile } from "../../sim/20-world/layout";
import { HALL, isHalle, zoneSpots } from "../../sim/20-world/properties";
import type { GameState, HallItem, Location } from "../../sim/50-state";
import { rackAlarms } from "../../sim/60-infra/alarms";
import { hallAt } from "../../sim/90-actions/hall";
import { seatOf } from "../../sim/90-actions/work-orders";
import { useStore } from "../store";
import { visitThen } from "./visit";
import { Prism, WALL } from "./draw";
import { ART } from "./rooms";
import { aisleTiles, key, runsOf, wallPieces, type Pt } from "./hall-edit-geom";
import { AreaFloor, Battery, Containment, CratedRack, Crac, Doorway, Generator, Hatch, NocDesk, NocLettering, StubWall, Switchgear, Transformer, Ups, Vent, WallScreen } from "./hall-art";

type Push = (depth: number, node: ReactNode) => void;
const FLOOR_OF: Record<Area["floor"], "concrete" | "epoxy" | "carpet" | null> = { raised: null, concrete: "concrete", epoxy: "epoxy", office: "carpet", outdoor: null };

// Scene tiles of an item and its top corner; a wall item runs down the left wall of its area.
export function itemTiles(i: HallItem, areas: Area[], halle: boolean): Pt[] {
  const a = areas.find((q) => q.id === i.area);
  if (!a) return [];
  if (HALL.items[i.kind].layer === "wall") return Array.from({ length: HALL.items[i.kind].w as number }, (_, k) => ({ x: a.rect.x + i.x, y: a.rect.y + i.y + k }));
  return footprint(i.kind, i, halle, a.rect);
}
export const corner = (pts: Pt[]): Pt => ({ x: Math.min(...pts.map((p) => p.x)), y: Math.min(...pts.map((p) => p.y)) });
const extent = (pts: Pt[]) => ({ w: Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)) + 1, h: Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y)) + 1 });

// The wall between two areas as cut-away stubs with a doorway at each passage.
function partitions(areas: Area[], color: string): { depth: number; node: ReactNode }[] {
  const out: { depth: number; node: ReactNode }[] = [];
  const hall = areas.find((a) => a.id === "hall");
  if (!hall) return out;
  const W = hall.rect.w, H = hall.rect.h;
  const gapsX = hall.passages.filter((p) => p.tile.x === W - 1).map((p) => p.tile.y);
  const gapsY = hall.passages.filter((p) => p.tile.y === H - 1 && p.to === "noc").map((p) => p.tile.x);
  const piece = (k: string, depth: number, node: ReactNode) => out.push({ depth, node: <g key={k} pointerEvents="none">{node}</g> });
  if (areas.some((a) => a.id === "xfmr")) {
    for (const y of wallPieces(0, H, gapsX)) piece(`wx${y}`, W + y + 0.5, <StubWall x0={W} y0={y} x1={W} y1={y + 1} color={color} />);
    for (const y of gapsX) piece(`dx${y}`, W + y + 0.4, <Doorway x={W} y={y} axis="y" />);
  }
  const xf = areas.find((a) => a.id === "xfmr"), bat = areas.find((a) => a.id === "battery");
  if (xf && bat) for (let x = W; x < W + xf.rect.w; x++) piece(`wp${x}`, x + xf.rect.h + 0.5, <StubWall x0={x} y0={xf.rect.h} x1={x + 1} y1={xf.rect.h} color={color} />);
  const noc = areas.find((a) => a.id === "noc");
  if (noc) {
    for (const x of wallPieces(0, noc.rect.w, gapsY)) piece(`wn${x}`, x + H + 0.5, <StubWall x0={x} y0={H} x1={x + 1} y1={H} color={color} />);
    for (const x of gapsY) piece(`dn${x}`, x + H + 0.4, <Doorway x={x} y={H} axis="x" />);
  }
  return out;
}

// One item of the layout in its own art. Holding the pointer over it names it.
function ItemArt({ i, areas, halle, tripped, alarm, hall }: { i: HallItem; areas: Area[]; halle: boolean; tripped: boolean; alarm: boolean; hall: GameState["properties"][number]["hall"] }) {
  const pts = itemTiles(i, areas, halle), c = corner(pts), p = { x: c.x, y: c.y, facing: i.facing };
  switch (i.kind) {
    case "crac": return <Crac {...p} />;
    case "vent": return <Vent x={c.x} y={c.y} reach={ventReach(c, hall?.items ?? [], areas, halle)} />;
    case "containment": return <Containment x={c.x} y={c.y} {...ends(c, hall?.items.filter((q) => q.kind === "containment") ?? [], areas, halle)} />;
    case "transformer": return <Transformer {...p} size={halle ? "halle" : "office"} />;
    case "switchgear": return <Switchgear {...p} />;
    case "generator": return <Generator {...p} />;
    case "ups": return <Ups {...p} running={!tripped} />;
    case "battery": return <Battery {...p} />;
    case "nocdesk": return <NocDesk {...p} seats={HALL.items.nocdesk.seats ?? 2} occupied={[]} />;
    case "screen": return <WallScreen y={c.y} state={tripped ? "trip" : alarm ? "alarm" : "ok"} />;
  }
}

// A vent within reach of a cooling unit gets its air; the dots show it.
function ventReach(at: Pt, items: HallItem[], areas: Area[], halle: boolean): boolean {
  return items.filter((i) => i.kind === "crac").some((i) => itemTiles(i, areas, halle).some((p) => Math.abs(p.x - at.x) + Math.abs(p.y - at.y) <= HALL.air.reach));
}

// Containment tiles that end a run carry a door panel on the open side.
function ends(at: Pt, all: HallItem[], areas: Area[], halle: boolean) {
  const set = new Set(all.flatMap((i) => itemTiles(i, areas, halle)).map(key)), has = (x: number, y: number) => set.has(key({ x, y }));
  const w = has(at.x - 1, at.y), e = has(at.x + 1, at.y), n = has(at.x, at.y - 1), s = has(at.x, at.y + 1);
  return { endW: !w && e, endE: w && !e, endN: !n && s, endS: n && !s };
}

// The tiles where delivered racks wait: beside the entry door, clear of the walkway and of every body.
export function crateSpots(H: number, taken: Set<string>, n: number): Pt[] {
  const cand: Pt[] = [{ x: 0, y: H - 1 }, { x: 1, y: H - 1 }, { x: 2, y: H - 1 }, { x: 2, y: H - 2 }, { x: 1, y: H - 4 }, { x: 2, y: H - 4 }];
  return cand.filter((p) => !taken.has(key(p))).slice(0, n);
}

export function annexScene(game: GameState, loc: Location, plan: OfficePlan, tiles: Record<string, Tile>, push: Push): { halle: boolean; areas: Area[]; bodies: Set<string> } {
  const at = hallAt(game, loc.id), hall = plan.hall!, areas = at ? siteAreas(game, loc) : [], halle = !!at && isHalle(at.p.buildingId);
  const color = game.company.color, H = areas.find((a) => a.id === "hall")?.rect.h ?? 0;
  for (const a of areas) {
    const kind = FLOOR_OF[a.floor];
    if (kind) push(-50, <g key={`fl${a.id}`} pointerEvents="none"><AreaFloor x={a.rect.x} y={a.rect.y} w={a.rect.w} h={a.rect.h} kind={kind} /></g>);
  }
  for (const s of partitions(areas, color)) push(s.depth, s.node);
  const noc = areas.find((a) => a.id === "noc");
  if (noc) push(-40, <g key="noclabel" pointerEvents="none"><NocLettering y={noc.rect.y} len={noc.rect.h} company={game.company} /></g>);

  const alarm = game.racks.some((r) => r.locationId === loc.id && rackAlarms(game, r.id).length > 0);
  const bodies = new Set<string>();
  for (const t of Object.values(tiles)) bodies.add(key(t));
  const owners = hall.customers.flatMap((c) => (c.zoneId ? [] : c.tile ? [c.tile] : []));
  for (const t of owners) bodies.add(key(t));
  if (hall.exchange?.tile) bodies.add(key(hall.exchange.tile));
  for (const i of hall.items) {
    const pts = itemTiles(i, areas, halle);
    if (HALL.items[i.kind].layer === "body") for (const p of pts) bodies.add(key(p));
  }
  for (const i of hall.items) {
    const pts = itemTiles(i, areas, halle), ex = extent(pts), c = corner(pts), body = HALL.items[i.kind].layer === "body";
    if (i.kind === "transformer" || i.kind === "generator") push(-30, <g key={`h${i.id}`} pointerEvents="none"><Hatch x={c.x} y={c.y} w={ex.w} h={ex.h} /></g>);
    const depth = body ? c.x + ex.w - 1 + c.y + ex.h - 1 + 0.5 : i.kind === "screen" ? -39 : c.x + c.y - 1.9;
    const art = <ItemArt i={i} areas={areas} halle={halle} tripped={loc.tripped} alarm={alarm} hall={hall} />;
    // A NOC desk is a PC of the company: pressing it opens the desktop.
    if (i.kind === "nocdesk") push(depth, <g key={`i${i.id}`} className="w-obj" role="button" aria-label={t(ART.nocdesk.label!)} onClick={(e) => { e.stopPropagation(); visitThen(loc.id, seatOf(game, loc.id, "player"), t(ART.nocdesk.label!), () => useStore.getState().setSurface("desktop")); }}>{art}</g>);
    else push(depth, <g key={`i${i.id}`} role="img" aria-label={t(`hall.item.${i.kind}`)} pointerEvents="none"><title>{t(`hall.item.${i.kind}`)}</title>{art}</g>);
  }

  // Delivered racks stand crated by the entry until they are placed.
  const crates = game.racks.filter((r) => r.locationId === loc.id && !r.tile);
  crateSpots(H, bodies, crates.length).forEach((p, k) => push(p.x + p.y + 0.5, <g key={`crate${crates[k].id}`} role="img" aria-label={t("hall.obj.crate")} pointerEvents="none"><CratedRack x={p.x} y={p.y} facing="e" /></g>));

  // Trays over each run, the conduit from the annex wall, and light rails over the aisles only.
  const standing = [...Object.values(tiles), ...hall.customers.flatMap((c) => (c.zoneId ? [] : c.tile ? [c.tile] : [])), ...(hall.exchange?.tile ? [hall.exchange.tile] : [])];
  const W = areas.find((a) => a.id === "hall")?.rect.w ?? 0, runs = runsOf(standing);
  runs.forEach((r, n) => {
    const alongX = r.facing === "n" || r.facing === "s", a = r.tiles[0], b = r.tiles[r.tiles.length - 1];
    const x0 = a.x, y0 = a.y, x1 = alongX ? b.x + 1 : a.x + 1, y1 = alongX ? a.y + 1 : b.y + 1, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, by = alongX ? cy : a.y + 0.5;
    push(Math.max(x1, 0) + Math.max(y1, 0) + 0.2, (
      <g key={`tray${n}`} pointerEvents="none">
        <Prism x0={alongX ? x0 : cx - 0.18} y0={alongX ? cy - 0.18 : y0} x1={alongX ? x1 : cx + 0.18} y1={alongX ? cy + 0.18 : y1} z0={WALL - 1} z1={WALL + 1.5} tone="w-tone-frame" />
        <Prism x0={alongX ? x1 - 0.1 : cx - 0.03} y0={by - 0.03} x1={W - 0.4} y1={by + 0.03} z0={WALL + 5} z1={WALL + 7} tone="w-tone-frame" />
      </g>
    ));
  });
  const zoneBodies = new Set(hall.zones.filter((z) => z.kind === "cage").flatMap(zoneSpots).map(key));
  const faced = [...standing, ...hall.zones.filter((z) => z.kind !== "cage").flatMap(zoneSpots)], fronts = faced.map(intake);
  const alongY = new Map(faced.map((q) => [key(intake(q)), q.facing === "e" || q.facing === "w"]));
  const nonHall = areas.filter((a) => a.id !== "hall");
  const rails = aisleTiles(fronts, bodies, zoneBodies).filter((p) => !nonHall.some((a) => areaAt([a], p)) && !!areaAt(areas, p));
  for (const p of rails) { const v = alongY.get(key(p)); push(p.x + p.y + 1, <g key={`rail${key(p)}`} pointerEvents="none"><Prism x0={v ? p.x + 0.47 : p.x + 0.2} y0={v ? p.y + 0.2 : p.y + 0.47} x1={v ? p.x + 0.53 : p.x + 0.8} y1={v ? p.y + 0.8 : p.y + 0.53} z0={WALL + 2} z1={WALL + 4} tone="w-tone-tube" /></g>); }
  // The conduit's trunk along the annex wall, joining every branch.
  if (runs.length && W) {
    const ys = runs.map((r) => r.tiles[0].y + 0.5), lo = Math.min(...ys), hi = Math.max(...ys);
    push(W + hi, <g key="trunk" pointerEvents="none"><Prism x0={W - 0.43} y0={lo - 0.03} x1={W - 0.37} y1={hi + 0.03} z0={WALL + 5} z1={WALL + 7} tone="w-tone-frame" /></g>);
  }
  return { halle, areas, bodies };
}
