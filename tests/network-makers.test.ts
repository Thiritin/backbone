import { describe, expect, it } from "vitest";
import { brandsOf, MODELS, modelById, NET_LIFE, shopModels, type DeviceModel } from "../src/sim/10-catalog/hardware";
import { newGame, type GameState } from "../src/sim/50-state";
import { hourOf } from "../src/sim/00-core/time";
import { buyDevice, withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const copper = (m: DeviceModel) => m.ports.filter((p) => p.media === "rj45" && p.gbit === 1).length;

describe("switch and firewall makers", () => {
  it("sells an 8, a 24 and a 48 port copper switch every year, one of them under 500 euro", () => {
    for (let y = 2005; y <= 2032; y++) {
      const sw = shopModels(y).filter((m) => m.kind === "switch");
      for (const n of [8, 24, 48]) expect(sw.some((m) => copper(m) === n), `${y}: ${n} ports`).toBe(true);
      expect(sw.some((m) => copper(m) >= 8 && m.price < 500), `${y}: cheap`).toBe(true);
      expect(sw.some((m) => m.ports.some((p) => p.gbit >= 10) && m.layer === 3), `${y}: L3 with 10G`).toBe(y >= 2008);
    }
  });

  it("gives every switch and firewall one maker, its years on sale and support, and a name of its own", () => {
    const net = MODELS.filter((m) => m.kind === "switch" || m.kind === "firewall");
    expect(net.length).toBeGreaterThan(130);
    for (const m of net) {
      expect(m.brand, m.id).toBeDefined();
      expect(brandsOf(m), m.id).toEqual([m.brand]);
      expect(NET_LIFE[m.brand!], m.id).toBeDefined();
      expect(m.supportYears, m.id).toBe(NET_LIFE[m.brand!].support);
      expect(m.name, m.id).not.toMatch(/^L[23] switch|^Firewall/);
    }
    expect(new Set(net.map((m) => m.id)).size).toBe(net.length);
    expect(new Set(net.map((m) => m.brand))).toEqual(new Set(["Sysko", "Junipurr", "Aristotle", "Hewlett-Packet", "MicroTick", "Nettgear", "Ubiquitea", "D-Lunk", "Fortinope", "Pablo Alto", "Netgoat", "SoPhosphate"]));
    expect(modelById("hp-2510-24").supportYears).toBe(99);
    expect(modelById("dl-dgs1008d")).toMatchObject({ until: 2009, supportYears: 2 });
    expect(modelById("mt-crs504")).toMatchObject({ price: 650, layer: 2 });
  });

  it("keeps the old generic ids as Sysko models with their ports", () => {
    expect(modelById("sw-8")).toMatchObject({ name: "Catalust 2960-8TC", brand: "Sysko", price: 60, watts: 8 });
    expect(modelById("sw-48").ports).toHaveLength(52);
    expect(modelById("fw-40g")).toMatchObject({ name: "Firepowder 4120", throughputGbit: 40, ipsGbit: 12 });
    const s: GameState = { ...withServer(newGame(1)), cash: 1e6, hour: hourOf(new Date(Date.UTC(2010, 0, 1))) };
    ok(buyDevice(s, "ng-gs108t", "Nettgear", 1, "loc1"));
    expect(buyDevice(s, "ng-gs108t", "Sysko", 1, "loc1")).toEqual({ ok: false, error: "error.unknownBrand" });
    expect(buyDevice(s, "ub-usw-lite-8", "Ubiquitea", 1, "loc1").ok).toBe(false);
  });

  it("lists inspection throughput and sessions on firewalls and sells a small one every year", () => {
    for (const m of MODELS.filter((x) => x.kind === "firewall")) {
      expect(m.ipsGbit, m.id).toBeLessThanOrEqual(m.throughputGbit!);
      expect(m.sessions, m.id).toBeGreaterThan(0);
    }
    for (let y = 2005; y <= 2032; y++) {
      const fw = shopModels(y).filter((m) => m.kind === "firewall");
      expect(fw.some((m) => m.price < 1000), `${y}`).toBe(true);
      expect(fw.some((m) => m.throughputGbit! >= (y < 2011 ? 1 : y < 2017 ? 10 : 40)), `${y}`).toBe(true);
    }
    expect(modelById("pa-7500")).toMatchObject({ brand: "Pablo Alto", ipsGbit: 1000 });
  });
});
