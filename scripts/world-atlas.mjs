// Crops the world sprites out of the purchased tileset sheets into public/world/atlas.png and public/world/sprites.json.
// The sheets stay outside the repository: node scripts/world-atlas.mjs [sheet folder]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

const SRC = process.argv[2] ?? "/Users/martin/Projects/backbone-assets/modern-data-center";
const OUT = new URL("../public/world/", import.meta.url).pathname;
const ATLAS_W = 480;

// Name to a source rect, or to parts [x, y, w, h, dx, dy] assembled into a w by h sprite.
const B1 = "tile-B-01.png", B2 = "tile-B-02.png", B4 = "tile-B-04.png", B5 = "tile-B-05.png", WALLS = "Auto-tile-A4-walls-3.png";
const SPEC = {
  floor: { sheet: "Tile_A2-2.png", x: 24, y: 216, w: 48, h: 48 },
  "floor-alt": { sheet: "Tile_A2-2.png", x: 120, y: 216, w: 48, h: 48 },
  wall: { sheet: WALLS, x: 216, y: 624, w: 48, h: 48 },
  "wall-base": { sheet: WALLS, x: 216, y: 672, w: 48, h: 48 },
  "rack-closed": { sheet: B2, x: 0, y: 96, w: 48, h: 96 },
  "rack-open": { sheet: B1, x: 240, y: 192, w: 48, h: 96 },
  desk: { sheet: B4, x: 0, y: 192, w: 96, h: 96 },
  pc: { sheet: B4, x: 585, y: 607, w: 30, h: 65 },
  scanner: { sheet: B1, x: 288, y: 384, w: 48, h: 96 },
  shelf: { sheet: B4, x: 672, y: 384, w: 48, h: 96 },
  fan: { sheet: B5, x: 684, y: 294, w: 72, h: 39 },
  fusebox: { sheet: B2, x: 590, y: 289, w: 68, h: 94 },
  "door-closed": { sheet: B1, x: 384, y: 288, w: 48, h: 96 },
  "door-half": { sheet: B1, x: 480, y: 288, w: 48, h: 96 },
  "door-open": { sheet: B1, x: 432, y: 288, w: 48, h: 96 },
};

function decode(file) {
  const buf = readFileSync(file);
  let pos = 8, w = 0, h = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error(`${file}: only 8-bit RGBA without interlace`);
    }
    if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * 4), stride = w * 4;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? px[y * stride + i - 4] : 0, b = y ? px[(y - 1) * stride + i] : 0, c = y && i >= 4 ? px[(y - 1) * stride + i - 4] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      px[y * stride + i] = (line[i] + pred) & 255;
    }
  }
  return { w, h, px };
}

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = ~0; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); out.write(type, 4, "ascii"); data.copy(out, 8);
  out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encode({ w, h, px }) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const sheets = {};
const sheet = (name) => (sheets[name] ??= decode(join(SRC, name)));
const blit = (dst, src, sx, sy, w, h, dx, dy) => {
  for (let y = 0; y < h; y++) src.px.copy(dst.px, ((dy + y) * dst.w + dx) * 4, ((sy + y) * src.w + sx) * 4, ((sy + y) * src.w + sx + w) * 4);
};

// Shelf packing: left to right, a new row when the next sprite does not fit.
const entries = Object.entries(SPEC).map(([name, s]) => ({ name, s, w: s.w, h: s.h }));
let x = 0, y = 0, rowH = 0;
for (const e of entries) {
  if (x + e.w > ATLAS_W) { x = 0; y += rowH; rowH = 0; }
  Object.assign(e, { x, y });
  x += e.w; rowH = Math.max(rowH, e.h);
}
const atlas = { w: ATLAS_W, h: y + rowH, px: null };
atlas.px = Buffer.alloc(atlas.w * atlas.h * 4);
const json = {};
for (const e of entries) {
  const src = sheet(e.s.sheet);
  if (e.s.parts) for (const [px, py, pw, ph, dx, dy] of e.s.parts) blit(atlas, src, px, py, pw, ph, e.x + dx, e.y + dy);
  else blit(atlas, src, e.s.x, e.s.y, e.w, e.h, e.x, e.y);
  json[e.name] = { sheet: "atlas.png", x: e.x, y: e.y, w: e.w, h: e.h, ...(e.s.anchor ? { anchor: e.s.anchor } : {}) };
}
writeFileSync(join(OUT, "atlas.png"), encode(atlas));
writeFileSync(join(OUT, "sprites.json"), `{\n${Object.entries(json).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n")}\n}\n`);
console.log(`${entries.length} sprites, atlas ${atlas.w} by ${atlas.h}`);
