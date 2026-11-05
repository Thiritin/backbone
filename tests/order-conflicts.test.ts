import { describe, expect, it } from "vitest";
import type { GameState } from "../src/sim/50-state";
import { addSecondPsu, setPower, installPart, mountDevice, sellDevice, setLabel, unmountDevice, removePart } from "../src/sim/90-actions/hardware";
import { busyReason } from "../src/sim/90-actions/busy";
import { cancelWorkOrder } from "../src/sim/90-actions/work-orders";
import { startBurnin } from "../src/sim/90-actions/burnin";
import { addLocation, buyRack } from "../src/sim/90-actions/hardware";
import { buyDevice, freeFloor, newGame, settle, withServer } from "./fixtures";

type R = { ok: boolean; id?: string; error?: string };
const ok = (r: R) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: R) => (r.ok ? "ok" : r.error);
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const open = (s: GameState) => s.orders.filter((o) => !o.applied);
// A cage with an empty rack; the player stays at home, so hand work is the provider's remote hands.
const colo = () => {
  const s: GameState = { ...withServer(newGame(1)), cash: 10_000_000 };
  const loc = ok(addLocation(freeFloor(s), "equinox-fr5", "cage", 4));
  return { s, loc, rack: ok(buyRack(s, loc, "rack-42", 1)) };
};
const server = (c: ReturnType<typeof colo>, at?: number) => {
  const id = ok(buyDevice(c.s, "g1-compute", "Dwell", 1, c.loc, {}));
  if (at) { ok(mountDevice(c.s, id, c.rack, at, true)); dev(c.s, id).maintenance = null; ok(setPower(c.s, id, false)); }
  return id;
};
const ram = (c: ReturnType<typeof colo>) => ok(buyDevice(c.s, "part-ram", "Generic", 1, c.loc, { part: { kind: "ram", size: 2 } }));

describe("order conflicts", () => {
  it("refuses a second part order on a unit that has one open, and allows it once the first landed", () => {
    const c = colo(), id = server(c, 10), { s } = c;
    ok(installPart(s, id, ram(c)));
    expect(err(installPart(s, id, ram(c)))).toBe("error.busy");
    expect(err(removePart(s, id, dev(s, id).components.find((x) => x.kind === "ram")!.id))).toBe("error.busy");
    expect(busyReason(s, { deviceId: id })).toBe("error.busy");
    settle(s);
    expect(busyReason(s, { deviceId: id })).toBeNull();
    ok(installPart(s, id, ram(c)));
  });

  it("queues orders on different units side by side", () => {
    const c = colo(), a = server(c, 10), b = server(c, 14);
    ok(installPart(c.s, a, ram(c)));
    ok(installPart(c.s, b, ram(c)));
    expect(open(c.s)).toHaveLength(2);
  });

  it("refuses unmounting and selling, a second PSU and burn-in on a unit with an open order", () => {
    const c = colo(), id = server(c, 10), { s } = c;
    ok(installPart(s, id, ram(c)));
    expect(err(unmountDevice(s, id))).toBe("error.busy");
    expect(err(sellDevice(s, id))).toBe("error.busy");
    expect(err(addSecondPsu(s, id))).toBe("error.busy");
    expect(err(startBurnin(s, id, false))).toBe("error.busy");
  });

  it("refuses a mount into a slot an open order frees or occupies", () => {
    const c = colo(), a = server(c, 10), { s } = c;
    ok(unmountDevice(s, a));
    const b = server(c);
    expect(err(mountDevice(s, b, c.rack, 10))).toBe("error.busy");
    expect(busyReason(s, { rackId: c.rack, slot: 10 })).toBe("error.busy");
    const x = server(c), d = server(c);
    ok(mountDevice(s, x, c.rack, 14));
    expect(err(mountDevice(s, d, c.rack, 14))).toBe("error.busy");
    ok(mountDevice(s, d, c.rack, 18));
    expect(open(s)).toHaveLength(3);
  });

  it("leaves renames and unrelated units free while an order is open", () => {
    const c = colo(), a = server(c, 10), b = server(c, 14), { s } = c;
    ok(installPart(s, a, ram(c)));
    ok(setLabel(s, a, "web"));
    expect(err(unmountDevice(s, b))).toBe("ok");
  });

  it("frees the target when the open order is cancelled", () => {
    const c = colo(), id = server(c, 10), { s } = c;
    ok(installPart(s, id, ram(c)));
    expect(err(installPart(s, id, ram(c)))).toBe("error.busy");
    ok(cancelWorkOrder(s, open(s)[0].id));
    ok(installPart(s, id, ram(c)));
  });

  it("refuses the player's own hands on a unit with an open remote hands order", () => {
    const c = colo(), id = server(c, 10), { s } = c;
    ok(installPart(s, id, ram(c)));
    s.player = { ...s.player, at: c.loc };
    expect(err(installPart(s, id, ram(c), undefined, "self"))).toBe("error.busy");
  });
});
