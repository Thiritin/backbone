import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { skuById, SMT_SHARE, topBoost } from "../src/sim/10-catalog/cpus";
import { componentParts, modelById } from "../src/sim/10-catalog/hardware";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { device, deviceDefaults, newGame, type GameState } from "../src/sim/50-state";
import { installedThreads, installedVcpu, perCoreOf } from "../src/sim/60-infra/status";
import { FAST_HAPPY, monthlyReviews, nodeBoost } from "../src/sim/85-products/products";
import type { SimEvent } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { hypervisor, withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const FRAG = { ...sizeSpec("gameServer", 0, 2005), vcpu: 1, ramGb: 2, diskGb: 10 };
const FEB = hourOf(new Date(Date.UTC(2005, 1, 1)));
// Runs the month start n times, each on the next month, so every run rolls its own dice.
const months = (s: GameState, n: number, events: SimEvent[] = []) => { for (let i = 0; i < n; i++) { s.hour = hourOf(new Date(Date.UTC(2005, 1 + i, 1))); monthlyReviews(s, events); } };

// The basement server in a cluster with a gamer's game server on it; cpu swaps the server's CPUs for another part.
function setup(cpu?: string) {
  const s: GameState = { ...withServer(newGame(1)), cash: 100_000 };
  if (cpu) {
    const m = modelById("g1-compute"), parts = componentParts(m, skuById(cpu)!.vendor, cpu);
    s.devices = s.devices.map((d) => (d.id === "dev3" ? { ...d, ...deviceDefaults(m.id, 0, parts) } : d));
  }
  const cluster = hypervisor(s, ["dev3"]);
  const gamer = addCustomer(s, "Kai Frag", "gamer");
  const game = ok(provisionService(s, gamer, "gameServer", { label: "Frag 1", spec: FRAG, clusterId: cluster, deviceId: "dev3" }));
  s.hour = FEB;
  s.services = s.services.map((v) => ({ ...v, startedAt: 0 }));
  return { s, gamer, game, happy: s.customers.find((c) => c.id === gamer)!.happiness };
}
const customer = (s: GameState, id: string) => s.customers.find((c) => c.id === id)!;

describe("threads", () => {
  it("counts a second thread as a share of a core", () => {
    const m = modelById("g3-compute"), d = { ...device("d", m.id, "Dwell", null, 0, null, "d", 0), ...deviceDefaults(m.id, 0, componentParts(m)) };
    expect(installedThreads(d)).toBe(24);
    expect(installedVcpu(d)).toBe(Math.round((12 + 12 * SMT_SHARE) * perCoreOf(d) * 100) / 100);
    const amb = { ...d, ...deviceDefaults(m.id, 0, componentParts(m, "amb", "amb-opteroni-6174")) };
    expect(installedThreads(amb)).toBe(24);
    expect(installedVcpu(amb)).toBe(Math.round(24 * perCoreOf(amb) * 100) / 100);
  });
});

describe("fast game servers", () => {
  it("knows the fastest part on sale and a node's boost clock", () => {
    expect(topBoost(2005)).toBe(3.73);
    expect(topBoost(2012)).toBe(3.8);
    expect(topBoost(2024)).toBe(4.4);
    const { s } = setup();
    expect(nodeBoost(s.devices.find((d) => d.id === "dev3")!)).toBe(3.6);
  });

  it("cheer gamers each month, write five-star reviews and make a new CPU known among gamers", () => {
    const { s, gamer, happy } = setup();
    const events: SimEvent[] = [], before = s.marketing.awareness.gamer;
    monthlyReviews(s, events);
    expect(customer(s, gamer).happiness).toBe(Math.min(100, happy + FAST_HAPPY));
    expect(s.marketing.awareness.gamer).toBeGreaterThan(before);
    months(s, 40, events);
    expect(s.marketing.reviews.filter((r) => r.reason === "fast").every((r) => r.stars === 5)).toBe(true);
    expect(s.marketing.reviews.some((r) => r.reason === "fast")).toBe(true);
  });

  it("do nothing for a slow part, and a part is new for six months only", () => {
    const { s, gamer, happy } = setup("indel-xenon-5148-lv");
    const before = s.marketing.awareness.gamer;
    monthlyReviews(s, []);
    expect(customer(s, gamer).happiness).toBe(happy);
    expect(s.marketing.awareness.gamer).toBe(before);
    const late = setup();
    late.s.hour = hourOf(new Date(Date.UTC(2005, 8, 1)));
    monthlyReviews(late.s, []);
    expect(customer(late.s, late.gamer).happiness).toBe(late.happy + FAST_HAPPY);
    expect(late.s.marketing.awareness.gamer).toBe(before);
  });
});

describe("smooth months", () => {
  it("earn a review of four stars or more, never after a slowdown or an outage in the month", () => {
    // The first month start whose dice roll a review for the unspoiled game server; the spoiled runs roll the same dice.
    const at = (k: number) => hourOf(new Date(Date.UTC(2005, 1 + k, 1)));
    const one = setup("indel-xenon-5148-lv");
    let first = 0;
    while (!one.s.marketing.reviews.length) { one.s.hour = at(first); monthlyReviews(one.s, []); if (!one.s.marketing.reviews.length) first++; }
    expect(one.s.marketing.reviews.map((r) => r.reason)).toEqual(["smooth"]);
    const roll = (spoil: (s: GameState, id: string) => void) => {
      const x = setup("indel-xenon-5148-lv");
      spoil(x.s, x.game);
      x.s.hour = at(first);
      monthlyReviews(x.s, []);
      return x.s.marketing.reviews;
    };
    expect(roll((s, id) => { s.services = s.services.map((v) => (v.id === id ? { ...v, slowedAt: at(first) - 1 } : v)); })).toEqual([]);
    expect(roll((s, id) => { s.downSince = { [id]: at(first) - 5 }; })).toEqual([]);
    expect(roll((s) => { s.services = s.services.map((v) => ({ ...v, startedAt: at(first) - 24 })); })).toEqual([]);
  });
});
