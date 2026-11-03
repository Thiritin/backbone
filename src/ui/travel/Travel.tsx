import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "../../i18n/en";
import { LOCALE } from "../../i18n/lang";
import { formatClock, MS_PER_HOUR, nowHours } from "../../sim/00-core/time";
import { playerAt } from "../../sim/60-infra/handwork";
import { drive, travelTo } from "../../sim/90-actions/travel";
import { cityNamed, LAND, WorldMap, X, Y, type Marker } from "../map/WorldMap";
import { ROADS } from "../map/roads";
import { useStore } from "../store";
import { along, driveMs, km, loadRoutes, routeOf, useTrip, type LL, type Trip } from "./route";
import { Scene, useSkip } from "./Scene";
import { engineRun } from "./sounds";
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
    void loadRoutes();
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
const OPEN_MS = 1500;
const line = (p: { x: number; y: number }[]) => p.map((q) => `${q.x},${q.y}`).join(" ");

// Holds the dark map until the routes file has loaded.
function Road({ trip }: { trip: Trip }) {
  const [routes, setRoutes] = useState<Record<string, LL[]> | null>(null);
  useEffect(() => { void loadRoutes().then(setRoutes); }, []);
  return routes ? <Drive trip={trip} routes={routes} /> : <div className="travel travel-road" />;
}

function Drive({ trip, routes }: { trip: Trip; routes: Record<string, LL[]> }) {
  const game = useStore((s) => s.game), advance = useStore((s) => s.advance), send = useTrip((s) => s.send);
  const route = useMemo(() => routeOf(trip.from.city, trip.to.city, routes), [trip, routes]);
  const pts = useMemo(() => route.map(([lon, lat]) => ({ x: X(lon), y: Y(lat) })), [route]);
  const ms = driveMs(km(route)), hours = trip.until - trip.start;
  const [e, setE] = useState(0);
  const [{ vw, vh }] = useState(() => ({ vw: window.innerWidth || 1280, vh: window.innerHeight || 720 }));

  // Steps the sim minute by minute up to the hour the trip reaches at fraction to.
  const catchUp = (to: number) => {
    const left = () => Math.floor((trip.start + hours * to - nowHours(useStore.getState().game)) * 60 + 1e-6);
    for (let n = left(); n > 0;) { advance(n / 60); const m = left(); if (m >= n) break; n = m; }
  };
  const finish = () => { catchUp(1); send("done"); };

  useEffect(() => {
    const stop = engineRun(), t0 = performance.now();
    let raf = requestAnimationFrame(function frame(now) {
      const f = Math.min(1, (now - t0) / ms);
      setE(now - t0);
      catchUp(f);
      if (f >= 1) send("done");
      else raf = requestAnimationFrame(frame);
    });
    return () => { cancelAnimationFrame(raf); stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useSkip(finish);

  // The camera opens wide on the coast, then eases in to follow the car with both ends in view.
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), aspect = vw / vh;
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const mid = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  const near = Math.max((x1 - x0) * 2.2, (y1 - y0) * 2.2 * aspect, 3), far = Math.max(near * 3.5, 28);
  const z0 = Math.min(1, e / OPEN_MS), z = z0 * z0 * (3 - 2 * z0);
  const car = pts.length ? along(pts, e / ms) : { ...mid, deg: 0, i: 0 };
  const w = far * (near / far) ** z, h = w / aspect, cx = mid.x + (car.x - mid.x) * z, cy = mid.y + (car.y - mid.y) * z;
  const px = w / vw, mult = Math.round((hours * MS_PER_HOUR) / ms);
  const ends = [trip.from, trip.to].map((l, i) => ({ l, p: pts[i ? pts.length - 1 : 0] }));

  return (
    <div className="travel travel-road" role="dialog" aria-label={t("travel.road")}>
      <svg viewBox={`${cx - w / 2} ${cy - h / 2} ${w} ${h}`} preserveAspectRatio="xMidYMid slice">
        <path className="tr-land" d={LAND} />
        <path className="tr-roads" d={ROAD_D} style={{ opacity: z }} />
        <polyline className="tr-trail" points={line([...pts.slice(0, car.i + 1), car])} strokeWidth={2 * px} strokeDasharray={`${4 * px} ${3 * px}`} />
        <polyline className="tr-route" points={line([car, ...pts.slice(car.i + 1)])} strokeWidth={2 * px} />
        {ends.map(({ l, p }) => p && (
          <g key={l.id} transform={`translate(${p.x} ${p.y}) scale(${px})`}>
            <rect className="tr-end" x="-3" y="-3" width="6" height="6" />
            <text className="tr-name" x="8" y="4">{l.name}</text>
          </g>
        ))}
        <g transform={`translate(${car.x} ${car.y}) rotate(${car.deg}) scale(${px})`} shapeRendering="crispEdges">
          <rect x="-8" y="-5" width="16" height="10" fill="oklch(0.15 0.01 250 / 0.5)" />
          <rect x="-7" y="-4" width="14" height="8" className="tr-car" />
          <rect x="1" y="-3" width="3" height="6" fill="oklch(0.45 0.06 235)" />
          <rect x="-5" y="-3" width="2" height="6" fill="oklch(0.45 0.06 235)" />
          <rect x="6" y="-4" width="1" height="2" fill="oklch(0.97 0.14 95)" />
          <rect x="6" y="2" width="1" height="2" fill="oklch(0.97 0.14 95)" />
          <rect x="-7" y="-4" width="1" height="2" fill="oklch(0.6 0.2 25)" />
          <rect x="-7" y="2" width="1" height="2" fill="oklch(0.6 0.2 25)" />
        </g>
      </svg>
      <div className="travel-clock num">
        <span>{formatClock(game.hour, game.minute)}</span>
        <strong>{t("travel.speed", { n: mult.toLocaleString(LOCALE) })}</strong>
      </div>
    </div>
  );
}
