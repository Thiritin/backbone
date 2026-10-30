import { describe, expect, it } from "vitest";
import { brandFrom, brandsOf, brandWatts, modelById, partOffers, shopModels, vendorsOf } from "../src/sim/10-catalog/hardware";
import { unitPrice } from "../src/sim/90-actions/hardware";
import { CLASS_TREE, classOf, CORES, inClass, makerOf, MAKERS, matchesFilter, NO_FILTER, RAMS, sortItems, type Sort } from "../src/ui/apps/shop/filter";

const models = (year: number) => shopModels(year).filter((m) => m.server);
const left = (year: number, p: object) => models(year).filter((m) => matchesFilter(m, { ...NO_FILTER, ...p }));

describe("shop filter", () => {
  it("an empty filter keeps every model", () => {
    expect(left(2014, {})).toHaveLength(models(2014).length);
  });
  it("each dimension keeps only matching specs", () => {
    expect(left(2014, { form: "2U" }).every((m) => m.height === 2)).toBe(true);
    expect(left(2014, { cores: 16 }).every((m) => m.server!.cores >= 16)).toBe(true);
    expect(left(2014, { ram: 256 }).every((m) => m.server!.ramGb >= 256)).toBe(true);
    expect(left(2014, { disk: "SSD" }).every((m) => m.server!.disk === "SSD")).toBe(true);
    expect(left(2014, { form: "2U", cores: 16, disk: "SSD" }).length).toBeLessThan(left(2014, { form: "2U" }).length);
  });
  it("stricter steps never add models", () => {
    for (const [k, steps] of [["cores", CORES], ["ram", RAMS]] as const) {
      const n = steps.map((v) => left(2014, { [k]: v }).length);
      expect(n).toEqual([...n].sort((a, b) => b - a));
    }
  });
  it("spec filters drop non-servers, form factor keeps matching heights", () => {
    const rest = shopModels(2014).filter((m) => !m.server && m.kind !== "part");
    expect(rest.some((m) => matchesFilter(m, NO_FILTER))).toBe(true);
    expect(rest.some((m) => matchesFilter(m, { ...NO_FILTER, cores: 4 }))).toBe(false);
    expect(rest.filter((m) => matchesFilter(m, { ...NO_FILTER, form: "1U" })).every((m) => m.height === 1)).toBe(true);
  });
  it("sells no towers", () => {
    expect(left(2005, {}).every((m) => m.height > 0)).toBe(true);
  });
});

describe("shop sort", () => {
  const items = shopModels(2008).filter((m) => m.server).flatMap((model) => brandsOf(model).map((brand) => ({ model, brand })));
  const price = (it: (typeof items)[number]) => unitPrice({ model: it.model.id, brand: it.brand, qty: 1, vendor: vendorsOf(it.model)[0] }, 2008);
  const col = (sort: Sort, f: (it: (typeof items)[number]) => number) => sortItems(items, sort, 2008).map(f);
  const ascending = (a: number[]) => a.every((v, i) => !i || a[i - 1] <= v);

  it("keeps the list for the default order and does not change it", () => {
    const copy = [...items];
    expect(sortItems(items, "default", 2008)).toEqual(items);
    sortItems(items, "priceLow", 2008);
    expect(items).toEqual(copy);
  });
  it("orders by price both ways", () => {
    expect(ascending(col("priceLow", price))).toBe(true);
    expect(ascending(col("priceHigh", price).map((p) => -p))).toBe(true);
    expect(new Set(col("priceLow", price)).size).toBeGreaterThan(1);
  });
  it("lists the newest release first", () => {
    const from = (it: (typeof items)[number]) => brandFrom(it.model, it.brand);
    expect(ascending(col("newest", from).map((v) => -v))).toBe(true);
    expect(new Set(col("newest", from)).size).toBeGreaterThan(1);
  });
  it("lists the lowest power first", () => {
    const watts = (it: (typeof items)[number]) => brandWatts(it.model, it.brand);
    expect(ascending(col("power", watts))).toBe(true);
  });
});

describe("shop classes", () => {
  it("every model falls in a class of the tree", () => {
    const known = CLASS_TREE.flatMap(([p, kids]) => [p, ...kids]);
    for (const m of shopModels(2014).filter((x) => x.kind !== "part")) expect(known).toContain(classOf(m));
  });
  it("a parent class holds its children and nothing else", () => {
    const server = classOf(shopModels(2014).find((m) => m.server)!);
    expect(inClass("Servers", server)).toBe(true);
    expect(inClass("Servers", "Layer 2")).toBe(false);
    expect(inClass("Switches", "Layer 3")).toBe(true);
    expect(inClass("Layer 2", "Layer 3")).toBe(false);
    expect(inClass(null, server)).toBe(true);
    expect(classOf(modelById("part-ram"))).toBe("Parts");
  });
  it("parts list under their real maker or none", () => {
    for (const p of partOffers(2014)) {
      const make = makerOf("Generic", p);
      if (p.kind === "cpu" || p.kind === "board") expect(["Indel", "AMB"]).toContain(make);
      if (p.kind === "gpu") expect(make).toBe("nVidea");
      if (p.kind === "ram") expect(make).toBeNull();
      expect(make).not.toBe("Generic");
    }
    expect(MAKERS).not.toContain("Generic");
  });
});
