// Builds src/ui/map/streets/<city code>.ts from OpenStreetMap (ODbL) via the Overpass API.
// Usage: node -e "import('vite').then((v) => v.runnerImport('./scripts/import-streets.mjs'))"   (one query per 5 s, resumable via streets-cache/ outside the repo)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { REGIONS } from "../src/sim/20-world/datacenters.ts";
import { PLACES } from "../src/sim/20-world/places.ts";
import { CITIES } from "../src/ui/map/world-data.ts";

const MAX_KB = 200;
const CLASSES = ["motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential"];
const cacheDir = new URL("../../streets-cache/", import.meta.url); // two levels up from scripts/: outside the repo
const outDir = new URL("../src/ui/map/streets/", import.meta.url);
mkdirSync(cacheDir, { recursive: true });
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Douglas-Peucker, iterative.
const simplify = (pts, tol) => {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
      const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
};

// The inverse of streets/decode.ts.
const encode = (lines) => {
  let lat = 0, lon = 0;
  const num = (v) => { let n = v < 0 ? ~(v << 1) : v << 1, o = ""; while (n >= 32) { o += String.fromCharCode((32 | (n & 31)) + 63); n >>>= 5; } return o + String.fromCharCode(n + 63); };
  return lines.map((l) => l.map(([x, y]) => {
    const la = Math.round(y * 1e5), lo = Math.round(x * 1e5), o = num(la - lat) + num(lo - lon);
    lat = la; lon = lo;
    return o;
  }).join("")).join(" ");
};

// Joins ways of one class that meet end to start, so the file carries fewer, longer lines.
const join = (lines) => {
  const key = (p) => `${p[0]},${p[1]}`, byStart = new Map();
  lines.forEach((l, i) => byStart.set(key(l[0]), [...(byStart.get(key(l[0])) ?? []), i]));
  const used = new Uint8Array(lines.length), out = [];
  for (let i = 0; i < lines.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    let l = lines[i];
    for (;;) {
      const j = (byStart.get(key(l.at(-1))) ?? []).find((k) => !used[k]);
      if (j === undefined) break;
      used[j] = 1;
      l = [...l, ...lines[j].slice(1)];
    }
    out.push(l);
  }
  return out;
};

async function fetchCity(c, box) {
  const path = new URL(`${c.code}.json`, cacheDir);
  if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
  const re = `^(${CLASSES.join("|")})(_link)?$`;
  const q = `[out:json][timeout:180];way["highway"~"${re}"](${box.s},${box.w},${box.n},${box.e});out tags geom;`;
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(5000);
    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: new URLSearchParams({ data: q }), headers: { "User-Agent": "backbone-map-import" } });
      if (!res.ok) { console.log(`${c.code}: HTTP ${res.status}, retry`); await sleep(15000 * (attempt + 1)); continue; }
      const j = await res.json();
      const ways = j.elements.filter((e) => e.geometry).map((e) => [CLASSES.indexOf(e.tags.highway.replace("_link", "")), e.geometry.map((g) => [Math.round(g.lon * 1e6) / 1e6, Math.round(g.lat * 1e6) / 1e6])]);
      writeFileSync(path, JSON.stringify(ways));
      return ways;
    } catch (err) { console.log(`${c.code}: ${err.message}, retry`); }
  }
  throw new Error(`${c.code}: no response`);
}

for (const r of REGIONS) {
  const c = CITIES.find((x) => x.name === r.city);
  // 12 km around the centre, widened to hold every place in the city with room around it.
  const dLat = 6 / 111, dLon = 6 / (111 * Math.cos((c.lat * Math.PI) / 180)), here = PLACES.filter((p) => p.city === r.city);
  const box = {
    s: Math.min(c.lat - dLat, ...here.map((p) => p.lat - dLat / 4)), n: Math.max(c.lat + dLat, ...here.map((p) => p.lat + dLat / 4)),
    w: Math.min(c.lon - dLon, ...here.map((p) => p.lon - dLon / 4)), e: Math.max(c.lon + dLon, ...here.map((p) => p.lon + dLon / 4)),
  };
  const ways = await fetchCity(c, box);
  let out = "", note = "";
  search: for (let top = CLASSES.length; top > 2; top--) {
    for (let tol = 2e-5; tol < 1.2e-4; tol *= 1.3) {
      const lines = [];
      for (let k = 0; k < top; k++) lines.push(...join(ways.filter(([cls]) => cls === k).map(([, g]) => simplify(g, tol))).filter((l) => l.length > 1));
      out = `// Streets of ${c.name} from OpenStreetMap, © OpenStreetMap contributors (ODbL); generated by scripts/import-streets.mjs.\nimport { decode } from "./decode";\n\nexport const STREETS: [number, number][][] = decode(${JSON.stringify(encode(lines))});\n`;
      note = `${lines.length} lines, up to ${CLASSES[top - 1]}, tol ${tol.toExponential(1)}`;
      if (out.length < MAX_KB * 1024) break search;
    }
  }
  writeFileSync(new URL(`${c.code}.ts`, outDir), out);
  console.log(`${c.code}.ts: ${note}, ${(out.length / 1024).toFixed(0)} KB`);
}
