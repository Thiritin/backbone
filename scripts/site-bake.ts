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
interface Rule { m: string; name?: string; cell?: string[]; L?: [number, number]; C?: [number, number]; H?: [number, number] }
interface Cfg {
  kits: Record<string, { rules: Rule[] }>;
  models: { id: string; kit: string; src: string; yaw: number; size: [number, number, number]; dirs: ("x" | "y")[]; rules?: Rule[] }[];
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
function loadGlb(file: string): Tri[] {
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
function place(tris: Tri[], yaw: number, size: V3, dir: "x" | "y"): Tri[] {
  const c = Math.cos((yaw * Math.PI) / 180), s = Math.sin((yaw * Math.PI) / 180);
  const w = (p: V3): V3 => [p[0] * c - p[2] * s, -(p[0] * s + p[2] * c), p[1]];
  const T = tris.map((t) => ({ ...t, p: t.p.map(w) as Tri["p"] }));
  const all = T.flatMap((t) => t.p);
  const lo = [0, 1, 2].map((i) => Math.min(...all.map((p) => p[i]))), hi = [0, 1, 2].map((i) => Math.max(...all.map((p) => p[i])));
  const k = [0, 1, 2].map((i) => size[i] / (hi[i] - lo[i]));
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

const MATERIALS = new Set(["paint", "glass", "tyre", "rim", "trim", "lamp", "leaf", "needle", "trunk", "wall", "roof", "window", "door", "frame", "metal", "concrete", "brick", "solar"]);

const cellRgb = new Map<string, string>();
export interface BakedModel { id: string; w: number; h: number; ox: number; oy: number; paths: [string, string][] }

function oklch(hex: string): [number, number, number] {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]), m = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]), s = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}
const within = (v: number, r?: [number, number]) => !r || (r[0] <= r[1] ? v >= r[0] && v <= r[1] : v >= r[0] || v <= r[1]);
function material(rules: Rule[], t: Tri): string {
  const [L, C, H] = oklch(t.rgb);
  for (const r of rules) if ((!r.name || r.name === t.mat) && (!r.cell || r.cell.includes(t.cell)) && within(L, r.L) && within(C, r.C) && within(H, r.H)) return r.m;
  return "?";
}

export function bakeOne(m: Cfg["models"][number], dir: "x" | "y", rules: Rule[], inspect = false): BakedModel {
  const tris = place(loadGlb(path.join(artDir, m.src)), m.yaw, m.size, dir);
  type Item = { d: number; poly: Ring; key: string; rgb: string };
  const items: Item[] = [];
  cellRgb.clear();
  for (const t of tris) {
    const [a, b, c] = t.p, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], ln = Math.hypot(n[0], n[1], n[2]) || 1;
    const nn = n.map((q) => q / ln);
    if (nn[0] + nn[1] + nn[2] <= 0) continue;
    const poly = t.p.map(proj).map(([x, y]) => [Math.round(x * 8) / 8, Math.round(y * 8) / 8]) as Ring;
    if (Math.abs(area(poly)) < 0.6) continue;
    const face = nn[2] > 0.6 ? "t" : nn[1] >= nn[0] ? "l" : "r";
    items.push({ d: -(a[0] + a[1] + a[2] + b[0] + b[1] + b[2] + c[0] + c[1] + c[2]), poly: [...poly, poly[0]], key: `${inspect ? (t.cell || t.mat) : material(rules, t)}|${face}`, rgb: t.rgb });
    cellRgb.set(t.cell || t.mat, t.rgb);
  }
  items.sort((p, q) => p.d - q.d);
  // polygon-clipping throws on some degenerate meetings; retry with a tiny deterministic nudge, then give the face up.
  const attempt = <T,>(f: (nudge: number) => T): T | null => {
    for (const n of [0, 0.011, -0.017, 0.029]) { try { return f(n); } catch { /* retry */ } }
    return null;
  };
  const nudged = (r: Ring, n: number): pc.Polygon => [r.map(([x, y], i) => [x + (i % 2 ? n : -n), y + (i % 3 ? n : 0)] as pc.Pair)];
  let covered: pc.MultiPolygon = [];
  const parts = new Map<string, pc.MultiPolygon[]>();
  let lost = 0;
  for (const it of items) {
    const vis = covered.length ? attempt((n) => pc.difference(nudged(it.poly, n), covered)) : [nudged(it.poly, 0)];
    if (vis === null) { lost++; continue; }
    if (!vis.length) continue;
    (parts.get(it.key) ?? parts.set(it.key, []).get(it.key)!).push(vis);
    const next = covered.length ? attempt((n) => pc.union(covered, nudged(it.poly, n))) : [nudged(it.poly, 0)];
    if (next) covered = next; else lost++;
  }
  if (lost) console.warn(m.id, dir, "faces dropped:", lost);
  const paths: [string, string][] = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [key, ps] of [...parts].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const merged = attempt(() => pc.union(ps[0], ...ps.slice(1))) ?? ps.flat();
    let d = "";
    for (const poly of merged) {
      for (const ring of poly) {
        const r = simplify(ring as Ring, 0.35);
        if (Math.abs(area(r)) < 0.5) continue;
        for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        d += "M" + r.slice(0, -1).map(([x, y]) => `${+x.toFixed(1)} ${+y.toFixed(1)}`).join(" ") + "Z";
      }
    }
    if (!d) continue;
    const [mat, face] = key.split("|");
    if (!inspect && !MATERIALS.has(mat)) throw new Error(`${m.id}: colour rule missing, material ${mat}`);
    paths.push([inspect ? `${mat}|${face}` : `m-${mat} f-${face}`, d]);
  }
  return { id: dir === "x" && m.dirs.length === 1 ? m.id : `${m.id}-${dir}`, w: Math.ceil(x1 - x0), h: Math.ceil(y1 - y0), ox: Math.floor(x0), oy: Math.floor(y0), paths };
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
  const body = JSON.stringify(out.map((b) => ({ id: b.id, w: b.w, h: b.h, ox: b.ox, oy: b.oy, paths: b.paths })), null, 0).replace(/\},\{"id"/g, "},\n{\"id\"");
  const file = path.join(root, "src/ui/world/site/models.gen.ts");
  fs.writeFileSync(file, `// Generated by scripts/site-bake.ts from art/site; do not edit. Models by Kenney (CC0).\nexport interface BakedModel { id: string; w: number; h: number; ox: number; oy: number; paths: [string, string][] }\nexport const MODELS: BakedModel[] = ${body};\nexport const BAKE_HASH = "${createHash("sha256").update(body).digest("hex").slice(0, 12)}";\n`);
  console.log("wrote", file);
}
