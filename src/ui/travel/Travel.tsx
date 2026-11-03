import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "../../i18n/en";
import { LOCALE } from "../../i18n/lang";
import { formatClock, MS_PER_HOUR, nowHours } from "../../sim/00-core/time";
import { datacenterById, listed } from "../../sim/20-world/datacenters";
import { playerAt } from "../../sim/60-infra/handwork";
import { drive, travelTo } from "../../sim/90-actions/travel";
import { cityNamed, LAND, WorldMap, X, XF, Y, type Marker } from "../map/WorldMap";
import { useStore } from "../store";
import { placeOf } from "../../sim/20-world/places";
import { along, driveMs, driveOf, km, loadRoutes, loadStreets, useTrip, type LL, type RouteData, type Trip } from "./route";
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
  const [focus, setFocus] = useState(here.city);
  const [streets, setStreets] = useState("");
  useEffect(() => { let on = true; void loadStreets(focus).then((l) => on && setStreets(toPath(l))); return () => { on = false; }; }, [focus]);
  // Every reachable place as a pin at street zoom; above it, one pin per city with the count.
  const spots = useMemo(() => game.locations.flatMap((l) => {
    const c = cityNamed(l.city), p = placeOf(game, l.id) ?? c;
    if (!p || !listed(l.city) || (l.id !== here.id && !drive(game, l.id))) return [];
    return [{ l, lon: p.lon, lat: p.lat }];
  }), [game, here.id]);
  const markers = useMemo(() => {
    const pin = ({ l, lon, lat }: (typeof spots)[number], zoom: Marker["zoom"]): Marker =>
      ({ id: l.id, lon, lat, label: l.name, zoom, kind: l.space === "basement" ? "basement" : l.dc ? "datacenter" : "location", provider: l.dc ? datacenterById(l.dc).provider : null, selected: l.id === here.id });
    const cities = new Map<string, typeof spots>();
    for (const x of spots) cities.set(x.l.city, [...(cities.get(x.l.city) ?? []), x]);
    return [...spots.map((x) => pin(x, "street")), ...[...cities].map(([city, g]): Marker => {
      const c = cityNamed(city)!;
      return g.length === 1 ? pin(g[0], "region")
        : { id: `city:${city}`, lon: c.lon, lat: c.lat, label: city, zoom: "region", kind: "location", count: g.length, selected: g.some((x) => x.l.id === here.id) };
    })];
  }, [spots, here.id]);
  const inFocus = spots.filter((x) => x.l.city === focus), lons = inFocus.map((x) => x.lon), lats = inFocus.map((x) => x.lat);
  const initial = inFocus.length ? { west: Math.min(...lons) - 0.03, east: Math.max(...lons) + 0.03, south: Math.min(...lats) - 0.02, north: Math.max(...lats) + 0.02 } : undefined;

  useEffect(() => {
    ref.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); send("close"); } };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [send]);

  const pick = (id: string) => {
    if (id.startsWith("city:")) return setFocus(id.slice(5));
    if (id === here.id) return;
    const s = useStore.getState(), from = playerAt(s.game), start = nowHours(s.game);
    const r = s.act(travelTo, id);
    if (!r.ok) return setError(t(r.error, r.params));
    const g = useStore.getState().game;
    const trip: Trip = { from, to: playerAt(g), start, until: g.player.until, resume: s.speed };
    s.setSpeed(0);
    void loadRoutes();
    void loadRoads();
    void loadStreets(from.city);
    void loadStreets(trip.to.city);
    send("pick", trip);
  };

  return (
    <div ref={ref} className="travel travel-map" role="dialog" aria-label={t("travel.map")} tabIndex={-1}>
      <WorldMap key={focus} initial={initial} markers={markers} onMarkerClick={pick} minW={0.04} layer={streets && <path className="tr-streets" d={streets} />} />
      {streets && <div className="travel-osm">{t("travel.osm")}</div>}
      <button className="travel-close" onClick={() => send("close")}>{t("travel.close")}</button>
      {error && <div className="travel-error" role="alert">{error}</div>}
    </div>
  );
}


// The road layer as one path, loaded with the routes on the first trip.
let roadPath: Promise<string> | null = null;
const toPath = (lines: LL[][], x = XF) => lines.map((r) => "M" + r.map(([lon, lat]) => `${x(lon)} ${Y(lat)}`).join("L")).join("");
const loadRoads = () => (roadPath ??= import("../map/roads").then((m) => toPath(m.ROADS, X), () => ""));
const line = (p: { x: number; y: number }[]) => p.map((q) => `${q.x},${q.y}`).join(" ");
const smooth = (u: number) => { const v = Math.max(0, Math.min(1, u)); return v * v * (3 - 2 * v); };
// Street phases: the first and last STREET_KM of a drive take END of the time each, at street zoom STREET_W km wide.
const STREET_KM = 3, END = 0.2, STREET_W = 4, STREET_MS = 3000;

// Holds the dark map until the routes, roads and both cities' streets have loaded.
function Road({ trip }: { trip: Trip }) {
  const [data, setData] = useState<{ rd: RouteData; roads: string; streets: string } | null>(null);
  useEffect(() => {
    void Promise.all([loadRoutes(), loadRoads(), loadStreets(trip.from.city), loadStreets(trip.to.city)])
      .then(([rd, roads, a, b]) => setData({ rd, roads, streets: toPath(a === b ? a : [...a, ...b]) }));
  }, [trip]);
  return data ? <Drive trip={trip} {...data} /> : <div className="travel travel-road" />;
}

function Drive({ trip, rd, roads, streets }: { trip: Trip; rd: RouteData; roads: string; streets: string }) {
  const game = useStore((s) => s.game), advance = useStore((s) => s.advance), send = useTrip((s) => s.send);
  const route = useMemo(() => {
    const g = useStore.getState().game;
    return driveOf({ city: trip.from.city, place: placeOf(g, trip.from.id) }, { city: trip.to.city, place: placeOf(g, trip.to.id) }, rd);
  }, [trip, rd]);
  const pts = useMemo(() => route.map(([lon, lat]) => ({ x: XF(lon), y: Y(lat) })), [route]);
  const length = km(route), long = length > STREET_KM * 3;
  const ms = driveMs(length) + (long ? STREET_MS : 0), hours = trip.until - trip.start;
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

  // A long drive crawls through the streets at each end and speeds up between them, with the speed kept continuous;
  // the camera sits at street level over the car at both ends and pulls out to the whole route in the middle.
  const f = Math.min(1, e / ms), aspect = vw / vh;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const mid = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  const lat = -mid.y, wStreet = (0.7 * STREET_W) / (111 * Math.cos((lat * Math.PI) / 180));
  let k = f, z = 0;
  if (long) {
    const hd = STREET_KM / length, u = (f - END) / (1 - 2 * END), m = Math.min(1, ((hd / END) * (1 - 2 * END)) / (1 - 2 * hd));
    k = f < END ? (hd * f) / END : f > 1 - END ? 1 - (hd * (1 - f)) / END : hd + (1 - 2 * hd) * (m * u + (1 - m) * smooth(u));
    z = smooth(u / 0.25) * smooth((1 - u) / 0.25);
  }
  const car = pts.length ? along(pts, k) : { ...mid, deg: 0, i: 0 };
  const wFar = Math.max((x1 - x0) * 1.3, (y1 - y0) * 1.3 * aspect, wStreet);
  const w = long ? wStreet * (wFar / wStreet) ** z : wFar, h = w / aspect;
  const cx = long ? car.x + (mid.x - car.x) * z : mid.x, cy = long ? car.y + (mid.y - car.y) * z : mid.y;
  const px = w / vw, mult = Math.round((hours * MS_PER_HOUR) / ms);
  const ends = [trip.from, trip.to].map((l, i) => ({ l, p: pts[i ? pts.length - 1 : 0] }));
  const streetsOn = !!streets && z < 0.95;

  return (
    <div className="travel travel-road" role="dialog" aria-label={t("travel.road")}>
      <svg viewBox={`${cx - w / 2} ${cy - h / 2} ${w} ${h}`} preserveAspectRatio="xMidYMid slice">
        <path className="tr-land" d={LAND} />
        <path className="tr-roads" d={roads} style={{ opacity: z }} />
        {streets && <path className="tr-streets" d={streets} style={{ opacity: 1 - z }} />}
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
      {streetsOn && <div className="travel-osm">{t("travel.osm")}</div>}
      <div className="travel-clock num">
        <span>{formatClock(game.hour, game.minute)}</span>
        <strong>{t("travel.speed", { n: mult.toLocaleString(LOCALE) })}</strong>
      </div>
    </div>
  );
}
