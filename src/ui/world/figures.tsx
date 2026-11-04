// People in every room, drawn to docs/design/world-art.md: seated at desks, standing at a rack, walking from the door.
import { useState, type ReactNode } from "react";
import { t } from "../../i18n/en";
import { LOCALE } from "../../i18n/lang";
import { dateOf } from "../../sim/00-core/time";
import { entryTile, officeSeats, officeWalk, type Facing, type OfficePlan } from "../../sim/20-world/layout";
import type { GameState, Location } from "../../sim/50-state";
import { figuresIn, type Figure } from "../../sim/60-infra/figures";
import { brandColor } from "../art/logos";
import { at3 } from "./draw";
import { iso, type Pt } from "./grid";
import { DESK_Z } from "./office";
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

function Walking({ l, step }: { l: Look; step: number }) {
  const s = step ? 2 : -2;
  return (
    <>
      <path stroke={l.pants} strokeWidth="5" strokeLinecap="round" d={`M-3,-24 L${-3 + s},-2 M3,-24 L${3 - s},-2`} />
      <rect x="-7" y="-44" width="14" height="22" rx="6" fill={l.shirt} />
      <Badge l={l} y={-40} />
      <Head l={l} y={-51} front />
    </>
  );
}

// Minutes of the day each person arrives and leaves, spread over the first and last half hour of the 9 to 17 shift, and how long the walk takes.
const WALK_MIN = 6, ARRIVE = 9 * 60, LEAVE = 17 * 60 - 30, SPREAD = 30 - WALK_MIN;

function along(path: Pt[], t: number): Pt {
  const seg = path.slice(1).map((p, i) => Math.abs(p.x - path[i].x) + Math.abs(p.y - path[i].y)), total = seg.reduce((a, b) => a + b, 0);
  let d = t * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i]) { const k = seg[i] ? d / seg[i] : 0; return { x: path[i].x + (path[i + 1].x - path[i].x) * k, y: path[i].y + (path[i + 1].y - path[i].y) * k }; }
    d -= seg[i];
  }
  return path[path.length - 1];
}

// The name on a small plate on the floor at the figure's feet.
function FloorTag({ at, name }: { at: Pt; name: string }) {
  const w = name.length * 2.6 + 4;
  return (
    <g pointerEvents="none" transform={`translate(${at.x} ${at.y})`}>
      <rect className="w-tent" x={-w / 2} y="1" width={w} height="7" rx="1" />
      <text className="w-num w-num-sm w-tent-text" x={-w / 2 + 2} y="6">{name}</text>
    </g>
  );
}

// The people in this room as depth-sorted things: office staff at their desks, technicians and the provider's people at racks.
export function useFigures(game: GameState, loc: Location, plan: OfficePlan | undefined): { depth: number; node: ReactNode }[] {
  const [hover, setHover] = useState<string | null>(null);
  const floor = plan?.floor ?? 1, m = dateOf(game.hour).getUTCHours() * 60 + game.minute, out: { depth: number; node: ReactNode }[] = [];
  const seats = plan ? new Map(officeSeats(plan).map((x) => [`${x.x},${x.y},${x.floor}`, x])) : new Map();
  const door = entryTile(loc, plan), from = { x: door.x + 0.5, y: door.y + 0.5 };
  for (const f of figuresIn(game, loc.id, game.hour) as Figure[]) {
    if ((f.tile.floor ?? 1) !== floor) continue;
    const l = look(f.id, f.colour), seat = f.seated ? seats.get(`${f.tile.x},${f.tile.y},${f.tile.floor}`) : undefined;
    let t: number, path: Pt[], end: Pt, depth: number;
    if (seat && plan) {
      const h = hash(f.id), arrive = ARRIVE + (h % SPREAD), leave = LEAVE + ((h >>> 4) % SPREAD);
      if (m < arrive || m >= leave + WALK_MIN) continue;
      t = m < arrive + WALK_MIN ? (m - arrive) / WALK_MIN : m >= leave ? 1 - (m - leave) / WALK_MIN : 1;
      end = { x: seat.x + 1, y: seat.y + (seat.facing === "s" ? 0.55 : 0.45) };
      path = officeWalk(plan, seat);
      // Seated facing the wall, the chair's backrest is drawn over the person; facing the room, the person over the chair.
      depth = seat.x + seat.y + (seat.facing === "s" ? 0.001 : -0.001);
    } else {
      // A job's hour: in from the door over the first minutes, back out over the last.
      const k = m % 60;
      t = k < WALK_MIN ? k / WALK_MIN : k >= 60 - WALK_MIN ? (60 - k) / WALK_MIN : 1;
      end = { x: f.tile.x + 0.5, y: f.tile.y + 0.5 };
      path = [from, { x: from.x, y: end.y }, end];
      depth = f.tile.x + f.tile.y + 0.5;
    }
    const pos = t >= 1 ? end : along(path, t), s = iso(pos.x, pos.y);
    const enter = () => setHover(f.id), exit = () => setHover((v) => (v === f.id ? null : v));
    out.push({
      depth: t >= 1 ? depth : Math.floor(pos.x) + Math.floor(pos.y) + 0.5,
      node: (
        <g key={f.id} className="w-person" data-person={f.id} aria-label={f.name} style={{ transform: `translate(${s.x}px, ${s.y}px)` }} onPointerEnter={enter} onPointerLeave={exit}>
          {t < 1 ? <Walking l={l} step={m % 2} /> : seat ? <Seated l={l} facing={seat.facing === "s" ? "s" : "n"} /> : <Standing l={l} facing={f.facing} busy={f.busy} />}
        </g>
      ),
    });
    // A rack row in front would hide someone in the aisle, so a faint outline shows through.
    if (!seat) out.push({ depth: 1e9, node: <g key={`x-${f.id}`} className="w-person w-xray" aria-hidden onPointerEnter={enter} onPointerLeave={exit} style={{ transform: `translate(${s.x}px, ${s.y}px)` }}>{t < 1 ? <Walking l={l} step={m % 2} /> : <Standing l={l} facing={f.facing} busy={false} />}</g> });
    if (hover !== f.id || t < 1) continue;
    if (seat) {
      // A tent card at the desk's left corner, toward the person.
      const c = at3(seat.x + 0.18, seat.y + (seat.facing === "s" ? 1.3 : -0.3), DESK_Z);
      out.push({
        depth: seat.x + seat.y + 3,
        node: (
          <g key={`tag-${f.id}`} pointerEvents="none" transform={`translate(${c.x} ${c.y})`}>
            <rect className="w-tent" x="-1" y="-7" width={f.name.length * 2.6 + 4} height="7" />
            <text className="w-num w-num-sm w-tent-text" x="1" y="-2">{f.name}</text>
          </g>
        ),
      });
    } else out.push({ depth: 1e9 + 1, node: <FloorTag key={`tag-${f.id}`} at={s} name={f.name} /> });
  }
  return out;
}

// The paper tag on a rack's side while someone works at it: who, what, until when.
export function WorkTag({ game, rackId }: { game: GameState; rackId: string }) {
  const loc = game.racks.find((r) => r.id === rackId)?.locationId, f = loc ? figuresIn(game, loc, game.hour).find((x) => x.job?.rackId === rackId) : undefined;
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
