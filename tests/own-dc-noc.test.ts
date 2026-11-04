import { describe, expect, it } from "vitest";
import { FIXTURES, neighbourRacks, seatsAt } from "../src/sim/20-world/layout";
import { desks, freeDesk } from "../src/sim/60-infra/properties";
import { breakerTick } from "../src/sim/60-infra/power";
import { hands } from "../src/sim/90-actions/presence";
import { setTechLocation } from "../src/sim/90-actions/staff";
import { nowHours } from "../src/sim/00-core/time";
import type { Employee } from "../src/sim/47-staff/staff";
import { at, edit, ownHall, place, type OwnHall } from "./own-dc-hall";

const WEEKDAY = at(2013, 3, 4, 10);
const tech = (e: OwnHall, id: string, location: string | null = null): Employee => {
  const t: Employee = { id, name: id, role: "technician", skill: 50, talent: 50, salary: 3000, hiredAt: 0, assignment: "queue", location, trained: [], plan: [], training: null, busyUntil: 0, raise: null, nextRaiseAt: 1e9, refusedAt: null, team: e.s.teams[0].id, worked: 0, desk: null };
  e.s.staff.push(t);
  return t;
};
const nocDeskId = (e: OwnHall) => e.hall().items.find((i) => i.kind === "nocdesk")!.id;
const trip = (e: OwnHall) => Object.assign(e.s.locations.find((l) => l.id === e.hallId)!, { tripped: true, trippedAt: nowHours(e.s) });
const minutesLater = (e: OwnHall, m: number) => { e.s.hour += Math.floor(m / 60); e.s.minute = m % 60; };

describe("own datacenter: NOC seats", () => {
  it("counts the starting desk's three seats and a new desk's two", () => {
    const e = ownHall();
    const base = desks(e.s);
    place(e, { kind: "nocdesk", area: "hall", x: 6, y: 3, facing: "s" });
    expect(desks(e.s) - base).toBe(2);
  });

  it("fills office desks before hall seats", () => {
    const e = ownHall();
    expect(freeDesk(e.s)?.sectionId.startsWith("noc:") ?? true).toBe(true);
    expect(freeDesk(e.s, e.propertyId)?.sectionId).toBe(`noc:${nocDeskId(e)}`);
  });

  it("fails the third technician assigned to a hall with two free seats", () => {
    const e = ownHall();
    e.hall().items.find((i) => i.kind === "nocdesk")!.price = 3000; // two seats
    const ts = ["a", "b", "c"].map((id) => tech(e, id));
    expect(ts.map((t) => setTechLocation(e.s, t.id, e.hallId).ok)).toEqual([true, true, false]);
    expect(setTechLocation(e.s, "c", e.hallId)).toMatchObject({ error: "error.noFreeDesk" });
  });

  it("keeps a desk with a seated technician", () => {
    const e = ownHall();
    place(e, { kind: "nocdesk", area: "hall", x: 6, y: 3, facing: "s" });
    const extra = e.hall().items.filter((i) => i.kind === "nocdesk").at(-1)!.id;
    tech(e, "a");
    e.s.staff[0].desk = { propertyId: e.propertyId, sectionId: `noc:${extra}`, index: 0 };
    expect(edit(e, { remove: [`item:${extra}`] })).toMatchObject({ ok: false, error: "error.locked" });
  });

  it("lists the player's seat first in every location type", () => {
    const e = ownHall();
    expect(seatsAt(e.s, e.s.locations[0])[0]).toMatchObject({ sectionId: "desk" });
    const hall = e.s.locations.find((l) => l.id === e.hallId)!;
    expect(seatsAt(e.s, hall)[0].sectionId).toBe(`noc:${nocDeskId(e)}`);
    expect(seatsAt(e.s, hall)).toHaveLength(3);
    for (const space of ["share", "cage"] as const) expect(seatsAt(e.s, { ...hall, space })[0]).toMatchObject({ sectionId: "terminal" });
  });
});

describe("own datacenter: hall response", () => {
  it("resets a trip after 30 minutes with a technician on shift", () => {
    const e = ownHall();
    e.s.hour = WEEKDAY;
    setTechLocation(e.s, tech(e, "a").id, e.hallId);
    trip(e);
    minutesLater(e, 29);
    breakerTick(e.s);
    expect(e.s.locations.find((l) => l.id === e.hallId)!.tripped).toBe(true);
    minutesLater(e, 30);
    expect(breakerTick(e.s).map((x) => x.key)).toContain("event.hallBreakerReset");
    expect(e.s.locations.find((l) => l.id === e.hallId)!.tripped).toBe(false);
  });

  it("resets after 10 minutes with a wall screen", () => {
    const e = ownHall();
    e.s.hour = WEEKDAY;
    place(e, { kind: "noc", x: 0, y: 0, facing: "n" });
    place(e, { kind: "screen", area: "noc", x: 0, y: 1, facing: "e" });
    setTechLocation(e.s, tech(e, "a").id, e.hallId);
    trip(e);
    minutesLater(e, 10);
    breakerTick(e.s);
    expect(e.s.locations.find((l) => l.id === e.hallId)!.tripped).toBe(false);
  });

  it("stays tripped with nobody on shift", () => {
    const e = ownHall();
    e.s.hour = WEEKDAY;
    trip(e);
    minutesLater(e, 55);
    breakerTick(e.s);
    expect(e.s.locations.find((l) => l.id === e.hallId)!.tripped).toBe(true);
  });
});

describe("own datacenter: hands and fixtures", () => {
  it("is remote in a staffed hall and none in an unstaffed one", () => {
    const e = ownHall();
    e.s.hour = WEEKDAY;
    expect(hands(e.s, e.hallId)).toBe("none");
    setTechLocation(e.s, tech(e, "a").id, e.hallId);
    expect(hands(e.s, e.hallId)).toBe("remote");
  });

  it("puts a terminal by the entry off every rack tile", () => {
    const e = ownHall();
    const hall = e.s.locations[0];
    for (const space of ["share", "cage"] as const) {
      const f = FIXTURES[space].terminal, loc = { ...hall, space, positions: 6 };
      expect(f).toBeDefined();
      expect(neighbourRacks(loc).some((t) => t.x === f.x && t.y === f.y)).toBe(false);
    }
  });
});
