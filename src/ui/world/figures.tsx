// People in every room, drawn to docs/design/world-art.md: seated at desks, standing at a rack, walking from the door.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { t } from "../../i18n/en";
import { LOCALE } from "../../i18n/lang";
import { dateOf } from "../../sim/00-core/time";
import { rackUnits } from "../../sim/20-world/datacenters";
import { type Facing, type OfficePlan, seatsAt, siteAreas, type Tile } from "../../sim/20-world/layout";
import type { GameState, Location } from "../../sim/50-state";
import { figuresIn, pathOf, type Figure } from "../../sim/60-infra/figures";
import { present } from "../../sim/60-infra/handwork";
import { nowMin, seatOf } from "../../sim/90-actions/work-orders";
import { brandColor } from "../art/logos";
import { at3, rackHeight } from "./draw";
import { iso, type Pt } from "./grid";
import { useVisit, walkSeconds } from "./visit";
// A rounded figure in flat colours, head a little large.
const SKIN = ["oklch(0.82 0.06 60)", "oklch(0.72 0.08 55)", "oklch(0.58 0.08 50)", "oklch(0.45 0.06 45)"];
const HAIR = ["oklch(0.3 0.03 50)", "oklch(0.5 0.08 60)", "oklch(0.75 0.1 85)", "oklch(0.25 0.01 260)", "oklch(0.55 0.12 40)"];
const SHIRT = ["oklch(0.55 0.12 250)", "oklch(0.62 0.12 150)", "oklch(0.7 0.13 70)", "oklch(0.55 0.15 20)", "oklch(0.8 0.02 250)", "oklch(0.5 0.08 300)"];
const PANTS = ["oklch(0.35 0.04 255)", "oklch(0.3 0.01 60)", "oklch(0.5 0.03 80)"];
// String hash with a final mix, so ids that differ in one digit still spread.
const hash = (s: string) => { let h = [...s].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 0x5bd1e995) >>> 0, 7); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); return (h ^ (h >>> 13)) >>> 0; };
const look = (id: string, colour: string | null) => {
  const h = hash(id);
  return { skin: SKIN[h % 4], hair: HAIR[(h >>> 3) % 5], shirt: colour ? brandColor(colour) : SHIRT[(h >>> 6) % 6], pants: PANTS[(h >>> 9) % 3], delay: (h % 50) / 10, badge: !!colour };
};
type Look = ReturnType<typeof look>;
// Screen offset of a step of dx, dy tiles at height z.
const rel = (dx: number, dy: number, z: number): Pt => ({ x: (dx - dy) * 32, y: (dx + dy) * 16 - z });
const STEP: Record<Facing, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const toViewer = (f: Facing) => f === "s" || f === "e";

const Head = ({ l, y, front }: { l: Look; y: number; front: boolean }) => (
  <g className="w-fig-head" style={{ animationDelay: `${l.delay}s`, transformOrigin: `0px ${y + 6}px` }}>
    <circle cx="0" cy={y} r="7" fill={l.skin} />
    {front
      ? <path fill={l.hair} d={`M-7,${y - 0.5} A7,7 0 0 1 7,${y - 0.5} L5,${y - 3} L-5,${y - 3} Z`} />
      : <path fill={l.hair} d={`M-7,${y + 1.5} A7,7 0 1 1 7,${y + 1.5} Z`} />}
  </g>
);

// The provider's badge clipped to the chest.
const Badge = ({ l, y }: { l: Look; y: number }) => l.badge ? <><rect x="-5.5" y={y} width="4.5" height="3.2" rx="0.5" fill="white" /><circle cx="-3.25" cy={y + 1.6} r="0.9" fill={l.shirt} /></> : null;

function Seated({ l, facing }: { l: Look; facing: "s" | "n" }) {
  const k = facing === "s" ? 1 : -1, knee = rel(0, 0.3 * k, 18), hand = (dx: number) => rel(dx, 0.32, 24);
  return (
    <>
      {facing === "s" && <path className="w-fig" style={{ stroke: l.pants }} strokeWidth="6" strokeLinecap="round" d={`M-3,-18 L${knee.x - 3},${knee.y} M3,-18 L${knee.x + 3},${knee.y}`} />}
      <rect x="-7" y="-35" width="14" height="19" rx="6" fill={l.shirt} />
      {facing === "s" && (
        <g className="w-fig-hands" style={{ animationDelay: `${l.delay}s` }}>
          <path stroke={l.shirt} strokeWidth="3.4" strokeLinecap="round" fill="none" d={`M-6,-31 L${hand(-0.1).x},${hand(-0.1).y} M6,-31 L${hand(0.1).x},${hand(0.1).y}`} />
          <circle cx={hand(-0.1).x} cy={hand(-0.1).y} r="1.8" fill={l.skin} />
          <circle cx={hand(0.1).x} cy={hand(0.1).y} r="1.8" fill={l.skin} />
        </g>
      )}
      <Head l={l} y={rel(0, 0, 41).y} front={facing === "s"} />
    </>
  );
}

// Standing at a rack's face; the working hand reaches into it every few seconds.
function Standing({ l, facing, busy }: { l: Look; facing: Facing; busy: boolean }) {
  const [dx, dy] = STEP[facing], hand = rel(dx * 0.3, dy * 0.3, 32), front = toViewer(facing);
  const arm = (
    <g className={busy ? "w-fig-work" : undefined} style={{ animationDelay: `${l.delay}s` }}>
      <path stroke={l.shirt} strokeWidth="3.4" strokeLinecap="round" fill="none" d={`M5,-40 L${hand.x},${hand.y}`} />
      <circle cx={hand.x} cy={hand.y} r="1.8" fill={l.skin} />
    </g>
  );
  return (
    <>
      <path stroke={l.pants} strokeWidth="5" strokeLinecap="round" d="M-3,-24 L-3,-2 M3,-24 L3,-2" />
      {!front && arm}
      <rect x="-7" y="-44" width="14" height="22" rx="6" fill={l.shirt} />
      {front && <Badge l={l} y={-40} />}
      {front && arm}
      <Head l={l} y={-51} front={front} />
    </>
  );
}

// Two-frame leg swing: the mirrored legs swap places every few frames while the figure walks.
function Walking({ l }: { l: Look }) {
  return (
    <>
      <path className="w-fig-stride" stroke={l.pants} strokeWidth="5" strokeLinecap="round" d="M-3,-24 L-5,-2 M3,-24 L5,-2" />
      <rect x="-7" y="-44" width="14" height="22" rx="6" fill={l.shirt} />
      <Badge l={l} y={-40} />
      <Head l={l} y={-51} front />
    </>
  );
}

// The name and the job on a small plate on the floor at the figure's feet.
function FloorTag({ at, text }: { at: Pt; text: string }) {
  const w = text.length * 2.6 + 4;
  return (
    <g pointerEvents="none" transform={`translate(${at.x} ${at.y})`}>
      <rect className="w-tent" x={-w / 2} y="1" width={w} height="7" />
      <text className="w-num w-num-sm w-tent-text" x={-w / 2 + 2} y="6">{text}</text>
    </g>
  );
}

// Two flat tones over a rack top (or a head) while someone works.
function Progress({ at, f }: { at: Pt; f: number }) {
  return (
    <g pointerEvents="none" transform={`translate(${at.x} ${at.y})`} data-progress={f.toFixed(2)}>
      <rect className="w-prog-bg" x="-13" y="-3" width="26" height="5" />
      <rect className="w-prog-fill" x="-12" y="-2" width={Math.max(0, Math.min(1, f)) * 24} height="3" />
    </g>
  );
}

// A figure that glides along tile points over ms real milliseconds; the position is set once per segment and the browser animates it.
function Mover({ pts, ms, onDone, depth, children, ...rest }: { pts: Pt[]; ms: number; onDone?: () => void; depth?: number; children: ReactNode } & Record<string, unknown>) {
  const ref = useRef<SVGGElement>(null), s = iso(pts[0].x, pts[0].y);
  const sig = `${pts.map((p) => `${p.x},${p.y}`).join(";")}@${Math.round(ms)}`;
  const done = useRef(onDone);
  done.current = onDone;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || pts.length < 2 || ms < 60 || typeof el.animate !== "function") { done.current?.(); return; }
    const dist = pts.map((_, i) => pts.slice(1, i + 1).reduce((a, p, j) => a + Math.abs(p.x - pts[j].x) + Math.abs(p.y - pts[j].y), 0)), total = dist[dist.length - 1] || 1;
    const a = el.animate(pts.map((p, i) => { const q = iso(p.x, p.y); return { transform: `translate(${q.x}px, ${q.y}px)`, offset: dist[i] / total }; }), { duration: ms, fill: "forwards", easing: "linear" });
    a.onfinish = () => done.current?.();
    return () => a.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return <g ref={ref} {...rest} style={{ transform: `translate(${s.x}px, ${s.y}px)` }}>{children}</g>;
}

const centre = (p: Pt): Pt => ({ x: p.x + 0.5, y: p.y + 0.5 });
const key = (p: Pt) => `${p.x},${p.y}`;
// Where a seated person is drawn: in the chair, which in the office rooms is the column beside the desk.
const sitAt = (p: Pt, facing: Facing | undefined, office: boolean): Pt => office ? { x: p.x + 1, y: p.y + (facing === "s" ? 0.55 : 0.45) } : centre(p);

// The people in this room as depth-sorted things: seated at their seat, walking to a rack, working there and back. Every position comes from the saved
// work orders at the game minute; the next minute's position sets where the browser glides to, so no frame state is kept.
// A hall seat is saved relative to its area's corner; the scene needs it in hall tiles.
function sceneSeat(game: GameState, loc: Location, seat: Pt | null): Pt | null {
  const area = (seat as { area?: string | null } | null)?.area;
  const rect = area ? siteAreas(game, loc).find((a) => a.id === area)?.rect : undefined;
  return seat && rect ? { ...seat, x: seat.x + rect.x, y: seat.y + rect.y } : seat;
}

export function useFigures(game: GameState, loc: Location, plan: OfficePlan | undefined, tiles: Record<string, Tile>, speed: number): { depth: number; node: ReactNode }[] {
  const [hover, setHover] = useState<string | null>(null);
  const walk = useVisit((v) => v.walk), at = useVisit((v) => v.at), set = useVisit((v) => v.set);
  const floor = plan?.floor ?? 1, office = loc.space === "office", m = nowMin(game), out: { depth: number; node: ReactNode }[] = [];
  const msPerMin = speed > 0 ? 1000 / speed : 0, here = present(game, loc.id), seat = here ? sceneSeat(game, loc, seatOf(game, loc.id, "player")) : null;
  const busy = game.orders.some((o) => o.worker === "player" && o.locationId === loc.id && !o.applied);
  const pending = useVisit((v) => v.pending);
  const walkHere = walk?.locationId === loc.id ? walk : null;

  // Starts the waiting visit once the player's own orders are done; a visit to where the figure already stands opens at once.
  useEffect(() => {
    if (busy) { if (at) set({ at: null }); return; }
    if (!pending || pending.locationId !== loc.id || walk) return;
    const from = at?.locationId === loc.id ? at.pt : sceneSeat(game, loc, seatOf(game, loc.id, "player"));
    if (!from) { set({ pending: null }); pending.run(); return; }
    const path = pathOf(game, loc, from, pending.to), seconds = walkSeconds(path);
    set({ pending: null });
    if (seconds === 0) { set({ at: { locationId: loc.id, pt: pending.to } }); pending.run(); }
    else set({ walk: { ...pending, path, seconds } });
  }, [busy, pending, walk, at, loc, game, set]);

  const now = figuresIn(game, loc.id, m), next = msPerMin ? figuresIn(game, loc.id, m + 1) : [];
  const list: Figure[] = now.slice();
  if (seat && !list.some((f) => f.id === "player")) {
    const p = at?.locationId === loc.id ? at.pt : seat, sitting = key(p) === key(seat);
    list.push({ id: "player", name: "", role: "player", tile: { x: p.x, y: p.y, facing: (seat as Tile).facing ?? "n" }, facing: (seat as Tile).facing ?? "n", colour: null, busy: false, seated: sitting, pose: sitting ? "sit" : "stand", path: [p], progress: 0 });
  }
  // Without a drawn seat in the room nobody sits: the figure stands where the sim parks it.
  const seated = seatsAt(game, loc).length > 0;
  for (const f of list) {
    if ((f.tile.floor ?? 1) !== floor) continue;
    if (!seated && f.pose === "sit") f.pose = "stand";
    const player = f.id === "player", l = look(f.id, f.colour), name = player ? t("figures.you") : f.name;
    const walking = player && walkHere && f.pose !== "work" && f.pose !== "walk" ? walkHere : null;
    const other = next.find((x) => x.id === f.id);
    // The points to glide along this minute: the path between where the figure is now and next minute.
    let pts: Pt[] | null = null, ms = msPerMin;
    if (walking) { pts = walking.path.map(centre); ms = walking.seconds * 1000; }
    else if (other && f.pose === "walk") {
      const i = f.path.findIndex((p) => key(p) === key(f.tile)), j = f.path.findIndex((p) => key(p) === key(other.tile));
      if (i >= 0 && j > i) pts = f.path.slice(i, j + 1).map(centre);
    }
    const sitting = f.pose === "sit" && !walking, pos = sitting ? sitAt(f.tile, f.tile.facing, office) : centre(f.tile), p0 = pts ? pts[0] : pos;
    const mid = pts ? pts[Math.floor(pts.length / 2)] : pos;
    const depth = sitting ? f.tile.x + f.tile.y + (f.facing === "s" ? 0.001 : -0.001) : Math.floor(mid.x) + Math.floor(mid.y) + 0.5;
    const pose = walking ? "walk" : f.pose, s = iso(p0.x, p0.y);
    const enter = () => setHover(f.id), exit = () => setHover((v) => (v === f.id ? null : v));
    const body = pose === "sit" ? <Seated l={l} facing={toViewer(f.facing) ? "s" : "n"} /> : pose === "walk" ? <Walking l={l} /> : <Standing l={l} facing={f.facing} busy={pose === "work"} />;
    const done = walking ? () => { set({ walk: null, at: { locationId: loc.id, pt: walking.to } }); walking.run(); } : undefined;
    out.push({ depth, node: <Mover key={f.id} pts={pts && pts.length > 1 ? pts : [p0]} ms={ms} onDone={done} className="w-person" data-person={f.id} data-pose={pose} aria-label={name} onPointerEnter={enter} onPointerLeave={exit}>{body}</Mover> });
    // A rack row in front would hide someone in the aisle, so a faint outline shows through.
    if (!sitting) out.push({ depth: 1e9, node: <Mover key={`x-${f.id}`} pts={pts && pts.length > 1 ? pts : [p0]} ms={ms} className="w-person w-xray" aria-hidden>{pose === "walk" ? <Walking l={l} /> : <Standing l={l} facing={f.facing} busy={false} />}</Mover> });
    if (pose === "work") {
      const tile = f.job?.rackId ? tiles[f.job.rackId] : undefined, rack = f.job?.rackId ? game.racks.find((r) => r.id === f.job!.rackId) : undefined;
      const top = tile && rack ? at3(tile.x + 0.5, tile.y + 0.5, rackHeight(rackUnits(rack.model)) + 10) : { x: s.x, y: s.y - 64 };
      out.push({ depth: 1e9 + 2, node: <Progress key={`p-${f.id}`} at={top} f={f.progress} /> });
    }
    if (hover === f.id) {
      const job = f.job ? t(`world.work.${f.job.what}`) : "";
      out.push({ depth: 1e9 + 1, node: <FloorTag key={`tag-${f.id}`} at={s} text={job ? t("figures.hover", { name, job }) : name} /> });
    }
  }
  return out;
}

// The paper tag on a rack's side while someone works at it: who, what, until when.
export function WorkTag({ game, rackId }: { game: GameState; rackId: string }) {
  const loc = game.racks.find((r) => r.id === rackId)?.locationId, f = loc ? figuresIn(game, loc, nowMin(game)).find((x) => x.job?.rackId === rackId) : undefined;
  if (!f?.job) return null;
  const time = dateOf(f.job.until).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return (
    <div className="wr-work" data-work={f.id}>
      <b>{f.name}</b>
      <span>{t(`world.work.${f.job.what}`)}</span>
      <span>{t("world.workUntil", { time })}</span>
    </div>
  );
}
