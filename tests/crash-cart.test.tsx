import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FIXTURES, fixtureTiles, freeRackTiles, rackTiles, wallTiles } from "../src/sim/20-world/layout";
import { stepTile } from "../src/sim/20-world/properties";
import { deviceHealth } from "../src/sim/60-infra/status";
import { Screen } from "../src/ui/apps/console/Screen";
import { POWER_ACTION } from "../src/ui/apps/locations/power";
import { cartTarget, serversAt } from "../src/ui/world/rack/cartPlug";
import { ART } from "../src/ui/world/rooms";
import { bootedMachine, newGame, readyGame } from "./fixtures";

const key = (t: { x: number; y: number }) => `${t.x},${t.y}`;

describe("crash cart", () => {
  it("stands on a tile no rack, rack front or other fixture uses, for every basement rack count", () => {
    for (const count of [0, 1, 2]) {
      const s = newGame(7);
      const loc = s.locations.find((l) => l.space === "basement")!;
      s.racks = s.racks.filter((r) => r.locationId !== loc.id).concat(s.racks.filter((r) => r.locationId === loc.id).slice(0, count));
      const cart = FIXTURES.basement.cart, used = new Set<string>();
      const tiles = [...Object.values(rackTiles(loc, s.racks)), ...freeRackTiles(loc, s.racks), ...wallTiles(loc)];
      for (const t of tiles) { used.add(key(t)); used.add(key(stepTile(t, t.facing, 1))); }
      expect(used.has(key(cart))).toBe(false);
      const others = Object.entries(FIXTURES.basement).filter(([k]) => k !== "cart").flatMap(([, f]) => fixtureTiles(loc).filter((p) => p.x === f.x && p.y === f.y));
      expect(others.some((p) => key(p) === key(cart))).toBe(false);
    }
  });

  it("is a used object in the basement and every rented room", () => {
    expect(ART.cart.use).toBe("console");
    for (const space of ["basement", "share", "cage", "suite"] as const) expect(FIXTURES[space].cart).toBeDefined();
  });

  it("reboots a running server with Ctrl+Alt+Del", () => {
    const s = readyGame(5);
    bootedMachine(s, "dev3");
    expect(deviceHealth(s, "dev3").state).not.toBe("booting");
    expect(POWER_ACTION.reboot(s, "dev3").ok).toBe(true);
    expect(deviceHealth(s, "dev3").state).toBe("booting");
  });

  it("offers the key on a monitor with the OS up", () => {
    const s = readyGame(5);
    bootedMachine(s, "dev3");
    const d = s.devices.find((x) => x.id === "dev3")!;
    expect(renderToString(<Screen game={s} device={d} via="monitor" />)).toContain("Ctrl+Alt+Del");
    expect(renderToString(<Screen game={s} device={d} via="bmc" />)).not.toContain("Ctrl+Alt+Del");
  });

  it("plugs into the room's only server, and shows no signal when there is no choice", () => {
    const s = readyGame(5);
    const loc = s.locations.find((l) => l.space === "basement")!;
    s.player.at = loc.id;
    const ids = serversAt(s, loc.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(cartTarget(s, loc.id, null, null)).toBe(ids.length === 1 ? ids[0] : null);
    expect(cartTarget(s, loc.id, ids[0], null)).toBe(ids[0]);
    expect(cartTarget(s, loc.id, "gone", ids[ids.length - 1])).toBe(ids.length === 1 ? ids[0] : ids[ids.length - 1]);
    s.devices = s.devices.filter((d) => !ids.includes(d.id));
    expect(cartTarget(s, loc.id, null, null)).toBeNull();
  });
});
