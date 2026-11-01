import { describe, expect, it } from "vitest";
import { shopVendorUrl } from "../src/sim/80-business/shoplink";
import { companyFolder, searchIndex } from "../src/sim/80-business/index";
import { resolve } from "../src/sim/80-business/browser";
import { readyGame, newGame } from "./fixtures";

describe("start page search", () => {
  it("finds directory rows with sponsored rows on top and after every third result", () => {
    const s = newGame(1), hits = searchIndex(s, "panel");
    expect(hits.slice(0, 2).every((h) => h.ad)).toBe(true);
    const organic = hits.filter((h) => !h.ad);
    expect(organic.map((h) => h.row.title)).toEqual(expect.arrayContaining(["cPanic", "TCAdmen"]));
    expect(hits.filter((h) => h.ad).length).toBe(2 + Math.floor(organic.length / 3));
    expect(hits.filter((h) => h.ad).some((h) => organic.some((o) => o.row.url === h.row.url))).toBe(false);
    for (const h of hits) expect(resolve(s, h.row.url).page.kind).not.toBe("notfound");
    expect(searchIndex(s, "panel")).toEqual(hits);
    expect(searchIndex(s, "  ")).toEqual([]);
  });

  it("lists the shop systems and never advertises the encyclopedia", () => {
    const s = newGame(1), hits = searchIndex(s, "shop systems");
    expect(hits.filter((h) => !h.ad).map((h) => h.row.url)).toContain(shopVendorUrl("modemBill"));
    for (const q of ["a", "e", "o"]) expect(searchIndex(s, q).filter((h) => h.ad).some((h) => h.row.url.includes("wikipedio"))).toBe(false);
  });
});

describe("company bookmark folder", () => {
  it("is flat up to twenty sites and groups the consoles by category past that", () => {
    const s = readyGame(1);
    s.marketing.launched = true;
    const flat = companyFolder(s);
    expect(flat.title).toBe(s.company.name);
    expect(flat.rows[0].title).toBe(s.company.name);
    expect(flat.groups).toEqual([]);
    const panel = s.clusters.find((c) => c.vm)!, vm = s.workloads.find((w) => w.id === panel.vm)!;
    for (let i = 0; i < 25; i++) {
      s.workloads.push({ ...vm, id: `${vm.id}-x${i}`, hostname: `${vm.hostname}x${i}` });
      s.clusters.push({ ...panel, id: `${panel.id}-x${i}`, vm: `${vm.id}-x${i}` });
    }
    const grouped = companyFolder(s);
    expect(grouped.rows.map((r) => r.title)).toEqual([s.company.name]);
    expect(grouped.groups.length).toBeGreaterThan(0);
    expect(grouped.groups.flatMap((g) => g.rows).length).toBeGreaterThan(20);
    expect(grouped.groups.map((g) => g.title)).toContain("Web hosting panels");
  });
});
