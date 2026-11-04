// Pure helpers for the regional map layers: which layer shows at which zoom, simplification, clipping, packing.
export type LL = [number, number][];
export interface Box { w: number; s: number; e: number; n: number }

// k is map units per screen pixel (about 111 km per unit).
const ramp = (k: number, full: number, gone: number) => Math.min(1, Math.max(0, (gone - k) / (gone - full)));
// Street patch, then the regional patches under it, then the national layer under those; the layers overlap so no zoom leaves bare land.
export const fade = (k: number) => ({ patch: ramp(k, 0.002, 0.008), region: ramp(k, 0.03, 0.09), europe: ramp(k, 0.03, 0.1), detail: ramp(k, 0.004, 0.012) });

// Highest town class shown (1 is the largest); smaller towns appear as the view closes in.
export const townLevel = (k: number) => (k <= 0.0015 ? 5 : k <= 0.004 ? 4 : k <= 0.012 ? 3 : k <= 0.04 ? 2 : k <= 0.16 ? 1 : 0);
export const townClass = (pop: number) => (pop >= 1e6 ? 1 : pop >= 3e5 ? 2 : pop >= 1e5 ? 3 : pop >= 3e4 ? 4 : 5);

// Patch of about 150 km around a city.
export const REGION_KM = 150;
export const regionBox = (lat: number, lon: number): Box => {
  const dLat = REGION_KM / 111, dLon = REGION_KM / (111 * Math.cos((lat * Math.PI) / 180));
  return { w: lon - dLon, s: lat - dLat, e: lon + dLon, n: lat + dLat };
};
export const meetsBox = (a: Box, b: Box) => a.w < b.e && a.e > b.w && a.s < b.n && a.n > b.s;

// Douglas-Peucker; tol is in degrees.
export const simplify = (pts: LL, tol: number): LL => {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let max = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i], t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
      const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
};

// The runs of a line that lie inside the box.
export const clipLine = (l: LL, b: Box): LL[] => {
  const out: LL[] = [];
  let cur: LL = [];
  for (const p of l) {
    if (p[0] >= b.w && p[0] <= b.e && p[1] >= b.s && p[1] <= b.n) cur.push(p);
    else { if (cur.length > 1) out.push(cur); cur = []; }
  }
  if (cur.length > 1) out.push(cur);
  return out;
};
export const ringBox = (r: LL): Box => {
  const xs = r.map((p) => p[0]), ys = r.map((p) => p[1]);
  return { w: Math.min(...xs), e: Math.max(...xs), s: Math.min(...ys), n: Math.max(...ys) };
};

// Polyline packing in the format of streets/decode.ts.
export const encode = (lines: LL[]): string => {
  let lat = 0, lon = 0;
  const num = (v: number) => { let n = v < 0 ? ~(v << 1) : v << 1, o = ""; while (n >= 32) { o += String.fromCharCode((32 | (n & 31)) + 63); n >>>= 5; } return o + String.fromCharCode(n + 63); };
  return lines.map((l) => l.map(([x, y]) => {
    const la = Math.round(y * 1e5), lo = Math.round(x * 1e5), o = num(la - lat) + num(lo - lon);
    lat = la; lon = lo;
    return o;
  }).join("")).join(" ");
};

// One regional patch (or the national layer): lines and areas packed, towns as [lon, lat, class, name, "de|fr|es|it|pt" where different].
export interface Detail {
  urban: string; lake: string; forest: string; river: string; stream: string; major: string; second: string; rail: string;
  towns: [number, number, number, string, string][];
}
