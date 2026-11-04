import { describe, expect, it } from "vitest";
import { plugCords } from "../src/sim/60-infra/power";
import { atServer, setPower } from "../src/sim/90-actions/hardware";
import { newGame, withServer } from "./fixtures";

function bare() {
  const s = withServer(newGame(1));
  const d = s.devices.find((x) => x.id === "dev3")!;
  d.on = false;
  plugCords(s, d, false);
  return { s, d };
}

describe("power on without a cord", () => {
  it("refuses while no supply has its cord in, and works once one is plugged", () => {
    const { s, d } = bare();
    expect(setPower(s, "dev3", true)).toEqual({ ok: false, error: "error.noPower" });
    expect(d.on).toBe(false);
    plugCords(s, d, true);
    expect(setPower(s, "dev3", true).ok).toBe(true);
    expect(d.on).toBe(true);
  });

  it("refuses the power button at the front too", () => {
    const { s, d } = bare();
    expect(atServer(s, "dev3", "power", true)).toEqual({ ok: false, error: "error.noPower" });
    plugCords(s, d, true);
    expect(atServer(s, "dev3", "power", true).ok).toBe(true);
  });
});
