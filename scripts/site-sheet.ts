// Writes one HTML contact sheet per season class (summer, autumn, bare, snow) with every baked model: `node --experimental-strip-types scripts/site-sheet.ts <dir>`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { MODELS } = (await import(path.join(root, "src/ui/world/site/models.gen.ts"))) as { MODELS: { id: string; w: number; h: number; ox: number; oy: number; paths: [string, string][] }[] };
const css = fs.readFileSync(path.join(root, "src/ui/world/site/materials.css"), "utf8");
const out = process.argv[2] ?? ".";
const TONES = ["w-tone-fall-a", "w-tone-fall-b", "w-tone-fall-c"];
const WIDTH = 2800;

const sheet = (cls: string) => {
  let x = 20, y = 20, rowH = 0, body = "", n = 0;
  const pending: string[] = [];
  const paints = ["w-tone-car-2", "w-tone-car-3", "w-tone-car-4", "w-tone-car-5"];
  const list = [...MODELS, ...paints.map((p) => ({ ...MODELS.find((m) => m.id === "sedan-x")!, id: "sedan-x", tone: p }))] as (typeof MODELS[number] & { tone?: string })[];
  for (const m of list) {
    if (x + m.w + 30 > WIDTH) { x = 20; y += rowH + 50; rowH = 0; }
    const tone = /^(oak|tree)/.test(m.id) ? TONES[n++ % 3] : m.id.startsWith("hall") ? `w-tone-hall-${(n++ % 3) + 1}` : "";
    body += `<use href="#sm-${m.id}" x="${x - m.ox}" y="${y - m.oy}" class="${m.tone ?? tone}"/><text x="${x}" y="${y + m.h + 16}">${m.tone ? `${m.id} ${{ "w-tone-car-2": "blue", "w-tone-car-3": "white", "w-tone-car-4": "grey", "w-tone-car-5": "yellow" }[m.tone]}` : m.id}</text>`;
    x += Math.max(m.w, 60) + 30; rowH = Math.max(rowH, m.h);
    pending.push(m.id);
  }
  const H = y + rowH + 50;
  const defs = MODELS.map((m) => `<g id="sm-${m.id}" class="sm">${m.paths.map(([c, d]) => `<path class="${c}" d="${d}"/>`).join("")}</g>`).join("");
  const bg = cls === "ws-snow" ? "oklch(0.95 0.008 240)" : "oklch(0.74 0.14 140)";
  return `<!doctype html><meta charset="utf-8"><style>${css} body{margin:0;background:${bg}} text{font:12px sans-serif;fill:#223}</style><svg xmlns="http://www.w3.org/2000/svg" class="${cls}" width="${WIDTH}" height="${H}" viewBox="0 0 ${WIDTH} ${H}"><defs>${defs}</defs>${body}</svg>`;
};

for (const [name, cls] of [["summer", "ws-summer"], ["autumn", "ws-autumn"], ["bare", "ws-bare"], ["snow", "ws-snow ws-summer"]] as const) {
  fs.writeFileSync(path.join(out, `sheet-${name}.html`), sheet(cls));
}
