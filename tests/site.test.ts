import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { roomSize } from "../src/sim/20-world/layout";
import { REFIT } from "../src/sim/20-world/properties";
import { buyBuilding, refitSection } from "../src/sim/90-actions/properties";
import { fnv1a, lobbySeats, pick, reservedBay, siteOf, visibleBehind, type Item } from "../src/ui/world/site/layout";
import { bakeConfig, bakeOne, kitRules } from "../scripts/site-bake";
import { BAKE_HASH, MODELS } from "../src/ui/world/site/models.gen";
import { BAY, CAR_SIZE, overlaps, STREET } from "../src/ui/world/site/layout";
import { newGame } from "./fixtures";

const ok = (r: { ok: boolean; error?: string; id?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };
function hallGame() {
  const s = newGame(7);
  s.cash = 10_000_000;
  s.hour = hourOf(new Date(Date.UTC(2013, 2, 2, 10)));
  const pid = ok(buyBuilding(s, "gallushof")), p = s.properties.find((x) => x.id === pid)!;
  const hid = ok(refitSection(s, pid, p.sections.find((x) => x.floor === 1)!.id, "hall"));
  s.hour += 24 * REFIT.hall.days;
  return { s, loc: s.locations.find((l) => l.id === hid)! };
}
const site = (s: ReturnType<typeof newGame>, loc: ReturnType<typeof newGame>["locations"][number]) => { const { w, h } = roomSize(loc); return siteOf(s, loc, w, h); };
const lift = (sp: { lift: number }, i: Item) => (i.layer === "back" ? sp.lift : 0);

describe("site layout", () => {
  it("hashes a fixed id to a fixed seed", () => {
    expect(fnv1a("basement")).toBe(fnv1a("basement"));
    expect(fnv1a("a")).toBe(0xe40c292c);
    expect(pick(5, 1, 3)).toBe(pick(5, 1, 3));
  });

  it("two halls of one class differ in at least one pick", () => {
    const a = fnv1a("hall-1:S"), b = fnv1a("hall-2:S");
    expect([0, 1, 2, 3, 4, 5, 6, 7].some((slot) => pick(a, slot, 6) !== pick(b, slot, 6))).toBe(true);
  });

  it("every module of the basement and the hall is seen and stays off the room", () => {
    const g = newGame(7), { s, loc } = hallGame();
    const home = g.locations.find((l) => l.space === "basement")!;
    for (const [game, l] of [[g, home], [s, loc]] as const) {
      const sp = site(game, l);
      expect(sp.kind).not.toBe("none");
      for (const i of sp.items) {
        const behind = i.y1 <= 0 || i.x1 <= 0;
        if (i.t !== "street") expect(i.x1 <= 0 || i.y1 <= 0 || i.x0 >= sp.w || i.y0 >= sp.h, `${i.t} overlaps the room`).toBe(true);
        if (behind && i.t !== "street") expect(visibleBehind(i.x1, i.y1, lift(sp, i) + i.top, sp.w, sp.h), `${i.t} is hidden`).toBe(true);
      }
    }
  });

  it("the reserved bay lies outside the room and the lobby seats are on the lobby", () => {
    const { s, loc } = hallGame(), sp = site(s, loc), bay = reservedBay(sp)!;
    expect(bay.x >= sp.w || bay.y < 0 || bay.x < 0 || bay.y >= sp.h).toBe(true);
    const lobby = sp.items.find((i) => i.t === "lobby")!;
    expect(lobbySeats(sp)).toHaveLength(2);
    for (const q of lobbySeats(sp)) expect(q.x >= lobby.x0 && q.x <= lobby.x1 && q.y >= lobby.y0 && q.y <= lobby.y1).toBe(true);
  });

  it("the street is 7 m and a bay is 2.5 x 5", () => {
    const { s, loc } = hallGame(), st = site(s, loc).items.find((i) => i.t === "street")!;
    expect(st.y1 - st.y0).toBe(STREET);
    expect(STREET).toBe(7);
    expect([BAY.w, BAY.l]).toEqual([2.5, 5]);
    const bays = site(s, loc).items.find((i) => i.t === "bays")!;
    expect(bays.x1 - bays.x0).toBe(5);
  });

  it("the security fence stands around the compound with a gate in the front line", () => {
    const { s, loc } = hallGame(), sp = site(s, loc), fences = sp.items.filter((i) => i.t === "fence"), gate = sp.items.find((i) => i.t === "gate")!;
    expect(fences.length).toBeGreaterThan(20);
    expect(fences.every((f) => f.top > 80)).toBe(true);
    expect(gate.y0).toBeGreaterThan(sp.h);
  });

  it("the office and rented spaces have no placements", () => {
    const g = newGame(7);
    for (const l of g.locations.filter((x) => x.space !== "basement" && x.space !== "hall")) expect(site(g, l).items).toEqual([]);
  });
});

describe("baked models", () => {
  const ids = bakeConfig.models.flatMap((m) => m.dirs.map((d) => (d === "x" && m.dirs.length === 1 ? m.id : `${m.id}-${d}`)));
  it("has every configured id", () => { for (const id of ids) expect(MODELS.find((m) => m.id === id), id).toBeTruthy(); });
  it("keeps each model between 3 and 60 paths with known material classes", () => {
    const mats = new Set(["paint", "glass", "tyre", "rim", "trim", "lamp", "leaf", "shrub", "needle", "trunk", "wall", "roof", "window", "door", "frame", "metal", "concrete", "brick", "solar"]);
    for (const m of MODELS) {
      expect(m.paths.length, m.id).toBeGreaterThanOrEqual(3);
      expect(m.paths.length, m.id).toBeLessThanOrEqual(60);
      for (const [c] of m.paths) expect(c).toMatch(/^m-([a-z]+) f-[tlr]( snow| bare)?$/), expect(mats.has(c.split(" ")[0].slice(2)), c).toBe(true);
    }
  });
  it("draws a sedan 1.45 m tall", () => {
    const cfg = bakeConfig.models.find((m) => m.id === "sedan")!, m = MODELS.find((x) => x.id === "sedan-x")!;
    expect(cfg.size[2] * 32).toBeGreaterThan(44);
    expect(cfg.size[2] * 32).toBeLessThan(48);
    const [l, w] = CAR_SIZE.sedan;
    expect(m.h).toBeLessThanOrEqual(Math.ceil((l + w) * 16 + cfg.size[2] * 32));
    expect(m.oy).toBeGreaterThanOrEqual(-Math.ceil(cfg.size[2] * 32));
  });
  it("bakes deterministically", () => {
    const cfg = bakeConfig.models.find((m) => m.id === "sedan")!, a = bakeOne(cfg, "x", kitRules(cfg)), b = MODELS.find((x) => x.id === "sedan-x")!;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(BAKE_HASH).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe("site placement", () => {
  it("keeps every footprint apart in the basement and the hall", () => {
    const g = newGame(7), { s, loc } = hallGame();
    for (const [game, l] of [[g, g.locations.find((x) => x.space === "basement")!], [s, loc]] as const) {
      const bad = overlaps(site(game, l).items).map(([a, b]) => `${a.t}@${a.x0},${a.y0} / ${b.t}@${b.x0},${b.y0}`);
      expect(bad).toEqual([]);
    }
  });

  it("lines every building up on its own lot with a driveway from its front to the street", () => {
    const g = newGame(7), { s, loc } = hallGame();
    for (const [game, l] of [[g, g.locations.find((x) => x.space === "basement")!], [s, loc]] as const) {
      const items = site(game, l).items, street = items.find((i) => i.t === "street")!, drives = items.filter((i) => i.t === "path" && i.kind === "drive");
      const lots = items.filter((i) => i.t === "house" || i.t === "box");
      expect(lots.length).toBeGreaterThan(3);
      for (const b of lots) {
        const d = drives.find((x) => Math.abs(x.y0 - b.y1) < 1e-6 && x.x0 >= b.x0 && x.x1 <= b.x1);
        expect(d, `drive for ${b.t}@${b.x0}`).toBeTruthy();
        expect(d!.y1).toBe(street.y0);
        expect(lots.filter((o) => Math.abs(o.y1 - b.y1) > 3 + 1e-6)).toEqual([]);
      }
    }
  });

  it("builds the lobby on to the hall and keeps its seats inside", () => {
    const { s, loc } = hallGame(), sp = site(s, loc), lobby = sp.items.find((i) => i.t === "lobby")!;
    expect(lobby.y0).toBe(sp.h);
    expect(lobby.x0).toBe(0);
    for (const seat of sp.seats) expect(seat.x > lobby.x0 && seat.x < lobby.x1 && seat.y > lobby.y0 && seat.y < lobby.y1).toBe(true);
    const fences = sp.items.filter((i) => i.t === "fence");
    expect(fences.filter((f) => f.x1 > lobby.x0 && f.x0 < lobby.x1 && f.y1 > lobby.y0 && f.y0 < lobby.y1)).toEqual([]);
  });

  it("draws the site flat: no gradients, filters or blur in the baked models or the site files", () => {
    const dir = "src/ui/world/site/", src = readdirSync(dir).map((f) => readFileSync(dir + f, "utf8")).join("\n");
    expect(src).not.toMatch(/Gradient|stop-color|stopColor|<filter|filter:|filter=|feGaussianBlur|blur\(|drop-shadow/);
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".tsx"))) expect(readFileSync(dir + f, "utf8"), f).not.toMatch(/oklch/);
    expect(JSON.stringify(MODELS)).not.toMatch(/Gradient|filter|blur|opacity/);
  });

  it("keeps every basement tree base at least a tile from the cliff edge and every belt canopy off the road", () => {
    const g = newGame(7), items = site(g, g.locations.find((x) => x.space === "basement")!).items;
    for (const tr of items.filter((i) => i.t === "tree")) expect((tr.y0 + tr.y1) / 2, `tree@${tr.x0}`).toBeLessThanOrEqual(-1);
    const { s, loc } = hallGame(), hall = site(s, loc).items, street = hall.find((i) => i.t === "street")!;
    for (const tr of hall.filter((i) => i.t === "tree" && i.y0 > street.y1)) expect(tr.y0).toBeGreaterThan(street.y1 + 2);
  });
});
