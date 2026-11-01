import { describe, expect, it } from "vitest";
import { cardAt, cardOf, gpuDemand, gpuOffers, gpuPrice, gpuRent, GPU_CARDS } from "../src/sim/10-catalog/gpu";
import { componentParts, fits, modelById, partOffers } from "../src/sim/10-catalog/hardware";
import { partPrice } from "../src/sim/10-catalog/parts";
import { marketPrice, sizeSpec, specPrice } from "../src/sim/10-catalog/products";
import { GPU_SKILL } from "../src/sim/10-catalog/research";
import { needsOf } from "../src/sim/30-market/market";
import { specText } from "../src/sim/30-market/spec";
import { SAVE_VERSION, type GameState } from "../src/sim/50-state";
import { cardsFree, lineOffered, workloadsOf } from "../src/sim/60-infra/cluster";
import { busyDevices, deviceWatts, rackPower } from "../src/sim/60-infra/status";
import { newsTick } from "../src/sim/80-business/news";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { connect, installPart, removePart, type CartLine } from "../src/sim/90-actions/hardware";
import { buyBare, buyDevice, newGame } from "./fixtures";
import { research } from "../src/sim/90-actions/store";
import { tick } from "../src/sim/88-tick/tick";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { hypervisor, skipTo, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

type R = { ok: boolean; id?: string; error?: string };
const ok = (r: R) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: R) => (r.ok ? "ok" : r.error);

const V100 = { kind: "gpu" as const, size: 2017 };
const M2050 = { kind: "gpu" as const, size: 2010 };
const card = (qty: number, size = 2017): NonNullable<CartLine["extras"]> => [{ kind: "gpu", size, qty }];
const rich = (year: number): GameState => {
  const s = { ...withServer(newGame(1)), cash: 50_000_000 };
  skipTo(s, year);
  return s;
};
const cardsOf = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!.components.filter((c) => c.kind === "gpu");
// A GPU 4U in the basement rack, cabled to the switch.
function gpuServer(s: GameState, model = "g3-gpu", slot = 5): string {
  const id = ok(buyDevice(s, model, "Dwell", 1, "loc1"));
  ok(mountDevice(s, id, "rack2", slot));
  // The server's SFP port goes to an uplink switch, which is cabled to the basement switch.
  const sw = ok(buyDevice(s, "sw-48", "Sysko", 1, "loc1"));
  ok(mountDevice(s, sw, "rack2", 12));
  ok(connect(s, { device: sw, port: 0 }, { device: "dev4", port: 2 }));
  ok(connect(s, { device: id, port: 0 }, { device: sw, port: 48 }));
  return id;
}

describe("GPU cards", () => {
  it("lists the seven cards with their launch prices and watts", () => {
    expect(GPU_CARDS.map((c) => [c.year, c.price, c.watts])).toEqual([[2007, 1300, 170], [2010, 2200, 225], [2014, 4500, 300], [2017, 9000, 300], [2020, 11000, 400], [2023, 28000, 700], [2025, 35000, 1000]]);
    expect(GPU_CARDS.filter((c) => c.wide).map((c) => c.year)).toEqual([2017, 2020, 2023, 2025]);
    expect(GPU_CARDS.every((c) => c.name.startsWith("nVidea Tezla"))).toBe(true);
  });

  it("prices a card at 10% off a year until its successor, then at half", () => {
    const v100 = cardOf(2017);
    expect(gpuPrice(v100, 2017)).toBe(9000);
    expect(gpuPrice(v100, 2018)).toBeCloseTo(8100);
    expect(gpuPrice(v100, 2019)).toBeCloseTo(7200);
    expect(gpuPrice(v100, 2020)).toBe(4500);
    expect(gpuPrice(v100, 2030)).toBe(4500);
    expect(gpuPrice(cardOf(2025), 2030)).toBe(17500);
    expect(gpuPrice(cardOf(2025), 2040)).toBe(17500);
    expect(partPrice("gpu", 2023, undefined, 2024)).toBe(25200);
  });

  it("sells the newest card and the one before in the Parts tab", () => {
    expect(cardAt(2006)).toBeNull();
    expect(gpuOffers(2017).map((c) => c.id)).toEqual(["tezla-k80", "tezla-v100", "instinkt-mi25"]);
    expect(new Set(partOffers(2023).filter((p) => p.kind === "gpu").map((p) => p.sku))).toEqual(new Set(["a10", "l40s", "tezla-a100", "tezla-h100", "instinkt-mi210", "instinkt-mi300x"]));
    expect(partOffers(2006).some((p) => p.kind === "gpu")).toBe(false);
  });
});

describe("GPU fit rules", () => {
  it("refuses a card in a 1U", () => {
    expect(fits(modelById("g3-compute"), [{ kind: "gpu", size: 2010 }])).toBe("error.noSlot");
    expect(fits(modelById("g6-arm"), [V100])).toBe("error.noSlot");
    const s = rich(2012);
    expect(err(buyDevice(s, "g3-compute", "Dwell", 1, "loc1", { extras: card(1, 2010) }))).toBe("error.noSlot");
  });

  it("takes one single-width card in a 2U of the generations to 2016 and none after", () => {
    expect(fits(modelById("g4-memory"), [{ kind: "gpu", size: 2014 }])).toBeNull();
    expect(fits(modelById("g4-memory"), [{ kind: "gpu", size: 2014 }, { kind: "gpu", size: 2014 }])).toBe("error.noSlot");
    expect(fits(modelById("g4-storage"), [V100])).toBe("error.noSlot");
    expect(fits(modelById("g5-memory"), [{ kind: "gpu", size: 2014 }])).toBe("error.noSlot");
  });

  it("takes four double-width cards in a GPU 4U and no fifth", () => {
    const m = modelById("g5-gpu");
    expect(fits(m, Array.from({ length: 4 }, () => V100))).toBeNull();
    expect(fits(m, Array.from({ length: 5 }, () => V100))).toBe("error.noSlot");
    const s = rich(2017);
    ok(buyBare(s, "g5-gpu", "Dwell", 1, "loc1", { extras: card(4) }));
    expect(err(buyBare(s, "g5-gpu", "Dwell", 1, "loc1", { extras: card(5) }))).toBe("error.noSlot");
  });

  it("refuses a fifth card installed into a full GPU server", () => {
    const s = rich(2012), id = gpuServer(s);
    const spare = ok(buyDevice(s, "part-gpu", "Generic", 1, "loc1", { part: M2050 }));
    expect(err(installPart(s, id, spare))).toBe("error.noSlot");
    s.devices.find((d) => d.id === id)!.on = false;
    ok(removePart(s, id, cardsOf(s, id)[0].id));
    for (let h = 0; h < 2; h++) tick(s);
    ok(installPart(s, id, spare));
    expect(cardsOf(s, id)).toHaveLength(4);
  });
});

describe("GPU servers", () => {
  it("ships the GPU line from 2011 with four of the generation's card", () => {
    expect(componentParts(modelById("g3-gpu")).filter((p) => p.kind === "gpu")).toEqual(Array(4).fill({ kind: "gpu", size: 2010, sku: "tezla-m2050" }));
    expect(componentParts(modelById("g5-gpu")).filter((p) => p.kind === "gpu")).toEqual(Array(4).fill({ kind: "gpu", size: 2017, sku: "tezla-v100" }));
    expect(componentParts(modelById("g7-gpu")).filter((p) => p.kind === "gpu")).toEqual(Array(4).fill({ kind: "gpu", size: 2023, sku: "tezla-h100" }));
    expect(() => modelById("g2-gpu")).toThrow();
  });

  it("adds the cards' watts to the draw of the rack", () => {
    const s = rich(2012), id = gpuServer(s);
    const d = s.devices.find((x) => x.id === id)!, rack = () => rackPower(s, "rack2").watts;
    const busy = busyDevices(s), rated = s.devices.filter((x) => x.rackId === "rack2").reduce((n, x) => n + (busy.has(x.id) ? modelById(x.model).watts : modelById(x.model).idleWatts), 0);
    expect(deviceWatts(d)).toBe(modelById("g3-gpu").watts + 4 * 225);
    expect(rack()).toBe(rated + 4 * 225);
    d.components.find((c) => c.kind === "gpu")!.failedAt = s.hour;
    expect(rack()).toBe(rated + 3 * 225);
  });
});

describe("GPU rental", () => {
  it("prices a card a month by year, straight between the anchors", () => {
    expect([2011, 2016, 2017, 2020, 2023, 2026].map(gpuRent)).toEqual([600, 450, 1500, 1800, 4000, 2500]);
    expect(gpuRent(2009)).toBe(600);
    expect(gpuRent(2031)).toBe(2500);
    expect(gpuRent(2018)).toBeCloseTo(1600);
    expect(specPrice("gpu", sizeSpec("gpu", 0, 2017), 2017)).toBeCloseTo(1500, 0);
    expect(marketPrice("gpu", sizeSpec("gpu", 2, 2023), 2023)).toBeCloseTo(16000, 0);
  });

  it("names the cards of a spec", () => {
    expect(specText("gpu", sizeSpec("gpu", 1, 2020))).toMatch(/^GPU server, 2 GPUs, /);
    expect(specText("gpu", sizeSpec("gpu", 0, 2020))).toMatch(/^GPU server, 1 GPU, /);
    expect(sizeSpec("gpu", 3, 2020).gpus).toBe(8);
  });

  it("scales demand by year and shares it over four profiles", () => {
    expect([2010, 2011, 2016, 2017, 2019, 2020, 2022, 2023, 2026].map(gpuDemand)).toEqual([0, 0.2, 0.2, 0.6, 0.6, 1, 1, 2.5, 2.5]);
    const gpu = (p: Parameters<typeof needsOf>[0], y: number) => needsOf(p, y).find(([x]) => x === "gpu")?.[1] ?? 0;
    expect(gpu("hobbyDev", 2010)).toBe(0);
    expect(gpu("enterprise", 2020)).toBeCloseTo(0.03);
    expect(gpu("agency", 2023)).toBeCloseTo(0.075);
    expect(gpu("onlineShop", 2017)).toBeCloseTo(0.018);
    expect(gpu("private", 2023)).toBe(0);
    expect(needsOf("hobbyDev", 2023).reduce((n, [, w]) => n + w, 0)).toBeCloseTo(1);
    expect(needsOf("hobbyDev", 2009)).toEqual([["vps", 0.9], ["webHosting", 0.1]]);
  });

  it("needs the skill and a free card to be offered, and rents whole cards", () => {
    const s = rich(2012), id = gpuServer(s);
    hypervisor(s, [id], "GPU 1");
    expect(lineOffered(s, "gpu")).toBe(false);
    s.unlocks = [...s.unlocks, GPU_SKILL];
    expect(lineOffered(s, "gpu")).toBe(true);
    const cus = addCustomer(s, "Ada Lang", "hobbyDev");
    const two = { ...sizeSpec("gpu", 1, 2012) }, one = sizeSpec("gpu", 0, 2012);
    const first = ok(provisionService(s, cus, "gpu", { label: "Train", spec: two }));
    expect(workloadsOf(s, first)[0]).toMatchObject({ deviceId: id, gpus: 2 });
    expect(cardsFree(s, s.devices.find((d) => d.id === id)!)).toBe(2);
    ok(provisionService(s, cus, "gpu", { label: "Render", spec: one }));
    ok(provisionService(s, cus, "gpu", { label: "Infer", spec: one }));
    expect(lineOffered(s, "gpu")).toBe(false);
    expect(err(provisionService(s, cus, "gpu", { label: "More", spec: one }))).toBe("error.noCard");
    expect(err(provisionService(s, cus, "gpu", { label: "Big", spec: sizeSpec("gpu", 3, 2012) }))).toBe("error.noCard");
    expect(err(removePart(s, id, cardsOf(s, id)[0].id))).toBe("error.cardInUse");
  });

  it("refuses the line without its skill, offered only from 2011", () => {
    const s = rich(2010);
    expect(err(research(s, GPU_SKILL))).toBe("error.notYet");
    const later = rich(2012);
    later.knowHow = 10_000;
    later.unlocks = [...later.unlocks, "products", "monitoring"];
    expect(err(research(later, GPU_SKILL))).toBe("ok");
  });
});

describe("GPU news and old saves", () => {
  it("announces each card and the two demand waves on their day", () => {
    const keys = (year: number) => {
      const s = newGame(1);
      skipTo(s, year);
      s.hour += 9;
      return newsTick(s).map((e) => e.key);
    };
    expect(keys(2007)).toContain("event.news.gpu");
    expect(keys(2025)).toContain("event.news.gpu");
    expect(keys(2017)).toEqual(expect.arrayContaining(["event.news.gpu", "event.news.gpuDemand"]));
    expect(keys(2023)).toContain("event.news.gpuDemand");
    expect(keys(2019)).not.toContain("event.news.gpuDemand");
  });

  it("gives a GPU server saved without cards the cards of its preset", () => {
    const s = rich(2012), id = gpuServer(s);
    const d = s.devices.find((x) => x.id === id)!;
    d.components = d.components.filter((c) => c.kind !== "gpu");
    const old = JSON.parse(serialize(s));
    old.version = 2;
    const loaded = deserialize(JSON.stringify(old)).devices.find((x) => x.id === id)!;
    expect(loaded.components.filter((c) => c.kind === "gpu")).toMatchObject(Array(4).fill({ size: 2010, failedAt: null }));
    expect(new Set(loaded.components.map((c) => c.id)).size).toBe(loaded.components.length);
    expect(deserialize(serialize(deserialize(JSON.stringify(old)))).devices.find((x) => x.id === id)!.components.filter((c) => c.kind === "gpu")).toHaveLength(4);
  });

  it("keeps the cards a player took out of a current save", () => {
    const s = rich(2012), id = gpuServer(s);
    const d = s.devices.find((x) => x.id === id)!;
    d.components = d.components.filter((c) => c.kind !== "gpu");
    const loaded = deserialize(serialize(s));
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.devices.find((x) => x.id === id)!.components.some((c) => c.kind === "gpu")).toBe(false);
  });
});
