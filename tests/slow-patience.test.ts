import { newGame } from "./fixtures";
import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import type { Profile } from "../src/sim/30-customers/customers";
import { slowed } from "../src/sim/40-support/tickets";
import { addCustomer, addService } from "../src/sim/90-actions/customers";

// 2005-01-10 is a Monday.
const MON = hourOf(new Date(Date.UTC(2005, 0, 10, 0)));

// Hourly happiness lost by a customer whose service runs 30% slow for 24 hours from Monday 00:00.
function slowDay(profile: Profile): number[] {
  const s = newGame(1);
  s.hour = MON;
  const cus = addCustomer(s, "Jonas Weber", profile), svc = addService(s, cus, "webHosting", "Web S", 0.01, "hour");
  const c = () => s.customers.find((x) => x.id === cus)!;
  c().happiness = 100;
  const lost: number[] = [];
  for (let h = 0; h < 24; h++, s.hour++) {
    const before = c().happiness;
    slowed(s, c(), svc, 0.3);
    lost.push(before - c().happiness);
  }
  return lost;
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("slowdown patience", () => {
  it("costs a private customer under a tenth of what it costs an office", () => {
    const office = sum(slowDay("office")), priv = sum(slowDay("private"));
    expect(office).toBeGreaterThan(0);
    expect(priv).toBeLessThan(office / 10);
  });

  it("costs an office more per hour the longer it lasts", () => {
    const office = slowDay("office");
    // 09:00 and 17:00 both have the whole office looking.
    expect(office[17]).toBeGreaterThan(office[9] * 1.3);
    expect(office[3]).toBeLessThan(office[9] / 10);
  });

  it("starts the ramp over after a quiet hour", () => {
    const s = newGame(1);
    s.hour = MON + 9;
    const cus = addCustomer(s, "Jonas Weber", "office"), svc = addService(s, cus, "webHosting", "Web S", 0.01, "hour");
    const run = () => s.services.find((v) => v.id === svc)!.slowRun!;
    const c = () => s.customers.find((x) => x.id === cus)!;
    slowed(s, c(), svc, 0.3);
    s.hour++;
    slowed(s, c(), svc, 0.3);
    expect(run().since).toBe(MON + 9);
    s.hour += 2;
    slowed(s, c(), svc, 0.3);
    expect(run()).toEqual({ since: MON + 12, last: MON + 12 });
  });
});
