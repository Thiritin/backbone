// Bakes the CC0 Kenney GLBs listed in site-bake.json into flat SVG paths in the room's 2:1 projection.
// Run with `npm run site-bake`; the output src/ui/world/site/models.gen.ts is committed. `-- --inspect` lists the colours per model.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import pc from "polygon-clipping";

type V3 = [number, number, number];
type Tri = { p: [V3, V3, V3]; rgb: string; mat: string; cell: string };
// A colour rule: the first one whose ranges (OKLCH, hue in degrees) and material name all hold gives the material.
// x and y are the facing along +x and +y; nx and ny the opposite way.
export type Dir = "x" | "y" | "nx" | "ny";
interface Rule { m: string; name?: string; cell?: string[]; Z?: [number, number]; L?: [number, number]; C?: [number, number]; H?: [number, number] }
interface Cfg {
  kits: Record<string, { rules: Rule[] }>;
  models: { id: string; kit: string; src: string; yaw: number; size: [number, number, number]; dirs: Dir[]; rules?: Rule[]; bare?: boolean }[];
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg: Cfg = JSON.parse(fs.readFileSync(path.join(root, "scripts/site-bake.json"), "utf8"));
const artDir = path.join(root, "art/site/kenney");

const toHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const lin = (c: number) => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));

// Node transform as a 4x4 row-major matrix.
type M4 = number[][];
const mul = (a: M4, b: M4): M4 => a.map((_, i) => b[0].map((__, j) => a[i].reduce((s, _v, k) => s + a[i][k] * b[k][j], 0)));
function nodeMat(n: { matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }): M4 {
  if (n.matrix) { const m = n.matrix; return [0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => m[c * 4 + r])); }
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1], s = n.scale ?? [1, 1, 1], t = n.translation ?? [0, 0, 0];
  const R = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]];
  return [0, 1, 2].map((i) => [R[i][0] * s[0], R[i][1] * s[1], R[i][2] * s[2], t[i]]).concat([[0, 0, 0, 1]]);
}

// Triangles of a GLB in glTF space, each with the colour its colormap texel or material factor gives.
export function loadGlb(file: string): Tri[] {
  const raw = fs.readFileSync(file), jl = raw.readUInt32LE(12);
  const j = JSON.parse(raw.subarray(20, 20 + jl).toString()), bin = raw.subarray(20 + jl + 8);
  let tex: PNG | null = null;
  if (j.images?.[0]?.uri) tex = PNG.sync.read(fs.readFileSync(path.join(path.dirname(file), j.images[0].uri)));
  const acc = (i: number): number[][] => {
    const a = j.accessors[i], bv = j.bufferViews[a.bufferView], off = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type as "SCALAR"], size = { 5126: 4, 5123: 2, 5125: 4, 5121: 1 }[a.componentType as 5126], stride = bv.byteStride ?? size * n;
    const rd = (o: number) => (a.componentType === 5126 ? bin.readFloatLE(o) : a.componentType === 5123 ? bin.readUInt16LE(o) : a.componentType === 5125 ? bin.readUInt32LE(o) : bin.readUInt8(o));
    return Array.from({ length: a.count }, (_, k) => Array.from({ length: n }, (__, c) => rd(off + k * stride + c * size)));
  };
  const out: Tri[] = [];
  const walk = (ni: number, parent: M4) => {
    const n = j.nodes[ni], m = mul(parent, nodeMat(n));
    if (n.mesh !== undefined) {
      for (const pr of j.meshes[n.mesh].primitives) {
        const pos = acc(pr.attributes.POSITION), uv = pr.attributes.TEXCOORD_0 !== undefined ? acc(pr.attributes.TEXCOORD_0) : null;
        const idx = pr.indices !== undefined ? acc(pr.indices).map((v) => v[0]) : pos.map((_, k) => k);
        const mat = pr.material !== undefined ? j.materials[pr.material] : {};
        const f = mat.pbrMetallicRoughness?.baseColorFactor ?? [0.8, 0.8, 0.8, 1];
        const flat = toHex(lin(f[0]), lin(f[1]), lin(f[2]));
        const P = pos.map((p) => [0, 1, 2].map((r) => m[r][0] * p[0] + m[r][1] * p[1] + m[r][2] * p[2] + m[r][3]) as V3);
        for (let k = 0; k < idx.length; k += 3) {
          const [a, b, c] = [idx[k], idx[k + 1], idx[k + 2]];
          let rgb = flat, cell = "";
          if (uv && tex) {
            const u = (((uv[a][0] + uv[b][0] + uv[c][0]) / 3) % 1 + 1) % 1, v = (((uv[a][1] + uv[b][1] + uv[c][1]) / 3) % 1 + 1) % 1;
            const o = (Math.min(tex.height - 1, Math.floor(v * tex.height)) * tex.width + Math.min(tex.width - 1, Math.floor(u * tex.width))) * 4;
            rgb = toHex(tex.data[o], tex.data[o + 1], tex.data[o + 2]);
            cell = `${Math.floor(((o / 4) % tex.width) / 32)}.${Math.floor(Math.floor(o / 4 / tex.width) / 128)}`;
          }
          out.push({ p: [P[a], P[b], P[c]], rgb, mat: mat.name ?? "", cell });
        }
      }
    }
    for (const ch of n.children ?? []) walk(ch, m);
  };
  const I: M4 = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  for (const ni of j.scenes[j.scene ?? 0].nodes) walk(ni, I);
  return out;
}

// glTF (X right, Y up, -Z forward) to world (x, y on the ground, z up) after a yaw; a proper rotation, so winding holds. Scaled to the real size and set on the origin.
export function place(tris: Tri[], yaw: number, size: V3, facing: Dir): Tri[] {
  const dir = facing.slice(-1), c0 = facing[0] === "n" ? 180 : 0;
  yaw += c0;
  const c = Math.cos((yaw * Math.PI) / 180), s = Math.sin((yaw * Math.PI) / 180);
  const w = (p: V3): V3 => [p[0] * c - p[2] * s, -(p[0] * s + p[2] * c), p[1]];
  const T = tris.map((t) => ({ ...t, p: t.p.map(w) as Tri["p"] }));
  const all = T.flatMap((t) => t.p);
  const lo = [0, 1, 2].map((i) => Math.min(...all.map((p) => p[i]))), hi = [0, 1, 2].map((i) => Math.max(...all.map((p) => p[i])));
  // A zero length or width means: scale uniformly to the given height. A footprint within 15% of a whole tile count snaps to it, so the base sits on the grid.
  const nat = [0, 1, 2].map((i) => hi[i] - lo[i]);
  size = size.map((v, i) => (v || (nat[i] * size[2]) / nat[2])) as V3;
  size = size.map((v, i) => (i < 2 && Math.abs(Math.max(1, Math.round(v)) - v) / v <= 0.15 ? Math.max(1, Math.round(v)) : v)) as V3;
  const k = [0, 1, 2].map((i) => size[i] / nat[i]);
  const sc = (p: V3): V3 => [(p[0] - lo[0]) * k[0], (p[1] - lo[1]) * k[1], (p[2] - lo[2]) * k[2]];
  // Facing y is a quarter turn about z (x, y) -> (W - y, x), which keeps the origin at the footprint's near-left corner.
  const q = (p: V3): V3 => (dir === "x" ? p : [size[1] - p[1], p[0], p[2]]);
  return T.map((t) => ({ ...t, p: t.p.map((p) => q(sc(p))) as Tri["p"] }));
}

const proj = (p: V3): [number, number] => [(p[0] - p[1]) * 32, (p[0] + p[1]) * 16 - p[2] * 32];
type Ring = [number, number][];
const area = (r: Ring) => r.reduce((s, p, i) => s + (p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1]), 0) / 2;

// Douglas-Peucker on a closed ring.
function simplify(r: Ring, tol: number): Ring {
  const dp = (pts: Ring): Ring => {
    if (pts.length < 3) return pts;
    const [a, b] = [pts[0], pts[pts.length - 1]], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    let best = -1, bi = 0;
    for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((pts[i][0] - a[0]) * dy - (pts[i][1] - a[1]) * dx) / len; if (d > best) { best = d; bi = i; } }
    return best > tol ? [...dp(pts.slice(0, bi + 1)).slice(0, -1), ...dp(pts.slice(bi))] : [a, b];
  };
  const open = r.slice(0, -1);
  if (open.length < 4) return r;
  let far = 0, fd = -1;
  for (let i = 1; i < open.length; i++) { const d = Math.hypot(open[i][0] - open[0][0], open[i][1] - open[0][1]); if (d > fd) { fd = d; far = i; } }
  const A = dp(open.slice(0, far + 1)), B = dp([...open.slice(far), open[0]]);
  const res = [...A.slice(0, -1), ...B.slice(0, -1)];
  return [...res, res[0]];
}

// Flat upward faces in the upper half of any other material frost too, except these.
const NOSNOW = new Set(["glass", "window", "tyre", "rim", "lamp", "solar", "trunk"]);
const SNOW = new Set(["roof", "paint", "leaf", "shrub", "needle", "metal", "concrete", "brick"]);
// The part of a polygon above (side 1) or below (-1) the height zc.
function clipZ(poly: V3[], zc: number, side: 1 | -1): V3[] {
  const out: V3[] = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length], dp = (p[2] - zc) * side, dq = (q[2] - zc) * side;
    if (dp >= 0) out.push(p);
    if (dp * dq < 0) { const k = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, zc]); }
  });
  return out;
}

const MATERIALS = new Set(["paint", "glass", "tyre", "rim", "trim", "lamp", "leaf", "shrub", "needle", "trunk", "wall", "roof", "window", "door", "frame", "metal", "concrete", "brick", "solar"]);

const cellRgb = new Map<string, string>();
export interface BakedModel { id: string; w: number; h: number; ox: number; oy: number; fp: [number, number]; paths: [string, string][] }

function oklch(hex: string): [number, number, number] {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]), m = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]), s = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}
const within = (v: number, r?: [number, number]) => !r || (r[0] <= r[1] ? v >= r[0] && v <= r[1] : v >= r[0] || v <= r[1]);
function material(rules: Rule[], t: Tri, top = 1): string {
  const [L, C, H] = oklch(t.rgb), z = Math.max(...t.p.map((q) => q[2])) / top;
  for (const r of rules) if ((!r.name || r.name === t.mat) && (!r.cell || r.cell.includes(t.cell)) && within(z, r.Z) && within(L, r.L) && within(C, r.C) && within(H, r.H)) return r.m;
  return "?";
}

// Bare-season branches: a spine and six arms of two tapered boxes, in the placed model's space, seeded by the id.
function branches(id: string, tris: Tri[]): Tri[] {
  const all = tris.flatMap((t) => t.p), lo = [0, 1, 2].map((i) => Math.min(...all.map((p) => p[i]))), hi = [0, 1, 2].map((i) => Math.max(...all.map((p) => p[i])));
  let seed = [...id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2, H = hi[2], R = Math.min(hi[0] - lo[0], hi[1] - lo[1]) / 2;
  const out: Tri[] = [];
  const box = (a: V3, b: V3, th: number) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ln = Math.hypot(...d), e = d.map((q) => q / ln);
    const up: V3 = Math.abs(e[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
    const cr = (p: number[], q: number[]): V3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
    const u = cr(e, up), un = Math.hypot(...u), uu = u.map((q) => (q / un) * th) as V3, vv = cr(e, uu).map((q) => q) as V3, vn = Math.hypot(...vv), v2 = vv.map((q) => (q / vn) * th) as V3;
    const c = (end: V3, su: number, sv: number): V3 => [end[0] + uu[0] * su + v2[0] * sv, end[1] + uu[1] * su + v2[1] * sv, end[2] + uu[2] * su + v2[2] * sv];
    const ring = (end: V3, k: number) => [c(end, -k, -k), c(end, k, -k), c(end, k, k), c(end, -k, k)];
    const A = ring(a, 1), B = ring(b, 0.6), mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const quad = (q: V3[]) => {
      const n = cr([q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], [q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2]]), g = [0, 1, 2].map((i) => (q[0][i] + q[2][i]) / 2 - mid[i]);
      const f = n[0] * g[0] + n[1] * g[1] + n[2] * g[2] < 0 ? [q[0], q[3], q[2], q[1]] : q;
      for (const k of [[0, 1, 2], [0, 2, 3]]) out.push({ p: k.map((i) => f[i]) as Tri["p"], rgb: "#f2be9e", mat: "woodBark", cell: "" });
    };
    for (let i = 0; i < 4; i++) quad([A[i], A[(i + 1) % 4], B[(i + 1) % 4], B[i]]);
    quad(A); quad(B);
  };
  const z0 = H * 0.16;
  box([cx, cy, z0], [cx + (rnd() - 0.5) * R * 0.2, cy + (rnd() - 0.5) * R * 0.2, H * 0.82], 0.22);
  const arms = 4 + (seed % 5), rise = 0.04 + 0.12 * rnd(), lean = 0.2 + 0.8 * rnd();
  for (let k = 0; k < arms; k++) {
    const a = (k / arms) * Math.PI * 2 + rnd() * 0.6, zs = z0 + H * (0.16 + 0.34 * rnd()), l1 = R * (0.4 + 0.15 * rnd()), l2 = R * (0.35 + 0.25 * rnd());
    const p0: V3 = [cx, cy, zs], p1: V3 = [cx + Math.cos(a) * l1, cy + Math.sin(a) * l1, zs + H * rise], p2: V3 = [p1[0] + Math.cos(a + lean) * l2, p1[1] + Math.sin(a + lean) * l2, p1[2] + H * (rise + 0.04)];
    box(p0, p1, 0.17); box(p1, p2, 0.12);
  }
  return out;
}

// The part of a convex ring left (-1) or right (1) of the vertical line x = cx.
function cutX(ring: Ring, cx: number, side: 1 | -1): Ring {
  const out: Ring = [];
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length], dp = (p[0] - cx) * side, dq = (q[0] - cx) * side;
    if (dp >= 0) out.push(p);
    if (dp * dq < 0) { const k = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]); }
  });
  return out;
}

function pass(m: Cfg["models"][number], dir: Dir, rules: Rule[], inspect: boolean, bare: boolean) {
  const placed = place(loadGlb(path.join(artDir, m.src)), m.yaw, m.size, dir);
  const top = Math.max(...placed.flatMap((t) => t.p.map((p) => p[2])));
  const midX = (Math.max(...placed.flatMap((t) => t.p.map((p) => p[0] - p[1]))) + Math.min(...placed.flatMap((t) => t.p.map((p) => p[0] - p[1])))) / 2;
  const tris = bare ? [...placed.filter((t) => material(rules, t, top) === "trunk"), ...branches(m.id, placed)] : placed;
  type Item = { poly: Ring; key: string; nn: V3; c: number; bb: [number, number, number, number] };
  const items: Item[] = [];
  cellRgb.clear();
  for (const t of tris) {
    const [a, b, c] = t.p, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], ln = Math.hypot(n[0], n[1], n[2]) || 1;
    const nn = n.map((q) => q / ln);
    if (nn[0] + nn[1] + nn[2] <= 0) continue;
    const mat = inspect ? (t.cell || t.mat) : material(rules, t, top);
    // Crowns are faceted, so splitting left and right by the facet normal gives a ragged seam; split them at the model's centre line instead.
    const rounded = !inspect && (mat === "leaf" || mat === "needle" || mat === "shrub");
    const face = nn[2] > (rounded ? 0.5 : 0.6) ? "t" : rounded ? "s" : nn[1] >= nn[0] ? "l" : "r";
    // Snow lies on the upward-leaning part of these materials: the whole face when it faces up, the upper part of a steep one.
    if (mat === "drop" || (mat === "needle" && face === "t" && Math.max(a[2], b[2], c[2]) < top * 0.12)) continue;
    const flat = !inspect && !bare && nn[2] > 0.9 && Math.min(a[2], b[2], c[2]) > top * 0.3 && !NOSNOW.has(mat), crown = mat === "leaf" || mat === "needle", snowy = flat || !inspect && !bare && SNOW.has(mat) && nn[2] > (crown ? 0.04 : 0.25) && (!crown || Math.max(a[2], b[2], c[2]) > top * 0.25);
    const zlo = Math.min(a[2], b[2], c[2]), zc = zlo + (Math.max(a[2], b[2], c[2]) - zlo) * 0.45;
    const pieces: [V3[], string][] = !snowy ? [[t.p, ""]] : face === "t" || mat === "roof" || mat === "paint" || mat === "metal" || mat === "concrete" || mat === "brick" ? [[t.p, "|s"]] : [[clipZ(t.p, zc, 1), "|s"], [clipZ(t.p, zc, -1), ""]];
    for (const [pp, sn] of pieces) {
      if (pp.length < 3) continue;
      // Rounding can merge neighbouring corners; repeated points make the clipper recurse without end.
      const poly = (pp.map(proj).map(([x, y]) => [Math.round(x * 8) / 8, Math.round(y * 8) / 8]) as Ring).filter((q, i, r) => { const o = r[(i + r.length - 1) % r.length]; return q[0] !== o[0] || q[1] !== o[1]; });
      if (poly.length < 3 || Math.abs(area(poly)) < 1.2) continue;
      // A crown's side faces split at its centre line into left and right, so the seam is straight.
      const halves: [Ring, string][] = face === "s" ? [[cutX(poly, midX * 32, -1), "l"], [cutX(poly, midX * 32, 1), "r"]] : [[poly, face]];
      for (const [hp, hf] of halves) {
        if (hp.length < 3 || Math.abs(area(hp)) < 0.3) continue;
        const ring: Ring = [...hp, hp[0]], xs = hp.map((q) => q[0]), ys = hp.map((q) => q[1]);
        items.push({ poly: ring, key: `${mat}|${hf}${sn}`, nn: nn as V3, c: nn[0] * a[0] + nn[1] * a[1] + nn[2] * a[2], bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
      }
    }
    cellRgb.set(t.cell || t.mat, t.rgb);
  }
  // Exact visibility: pieces are ordered nearest first by comparing depth over each overlap, then each loses what the pieces ahead of it cover.
  // The view direction is (1,1,1); depth = x+y+z, larger is nearer, and it is affine in the projected point.
  const depth = (it: Item, sx: number, sy: number) => {
    const u = sx / 32, w = sy / 16, [nx, ny, nz] = it.nn, s = (it.c - ((nx - ny) * u) / 2 + (nz * w) / 2) / ((nx + ny + nz) / 2);
    return s + (s - w) / 2;
  };
  // The part of a convex ring where f >= 0, for f given at its vertices.
  const keepPos = (ring: Ring, f: number[]): Ring => {
    const out: Ring = [];
    ring.forEach((p, i) => {
      const q = ring[(i + 1) % ring.length], fp = f[i], fq = f[(i + 1) % ring.length];
      if (fp >= 0) out.push(p);
      if (fp * fq < 0) { const k = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]); }
    });
    return out;
  };
  // Convex polygon clipped by a convex polygon.
  const clipConvex = (subj: Ring, clip: Ring): Ring => {
    const sg = area(clip) >= 0 ? 1 : -1;
    let out = subj;
    for (let i = 0; i < clip.length && out.length; i++) {
      const a = clip[i], b = clip[(i + 1) % clip.length], side = (p: [number, number]) => sg * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
      out = keepPos(out, out.map(side));
    }
    return out;
  };
  const EPS = 1e-5;
  const attempt = <T,>(f: (nudge: number) => T): T | null => {
    for (const n of [0, 0.011, -0.017, 0.029, 0.043, -0.061, 0.097, -0.13]) { try { return f(n); } catch { /* retry */ } }
    return null;
  };
  const nudged = (r: Ring, n: number): pc.Polygon => [r.slice(0, -1).map(([x, y], i) => [x + (n && i % 2 ? n : 0), y + (n && i % 3 ? n : 0)] as pc.Pair)];
  // Nearest-first order: A goes before B when A is nearer over (most of) their overlap, then a topological sort, ties by mean depth.
  const n = items.length, before: number[][] = items.map(() => []), indeg = new Array(n).fill(0);
  const mean = items.map((it) => { const [x, y] = it.poly.reduce((a, q) => [a[0] + q[0], a[1] + q[1]], [0, 0]); return depth(it, x / it.poly.length, y / it.poly.length); });
  for (let ia = 0; ia < n; ia++) for (let ib = ia + 1; ib < n; ib++) {
    const A = items[ia], B = items[ib];
    if (B.bb[0] >= A.bb[2] || B.bb[2] <= A.bb[0] || B.bb[1] >= A.bb[3] || B.bb[3] <= A.bb[1]) continue;
    const ring = clipConvex(A.poly.slice(0, -1), B.poly.slice(0, -1));
    if (ring.length < 3 || Math.abs(area(ring)) < 1e-3) continue;
    // Signed area-weighted depth gap over the overlap; the sample at each vertex and the centroid is exact for affine depth.
    const f = ring.map(([x, y]) => depth(A, x, y) - depth(B, x, y)), g = f.reduce((s2, v) => s2 + v, 0);
    if (Math.abs(g) < EPS * f.length) continue;
    const [u, v] = g > 0 ? [ia, ib] : [ib, ia];
    before[u].push(v); indeg[v]++;
  }
  const order: number[] = [], done = new Array(n).fill(false);
  while (order.length < n) {
    let pick = -1;
    for (let k = 0; k < n; k++) if (!done[k] && indeg[k] === 0 && (pick < 0 || mean[k] > mean[pick])) pick = k;
    // A cycle: take the nearest remaining piece.
    if (pick < 0) for (let k = 0; k < n; k++) if (!done[k] && (pick < 0 || mean[k] > mean[pick])) pick = k;
    done[pick] = true; order.push(pick);
    for (const v of before[pick]) indeg[v]--;
  }
  // Each piece loses the pieces ahead of it in the order; the clips are the original grid-aligned pieces, so no float noise builds up.
  const parts = new Map<string, pc.MultiPolygon[]>();
  let lost = 0;
  order.forEach((k, pos) => {
    const it = items[k], clips: pc.Polygon[] = [];
    for (let q = 0; q < pos; q++) {
      const b = items[order[q]];
      if (b.bb[0] >= it.bb[2] || b.bb[2] <= it.bb[0] || b.bb[1] >= it.bb[3] || b.bb[3] <= it.bb[1]) continue;
      clips.push([b.poly.slice(0, -1)] as pc.Polygon);
    }
    const vis = clips.length ? attempt((nu) => pc.difference([it.poly.slice(0, -1).map(([x, y], i) => [x + (nu && i % 2 ? nu : 0), y + (nu && i % 3 ? nu : 0)] as pc.Pair)], ...clips)) : [nudged(it.poly, 0)];
    if (vis === null) { lost++; return; }
    if (vis.length) (parts.get(it.key) ?? parts.set(it.key, []).get(it.key)!).push(vis);
  });
  if (lost) console.warn(m.id, dir, "faces dropped:", lost);
  const paths: [string, string][] = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [key, ps] of [...parts].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const merged = attempt(() => pc.union(ps[0], ...ps.slice(1))) ?? ps.flat();
    let d = "";
    for (const poly of merged) {
      for (const ring of poly) {
        const r = simplify(ring as Ring, 0.02);
        // Rings under 0.5 px wide on average are slivers left where faces meet.
        const per = r.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - r[i][0], q[1] - r[i][1]), 0);
        // Lone triangles under 20 px2 are leftovers of mesh corners, not detail.
        if (Math.abs(area(r)) < 0.5 || (Math.abs(area(r)) * 2) / (per || 1) < 0.5 || (r.length === 4 && Math.abs(area(r)) < 20)) continue;
        for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        d += "M" + r.slice(0, -1).map(([x, y]) => `${+x.toFixed(1)} ${+y.toFixed(1)}`).join(" ") + "Z";
      }
    }
    if (!d) continue;
    const [mat, face, tag] = key.split("|");
    if (!inspect && !MATERIALS.has(mat)) throw new Error(`${m.id}: colour rule missing, material ${mat}`);
    paths.push([inspect ? `${mat}|${face}` : `m-${mat} f-${face}${bare ? " bare" : tag ? " snow" : ""}`, d]);
  }
  // Footprint in whole tiles: the extent of the placed model from its near-left ground corner.
  const fp: [number, number] = [0, 1].map((i) => Math.max(1, Math.ceil(Math.max(...placed.flatMap((t) => t.p.map((p) => p[i]))) - 0.01))) as [number, number];
  return { paths, x0, y0, x1, y1, fp };
}

export function bakeOne(m: Cfg["models"][number], dir: Dir, rules: Rule[], inspect = false): BakedModel {
  const main = pass(m, dir, rules, inspect, false), bare = m.bare && !inspect ? pass(m, dir, rules, false, true) : null;
  const [x0, y0, x1, y1] = [Math.min(main.x0, bare?.x0 ?? Infinity), Math.min(main.y0, bare?.y0 ?? Infinity), Math.max(main.x1, bare?.x1 ?? -Infinity), Math.max(main.y1, bare?.y1 ?? -Infinity)];
  return { id: dir === "x" && m.dirs.length === 1 ? m.id : `${m.id}-${dir}`, w: Math.ceil(x1 - x0), h: Math.ceil(y1 - y0), ox: Math.floor(x0), oy: Math.floor(y0), fp: main.fp, paths: [...main.paths, ...(bare?.paths ?? [])] };
}

export const bakeConfig = cfg;
export const kitRules = (m: Cfg["models"][number]) => [...(m.rules ?? []), ...cfg.kits[m.kit].rules];

if (!import.meta.main) {
  // imported by a test: nothing to run
} else if (process.argv.includes("--sheet")) {
  // Debug contact sheet: every model in the raw texel colours, one cell per colour; written to the path after --sheet.
  let x = 120, html = "";
  for (const m of cfg.models) for (const dir of m.dirs) {
    const b = bakeOne(m, dir, [], true);
    html += `<g transform="translate(${x - b.ox} ${240 - b.oy - b.h})">${b.paths.map(([c, d]) => { const [cell, face] = c.split("|"); const rgb = cellRgb.get(cell) ?? "#f0f"; return `<path d="${d}" fill="${rgb}" stroke="${rgb}" stroke-width="0.3" opacity="${face === "t" ? 1 : face === "l" ? 0.8 : 0.62}"><title>${cell}</title></path>`; }).join("")}</g><text x="${x}" y="260" font-size="9">${b.id}</text>`;
    x += Math.max(b.w, 60) + 20;
  }
  fs.writeFileSync(process.argv[process.argv.indexOf("--sheet") + 1], `<svg xmlns="http://www.w3.org/2000/svg" width="${x + 60}" height="280"><rect width="100%" height="100%" fill="#ddd"/>${html}</svg>`);
} else if (process.argv.includes("--inspect")) {
  for (const m of cfg.models) {
    const cnt = new Map<string, number>();
    for (const t of place(loadGlb(path.join(artDir, m.src)), m.yaw, m.size, m.dirs[0])) {
      const [L, C, H] = oklch(t.rgb), k = `${t.mat}${t.cell} L${(Math.round(L * 10) / 10).toFixed(1)} C${(Math.round(C * 25) / 25).toFixed(2)} H${Math.round(H / 30) * 30 % 360}`;
      cnt.set(k, (cnt.get(k) ?? 0) + 1);
    }
    const hx = new Map<string, string>();
    for (const t of place(loadGlb(path.join(artDir, m.src)), m.yaw, m.size, m.dirs[0])) hx.set(t.cell || t.mat, t.rgb);
    console.log(m.id, [...hx].map(([k, v]) => `${k}=${v}`).join(" "));
    console.log(m.id, [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k}x${v}`).join(" | "));
  }
} else {
  const out: BakedModel[] = [];
  for (const m of cfg.models) {
    const rules = kitRules(m);
    for (const dir of m.dirs) { const t0 = Date.now(); const b = bakeOne(m, dir, rules); out.push(b); console.log(b.id, b.paths.length, "paths", Date.now() - t0, "ms"); }
  }
  const body = JSON.stringify(out.map((b) => ({ id: b.id, w: b.w, h: b.h, ox: b.ox, oy: b.oy, fp: b.fp, paths: b.paths })), null, 0).replace(/\},\{"id"/g, "},\n{\"id\"");
  const file = path.join(root, "src/ui/world/site/models.gen.ts");
  fs.writeFileSync(file, `// Generated by scripts/site-bake.ts from art/site; do not edit. Models by Kenney (CC0).\nexport interface BakedModel { id: string; w: number; h: number; ox: number; oy: number; fp: [number, number]; paths: [string, string][] }\nexport const MODELS: BakedModel[] = ${body};\nexport const BAKE_HASH = "${createHash("sha256").update(body).digest("hex").slice(0, 12)}";\n`);
  console.log("wrote", file);
}
