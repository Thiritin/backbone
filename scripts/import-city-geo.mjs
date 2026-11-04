// Builds src/ui/map/geo/<city code>.ts (water, waterways, green, built-up areas, major roads, rail) from OpenStreetMap (ODbL) via the Overpass API.
// Usage: GEO_CACHE=<dir> node -e "import('vite').then((v) => v.runnerImport('./scripts/import-city-geo.mjs'))"   (one query per 5 s, resumable via the cache dir)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { REGIONS } from "../src/sim/20-world/datacenters.ts";
import { PLACES } from "../src/sim/20-world/places.ts";
import { CITIES } from "../src/ui/map/world-data.ts";

const MAX_KB = 220;
const cacheDir = new URL(`file://${process.env.GEO_CACHE ?? "/tmp/geo-cache"}/`);
const outDir = new URL("../src/ui/map/geo/", import.meta.url);
mkdirSync(cacheDir, { recursive: true });
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const key = (p) => `${p[0]},${p[1]}`;
// Chains ways that meet end to start or end to end; returns the chains.
const chain = (ways) => {
  const rest = ways.map((w) => w.slice()), out = [];
  while (rest.length) {
    let cur = rest.pop();
    for (let again = true; again; ) {
      again = false;
      for (let i = 0; i < rest.length; i++) {
        const w = rest[i];
        if (key(w[0]) === key(cur.at(-1))) cur = [...cur, ...w.slice(1)];
        else if (key(w.at(-1)) === key(cur.at(-1))) cur = [...cur, ...w.slice(0, -1).reverse()];
        else if (key(w.at(-1)) === key(cur[0])) cur = [...w, ...cur.slice(1)];
        else if (key(w[0]) === key(cur[0])) cur = [...w.slice(1).reverse(), ...cur];
        else continue;
        rest.splice(i, 1); again = true; break;
      }
    }
    out.push(cur);
  }
  return out;
};

async function fetchCity(c, box) {
  const path = new URL(`${c.code}.json`, cacheDir);
  if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
  const b = `(${box.s},${box.w},${box.n},${box.e})`;
  const q = `[out:json][timeout:240];(
way["natural"="water"]${b};relation["natural"="water"]${b};
way["waterway"~"^(river|canal)$"]${b};
way["leisure"~"^(park|garden|nature_reserve)$"]${b};way["landuse"~"^(forest|grass|meadow|recreation_ground|village_green|cemetery)$"]${b};way["natural"="wood"]${b};
way["landuse"~"^(residential|commercial|retail|industrial)$"]${b};
way["highway"~"^(motorway|trunk|primary|secondary)(_link)?$"]${b};way["railway"="rail"]${b};
);out tags geom;`;
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(5000);
    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: new URLSearchParams({ data: q }), headers: { "User-Agent": "backbone-map-import" } });
      if (!res.ok) { console.log(`${c.code}: HTTP ${res.status}, retry`); await sleep(15000 * (attempt + 1)); continue; }
      const j = await res.json();
      writeFileSync(path, JSON.stringify(j.elements));
      return j.elements;
    } catch (e) { console.log(`${c.code}: ${e.message}, retry`); await sleep(15000); }
  }
  throw new Error(`${c.code}: no response`);
}

const pts = (g) => g.map((p) => [p.lon, p.lat]);
function classify(els) {
  const L = { water: [], waterway: [], green: [], built: [], major: [], second: [], rail: [] };
  for (const e of els) {
    const t = e.tags ?? {};
    if (e.type === "relation") {
      const outer = (e.members ?? []).filter((m) => m.role === "outer" && m.geometry).map((m) => pts(m.geometry));
      for (const r of chain(outer)) if (key(r[0]) === key(r.at(-1)) && r.length > 3) L.water.push(r);
      continue;
    }
    if (!e.geometry) continue;
    const g = pts(e.geometry);
    if (t.natural === "water") L.water.push(g);
    else if (t.waterway) L.waterway.push(g);
    else if (t.leisure || t.natural === "wood" || ["forest", "grass", "meadow", "recreation_ground", "village_green", "cemetery"].includes(t.landuse)) L.green.push(g);
    else if (t.landuse) L.built.push(g);
    else if (t.railway) L.rail.push(g);
    else if (/^(motorway|trunk|primary)/.test(t.highway)) L.major.push(g);
    else if (t.highway) L.second.push(g);
  }
  L.waterway = chain(L.waterway);
  L.major = chain(L.major); L.second = chain(L.second); L.rail = chain(L.rail);
  return L;
}

for (const r of REGIONS) {
  const c = CITIES.find((x) => x.name === r.city);
  // Same box as import-streets.mjs.
  const dLat = 6 / 111, dLon = 6 / (111 * Math.cos((c.lat * Math.PI) / 180)), here = PLACES.filter((p) => p.city === r.city);
  const box = {
    s: Math.min(c.lat - dLat, ...here.map((p) => p.lat - dLat / 4)), n: Math.max(c.lat + dLat, ...here.map((p) => p.lat + dLat / 4)),
    w: Math.min(c.lon - dLon, ...here.map((p) => p.lon - dLon / 4)), e: Math.max(c.lon + dLon, ...here.map((p) => p.lon + dLon / 4)),
  };
  const L = classify(await fetchCity(c, box));
  let out = "", note = "";
  for (let tol = 3e-5; tol < 4e-4; tol *= 1.4) {
    // Areas smaller than a few streets' width vanish at this scale.
    const big = (l) => { const xs = l.map((p) => p[0]), ys = l.map((p) => p[1]); return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) > tol * 8; };
    const enc = (k, min) => encode(L[k].filter((l) => min < 4 || big(l)).map((l) => simplify(l, tol)).filter((l) => l.length >= min));
    // Small polygons and short lines vanish at this scale.
    const body = Object.keys(L).map((k) => `  ${k}: ${JSON.stringify(enc(k, k === "water" || k === "green" || k === "built" ? 4 : 2))},`).join("\n");
    out = `// Water, green, built-up areas, major roads and rail of ${c.name} from OpenStreetMap, © OpenStreetMap contributors (ODbL); generated by scripts/import-city-geo.mjs.\nimport { decode } from "../streets/decode";\n\nconst raw = {\n${body}\n};\nexport const GEO = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v ? decode(v) : []])) as Record<keyof typeof raw, [number, number][][]>;\n`;
    note = `tol ${tol.toExponential(1)}`;
    if (out.length < MAX_KB * 1024) break;
  }
  writeFileSync(new URL(`${c.code}.ts`, outDir), out);
  console.log(`${c.code}.ts: ${note}, ${(out.length / 1024).toFixed(0)} KB, ${Object.entries(L).map(([k, v]) => k + v.length).join(" ")}`);
}
