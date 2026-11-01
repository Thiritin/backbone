import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { COMPONENTS } from "../src/sim/10-catalog/hardware";
import { HOURS_PER_YEAR } from "../src/sim/60-infra/status";
import { hardwarePremium } from "../src/sim/46-finance/finance";
import { type GameState } from "../src/sim/50-state";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { buyInsurance, cancelInsurance } from "../src/sim/90-actions/finance";
import { replaceComponent, type ActionResult } from "../src/sim/90-actions/hardware";
import { buyDevice, newGame } from "./fixtures";
import { withServer } from "./fixtures";

const at = (y: number, m: number, d: number) => hourOf(new Date(Date.UTC(y, m - 1, d)));
const ok = (r: ActionResult) => { expect(r).toMatchObject({ ok: true }); return (r as { id?: string }).id!; };
// Ticks from the hour before `hour` up to it, collecting events.
const tickInto = (s: GameState, hour: number): SimEvent[] => { s.hour = hour - 1; return tick(s); };
const runFor = (s: GameState, hours: number): SimEvent[] => Array.from({ length: hours }, () => tick(s)).flat();


describe("hardware insurance", () => {
  it("charges a premium on purchase and each month, and pays the part of a component that fails while insured", () => {
    const s = withServer(newGame(13));
    s.cash = 5_000;
    const premium = hardwarePremium(s);
    expect(premium).toBeGreaterThan(0);
    ok(buyInsurance(s));
    expect(s.ledger.at(-1)).toMatchObject({ category: "insurance", amount: -premium });
    expect(buyInsurance(s)).toEqual({ ok: false, error: "error.insured" });
    ok(buyDevice(s, "part-fan", "Generic", 1, "loc1"));
    runFor(s, 2);
    const fan = s.devices.find((d) => d.id === "dev3")!.components.find((c) => c.kind === "fan")!;
    fan.failedAt = s.hour;
    const before = s.cash;
    ok(replaceComponent(s, "dev3", fan.id));
    expect(s.ledger.at(-1)).toMatchObject({ category: "insurance", key: "ledger.insuranceClaim", params: { component: "fan" }, amount: 25 });
    expect(s.cash).toBe(before + 25);
    tickInto(s, at(2005, 2, 1));
    expect(s.ledger.filter((e) => e.key === "ledger.insurancePremium")).toHaveLength(2);
  });

  it("pays nothing for a failure from before the policy or after it is cancelled", () => {
    const s = withServer(newGame(14));
    s.cash = 5_000;
    ok(buyDevice(s, "part-fan", "Generic", 1, "loc1"));
    ok(buyDevice(s, "part-fan", "Generic", 1, "loc1"));
    runFor(s, 2);
    const fans = s.devices.find((d) => d.id === "dev3")!.components.filter((c) => c.kind === "fan");
    fans[0].failedAt = s.hour;
    s.hour++;
    ok(buyInsurance(s));
    ok(replaceComponent(s, "dev3", fans[0].id));
    expect(s.ledger.some((e) => e.key === "ledger.insuranceClaim")).toBe(false);
    ok(cancelInsurance(s));
    fans[1].failedAt = s.hour;
    runFor(s, 1);
    ok(replaceComponent(s, "dev3", fans[1].id));
    expect(s.ledger.some((e) => e.key === "ledger.insuranceClaim")).toBe(false);
    expect(cancelInsurance(s)).toEqual({ ok: false, error: "error.notInsured" });
  });
});

describe("insurance and wear", () => {
  it("does not pay for a part that failed after its life expectancy", () => {
    const s = withServer(newGame(16));
    s.cash = 5_000;
    ok(buyDevice(s, "part-fan", "Generic", 1, "loc1"));
    ok(buyInsurance(s));
    runFor(s, 1);
    const fan = s.devices.find((d) => d.id === "dev3")!.components.find((c) => c.kind === "fan")!;
    fan.installedAt = s.hour - (COMPONENTS.fan.life + 1) * HOURS_PER_YEAR;
    fan.failedAt = s.hour;
    ok(replaceComponent(s, "dev3", fan.id));
    expect(s.ledger.some((e) => e.key === "ledger.insuranceClaim")).toBe(false);
  });
});

