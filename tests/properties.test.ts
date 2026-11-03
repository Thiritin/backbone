import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { listingById, listingsIn, REFIT, rentFor, UPKEEP_PER_SECTION } from "../src/sim/20-world/properties";
import { ownAddress } from "../src/sim/30-customers/addresses";
import { visibleCandidates } from "../src/sim/47-staff/staff";
import type { GameState } from "../src/sim/50-state";
import { desks, officeAddress, whoIsIn } from "../src/sim/60-infra/properties";
import { tick } from "../src/sim/88-tick/tick";
import { buyBuilding, freeSections, giveNotice, refitSection, rentSection } from "../src/sim/90-actions/properties";
import { hire } from "../src/sim/90-actions/staff";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame, withDomainMail } from "./fixtures";

const SEED = 7;
const at = (y: number, m: number, d = 1, h = 0) => hourOf(new Date(Date.UTC(y, m - 1, d, h)));
const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
// Jumps to the hour before a month start and ticks into it, so only the monthly billing runs.
const monthStart = (s: GameState, y: number, m: number) => { s.hour = at(y, m) - 1; tick(s); };
const fresh = () => { const s = newGame(SEED); s.cash = 2_000_000; return s; };
const rich = () => { const s = fresh(); s.hour = at(2005, 3, 10, 10); return s; };
const gallus = listingById("gallushof")!;
const rentFirst = (s: GameState, id = "gallushof") => {
  const r = rentSection(s, id, freeSections(s, listingById(id)!)[0]);
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const ledger = (s: GameState, key: string) => s.ledger.filter((e) => e.key === key);

describe("properties", () => {
  it("starts in the basement at the fixed address", () => {
    const s = newGame(SEED);
    expect(s.properties).toHaveLength(1);
    expect(s.properties[0]).toMatchObject({ kind: "basement", locationId: "loc1", sections: [] });
    expect(officeAddress(s)).toEqual({ street: "Kellerweg 3", zip: "60311", city: "Frankfurt am Main" });
    expect(desks(s)).toBe(0);
    expect(listingsIn("Frankfurt", 2005).length).toBeGreaterThanOrEqual(4);
  });

  it("bills the deposit on renting and the rent at each month start", () => {
    const s = rich(), cash = s.cash, rent = rentFor(gallus, 2005);
    const id = rentFirst(s);
    expect(s.cash).toBe(cash - 3 * rent);
    expect(s.properties.find((p) => p.id === id)).toMatchObject({ kind: "office", deposit: 3 * rent });
    const loc = s.locations.find((l) => l.id === s.properties.find((p) => p.id === id)!.locationId);
    expect(loc).toMatchObject({ space: "office", positions: 0, dc: null });
    monthStart(s, 2005, 4);
    expect(ledger(s, "ledger.officeRent").map((e) => e.amount)).toEqual([-rent]);
    expect(desks(s)).toBe(4);
  });

  it("ends the rent three months after notice and returns the deposit", () => {
    const s = rich(), rent = rentFor(gallus, 2005), id = rentFirst(s);
    expect(giveNotice(s, id).ok).toBe(true);
    for (const m of [4, 5, 6, 7, 8]) monthStart(s, 2005, m);
    expect(ledger(s, "ledger.officeRent")).toHaveLength(3);
    expect(ledger(s, "ledger.officeDepositBack").map((e) => e.amount)).toEqual([3 * rent]);
    expect(s.properties.map((p) => p.kind)).toEqual(["basement"]);
  });

  it("buying stops the rent, returns the deposit and bills upkeep", () => {
    const s = rich(), id = rentFirst(s);
    expect(buyBuilding(s, "gallushof").ok).toBe(true);
    const p = s.properties.find((x) => x.id === id)!;
    expect(p.kind).toBe("own");
    expect(ledger(s, "ledger.officeDepositBack")).toHaveLength(1);
    monthStart(s, 2005, 4);
    expect(ledger(s, "ledger.officeRent")).toHaveLength(0);
    expect(ledger(s, "ledger.upkeep").map((e) => e.amount)).toEqual([-UPKEEP_PER_SECTION * p.sections.length]);
    expect(buyBuilding(s, "zeilwerk")).toEqual({ ok: false, error: "error.buildingNotForSale" });
  });

  it("a refit blocks the section for its days and a server room makes an office zone", () => {
    const s = rich(), id = rentFirst(s), p = s.properties.find((x) => x.id === id)!, sec = p.sections[0].id;
    expect(refitSection(s, id, sec, "servers").ok).toBe(true);
    expect(desks(s)).toBe(0);
    const loc = s.locations.find((l) => l.id === p.locationId)!;
    expect(loc).toMatchObject({ space: "office", positions: 4, dc: null, az: "fra2" });
    expect(refitSection(s, id, sec, "desks")).toEqual({ ok: false, error: "error.refitting" });
    s.hour += 24 * REFIT.servers.days;
    expect(refitSection(s, id, sec, "desks").ok).toBe(true);
    expect(loc.positions).toBe(0);
    s.hour += 24 * REFIT.desks.days;
    expect(desks(s)).toBe(4);
  });

  it("the address follows the office", () => {
    const s = rich();
    rentFirst(s);
    expect(officeAddress(s)).toEqual({ street: gallus.street, zip: gallus.zip, city: gallus.city });
    expect(ownAddress(s).street).toBe(gallus.street);
  });

  it("hiring needs a free desk, and the desk is assigned", () => {
    const s = withDomainMail(fresh());
    const pick = () => visibleCandidates(s)[0].id;
    expect(hire(s, pick())).toEqual({ ok: false, error: "error.noFreeDesk" });
    const id = rentFirst(s);
    for (let i = 0; i < 4; i++) expect(hire(s, pick()).ok).toBe(true);
    expect(s.staff.map((e) => e.desk?.index)).toEqual([0, 1, 2, 3]);
    expect(s.staff.every((e) => e.desk?.propertyId === id)).toBe(true);
    expect(hire(s, pick())).toEqual({ ok: false, error: "error.noFreeDesk" });
  });

  it("whoIsIn keeps office hours on weekdays", () => {
    const s = withDomainMail(fresh()), id = rentFirst(s);
    expect(hire(s, visibleCandidates(s).find((c) => c.role !== "technician")!.id).ok).toBe(true);
    const monday = at(2005, 1, 3);
    expect(whoIsIn(s, id, monday + 8)).toHaveLength(0);
    expect(whoIsIn(s, id, monday + 9)).toHaveLength(1);
    expect(whoIsIn(s, id, monday + 18)).toHaveLength(0);
    expect(whoIsIn(s, id, at(2005, 1, 8, 12))).toHaveLength(0);
  });

  it("an old save loads with the basement property and staff without desks", () => {
    const s = rich(), data = JSON.parse(serialize(s));
    delete data.properties;
    data.staff = [{ ...s.candidates[0], id: "emp1", hiredAt: 0, assignment: "queue", location: null, trained: [], plan: [], training: null, busyUntil: 0, raise: null, nextRaiseAt: 0, refusedAt: null, team: "office", worked: 0 }];
    const back = deserialize(JSON.stringify(data));
    expect(back.properties).toEqual([expect.objectContaining({ kind: "basement", locationId: "loc1" })]);
    expect(back.staff[0].desk).toBeNull();
  });

  it("runs a month of ticks with an office", () => {
    const s = rich();
    rentFirst(s);
    runTo(s, at(2005, 4, 1, 2));
    expect(ledger(s, "ledger.officeRent")).toHaveLength(1);
  });
});
