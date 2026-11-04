// Builds src/ui/map/region/<city code>.ts (about 150 km around each European datacenter city) and region/europe.ts (the national layer):
// roads, rail, rivers, lakes, built-up areas and town names from Natural Earth 1:10m (public domain), forests and parks from OpenStreetMap (ODbL) via Overpass.
// Usage: NE_DIR=<dir with the ne_10m_* geojson files, saved as <name>.json> GEO_CACHE=<dir> node -e "import('vite').then((v) => v.runnerImport('./scripts/import-region-geo.mjs'))"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { REGIONS } from "../src/sim/20-world/datacenters.ts";
import { CITIES } from "../src/ui/map/world-data.ts";
import { clipLine, encode, meetsBox, regionBox, ringBox, simplify, townClass } from "../src/ui/map/detail.ts";

const ne = process.env.NE_DIR, cache = process.env.GEO_CACHE ?? "/tmp/region-cache";
if (!ne) throw new Error("NE_DIR missing");
mkdirSync(cache, { recursive: true });
const outDir = new URL("../src/ui/map/region/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const feats = (n) => JSON.parse(readFileSync(`${ne}/${n}.json`, "utf8")).features;
const lines = (g) => (g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : []);
const rings = (g) => (g.type === "Polygon" ? [g.coordinates[0]] : g.type === "MultiPolygon" ? g.coordinates.map((p) => p[0]) : []);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r4 = (l) => l.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);

const EUROPE = { w: -11, s: 35, e: 32, n: 62 };
const P = (f) => f.properties;
const roads = feats("ne_10m_roads").filter((f) => P(f).scalerank <= 8);
const rail = feats("ne_10m_railroads");
const urban = feats("ne_10m_urban_areas");
const lakes = [...feats("ne_10m_lakes"), ...feats("ne_10m_lakes_europe")];
const rivers = [...feats("ne_10m_rivers_lake_centerlines"), ...feats("ne_10m_rivers_europe")];
const places = feats("ne_10m_populated_places");
const major = (f) => /Highway|Beltway|Bypass/.test(P(f).type ?? "") && (P(f).type !== "Secondary Highway");

const near = (f, b) => { const g = f.geometry; const pts = g.type === "Point" ? [g.coordinates] : (g.type.startsWith("Multi") ? g.coordinates.flat(g.type === "MultiPolygon" ? 2 : 1) : g.type === "Polygon" ? g.coordinates[0] : g.coordinates); return pts.some(([x, y]) => x >= b.w && x <= b.e && y >= b.s && y <= b.n); };

// Lines clipped to the box, simplified, short pieces dropped.
const lineSet = (fs, b, tol, min = 0.01) => fs.filter((f) => near(f, b)).flatMap((f) => lines(f.geometry))
  .flatMap((l) => clipLine(l, b)).map((l) => simplify(l, tol)).filter((l) => l.length > 1 && (ringBox(l).e - ringBox(l).w) + (ringBox(l).n - ringBox(l).s) > min);
// Areas inside or crossing the box; those smaller than min degrees across vanish.
const areaSet = (rs, b, tol, min) => rs.filter((r) => { const x = ringBox(r); return meetsBox(x, b) && Math.max(x.e - x.w, x.n - x.s) > min; }).map((r) => simplify(r, tol)).filter((r) => r.length >= 4);

// The box is fetched in four tiles, as Overpass times out on the whole of it.
async function forests(c, b) {
  const path = `${cache}/${c.code}.json`;
  if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
  const out = [], mx = (b.w + b.e) / 2, my = (b.s + b.n) / 2;
  for (const t of [{ ...b, e: mx, n: my }, { ...b, w: mx, n: my }, { ...b, e: mx, s: my }, { ...b, w: mx, s: my }]) {
    const bb = `(${t.s},${t.w},${t.n},${t.e})`;
    const q = `[out:json][timeout:180];(way["natural"="wood"](if:length()>12000)${bb};way["landuse"="forest"](if:length()>12000)${bb};way["leisure"="nature_reserve"](if:length()>15000)${bb};way["boundary"="national_park"](if:length()>15000)${bb};);out geom qt;`;
    let done = false;
    for (let attempt = 0; attempt < 6 && !done; attempt++) {
      await sleep(4000);
      try {
        const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: new URLSearchParams({ data: q }), headers: { "User-Agent": "backbone-map-import" } });
        if (!res.ok) { console.log(`${c.code}: HTTP ${res.status}, retry`); await sleep(20000 * (attempt + 1)); continue; }
        out.push(...(await res.json()).elements.filter((e) => e.geometry).map((e) => e.geometry.map((p) => [p.lon, p.lat])));
        done = true;
      } catch (e) { console.log(`${c.code}: ${e.message}, retry`); await sleep(20000); }
    }
    if (!done) throw new Error(`${c.code}: no response`);
  }
  writeFileSync(path, JSON.stringify(out));
  return out;
}

const here = CITIES.filter((c) => REGIONS.some((r) => !r.us && r.city === c.name));
const taken = (f) => here.some((c) => Math.hypot(c.lon - P(f).LONGITUDE, c.lat - P(f).LATITUDE) < 0.12);
const town = (f, min, max) => {
  const p = P(f), cls = townClass(p.POP_MAX);
  if (cls < min || cls > max || taken(f)) return null;
  const nm = [p.NAME_DE, p.NAME_FR, p.NAME_ES, p.NAME_IT, p.NAME_PT].map((n) => (n && n !== p.NAME ? n : ""));
  return [Math.round(p.LONGITUDE * 100) / 100, Math.round(p.LATITUDE * 100) / 100, cls, p.NAME, nm.every((n) => !n) ? "" : nm.join("|")];
};

function build(b, o) {
  const pack = (ls, min = 2) => encode(ls.map(r4).filter((l) => l.length >= min));
  const towns = places.filter((f) => f.geometry && near(f, b)).map((f) => town(f, o.minClass, o.maxClass)).filter(Boolean).sort((a, c) => a[2] - c[2]);
  return {
    urban: pack(areaSet(urban.filter((f) => P(f).area_sqkm >= o.urbanKm).flatMap((f) => rings(f.geometry)), b, o.tol, o.tol * 2), 4),
    lake: pack(areaSet(lakes.flatMap((f) => rings(f.geometry)), b, o.tol, o.tol * 2), 4),
    // Protected areas that span sea or whole regions are dropped.
    forest: pack(areaSet((o.forests ?? []).filter((r) => { const x = ringBox(r); return Math.max(x.e - x.w, x.n - x.s) < 0.4; }), b, o.tol * 1.5, 0.04), 4),
    river: pack(lineSet(rivers.filter((f) => P(f).scalerank <= 8), b, o.tol)),
    stream: pack(o.detail ? lineSet(rivers.filter((f) => P(f).scalerank > 8), b, o.tol) : []),
    major: pack(lineSet(roads.filter(major).filter((f) => P(f).scalerank <= 5), b, o.tol)),
    second: pack(o.detail ? lineSet(roads.filter((f) => !major(f) || P(f).scalerank > 5), b, o.tol) : []),
    rail: pack(o.rail ? lineSet(rail, b, o.tol) : []),
    towns,
  };
}
const write = (name, what, d) => {
  const body = Object.entries(d).filter(([k]) => k !== "towns").map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join("\n");
  const out = `// ${what}; generated by scripts/import-region-geo.mjs.\n// Natural Earth (public domain), forests and parks © OpenStreetMap contributors (ODbL).\nimport type { Detail } from "../detail";\n\nexport const REGION: Detail = {\n${body}\n  towns: ${JSON.stringify(d.towns)},\n};\n`;
  writeFileSync(new URL(`${name}.ts`, outDir), out);
  console.log(`${name}.ts ${(out.length / 1024).toFixed(0)} KB, gzip ${(gzipSync(out).length / 1024).toFixed(0)} KB, towns ${d.towns.length}`);
};

for (const c of here) {
  const b = regionBox(c.lat, c.lon);
  write(c.code, `Roads, rail, rivers, lakes, forests and towns around ${c.name}`, build(b, { tol: 0.004, urbanKm: 4, detail: true, rail: true, minClass: 4, maxClass: 5, forests: process.env.NO_FOREST ? [] : await forests(c, b) }));
}
write("europe", "Major roads, rivers, lakes, large cities and towns of Europe", build(EUROPE, { tol: 0.01, urbanKm: 60, detail: false, rail: false, minClass: 1, maxClass: 3 }));
