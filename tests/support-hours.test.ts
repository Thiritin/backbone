import { describe, expect, it, vi } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { addHoursOn, hoursOn, isWorkHour } from "../src/sim/00-core/workhours";
import type { Profile } from "../src/sim/30-customers/customers";
import { createTicket } from "../src/sim/40-support/tickets";
import { newGame, type GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { deserialize, serialize } from "../src/sim/91-save/save";

const down = vi.hoisted(() => new Set<string>());
vi.mock("../src/sim/40-support/status", () => ({ serviceOnline: (_s: unknown, id: string) => !down.has(id) }));

// 2005-01-07 is a Friday.
const at = (day: number, hour: number) => hourOf(new Date(Date.UTC(2005, 0, day, hour)));
const FRI = 7, MON = 10, TUE = 11, WED = 12;

function customerAt(hour: number, profile: Profile, seed = 1) {
  const s = newGame(seed);
  s.hour = hour;
  const cus = addCustomer(s, "Jonas Weber", profile);
  const svc = addService(s, cus, "vps", "VPS 512", 0.01, "hour");
  const c = () => s.customers.find((x) => x.id === cus)!;
  return { s, cus, svc, c };
}
const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };

describe("business hours", () => {
  it("adds and counts business hours over a weekend", () => {
    expect(isWorkHour(at(FRI, 16))).toBe(true);
    expect(addHoursOn("business", at(FRI, 16), 8)).toBe(at(MON, 16));
    expect(hoursOn("business", at(FRI, 16), at(MON, 16))).toBe(8);
    expect(hoursOn("business", at(FRI, 18), at(WED, 9))).toBe(16);
    expect(hoursOn("business", at(FRI, 18), at(FRI, 18) + 3 * 168)).toBe(3 * 40);
    expect(addHoursOn("always", at(FRI, 16), 4)).toBe(at(FRI, 20));
  });

  it("makes a ticket opened Friday 16:00 with one business day due Monday 16:00", () => {
    const { s, c } = customerAt(at(FRI, 16), "smallBiz");
    expect(createTicket(s, c(), "howTo").dueAt).toBe(at(MON, 16));
  });

  it("gives an online shop four hours around the clock", () => {
    const { s, c } = customerAt(at(FRI, 22), "onlineShop");
    expect(createTicket(s, c(), "howTo").dueAt).toBe(at(8, 2));
  });
});

describe("customer clocks", () => {
  it("lets a private customer's weekend outage do no damage before Wednesday", () => {
    const { s, svc, c } = customerAt(at(FRI, 18), "private");
    down.add(svc);
    runTo(s, at(TUE, 23));
    expect(c().happiness).toBe(70);
    expect(s.tickets.filter((t) => t.kind === "outage")).toHaveLength(0);
    runTo(s, at(WED, 12));
    down.clear();
    expect(c().happiness).toBe(70 - 4);
  });

  it("hurts an online shop from the first hour of an outage", () => {
    const { s, svc, c } = customerAt(at(FRI, 18), "onlineShop");
    down.add(svc);
    runTo(s, at(FRI, 21));
    down.clear();
    expect(c().happiness).toBe(70 - 3 * 10);
  });

  it("pauses the overdue penalty at night for business-hour customers only", () => {
    const office = customerAt(at(MON, 9), "office");
    createTicket(office.s, office.c(), "howTo");
    runTo(office.s, at(TUE, 8));
    // Due 13:00; overdue in 14:00, 15:00 and 16:00, then nothing until morning.
    expect(office.c().happiness).toBeCloseTo(70 - 1.5 * 3, 6);

    const shop = customerAt(at(MON, 9), "onlineShop");
    createTicket(shop.s, shop.c(), "howTo");
    runTo(shop.s, at(TUE, 8));
    // Due 13:00; overdue every hour from 14:00 to Tuesday 08:00.
    expect(shop.c().happiness).toBeCloseTo(70 - 1.5 * 19, 6);
  });

  it("loads a save from before outage clocks", () => {
    const old = JSON.parse(serialize(newGame(3)));
    delete old.downSince;
    old.servicesDown = ["svc1"];
    const s = deserialize(JSON.stringify(old));
    expect(s.downSince).toEqual({});
    runTo(s, 5);
    expect(s.hour).toBe(5);
  });
});
