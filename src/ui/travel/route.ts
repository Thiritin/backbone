import { create } from "zustand";
import type { Speed } from "../../sim/00-core/time";
import type { Place } from "../../sim/20-world/places";
import type { Location } from "../../sim/50-state";
import { CITIES } from "../map/world-data";

export type LL = [number, number];
export type Stage = "room" | "map" | "leave" | "road" | "arrive";
export type TripEvent = "door" | "pick" | "close" | "done";

// Door, map, leave, road, arrive, room; done also stands for a skip.
export function next(s: Stage, e: TripEvent): Stage {
  if (e === "close") return s === "map" ? "room" : s;
  if (e === "door") return s === "room" ? "map" : s;
  if (e === "pick") return s === "map" ? "leave" : s;
  return s === "leave" ? "road" : s === "road" ? "arrive" : s === "arrive" ? "room" : s;
}

export interface Trip { from: Location; to: Location; start: number; until: number; resume: Speed; by: "drive" | "fly" }
interface TripStore { stage: Stage; trip: Trip | null; send: (e: TripEvent, trip?: Trip) => void }
export const useTrip = create<TripStore>((set) => ({
  stage: "room", trip: null,
  send: (e, trip) => set((s) => { const stage = next(s.stage, e); return { stage, trip: trip ?? (stage === "room" ? null : s.trip) }; }),
}));

const RAD = Math.PI / 180;
const vec = ([lon, lat]: LL) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];

export function arc(a: LL, b: LL, n = 32): LL[] {
  const p = vec(a), q = vec(b), d = Math.acos(Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2]));
  if (d < 1e-6) return [a, b];
  return Array.from({ length: n + 1 }, (_, i) => {
    const u = Math.sin((1 - i / n) * d) / Math.sin(d), w = Math.sin((i / n) * d) / Math.sin(d);
    const [x, y, z] = [0, 1, 2].map((j) => u * p[j] + w * q[j]);
    return [Math.atan2(y, x) / RAD, Math.asin(z) / RAD] as LL;
  });
}

const codeOf = (name: string) => CITIES.find((c) => c.name === name);

export interface RouteData { routes: Record<string, LL[]>; legs: Record<string, LL[]> }
// The routes file, loaded on the first trip so the main bundle stays small.
export const loadRoutes = (): Promise<RouteData> => import("../map/routes").then((m) => ({ routes: m.ROUTES, legs: m.LEGS }), () => ({ routes: {}, legs: {} }));

// One chunk per city, fetched when a trip touches it.
const streetFiles = import.meta.glob<{ STREETS: LL[][] }>(["../map/streets/*.ts", "!../map/streets/decode.ts"]);
const streets = new Map<string, Promise<LL[][]>>();
export const loadStreets = (city: string): Promise<LL[][]> => {
  const load = streetFiles[`../map/streets/${codeOf(city)?.code}.ts`];
  if (!load) return Promise.resolve([]);
  if (!streets.has(city)) streets.set(city, load().then((m) => m.STREETS, () => []));
  return streets.get(city)!;
};

// The driven polyline between two game cities by name, a great-circle arc when no road route is stored.
export function routeOf(from: string, to: string, routes: Record<string, LL[]>): LL[] {
  const a = codeOf(from), b = codeOf(to);
  if (!a || !b) return [];
  const r = a.code < b.code ? routes[`${a.code}-${b.code}`] : routes[`${b.code}-${a.code}`]?.slice().reverse();
  return r ?? arc([a.lon, a.lat], [b.lon, b.lat]);
}

export interface Spot { city: string; place: Place | null }
const pt = (s: Spot): LL | null => { const c = s.place ?? codeOf(s.city); return c ? [c.lon, c.lat] : null; };
const nearest = (line: LL[], p: LL, from = 0) => {
  let best = from, d = Infinity;
  for (let i = from; i < line.length; i++) { const dd = (line[i][0] - p[0]) ** 2 * 0.5 + (line[i][1] - p[1]) ** 2; if (dd < d) { d = dd; best = i; } }
  return best;
};

// The drive between two places: the street-level leg out of the first, the city-to-city route, the leg into the second.
// Within one city it is the stored drive between the two places, or a straight line.
export function driveOf(a: Spot, b: Spot, { routes, legs }: RouteData): LL[] {
  const pa = pt(a), pb = pt(b);
  if (!pa || !pb) return [];
  if (a.city === b.city) {
    if (a.place && b.place) {
      const fwd = a.place.id < b.place.id, l = legs[fwd ? `${a.place.id}~${b.place.id}` : `${b.place.id}~${a.place.id}`];
      if (l) return fwd ? l : l.slice().reverse();
    }
    return [pa, pb];
  }
  const trunk = routeOf(a.city, b.city, routes), ca = codeOf(a.city), cb = codeOf(b.city);
  const head = a.place && cb ? legs[`${a.place.id}>${cb.code}`] : undefined;
  const tail = b.place && ca ? legs[`${b.place.id}>${ca.code}`]?.slice().reverse() : undefined;
  const i = head ? nearest(trunk, head.at(-1)!) + 1 : 0, j = tail ? Math.max(i, nearest(trunk, tail[0], i)) : trunk.length;
  return [...(head ?? [pa]), ...trunk.slice(i, j), ...(tail ?? [pb])];
}

export function km(line: LL[]): number {
  let sum = 0;
  for (let i = 1; i < line.length; i++) {
    const p = vec(line[i - 1]), q = vec(line[i]);
    sum += 6371 * Math.acos(Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2]));
  }
  return sum;
}

export const driveMs = (distance: number) => Math.min(12_000, 6_000 + (distance / 300) * 1000);

// The point at fraction k of the polyline's length, with the heading in degrees.
export function along(pts: { x: number; y: number }[], k: number): { x: number; y: number; deg: number; i: number } {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  let left = seg.reduce((a, b) => a + b, 0) * Math.max(0, Math.min(1, k));
  for (let i = 0; i < seg.length; i++) {
    const a = pts[i], b = pts[i + 1], deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    if (left <= seg[i] || i === seg.length - 1) { const f = seg[i] ? Math.min(1, left / seg[i]) : 0; return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, deg, i }; }
    left -= seg[i];
  }
  return { ...(pts[0] ?? { x: 0, y: 0 }), deg: 0, i: 0 };
}
