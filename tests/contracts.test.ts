import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { DATACENTERS, spacePrice } from "../src/sim/20-world/datacenters";
import { newGame, type GameState } from "../src/sim/50-state";
import { locationRent } from "../src/sim/60-infra/status";
import { tick, type SimEvent } from "../src/sim/88-tick/tick";
import { addLocation, buyRack, cancelContract, closeLocation, noticeEnd, revokeCancel, sellRack } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { freeFloor } from "./fixtures";

const ok = (r: ReturnType<typeof addLocation>) => { if (!r.ok) throw new Error(r.error); return r.id!; };
const err = (r: ReturnType<typeof addLocation>) => (r.ok ? "ok" : r.error);
const rich = (): GameState => freeFloor({ ...newGame(1), cash: 1_000_000 });
const runTo = (s: GameState, hour: number) => { const ev: SimEvent[] = []; while (s.hour < hour) ev.push(...tick(s)); return ev; };
const FR5 = DATACENTERS.find((d) => d.id === "equinox-fr5")!;

describe("contracts", () => {
  it("opens one per rented location and drops it with the location", () => {
    const s = rich();
    const id = ok(addLocation(s, FR5.id, "share", 2));
    expect(s.contracts).toEqual([{ id: expect.any(String), provider: "equinox", dc: FR5.id, locationId: id, space: "share", positions: 2, since: 0, monthly: spacePrice(FR5, "share", 2), endsAt: null }]);
    ok(closeLocation(s, id));
    expect(s.contracts).toEqual([]);
  });

  it("fills contracts for saves without them", () => {
    const s = rich();
    ok(addLocation(s, FR5.id, "cage", 4));
    const { contracts: _, ...old } = JSON.parse(serialize(s));
    const back = deserialize(JSON.stringify(old));
    expect(back.contracts).toMatchObject([{ dc: FR5.id, space: "cage", positions: 4, monthly: spacePrice(FR5, "cage", 4), since: 0, endsAt: null }]);
    expect(deserialize(JSON.stringify(newGame(2))).contracts).toEqual([]);
  });

  it("gives notice to the end of a month and can revoke it", () => {
    const s = rich();
    s.hour = hourOf(new Date(Date.UTC(2005, 2, 15)));
    const id = ok(addLocation(s, FR5.id, "cage", 4));
    const c = s.contracts[0];
    expect(err(revokeCancel(s, c.id))).toBe("error.notCancelled");
    expect(err(cancelContract(s, "nope"))).toBe("error.unknownContract");
    ok(cancelContract(s, c.id));
    expect(c.endsAt).toBe(hourOf(new Date(Date.UTC(2005, 6, 1))));
    expect(err(cancelContract(s, c.id))).toBe("error.alreadyCancelled");
    ok(revokeCancel(s, c.id));
    expect(c.endsAt).toBeNull();
    const r = ok(buyRack(s, id, "rack-42", 1));
    expect(err(cancelContract(s, c.id))).toBe("error.locationNotEmpty");
    ok(sellRack(s, r));
    expect(noticeEnd(s.hour, 1)).toBe(hourOf(new Date(Date.UTC(2005, 4, 1))));
  });

  it("closes the location at the end of the notice period, or rolls a month while hardware stays", () => {
    const s = rich();
    const id = ok(addLocation(s, FR5.id, "share", 2));
    const c = s.contracts[0];
    ok(cancelContract(s, c.id));
    const end = c.endsAt!;
    ok(addLocation(s, FR5.id, "cage", 4));
    const second = s.contracts[1];
    ok(cancelContract(s, second.id));
    ok(buyRack(s, second.locationId, "rack-42", 1));
    expect(runTo(s, end + 1).filter((e) => e.key.startsWith("event.contract")).map((e) => e.key)).toEqual(["event.contractEnded"]);
    expect(s.locations.some((l) => l.id === id)).toBe(false);
    expect(s.contracts.map((x) => x.id)).toEqual([second.id]);
    const rolled = runTo(s, second.endsAt! + 1).filter((e) => e.key === "event.contractRolled");
    expect(rolled).toHaveLength(1);
    expect(second.endsAt).toBe(noticeEnd(second.endsAt! - 1, 0));
    expect(s.locations.some((l) => l.id === second.locationId)).toBe(true);
  });

  it("bills the rent agreed in the contract, not the current list price", () => {
    const s = rich();
    const id = ok(addLocation(s, FR5.id, "cage", 4));
    const loc = s.locations.find((l) => l.id === id)!;
    const before = locationRent(s, loc);
    const list = FR5.positionPrice;
    FR5.positionPrice = list * 2;
    try { expect(locationRent(s, loc)).toBe(before); } finally { FR5.positionPrice = list; }
  });
});
