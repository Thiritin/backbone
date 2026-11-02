import { newGame } from "./fixtures";
import { describe, expect, it } from "vitest";
import { monthlyBurn, runwayMonths } from "../src/sim/46-finance/finance";
import { monthlyPay, payOf, visibleCandidates } from "../src/sim/47-staff/staff";
import { hire } from "./fixtures";

describe("hiring part-time", () => {
  it("hires into the chosen team and rejects unknown teams", () => {
    const s = newGame(3);
    const [a, b] = visibleCandidates(s);
    expect(hire(s, a.id, "nope")).toEqual({ ok: false, error: "error.unknownTeam" });
    const r = hire(s, a.id, "parttime") as { ok: true; id: string };
    expect(r.ok).toBe(true);
    expect(s.staff.find((e) => e.id === r.id)!.team).toBe("parttime");
    const full = (hire(s, b.id) as { id: string }).id;
    expect(s.staff.find((e) => e.id === full)!.team).toBe("office");
  });

  it("shortens the runway by the hire's monthly pay at those hours", () => {
    const s = newGame(4);
    const [a, b] = visibleCandidates(s);
    hire(s, a.id, "parttime");
    const pay = payOf(s, s.staff[0]), next = monthlyPay(b.salary, 20);
    // A €600 loss in January; by mid-February it averages €200 a month over the last three full months.
    s.ledger.push({ hour: s.hour + 10, category: "hardware", key: "ledger.hardware", params: {}, amount: -600 });
    s.hour += 24 * 45;
    expect(monthlyBurn(s)).toBeCloseTo(200 + pay, 6);
    expect(runwayMonths(s, next)).toBeCloseTo(s.cash / (200 + pay + next), 6);
    expect(runwayMonths(s, next)).toBeLessThan(runwayMonths(s));
  });
});
