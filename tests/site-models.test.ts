import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { bakeConfig, bakeOne, kitRules } from "../scripts/site-bake";
import { MODELS } from "../src/ui/world/site/models.gen";

const css = readFileSync("src/ui/world/site/materials.css", "utf8");
const group = (id: string) => (/^(sedan|hatchback|van|coupe|suv|delivery|pickup|bintruck)/.test(id) ? "car" : /^(oak|pine|tree|bush)/.test(id) ? "tree" : /^(house|shop|office)/.test(id) ? "house" : /^(hall|warehouse|tank|container|solar|windmill|chimney|water)/.test(id) ? "industrial" : "prop");
const CAP = { car: 30, tree: 12, house: 45, industrial: 50, prop: 15 };

describe("model library", () => {
  it("keeps every model within its path cap", () => {
    for (const m of MODELS) expect(m.paths.length, m.id).toBeLessThanOrEqual(CAP[group(m.id)]);
  });
  it("stands the scale-table heights", () => {
    const h = (id: string) => bakeConfig.models.find((m) => m.id === id)!.size[2];
    const table: Record<string, number> = { sedan: 1.45, hatchback: 1.45, suv: 1.7, van: 2.0, delivery: 3.2, house: 7, warehouse: 7 };
    for (const [id, v] of Object.entries(table)) expect(Math.abs(h(id) - v) / v, id).toBeLessThanOrEqual(0.05);
    for (const m of bakeConfig.models.filter((x) => group(x.id) === "tree" && !x.id.startsWith("bush"))) expect(m.size[2], m.id).toBeGreaterThanOrEqual(6);
  });
  it("carries no brand ids", () => {
    for (const m of bakeConfig.models) expect(m.id, m.id).not.toMatch(/ford|toyota|vw|bmw|audi|opel|fiat|mercedes|volvo|tesla|ikea/i);
  });
  it("gives every material three tone variables", () => {
    const mats = new Set(MODELS.flatMap((m) => m.paths.map(([c]) => c.split(" ")[0].slice(2))));
    for (const k of mats) for (const f of ["t", "l", "r"]) expect(css, `${k}-${f}`).toMatch(new RegExp(`\\.m-${k} \\{[^}]*--${f}: var\\(--${k}-${f},`));
  });
  it("tags the snow pieces and draws them from the cover variables", () => {
    for (const id of ["tree-round", "pine-default", "house-c", "coupe-x", "hall-a"]) expect(MODELS.find((m) => m.id === id)!.paths.some(([c]) => c.endsWith(" snow")), id).toBe(true);
    for (const f of ["t", "l", "r"]) expect(css).toMatch(new RegExp(`\\.snow\\.f-${f} \\{ fill: var\\(--sn-${f}`));
    expect(css).toMatch(/\.ws-snow \{[^}]*--sn-t/);
  });
  it("bakes branches for bare trees and hides them outside the bare season", () => {
    for (const id of ["oak", "tree-round", "tree-fat", "tree-tall"]) expect(MODELS.find((m) => m.id === id)!.paths.some(([c]) => c.endsWith(" bare")), id).toBe(true);
    expect(css).toMatch(/\.bare \{ fill-opacity: var\(--bare-o, 0\)/);
    expect(css).toMatch(/\.ws-bare \{ --bare-o: 1/);
  });
  it("sets the leaf tones per season", () => {
    for (const s of ["spring", "summer", "autumn"]) expect(css).toMatch(new RegExp(`\\.ws-${s} \\{[^}]*--leaf-t[^}]*--leaf-l[^}]*--leaf-r`));
    expect(css).toMatch(/\.ws-bare \{ --leaf-o: 0/);
  });
  it("draws no gradient, filter or opacity-less leftovers in the new models", () => {
    expect(JSON.stringify(MODELS)).not.toMatch(/Gradient|filter|blur|opacity|stroke-/);
  });
  it("bakes new models the same way twice", () => {
    for (const id of ["tree-wide", "house-c", "container"]) {
      const cfg = bakeConfig.models.find((m) => m.id === id)!, dir = cfg.dirs[0], mid = dir === "x" && cfg.dirs.length === 1 ? id : `${id}-${dir}`;
      expect(JSON.stringify(bakeOne(cfg, dir, kitRules(cfg)))).toBe(JSON.stringify(MODELS.find((m) => m.id === mid)));
    }
  });
});
