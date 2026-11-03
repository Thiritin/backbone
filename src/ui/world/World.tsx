import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { t } from "../../i18n/en";
import { LOCALE } from "../../i18n/lang";
import { FIXTURES, rackTiles, roomSize, type Facing, type Tile } from "../../sim/20-world/layout";
import { rackUnits } from "../../sim/20-world/datacenters";
import { modelById } from "../../sim/10-catalog/hardware";
import { inbox } from "../../sim/40-support/letters";
import { powerByLocation } from "../../sim/88-tick/tick";
import { roomTemperature } from "../../sim/60-infra/sensors";
import type { Device, GameState, Location, Rack } from "../../sim/50-state";
import { Defs, Front } from "../art/fronts";
import { useStore } from "../store";
import { center, facingOf, iso, key, pathTo, TH, TW, useTiles, type Pt } from "./iso";
import "./world.css";

const WALL = 120, LOW = 58, STEP_MS = 200, BLINK_MS = 500, PAD = 48;
// Rack art is drawn 110 wide with 10 per unit, about a 19-inch front.
const ART_W = 110, ART_U = 10;
const SOLID = ["desk", "pc", "scanner", "shelf"];
// Where the player stood per location, so the room resumes there.
const stood: Record<string, Pt> = {};

const pts = (...p: Pt[]) => p.map((q) => `${q.x},${q.y}`).join(" ");
const up = (p: Pt, h: number): Pt => ({ x: p.x, y: p.y - h });
const lerp = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

export const roomOf = (game: GameState): Location =>
  game.locations.find((l) => l.id === game.player.at) ?? game.locations.find((l) => l.space === "basement") ?? game.locations[0];

export function World() {
  const game = useStore((s) => s.game), setSurface = useStore((s) => s.setSurface), openApp = useStore((s) => s.openApp);
  const loc = roomOf(game), home = loc.space === "basement";
  const { w, h } = roomSize(loc);
  const tiles = useMemo(() => rackTiles(loc, game.racks), [loc, game.racks]);
  const racks = game.racks.filter((r) => tiles[r.id]);
  const blocked = useMemo(() => new Set([
    ...(home ? SOLID.map((id) => key(FIXTURES[id].x, FIXTURES[id].y)) : []),
    ...Object.values(tiles).map((p) => key(p.x, p.y)),
  ]), [tiles, home]);

  const start = stood[loc.id] ?? (home ? { x: 1, y: 5 } : { x: Math.floor(w / 2), y: h - 2 });
  const [pos, setPos] = useState<Pt>(start);
  const [facing, setFacing] = useState<Facing>("w");
  const [door, setDoor] = useState(false);
  const at = useRef<Pt>(start), path = useRef<Pt[]>([]), then = useRef<(() => void) | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const base = useMemo(() => {
    const x0 = iso(0, h).x - PAD, x1 = iso(w, 0).x + PAD, y0 = -WALL - PAD, y1 = iso(w, h).y + PAD;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }, [w, h]);
  const [vb, setVb] = useState(base);
  const zoomed = vb.w < base.w * 0.55;

  // Walking and LED blink share one frame loop.
  useEffect(() => {
    let raf = 0, blinkAt = 0, t0 = 0, from = at.current;
    const frame = (now: number) => {
      if (now - blinkAt > BLINK_MS) { blinkAt = now; svg.current?.classList.toggle("w-blink"); }
      const next = path.current[0];
      if (next) {
        if (!t0) { t0 = now; from = at.current; setFacing(facingOf(next.x - from.x, next.y - from.y)); }
        const k = Math.min(1, (now - t0) / STEP_MS);
        setPos(lerp(from, next, k));
        if (k === 1) {
          at.current = next; path.current.shift(); t0 = 0;
          if (!path.current.length) { const run = then.current; then.current = null; run?.(); }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); stood[loc.id] = at.current; };
  }, [loc.id]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || (e.target as HTMLElement).closest?.("[role=dialog], [role=alertdialog], [role=menu]")) return;
      setSurface("desktop");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [setSurface]);

  // Wheel zoom around the pointer.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const m = el.getScreenCTM();
      setVb((v) => {
        const f = Math.min(base.w * 1.4 / v.w, Math.max(base.w / 5 / v.w, Math.exp(e.deltaY * 0.0015)));
        const p = m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : { x: v.x + v.w / 2, y: v.y + v.h / 2 };
        return { x: p.x - (p.x - v.x) * f, y: p.y - (p.y - v.y) * f, w: v.w * f, h: v.h * f };
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [base]);

  // Drag pans; a press that moved is no click.
  const drag = useRef<{ x: number; y: number; vb: typeof vb } | null>(null), dragged = useRef(false);
  const down = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, vb }; dragged.current = false; };
  const move = (e: React.PointerEvent) => {
    const d = drag.current, el = svg.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!dragged.current && Math.hypot(dx, dy) < 4) return;
    dragged.current = true;
    const r = el.getBoundingClientRect(), s = Math.max(d.vb.w / r.width, d.vb.h / r.height);
    setVb({ ...d.vb, x: d.vb.x - dx * s, y: d.vb.y - dy * s });
  };

  const walk = (targets: Pt[], run?: () => void) => {
    const cur = path.current[0], from = cur ?? at.current;
    const p = pathTo(from, targets, w, h, blocked);
    if (!p) return;
    path.current = cur ? [cur, ...p] : p;
    then.current = run ?? null;
    if (!path.current.length) { then.current = null; run?.(); }
  };
  const click = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); if (!dragged.current) fn(); };
  const use = (tile: Pt, run: () => void) => click(() => walk(useTiles(tile, blocked), () => {
    const dx = tile.x - at.current.x, dy = tile.y - at.current.y;
    if (dx || dy) setFacing(facingOf(dx, dy));
    run();
  }));

  const power = useMemo(() => (powerByLocation(game)[loc.id]?.kwh ?? 0) * 1000, [game, loc.id]);
  const temp = roomTemperature(game, loc);
  const unread = inbox(game).filter((l) => !l.read).length;
  const stored = game.devices.filter((d) => d.store === loc.id && !d.chassisId).length;
  const n = (v: number, digits = 0) => v.toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: digits });

  // Depth-sorted things standing on the floor.
  const things: { depth: number; node: ReactNode }[] = racks.map((r) => ({
    depth: tiles[r.id].x + tiles[r.id].y,
    node: <RackBox key={r.id} rack={r} tile={tiles[r.id]} devices={game.devices} zoomed={zoomed} onClick={use(tiles[r.id], () => openApp("Locations", { kind: "rack", id: r.id }))} />,
  }));
  if (home) {
    const f = FIXTURES;
    things.push(
      { depth: f.scanner.x + f.scanner.y, node: <Desk key="scanner" at={f.scanner} label={t("world.obj.scanner")} onClick={use(f.scanner, () => openApp("DocuWhere"))}><Scanner /></Desk> },
      { depth: f.desk.x + f.desk.y, node: <Desk key="desk" at={f.desk} label={t("world.obj.desk")} onClick={use(f.desk, () => {})}><Keyboard /></Desk> },
      { depth: f.pc.x + f.pc.y, node: <Desk key="pc" at={f.pc} label={t("world.obj.pc")} onClick={use(f.pc, () => setSurface("desktop"))}><Pc /></Desk> },
      { depth: f.shelf.x + f.shelf.y, node: <Shelf key="shelf" at={f.shelf} count={stored} label={t("world.obj.shelf")} onClick={use(f.shelf, () => openApp("Locations", { kind: "storage", id: loc.id }))} /> },
    );
  }
  things.push({ depth: pos.x + pos.y + 0.01, node: <Player key="player" at={pos} facing={facing} /> });
  things.sort((a, b) => a.depth - b.depth);

  // Near walls give way while the player stands close to them.
  const nearY = pos.y >= h - 3, nearX = pos.x >= w - 3;
  const O = iso(0, 0), X = iso(w, 0), Y = iso(0, h), XY = iso(w, h);

  return (
    <div className="world" aria-label={loc.name}>
      <svg ref={svg} className="world-svg" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet"
        onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
        <Defs />
        <polygon className="w-wall w-wall-l" points={pts(O, Y, up(Y, WALL), up(O, WALL))} />
        <polygon className="w-wall w-wall-r" points={pts(O, X, up(X, WALL), up(O, WALL))} />
        {home && <Fan at={FIXTURES.fan} label={`${n(temp, 1)} °C`} />}
        {Array.from({ length: w * h }, (_, i) => {
          const x = i % w, y = Math.floor(i / w);
          return <polygon key={i} className={`w-tile${(x + y) % 2 ? " w-tile-b" : ""}`} points={pts(iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1))}
            onClick={click(() => walk([{ x, y }]))} />;
        })}
        {things.map((x) => x.node)}
        <g className="w-near" style={{ opacity: nearY ? 0.2 : 1 }}>
          <polygon className="w-wall w-wall-near" points={pts(Y, XY, up(XY, LOW), up(Y, LOW))} />
        </g>
        <g className="w-near" style={{ opacity: nearX ? 0.2 : 1 }}>
          <polygon className="w-wall w-wall-near w-wall-x" points={pts(X, XY, up(XY, LOW), up(X, LOW))} />
        </g>
        {/* Fixtures in the near walls stay solid while the walls give way. */}
        {home && <Door at={FIXTURES.door.x} h={h} open={door} label={t("world.obj.door")} onClick={use(FIXTURES.door, () => { setDoor(true); setTimeout(() => openApp("Weather"), 700); })} />}
        {home && <Letterbox at={FIXTURES.letterbox.x} h={h} count={unread} label={t("world.obj.letterbox")} onClick={use(FIXTURES.letterbox, () => openApp("Post"))} />}
        {home && <FuseBox at={FIXTURES.fusebox.y} w={w} label={`${n(power)} W`} />}
      </svg>
    </div>
  );
}

type Click = (e: MouseEvent) => void;

// Footprint corners of a tile shrunk around its centre.
function corners(tile: Pt, s = 0.82) {
  const c = center(tile.x, tile.y), dx = (TW / 2) * s, dy = (TH / 2) * s;
  return { c, L: { x: c.x - dx, y: c.y }, B: { x: c.x, y: c.y + dy }, R: { x: c.x + dx, y: c.y }, T: { x: c.x, y: c.y - dy } };
}

function Box({ tile, height, s, top, left, right }: { tile: Pt; height: number; s?: number; top: string; left: string; right: string }) {
  const { L, B, R, T } = corners(tile, s);
  return (
    <>
      <polygon points={pts(L, B, up(B, height), up(L, height))} fill={left} />
      <polygon points={pts(B, R, up(R, height), up(B, height))} fill={right} />
      <polygon points={pts(up(T, height), up(R, height), up(B, height), up(L, height))} fill={top} />
    </>
  );
}

function RackBox({ rack, tile, devices, zoomed, onClick }: { rack: Rack; tile: Tile; devices: Device[]; zoomed: boolean; onClick: Click }) {
  const units = rackUnits(rack.model), H = 24 + units * 1.6, { L, B, R } = corners(tile);
  const mounted = devices.filter((d) => d.rackId === rack.id && !d.chassisId);
  // Only a front facing the camera shows: the south face is the lower left, the east face the lower right.
  const face = tile.facing === "s" ? { o: up(L, H), u: B.x - L.x, v: B.y - L.y } : tile.facing === "e" ? { o: up(B, H), u: R.x - B.x, v: R.y - B.y } : null;
  const artH = units * ART_U;
  return (
    <g className="w-obj w-rack" data-rack={rack.id} role="button" aria-label={rack.name} onClick={onClick}>
      <Box tile={tile} height={H} top="var(--metal-3)" left="var(--metal-2)" right="var(--metal)" />
      {face && (
        <g transform={`matrix(${face.u / ART_W} ${face.v / ART_W} 0 ${H / artH} ${face.o.x} ${face.o.y})`}>
          <rect x="4" y="2" width={ART_W - 8} height={artH - 4} fill="var(--rack)" />
          {mounted.map((d) => {
            const m = modelById(d.model), y = (units - d.slot - m.height + 1) * ART_U;
            if (m.height < 1) return null;
            return (
              <g key={d.id} transform={`translate(0 ${y})`}>
                {zoomed && <Front model={m} brand={d.brand} name="" state={d.on ? "ok" : "off"} ports={[]} w={ART_W} h={m.height * ART_U} />}
                <rect className={d.on ? "w-led w-led-on" : "w-led"} x="8" y="3" width="6" height="4" />
              </g>
            );
          })}
        </g>
      )}
    </g>
  );
}

function Desk({ at, label, onClick, children }: { at: Pt; label: string; onClick: Click; children: ReactNode }) {
  const { c } = corners(at);
  return (
    <g className="w-obj" role="button" aria-label={label} onClick={onClick}>
      <Box tile={at} height={22} s={0.96} top="oklch(0.62 0.07 60)" left="oklch(0.45 0.06 60)" right="oklch(0.52 0.06 60)" />
      <g transform={`translate(${c.x} ${c.y - 22})`}>{children}</g>
    </g>
  );
}

// Desk items draw around the desk top's centre, seen from the east.
const Pc = () => (
  <>
    <polygon points="-14,-2 2,-10 2,-34 -14,-26" fill="var(--metal-2)" />
    <polygon points="-12,-6 0,-12 0,-31 -12,-25" fill="oklch(0.55 0.12 250)" />
    <polygon points="6,6 16,1 16,-20 6,-15" fill="oklch(0.85 0.01 90)" />
    <polygon points="0,3 6,6 6,-15 0,-18" fill="oklch(0.75 0.01 90)" />
  </>
);
const Scanner = () => (
  <>
    <polygon points="-14,0 0,-7 14,0 0,7" fill="oklch(0.9 0.005 250)" />
    <polygon points="-14,0 0,7 0,10 -14,3" fill="oklch(0.7 0.005 250)" />
    <polygon points="0,7 14,0 14,3 0,10" fill="oklch(0.6 0.005 250)" />
  </>
);
const Keyboard = () => <polygon points="-4,-4 6,1 0,4 -10,-1" fill="oklch(0.85 0.01 90)" />;

function Shelf({ at, count, label, onClick }: { at: Pt; count: number; label: string; onClick: Click }) {
  const { c } = corners(at), boxes = Math.min(count, 6);
  return (
    <g className="w-obj" role="button" aria-label={label} onClick={onClick}>
      <Box tile={at} height={72} s={0.9} top="oklch(0.5 0.01 255)" left="oklch(0.36 0.01 255)" right="oklch(0.42 0.01 255)" />
      {Array.from({ length: boxes }, (_, i) => (
        <rect key={i} x={c.x - 22 + (i % 2) * 12} y={c.y - 14 - Math.floor(i / 2) * 22 + (i % 2) * 6} width="10" height="12" fill="oklch(0.68 0.09 70)" stroke="oklch(0.45 0.07 60)" strokeWidth="0.6" />
      ))}
      <text className="w-label" x={c.x} y={c.y - 82} textAnchor="middle">{n0(count)}</text>
    </g>
  );
}

const n0 = (v: number) => v.toLocaleString(LOCALE);

// A window with a fan on the back wall above tile (x, 0).
function Fan({ at, label }: { at: Pt; label: string }) {
  const a = iso(at.x, 0), b = iso(at.x + 1, 0), m = lerp(a, b, 0.5);
  return (
    <g aria-label={t("world.obj.fan")}>
      <polygon points={pts(up(lerp(a, b, 0.1), 98), up(lerp(a, b, 0.9), 98), up(lerp(a, b, 0.9), 62), up(lerp(a, b, 0.1), 62))} fill="oklch(0.78 0.05 230)" stroke="var(--metal-line)" strokeWidth="1" />
      <ellipse className="w-fan" cx={m.x} cy={m.y - 80} rx="9" ry="13" fill="none" stroke="var(--metal-2)" strokeWidth="2" />
      <text className="w-label" x={m.x} y={m.y - 104} textAnchor="middle">{label}</text>
    </g>
  );
}

// The door in the near wall along the room's last row; it swings into the room on its left hinge.
function Door({ at, h, open, label, onClick }: { at: number; h: number; open: boolean; label: string; onClick: Click }) {
  const a = iso(at, h), b = iso(at + 1, h), dx = b.x - a.x, dy = b.y - a.y, tall = LOW - 4;
  const skew = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <g className="w-obj" role="button" aria-label={label} onClick={onClick}>
      <polygon points={pts(a, b, up(b, tall), up(a, tall))} fill="oklch(0.18 0.01 255)" />
      <g transform={`translate(${a.x} ${a.y})`}>
        <g className="w-door" style={{ transform: `skewY(${open ? -skew : skew}deg)` }}>
          <rect x="0" y={-tall} width={dx} height={tall} fill="oklch(0.55 0.06 55)" stroke="oklch(0.38 0.05 55)" strokeWidth="1" />
          <circle cx={dx - 5} cy={-tall / 2} r="1.6" fill="oklch(0.85 0.08 90)" />
        </g>
      </g>
    </g>
  );
}

function Letterbox({ at, h, count, label, onClick }: { at: number; h: number; count: number; label: string; onClick: Click }) {
  const a = iso(at, h), b = iso(at + 1, h), p = lerp(a, b, 0.25), q = lerp(a, b, 0.75);
  return (
    <g className="w-obj" role="button" aria-label={label} onClick={onClick}>
      <polygon points={pts(up(p, 22), up(q, 22), up(q, 40), up(p, 40))} fill="oklch(0.7 0.15 85)" stroke="oklch(0.45 0.1 70)" strokeWidth="1" />
      <text className="w-label" x={(p.x + q.x) / 2} y={(p.y + q.y) / 2 - 44} textAnchor="middle">{n0(count)}</text>
    </g>
  );
}

// The fuse box on the near wall along the room's last column.
function FuseBox({ at, w, label }: { at: number; w: number; label: string }) {
  const a = iso(w, at), b = iso(w, at + 1), p = lerp(a, b, 0.2), q = lerp(a, b, 0.8);
  return (
    <g aria-label={t("world.obj.fusebox")}>
      <polygon points={pts(up(p, 24), up(q, 24), up(q, 50), up(p, 50))} fill="oklch(0.82 0.01 250)" stroke="var(--metal-line)" strokeWidth="1" />
      <text className="w-label" x={(p.x + q.x) / 2} y={(p.y + q.y) / 2 - 54} textAnchor="middle">{label}</text>
    </g>
  );
}

// Drawn facing the lower left; mirrored for the right-hand directions, seen from behind when walking away.
function Player({ at, facing }: { at: Pt; facing: Facing }) {
  const c = center(at.x, at.y), back = facing === "n" || facing === "w", flip = facing === "e" || facing === "n";
  return (
    <g className="w-player" transform={`translate(${c.x} ${c.y})`} aria-label={t("world.you")} pointerEvents="none">
      <ellipse rx="11" ry="5" fill="oklch(0 0 0 / 0.25)" />
      <g transform={flip ? "scale(-1 1)" : undefined}>
        <rect x="-5" y="-16" width="4" height="15" rx="1.5" fill="oklch(0.3 0.04 260)" />
        <rect x="1" y="-16" width="4" height="15" rx="1.5" fill="oklch(0.3 0.04 260)" />
        <rect x="-8" y="-33" width="16" height="19" rx="5" fill="var(--accent)" />
        <circle cy="-40" r="7" fill="oklch(0.8 0.06 60)" />
        {back ? <circle cy="-41" r="7" fill="oklch(0.32 0.05 50)" /> : (
          <>
            <path d="M-7 -41a7 7 0 0 1 14 0q-7 -4 -14 0z" fill="oklch(0.32 0.05 50)" />
            <circle cx="-3.5" cy="-40" r="1" fill="oklch(0.2 0.02 260)" />
            <circle cx="1" cy="-40" r="1" fill="oklch(0.2 0.02 260)" />
          </>
        )}
      </g>
    </g>
  );
}
