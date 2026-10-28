import { describe, expect, it } from "vitest";
import { setPower } from "../src/sim/90-actions/hardware";
import { startGame } from "../src/sim/90-actions/start";
import { usageOf } from "../src/sim/60-infra/usage";

const dev = (s: ReturnType<typeof startGame>, id: string) => s.devices.find((d) => d.id === id)!;

describe("utilization", () => {
  it("shows the friends' load on the server, its switch, rack and location", () => {
    const s = startGame(1);
    const u = usageOf(s, [dev(s, "dev3")]);
    for (const k of ["cpu", "ram", "disk", "net"] as const) expect(u[k]).toBeGreaterThan(0);
    for (const k of ["cpu", "ram", "disk", "net"] as const) expect(u[k]).toBeLessThanOrEqual(1);
    expect(usageOf(s, s.devices.filter((d) => d.rackId === dev(s, "dev3").rackId))).toEqual(u);
    expect(usageOf(s, [dev(s, "dev4")]).net).toBeGreaterThan(0);
  });

  it("changes over the day and goes dark when the server is off", () => {
    const s = startGame(1);
    const day = Array.from({ length: 24 }, (_, h) => { s.hour = h; return usageOf(s, [dev(s, "dev3")]).cpu; });
    expect(Math.max(...day)).toBeGreaterThan(Math.min(...day));
    setPower(s, "dev3", false);
    expect(usageOf(s, [dev(s, "dev3")])).toEqual({ cpu: 0, ram: 0, disk: 0, net: 0 });
  });
});
