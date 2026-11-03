import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { listingById } from "../src/sim/20-world/properties";
import { rackTiles } from "../src/sim/20-world/layout";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import type { GameState } from "../src/sim/50-state";
import { figuresIn } from "../src/sim/60-infra/figures";
import { failComponents, tick } from "../src/sim/88-tick/tick";
import { addLocation, buyRack, mountDevice, type ActionResult } from "../src/sim/90-actions/hardware";
import { freeSections, rentSection } from "../src/sim/90-actions/properties";
import { setOnCall } from "../src/sim/90-actions/staff";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buyDevice, freeFloor, hire, newGame, withDomainMail, withServer } from "./fixtures";

const ok = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const MONDAY = hourOf(new Date(Date.UTC(2005, 0, 3)));
const SATURDAY_2 = MONDAY + 5 * 24 + 2;
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;

function technician(s: GameState): string {
  const c = visibleCandidates(s).find((x) => x.role === "technician")!;
  const id = ok(hire(s, c.id));
  s.staff = s.staff.map((e) => (e.id === id ? { ...e, trained: ["hardware"] } : e));
  return id;
}

// A failed fan in the basement server with a spare in storage, the tick before the given hour.
function failedFan(s: GameState, hour: number) {
  s.hour = hour - 1;
  const fan = dev(s, "dev3").components.find((c) => c.kind === "fan")!;
  s.devices = s.devices.map((d) => (d.id === "dev3" ? failComponents(s, d, [fan.id]) : d));
  ok(buyDevice(s, "part-fan", "Generic", 1, "loc1"));
}

describe("figures", () => {
  it("puts nobody in the basement unless a technician is called out there", () => {
    const s = { ...withServer(newGame(1)), cash: 100_000 };
    const id = technician(s);
    ok(setOnCall(s, id, true));
    tick(s);
    expect(figuresIn(s, "loc1", s.hour)).toEqual([]);
    failedFan(s, SATURDAY_2);
    tick(s);
    const rack = rackTiles(s.locations[0], s.racks)[dev(s, "dev3").rackId!];
    const [f, ...rest] = figuresIn(s, "loc1", s.hour);
    expect(rest).toEqual([]);
    expect(f).toMatchObject({ id, role: "technician", seated: false, busy: true, colour: null, job: { deviceId: "dev3", what: "hardware", until: s.hour + 1 } });
    expect(f.tile).toMatchObject({ x: rack.x, y: rack.y + 1, facing: "n" });
    expect(figuresIn(s, "loc1", s.hour + 1)).toEqual([]);
    expect(figuresIn(deserialize(serialize(s)), "loc1", s.hour)).toHaveLength(1);
  });

  it("shows the provider's technician at the rack only in the last hour of a remote hands job", () => {
    const s: GameState = { ...withServer(newGame(7)), cash: 100_000 };
    const loc = ok(addLocation(freeFloor(s), "equinox-fr5", "cage", 4)), rack = ok(buyRack(s, loc, "rack-42", 1));
    s.locations.find((l) => l.id === loc)!.readyAt = s.hour;
    const job = ok(mountDevice(s, ok(buyDevice(s, "sw-8", "Sysko", 1, loc)), rack, 10));
    const due = s.handsJobs[0].dueAt, at = rackTiles(s.locations.find((l) => l.id === loc)!, s.racks)[rack];
    expect(figuresIn(s, loc, Math.ceil(due) - 2)).toEqual([]);
    const [f] = figuresIn(s, loc, Math.ceil(due) - 1);
    expect(f).toMatchObject({ id: job, name: "Equinox", role: "provider", colour: "equinox", job: { rackId: rack, what: "mount", until: due } });
    expect(f.tile).toMatchObject({ x: at.x, y: at.y + (at.facing === "s" ? 1 : -1) });
    expect(figuresIn(s, loc, Math.ceil(due))).toEqual([]);
  });

  it("seats office staff at their desks in office hours", () => {
    const s = withDomainMail(newGame(7));
    s.cash = 2_000_000;
    const prop = ok(rentSection(s, "gallushof", freeSections(s, listingById("gallushof")!)[0]));
    ok(hire(s, visibleCandidates(s).find((c) => c.role !== "technician")!.id));
    const loc = s.properties.find((p) => p.id === prop)!.locationId!;
    expect(figuresIn(s, loc, MONDAY + 8)).toEqual([]);
    const [f] = figuresIn(s, loc, MONDAY + 9);
    expect(f).toMatchObject({ id: s.staff[0].id, seated: true, tile: { y: 2, facing: "s" } });
  });
});
