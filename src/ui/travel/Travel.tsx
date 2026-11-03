import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "../../i18n/en";
import { LOCALE } from "../../i18n/lang";
import { formatClock, MS_PER_HOUR, nowHours } from "../../sim/00-core/time";
import { playerAt } from "../../sim/60-infra/handwork";
import { drive, travelTo } from "../../sim/90-actions/travel";
import type { Location } from "../../sim/50-state";
import { cityNamed, LAND, WorldMap, X, Y, type Marker } from "../map/WorldMap";
import { ROADS } from "../map/roads";
import { useStore } from "../store";
import { along, driveMs, km, routeOf, useTrip, type Trip } from "./route";
import { carDoor, engineRun, engineStart, engineStop } from "./sounds";
import "./travel.css";

export function Travel() {
  const stage = useTrip((s) => s.stage), trip = useTrip((s) => s.trip);
  if (stage === "map") return <TravelMap />;
  if (!trip) return null;
  if (stage === "leave") return <Scene key="leave" place={trip.from} leaving />;
  if (stage === "road") return <Road trip={trip} />;
  if (stage === "arrive") return <Scene key="arrive" place={trip.to} leaving={false} />;
  return null;
}

// Any key or click calls fn once.
function useSkip(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let done = false;
    const go = (e: Event) => { e.preventDefault(); e.stopPropagation(); if (!done) { done = true; ref.current(); } };
    window.addEventListener("keydown", go, true);
    window.addEventListener("pointerdown", go, true);
    return () => { window.removeEventListener("keydown", go, true); window.removeEventListener("pointerdown", go, true); };
  }, []);
}

// Real milliseconds since mount, frame by frame.
function useElapsed(): number {
  const [e, setE] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = requestAnimationFrame(function frame(now) { setE(now - t0); raf = requestAnimationFrame(frame); });
    return () => cancelAnimationFrame(raf);
  }, []);
  return e;
}

function TravelMap() {
  const game = useStore((s) => s.game), send = useTrip((s) => s.send);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const here = playerAt(game);
  const markers = useMemo(() => game.locations.flatMap((l): Marker[] => {
    const c = cityNamed(l.city);
    if (!c || (l.id !== here.id && !drive(game, l.id))) return [];
    return [{ id: l.id, lon: c.lon, lat: c.lat, label: l.name, kind: l.space === "basement" ? "basement" : l.dc ? "datacenter" : "location", selected: l.id === here.id }];
  }), [game, here.id]);
  const home = cityNamed(here.city);
  const initial = home ? { west: home.lon - 9, east: home.lon + 9, south: home.lat - 5, north: home.lat + 5 } : undefined;

  useEffect(() => {
    ref.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); send("close"); } };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [send]);

  const pick = (id: string) => {
    if (id === here.id) return;
    const s = useStore.getState(), from = playerAt(s.game), start = nowHours(s.game);
    const r = s.act(travelTo, id);
    if (!r.ok) return setError(t(r.error, r.params));
    const g = useStore.getState().game;
    const trip: Trip = { from, to: playerAt(g), start, until: g.player.until, resume: s.speed };
    s.setSpeed(0);
    send("pick", trip);
  };

  return (
    <div ref={ref} className="travel travel-map" role="dialog" aria-label={t("travel.map")} tabIndex={-1}>
      <WorldMap initial={initial} markers={markers} onMarkerClick={pick} />
      <button className="travel-close" onClick={() => send("close")}>{t("travel.close")}</button>
      {error && <div className="travel-error" role="alert">{error}</div>}
    </div>
  );
}

const ROAD_D = ROADS.map((r) => "M" + r.map(([lon, lat]) => `${X(lon)} ${Y(lat)}`).join("L")).join("");

function Road({ trip }: { trip: Trip }) {
  const game = useStore((s) => s.game), advance = useStore((s) => s.advance), send = useTrip((s) => s.send);
  const line = useMemo(() => routeOf(trip.from.city, trip.to.city), [trip]);
  const pts = useMemo(() => line.map(([lon, lat]) => ({ x: X(lon), y: Y(lat) })), [line]);
  const ms = driveMs(km(line)), hours = trip.until - trip.start;
  const [k, setK] = useState(0);

  // Steps the sim minute by minute up to the hour the trip reaches at fraction to.
  const catchUp = (to: number) => {
    let left = Math.floor((trip.start + hours * to - nowHours(useStore.getState().game)) * 60 + 1e-6);
    while (left > 0) {
      advance(left / 60);
      const now = Math.floor((trip.start + hours * to - nowHours(useStore.getState().game)) * 60 + 1e-6);
      if (now >= left) break;
      left = now;
    }
  };
  const finish = () => { catchUp(1); send("done"); };

  useEffect(() => {
    const stop = engineRun(), t0 = performance.now();
    let raf = requestAnimationFrame(function frame(now) {
      const f = Math.min(1, (now - t0) / ms);
      setK(f);
      catchUp(f);
      if (f >= 1) send("done");
      else raf = requestAnimationFrame(frame);
    });
    return () => { cancelAnimationFrame(raf); stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useSkip(finish);

  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const w = Math.max(6, (x1 - x0) * 1.6), h = Math.max(4, (y1 - y0) * 1.6), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const car = pts.length ? along(pts, k) : { x: cx, y: cy, deg: 0 }, s = Math.max(w, h * 1.6) / 60;
  const mult = Math.round((hours * MS_PER_HOUR) / ms);
  const ends = [trip.from, trip.to].map((l, i) => ({ l, p: pts[i ? pts.length - 1 : 0] }));

  return (
    <div className="travel travel-road" role="dialog" aria-label={t("travel.road")}>
      <svg viewBox={`${cx - w / 2} ${cy - h / 2} ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
        <path className="tr-land" d={LAND} />
        <path className="tr-roads" d={ROAD_D} />
        <polyline className="tr-route" points={pts.map((p) => `${p.x},${p.y}`).join(" ")} />
        {ends.map(({ l, p }) => p && (
          <g key={l.id} transform={`translate(${p.x} ${p.y}) scale(${s / 8})`}>
            <circle className="tr-end" r="4" />
            <text className="tr-name" x="7" y="4">{l.name}</text>
          </g>
        ))}
        <g transform={`translate(${car.x} ${car.y}) rotate(${car.deg}) scale(${s})`}>
          <circle className="tr-glow" r="1.6" />
          <rect className="tr-car" x="-0.9" y="-0.5" width="1.8" height="1" rx="0.25" />
        </g>
      </svg>
      <div className="travel-clock num">
        <span>{formatClock(game.hour, game.minute)}</span>
        <strong>{t("travel.speed", { n: mult.toLocaleString(LOCALE) })}</strong>
      </div>
    </div>
  );
}

// Side view of a street: the building, the company car at the kerb and the avatar.
const LEAVE_MS = 4000, ARRIVE_MS = 3900, KERB = 176;
const ease = (a: number, b: number, e: number) => Math.max(0, Math.min(1, (e - a) / (b - a)));

function Scene({ place, leaving }: { place: Location; leaving: boolean }) {
  const e = useElapsed(), send = useTrip((s) => s.send), fired = useRef(new Set<string>());
  const end = () => {
    if (!leaving) { const s = useStore.getState(), trip = useTrip.getState().trip; if (trip && !s.alert) s.setSpeed(trip.resume); }
    send("done");
  };
  useSkip(end);
  const cues: [string, number, () => void][] = leaving
    ? [["shut", 1650, carDoor], ["start", 1900, engineStart]]
    : [["stop", 1500, engineStop], ["open", 1700, carDoor], ["shut", 2350, carDoor]];
  for (const [id, at, play] of cues) if (e >= at && !fired.current.has(id)) { fired.current.add(id); play(); }
  useEffect(() => { if (e >= (leaving ? LEAVE_MS : ARRIVE_MS)) end(); });

  const door = 80;
  let carX: number, open: boolean, me: number | null, fade: number;
  if (leaving) {
    carX = KERB + 220 * ease(2600, 3500, e) ** 2;
    open = e >= 1150 && e < 1650;
    me = e < 1500 ? door + (KERB + 22 - door) * ease(0, 1200, e) : null;
    fade = ease(3400, LEAVE_MS, e);
  } else {
    carX = KERB - 250 * (1 - ease(0, 1500, e)) ** 2;
    open = e >= 1700 && e < 2350;
    me = e >= 1900 && e < 3500 ? KERB + 22 + (door - KERB - 22) * ease(2300, 3400, e) : null;
    fade = 1 - ease(0, 500, e);
  }
  const walking = me !== null && (leaving ? e < 1200 : e >= 2300);

  return (
    <div className="travel travel-scene" role="dialog" aria-label={place.name}>
      <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges">
        <rect width="320" height="140" fill="oklch(0.78 0.05 235)" />
        <rect y="132" width="320" height="10" fill="oklch(0.72 0.006 255)" stroke={INK} />
        <rect y="142" width="320" height="38" fill="oklch(0.36 0.008 255)" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={i * 44 + 6} y="160" width="20" height="2" fill="oklch(0.85 0.02 90)" />)}
        {place.space === "basement" ? <House door={door} /> : <Datacenter door={door} />}
        <Car x={Math.round(carX)} open={open} />
        {me !== null && <Avatar x={Math.round(me)} step={walking ? Math.floor(e / 150) % 2 : 0} />}
      </svg>
      <div className="travel-fade" style={{ opacity: fade }} />
    </div>
  );
}

const INK = "oklch(0.22 0.01 255)";

function House({ door }: { door: number }) {
  return (
    <g stroke={INK} strokeWidth="1">
      <rect x="20" y="58" width="130" height="74" fill="oklch(0.8 0.04 75)" />
      <polygon points="12,58 85,22 158,58" fill="oklch(0.5 0.1 35)" />
      <rect x="36" y="72" width="22" height="18" fill="oklch(0.62 0.06 235)" />
      <rect x="112" y="72" width="22" height="18" fill="oklch(0.62 0.06 235)" />
      <rect x="36" y="122" width="18" height="8" fill="oklch(0.3 0.02 255)" />
      <rect x={door - 9} y="100" width="18" height="32" fill="oklch(0.55 0.06 55)" />
      <rect x={door + 4} y="115" width="2" height="2" fill="oklch(0.85 0.08 90)" stroke="none" />
    </g>
  );
}

function Datacenter({ door }: { door: number }) {
  return (
    <g stroke={INK} strokeWidth="1">
      <rect x="4" y="40" width="200" height="92" fill="oklch(0.7 0.008 255)" />
      {[52, 64, 76, 88].map((y) => <rect key={y} x="4" y={y} width="200" height="1" fill="oklch(0.6 0.008 255)" stroke="none" />)}
      <rect x="20" y="30" width="30" height="10" fill="oklch(0.6 0.008 255)" />
      <rect x="150" y="30" width="30" height="10" fill="oklch(0.6 0.008 255)" />
      <rect x="120" y="96" width="70" height="12" fill="oklch(0.53 0.19 262)" />
      <rect x={door - 12} y="98" width="24" height="34" fill="oklch(0.55 0.05 225)" />
      <rect x={door} y="98" width="1" height="34" fill={INK} stroke="none" />
    </g>
  );
}

function Car({ x, open }: { x: number; open: boolean }) {
  return (
    <g transform={`translate(${x} 0)`} stroke={INK} strokeWidth="1">
      <polygon points="10,128 16,114 42,114 50,128" fill="oklch(0.75 0.03 235)" />
      <rect x="0" y="126" width="60" height="14" fill="oklch(0.92 0.01 255)" />
      <rect x="0" y="133" width="60" height="2" fill="oklch(0.53 0.19 262)" stroke="none" />
      <rect x="56" y="128" width="4" height="3" fill="oklch(0.9 0.12 90)" stroke="none" />
      <rect x="10" y="137" width="10" height="10" fill="oklch(0.2 0.01 255)" />
      <rect x="42" y="137" width="10" height="10" fill="oklch(0.2 0.01 255)" />
      {open && <rect x="10" y="112" width="8" height="26" fill="oklch(0.82 0.01 255)" />}
      <rect x="18" y="116" width="1" height="22" fill={INK} stroke="none" />
    </g>
  );
}

function Avatar({ x, step }: { x: number; step: number }) {
  return (
    <g transform={`translate(${x - 4} 110)`} stroke={INK} strokeWidth="1">
      <rect x="1" y="0" width="6" height="6" fill="oklch(0.8 0.06 60)" />
      <rect x="0" y="6" width="8" height="9" fill="oklch(0.53 0.19 262)" />
      <rect x={step ? 0 : 1} y="15" width="3" height="7" fill="oklch(0.3 0.02 255)" />
      <rect x={step ? 5 : 4} y="15" width="3" height="7" fill="oklch(0.3 0.02 255)" />
    </g>
  );
}
