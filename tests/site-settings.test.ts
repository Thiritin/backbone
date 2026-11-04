import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ALL_DATACENTERS } from "../src/sim/20-world/datacenters";
import { Fence } from "../src/ui/world/site/perimeter";
import { SiteBack, SiteFront } from "../src/ui/world/site/Site";
import { buildSite } from "../src/ui/world/site/compound";
import { it as item, overlaps, visibleBehind, type SiteClass } from "../src/ui/world/site/layout";
import { compoundOf, settingOf, type Setting } from "../src/ui/world/site/setting";
import { newGame } from "./fixtures";

const SIZES: Record<SiteClass, [number, number]> = { S: [9, 9], M: [14, 12], L: [20, 16] };
const SETTINGS: Setting[] = ["industrial", "nowhere", "business"];
// Elements outside the model defs. The merged outside look already draws 1116 for an own hall S, so these pin growth, not the earlier plan figure.
const CAP: Record<SiteClass, number> = { S: 900, M: 1200, L: 1500 }, EDGE_CAP = 500;
const dc = (f: (d: (typeof ALL_DATACENTERS)[number]) => boolean) => ALL_DATACENTERS.find(f)!;
const nodes = (html: string) => (html.replace(/<defs>.*<\/defs>/g, "").match(/<[a-z]/g) ?? []).length;

describe("site settings", () => {
  it("maps each location kind to a setting", () => {
    const g = newGame(7), base = g.locations[0];
    const loc = (o: Partial<typeof base>) => ({ ...base, ...o });
    expect(settingOf(loc({ space: "basement" }), g)).toBe("suburb");
    expect(settingOf(loc({ space: "office" }), g)).toBe("business");
    const hub = dc((d) => d.size === "large" && (!!d.exchange?.onSite || d.carriers >= 4) && !d.green);
    expect(settingOf(loc({ space: "cage", dc: hub.id, city: hub.city }), g)).toBe("industrial");
    const small = dc((d) => d.size === "small" && !d.green);
    expect(settingOf(loc({ space: "share", dc: small.id, city: small.city }), g)).toBe("business");
    const green = dc((d) => d.green);
    expect(settingOf(loc({ space: "suite", dc: green.id, city: green.city }), g)).toBe("nowhere");
    const mid = dc((d) => d.size === "medium" && !d.green);
    expect(["industrial", "business"]).toContain(settingOf(loc({ space: "cage", dc: mid.id, city: mid.city }), g));
    expect(settingOf(loc({ space: "cage", dc: mid.id, city: mid.city }), g)).toBe(settingOf(loc({ space: "cage", dc: mid.id, city: mid.city }), g));
  });

  it("adds modules with the size class and varies the variants by seed", () => {
    for (const s of SETTINGS) expect(compoundOf(s, "L", 5).util.length).toBeGreaterThanOrEqual(compoundOf(s, "S", 5).util.length);
    expect(compoundOf("industrial", "S", 5).fence).toBe("double");
    expect(compoundOf("business", "S", 5).fence).toBe("single");
    expect(compoundOf("industrial", "L", 5).guard).toBe(true);
    const seeds = Array.from({ length: 12 }, (_, k) => compoundOf("nowhere", "M", k * 7919));
    expect(new Set(seeds.map((c) => `${c.turbine}${c.solar}${c.farm}${c.slide}`)).size).toBeGreaterThan(1);
  });

  for (const setting of SETTINGS) for (const cls of ["S", "M", "L"] as const) for (const edge of [false, true]) {
    const [w, h] = SIZES[cls], name = `${setting} ${cls}${edge ? " edge" : ""}`;
    it(`${name} keeps every module off the room, apart and in view`, () => {
      const sp = buildSite(setting, cls, 1234, w, h, edge), bay = sp.bay!;
      expect(overlaps(sp.items).map(([a, b]) => `${a.t}@${a.x0},${a.y0} / ${b.t}@${b.x0},${b.y0}`)).toEqual([]);
      for (const i of sp.items) {
        if (i.t === "street") continue;
        expect(i.x1 <= 0 || i.y1 <= 0 || i.x0 >= w || i.y0 >= h, `${i.t} on the room`).toBe(true);
        if (i.y1 <= 0 || i.x1 <= 0) expect(visibleBehind(i.x1, i.y1, i.top, w, h), `${i.t} hidden`).toBe(true);
      }
      expect(bay.x >= w || bay.y < 0 || bay.x < 0 || bay.y >= h).toBe(true);
      const street = sp.items.find((i) => i.t === "street")!, gate = sp.items.find((i) => i.t === "gate")!;
      expect(gate.y0).toBeGreaterThan(h);
      expect(gate.y1).toBeLessThan(street.y0);
    });
    it(`${name} keeps trees off the verge and the driveways`, () => {
      const sp = buildSite(setting, cls, 1234, w, h, edge), street = sp.items.find((i) => i.t === "street")!;
      for (const t of sp.items.filter((i) => i.t === "tree")) {
        expect(t.y0, "tree south of the street").toBeLessThan(street.y0);
        for (const d of sp.items.filter((i) => i.t === "path" && i.kind === "drive")) expect(t.x0 - 2 < d.x1 && d.x0 < t.x1 + 2 && t.y1 + 2 > d.y0 && d.y1 > t.y0 - 2, "tree on a driveway").toBe(false);
      }
    });
    it(`${name} stays inside the node budget`, () => {
      const sp = buildSite(setting, cls, 1234, w, h, edge), html = renderToStaticMarkup(createElement("svg", null, createElement(SiteBack, { s: sp, name: "Co", band: "red", month: 6, year: 2020 }), createElement(SiteFront, { s: sp, name: "Co", band: "red", year: 2020 })));
      expect(nodes(html)).toBeLessThanOrEqual(edge ? EDGE_CAP : CAP[cls]);
      for (const i of sp.items.filter((x) => !["street", "walk", "field", "rail", "lobby", "yard", "tree", "car", "house", "box", "bays", "path", "fence", "hedge"].includes(x.t))) {
        expect(nodes(renderToStaticMarkup(createElement(SiteBack, { s: { ...sp, items: [{ ...i, layer: "back" }] }, name: "", band: "", month: 6, year: 2020 }))), i.t).toBeLessThanOrEqual(90);
      }
    });
  }

  it("builds the security fence with posts every 2.5 m", () => {
    const run = item("fence", 0, 0, 5, 0.1, 100, "back", { dir: "x", coil: true });
    const html = renderToStaticMarkup(createElement("svg", null, createElement(Fence, { i: run })));
    expect(html.match(/class="w-fpost" d="([^"]+)"/)![1].match(/M/g)).toHaveLength(3);
    expect(html).toContain("w-coil");
  });
});
