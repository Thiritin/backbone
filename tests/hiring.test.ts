import { describe, expect, it } from "vitest";
import { monthlyBurn, runwayMonths } from "../src/sim/46-finance/finance";
import { monthlyPay, visibleCandidates } from "../src/sim/47-staff/staff";
import { newGame } from "../src/sim/50-state";
import { hire } from "../src/sim/90-actions/staff";

describe("hiring part-time", () => {
  it("hires at the chosen hours and rejects hours outside the work-hour steps", () => {
    const s = newGame(3);
    const [a, b] = visibleCandidates(s);
    expect(hire(s, a.id, 5 as never)).toMatchObject({ ok: false });
    const r = hire(s, a.id, 2) as { ok: true; id: string };
    expect(r.ok).toBe(true);
    expect(s.staff.find((e) => e.id === r.id)!.hours).toBe(2);
    const full = (hire(s, b.id) as { id: string }).id;
    expect(s.staff.find((e) => e.id === full)!.hours).toBe(8);
  });

  it("shortens the runway by the hire's monthly pay at those hours", () => {
    const s = newGame(4);
    const [a, b] = visibleCandidates(s);
    hire(s, a.id, 2);
    const pay = monthlyPay(s.staff[0]), next = monthlyPay({ salary: b.salary, hours: 4 });
    // A €600 loss in January; by mid-February it averages €200 a month over the last three full months.
    s.ledger.push({ hour: s.hour + 10, category: "hardware", key: "ledger.hardware", params: {}, amount: -600 });
    s.hour += 24 * 45;
    expect(monthlyBurn(s)).toBeCloseTo(200 + pay, 6);
    expect(runwayMonths(s, next)).toBeCloseTo(s.cash / (200 + pay + next), 6);
    expect(runwayMonths(s, next)).toBeLessThan(runwayMonths(s));
  });
});
