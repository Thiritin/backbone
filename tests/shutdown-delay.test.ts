import { describe, expect, it } from "vitest";
import { nowHours } from "../src/sim/00-core/time";
import { bootHours, deviceHealth, halting, haltHours, HALT_MINUTES, working } from "../src/sim/60-infra/status";
import { tickMinute } from "../src/sim/88-tick/tick";
import { reboot, setPower, shutdown } from "../src/sim/90-actions/hardware";
import { readyGame } from "./fixtures";

const dev3 = (s: ReturnType<typeof readyGame>) => s.devices.find((d) => d.id === "dev3")!;
const minutes = (s: ReturnType<typeof readyGame>, n: number) => { for (let i = 0; i < n; i++) tickMinute(s); };

describe("shutdown delay", () => {
  it("keeps a cleanly shut down server on until its OS has halted", () => {
    const s = readyGame(3);
    const halt = Math.round(haltHours(s, dev3(s)) * 60);
    expect(halt).toBeGreaterThan(HALT_MINUTES);
    expect(shutdown(s, "dev3").ok).toBe(true);
    expect(halting(dev3(s))).toBe(true);
    expect(working(s, "dev3")).toBe(false);
    expect(deviceHealth(s, "dev3").state).toBe("halting");
    minutes(s, halt - 1);
    expect(dev3(s).on).toBe(true);
    minutes(s, 1);
    expect(dev3(s).on).toBe(false);
    expect(dev3(s).haltUntil).toBeUndefined();
  });

  it("cuts a halting server off at once when the plug is pulled", () => {
    const s = readyGame(3);
    shutdown(s, "dev3");
    setPower(s, "dev3", false);
    expect(dev3(s).on).toBe(false);
    expect(dev3(s).haltUntil).toBeUndefined();
  });

  it("boots a rebooted server once the halt is through", () => {
    const s = readyGame(3);
    const halt = haltHours(s, dev3(s)), boot = bootHours(s, dev3(s));
    expect(reboot(s, "dev3").ok).toBe(true);
    expect(dev3(s).bootUntil).toBeCloseTo(nowHours(s) + halt + boot);
    minutes(s, Math.round((halt + boot) * 60) + 1);
    expect(dev3(s).on).toBe(true);
    expect(working(s, "dev3")).toBe(true);
  });
});
