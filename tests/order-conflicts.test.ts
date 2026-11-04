import { describe, expect, it } from "vitest";
import type { GameState } from "../src/sim/50-state";
import { addSecondPsu, setPower, installPart, mountDevice, sellDevice, setLabel, unmountDevice, removePart } from "../src/sim/90-actions/hardware";
import { busyReason } from "../src/sim/90-actions/busy";
import { cancelWorkOrder } from "../src/sim/90-actions/work-orders";
import { startBurnin } from "../src/sim/90-actions/burnin";
import { buyDevice, newGame, settle, withServer } from "./fixtures";
import { mountDevice as plug } from "./plugged";

type R = { ok: boolean; id?: string; error?: string };
const ok = (r: R) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: R) => (r.ok ? "ok" : r.error);
const rich = (): GameState => ({ ...withServer(newGame(1)), cash: 10_000_000 });
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const open = (s: GameState) => s.orders.filter((o) => !o.applied);
const server = (s: GameState, at?: number) => {
  const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1", {}));
  if (at) { ok(plug(s, id, "rack2", at)); ok(setPower(s, id, false)); }
  return id;
};
const ram = (s: GameState) => ok(buyDevice(s, "part-ram", "Generic", 1, "loc1", { part: { kind: "ram", size: 2 } }));

describe("order conflicts", () => {
  it("refuses a second part order on a unit that has one open, and allows it once the first landed", () => {
    const s = rich(), id = server(s, 10);
    ok(installPart(s, id, ram(s)));
    expect(err(installPart(s, id, ram(s)))).toBe("error.busy");
    expect(err(removePart(s, id, dev(s, id).components.find((c) => c.kind === "ram")!.id))).toBe("error.busy");
    expect(busyReason(s, { deviceId: id })).toBe("error.busy");
    settle(s);
    expect(busyReason(s, { deviceId: id })).toBeNull();
    ok(installPart(s, id, ram(s)));
  });

  it("queues orders on different units side by side", () => {
    const s = rich(), a = server(s, 10), b = server(s, 14);
    ok(installPart(s, a, ram(s)));
    ok(installPart(s, b, ram(s)));
    expect(open(s)).toHaveLength(2);
  });

  it("refuses unmounting and selling, a second PSU and burn-in on a unit with an open order", () => {
    const s = rich(), id = server(s, 10);
    ok(installPart(s, id, ram(s)));
    expect(err(unmountDevice(s, id))).toBe("error.busy");
    expect(err(sellDevice(s, id))).toBe("error.busy");
    expect(err(addSecondPsu(s, id))).toBe("error.busy");
    expect(err(startBurnin(s, id, false))).toBe("error.busy");
  });

  it("refuses a mount into a slot an open order frees or occupies", () => {
    const s = rich(), a = server(s, 10);
    ok(unmountDevice(s, a));
    const b = server(s);
    expect(err(mountDevice(s, b, "rack2", 10))).toBe("error.busy");
    expect(busyReason(s, { rackId: "rack2", slot: 10 })).toBe("error.busy");
    const c = server(s), d = server(s);
    ok(mountDevice(s, c, "rack2", 14));
    expect(err(mountDevice(s, d, "rack2", 14))).toBe("error.busy");
    ok(mountDevice(s, d, "rack2", 18));
    expect(open(s)).toHaveLength(3);
  });

  it("leaves renames and unrelated units free while an order is open", () => {
    const s = rich(), a = server(s, 10), b = server(s, 14);
    ok(installPart(s, a, ram(s)));
    ok(setLabel(s, a, "web"));
    expect(err(unmountDevice(s, b))).toBe("ok");
  });

  it("frees the target when the open order is cancelled", () => {
    const s = rich(), id = server(s, 10);
    ok(installPart(s, id, ram(s)));
    expect(err(installPart(s, id, ram(s)))).toBe("error.busy");
    ok(cancelWorkOrder(s, open(s)[0].id));
    ok(installPart(s, id, ram(s)));
  });
});
