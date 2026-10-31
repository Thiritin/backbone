import { describe, expect, it } from "vitest";
import { fanStatus, FAN_WARN_RPM, INLET_CRIT_C, INLET_WARN_C, inletStatus, sensorRows } from "../src/sim/80-business/readouts";
import { BASEMENT_SERVER, readyGame } from "./fixtures";

const setup = () => {
  const s = readyGame(1), d = s.devices.find((x) => x.id === BASEMENT_SERVER)!;
  return { s, d, rows: () => sensorRows(s, d) };
};

describe("IPMI sensors", () => {
  it("marks a failed fan Critical and raises the inlet reading", () => {
    const { s, d, rows } = setup();
    d.on = true;
    const before = rows().find((r) => r.kind === "inlet")!.value!;
    d.components.find((c) => c.kind === "fan")!.failedAt = s.hour;
    const after = rows();
    expect(after.filter((r) => r.kind === "fan").some((r) => r.value === 0 && r.status === "critical")).toBe(true);
    expect(after.find((r) => r.kind === "inlet")!.value!).toBeGreaterThan(before);
  });

  it("switches status exactly at the thresholds", () => {
    expect(inletStatus(INLET_WARN_C - 0.1)).toBe("ok");
    expect(inletStatus(INLET_WARN_C)).toBe("warning");
    expect(inletStatus(INLET_CRIT_C - 0.1)).toBe("warning");
    expect(inletStatus(INLET_CRIT_C)).toBe("critical");
    expect(fanStatus(FAN_WARN_RPM)).toBe("ok");
    expect(fanStatus(FAN_WARN_RPM - 1)).toBe("warning");
    expect(fanStatus(0)).toBe("critical");
  });

  it("reports the power draw of a running server and none for a stopped one", () => {
    const { d, rows } = setup();
    d.on = true;
    const on = rows();
    expect(on.find((r) => r.kind === "power")!.value).toBeGreaterThan(0);
    expect(on.find((r) => r.kind === "load")!.value).toBeGreaterThan(0);
    d.on = false;
    expect(rows().find((r) => r.kind === "power")!.value).toBe(0);
    expect(rows().filter((r) => r.kind === "fan").every((r) => r.status === "ok")).toBe(true);
  });
});
