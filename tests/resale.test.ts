import { describe, expect, it } from "vitest";
import { SELL_CAP, SELL_FINAL } from "../src/sim/10-catalog/used";
import { newGame, type GameState } from "../src/sim/50-state";
import { deviceValue, resaleValue } from "../src/sim/60-infra/status";
import { installPart, removePart, sellDevice } from "../src/sim/90-actions/hardware";
import { buyDevice, withServer } from "./fixtures";

const rich = (): GameState => ({ ...withServer(newGame(1)), cash: 10_000_000 });
const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};

describe("resale", () => {
  it("is worth less than the shop price right after buying", () => {
    const s = rich();
    expect(resaleValue(s, 1000, s.hour)).toBe(900);
    expect(SELL_CAP).toBeLessThanOrEqual(1);
    expect(SELL_FINAL[1]).toBeLessThanOrEqual(1);
  });

  it("pays no more for a stripped server and its parts than for the whole server", () => {
    const s = rich();
    const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    const whole = deviceValue(s, s.devices.find((d) => d.id === id)!);
    const before = new Set(s.devices.map((d) => d.id));
    for (const c of [...s.devices.find((d) => d.id === id)!.components]) removePart(s, id, c.id);
    const spares = s.devices.filter((d) => !before.has(d.id)).map((d) => d.id);
    expect(spares.length).toBeGreaterThan(0);
    const cash = s.cash;
    for (const x of [id, ...spares]) ok(sellDevice(s, x));
    expect(s.cash - cash).toBeLessThanOrEqual(whole);
  });

  it("does not raise a server's price by taking a part out and putting it back", () => {
    const s = rich();
    const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    const d = s.devices.find((x) => x.id === id)!, price = d.price;
    const ram = d.components.find((c) => c.kind === "ram")!;
    ok(removePart(s, id, ram.id));
    const spare = s.devices.find((x) => x.model === "part-ram")!;
    ok(installPart(s, id, spare.id));
    expect(d.price).toBeLessThanOrEqual(price);
  });
});
