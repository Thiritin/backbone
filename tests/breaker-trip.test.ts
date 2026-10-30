import { describe, expect, it } from "vitest";
import { newGame } from "../src/sim/50-state";
import { rackPower } from "../src/sim/60-infra/status";
import { tickMinute } from "../src/sim/88-tick/tick";
import { setPower } from "../src/sim/90-actions/hardware";
import { withServer } from "./fixtures";

describe("breaker trip", () => {
  it("switches every server in an overloaded rack off and resets once they stop drawing", () => {
    const s = withServer(newGame(1));
    const rack = s.racks.find((r) => r.id === "rack2")!;
    rack.flatKw = rackPower(s, "rack2").watts / 1000 - 0.001;
    expect(rackPower(s, "rack2").tripped).toBe(true);
    const events = tickMinute(s);
    expect(events).toContainEqual({ app: "Locations", key: "event.breakerTripped", params: { rack: rack.name } });
    expect(s.devices.find((d) => d.id === "dev3")!.on).toBe(false);
    expect(s.devices.find((d) => d.id === "dev4")!.on).toBe(true);
    expect(rackPower(s, "rack2").tripped).toBe(false);
    expect(tickMinute(s).some((e) => e.key === "event.breakerTripped")).toBe(false);
  });

  it("trips again when a server boots into a rack without headroom", () => {
    const s = withServer(newGame(1));
    s.racks.find((r) => r.id === "rack2")!.flatKw = 0.001;
    tickMinute(s);
    expect(setPower(s, "dev3", true).ok).toBe(true);
    expect(tickMinute(s).some((e) => e.key === "event.breakerTripped")).toBe(true);
    expect(s.devices.find((d) => d.id === "dev3")!.on).toBe(false);
  });
});
