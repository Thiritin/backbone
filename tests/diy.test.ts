import { describe, expect, it } from "vitest";
import { rand } from "../src/sim/00-core/rng";
import { DATACENTERS } from "../src/sim/20-world/datacenters";
import { newGame, type GameState } from "../src/sim/50-state";
import { BOOKED_HOURS, FRIEND_FEE, handWork } from "../src/sim/60-infra/handwork";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { addLocation, buyRack, installPart, pullPower, setPower } from "../src/sim/90-actions/hardware";
import { buyDevice, skipTo, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

type R = { ok: boolean; id?: string; error?: string };
const ok = (r: R) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: R) => (r.ok ? "ok" : r.error);
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;

// A powered-off server in a rented rack at the datacenter, with a stick of RAM in storage beside it.
function setup(dcId: string) {
  const s: GameState = { ...withServer(newGame(1)), cash: 10_000_000 };
  const loc = ok(addLocation(s, dcId, "positions", 1));
  s.locations.find((l) => l.id === loc)!.readyAt = 0;
  const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, loc, { bare: true }));
  ok(mountDevice(s, id, ok(buyRack(s, loc, "rack-42", 1)), 1));
  ok(setPower(s, id, false));
  return { s, loc, id };
}
const stick = (s: GameState, loc: string) => ok(buyDevice(s, "part-ram", "Generic", 1, loc, { part: { kind: "ram", size: 2 } }));
// Installs are 30 minutes of work; the first seed value below rolls a mishap and the second does not.
const rolls = (hit: boolean) => { for (let x = 1; ; x++) if (rand({ s: x }) < 0.1 === hit) return x; };

describe("hand work options", () => {
  it("prices the drive by distance from the home city", () => {
    const at = (dc: string) => { const { s, loc } = setup(dc); return handWork(s, loc)!; };
    expect(at("interaction-fra").self).toMatchObject({ wait: 1, fee: 20, travel: 1 });
    expect(at("interaction-muc").self).toMatchObject({ wait: 4, fee: 90, travel: 4 });
    expect(at("ironmolehill-ams").self).toMatchObject({ wait: 9, fee: 250, travel: 9 });
    expect(at("interaction-fra").friend).toMatchObject({ wait: 1, fee: FRIEND_FEE, left: 3 });
    expect(at("interaction-fra").hands).toMatchObject({ perHour: 120, wait: 2 });
  });

  it("is not offered overseas", () => {
    const { s, loc, id } = setup("digitalreality-ash");
    const w = handWork(s, loc)!;
    expect(w.self).toBeNull();
    expect(w.friend).toBeNull();
    const part = stick(s, loc);
    expect(err(installPart(s, id, part, undefined, "self"))).toBe("error.tooFar");
    expect(err(installPart(s, id, part, undefined, "friend"))).toBe("error.tooFar");
    expect(dev(s, id).maintenance).toBeNull();
  });

  it("has no options in the basement", () => {
    expect(handWork(newGame(1), "loc1")).toBeNull();
  });

  it("marks the premium room of each city with a rival as a booked visit", () => {
    for (const city of new Set(DATACENTERS.map((d) => d.city))) {
      const rooms = DATACENTERS.filter((d) => d.city === city), top = Math.max(...rooms.map((d) => d.positionPrice));
      expect(rooms.filter((d) => d.visitBooking).map((d) => d.positionPrice)).toEqual(rooms.length > 1 ? [top] : []);
    }
  });

  it("adds a day to a booked visit", () => {
    const { s, loc, id } = setup("equinox-fr5");
    expect(handWork(s, loc)!.self!.wait).toBe(1 + BOOKED_HOURS);
    ok(installPart(s, id, stick(s, loc), undefined, "self"));
    expect(dev(s, id).maintenance!.doneAt).toBe(s.hour + BOOKED_HOURS + 1 + 0.5);
  });
});

describe("doing it yourself", () => {
  it("starts the work after the drive, pays the fare and keeps the player busy there and back", () => {
    const { s, loc, id } = setup("interaction-muc");
    const part = stick(s, loc), cash = s.cash, hour = s.hour;
    ok(installPart(s, id, part, undefined, "self"));
    expect(s.cash).toBe(cash - 90);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.travel", amount: -90 });
    expect(dev(s, id).maintenance!.doneAt).toBe(hour + 4 + 0.5);
    expect(s.playerBusyUntil).toBe((hour + 4 + 0.5 + 4) * 60);
  });

  it("waits for the replies the player already has queued", () => {
    const { s, loc, id } = setup("interaction-fra");
    s.playerBusyUntil = (s.hour + 3) * 60;
    ok(installPart(s, id, stick(s, loc), undefined, "self"));
    expect(dev(s, id).maintenance!.doneAt).toBe(s.hour + 3 + 1 + 0.5);
    expect(s.playerBusyUntil).toBe((s.hour + 3 + 1 + 0.5 + 1) * 60);
  });

  it("works for a pulled plug and refuses without cash", () => {
    const { s, id } = setup("interaction-fra");
    ok(setPower(s, id, true));
    const cash = s.cash;
    s.cash = 10;
    expect(err(pullPower(s, id, "self"))).toBe("error.noCash");
    s.cash = cash;
    ok(pullPower(s, id, "self"));
    expect(dev(s, id).hands).toMatchObject({ kind: "pull", doneAt: s.hour + 1 });
    expect(s.playerBusyUntil).toBe((s.hour + 2) * 60);
  });
});

describe("sending a friend", () => {
  it("costs 35 and leaves the player free", () => {
    const { s, loc, id } = setup("interaction-fra");
    s.rng = { s: rolls(false) };
    const part = stick(s, loc), cash = s.cash;
    ok(installPart(s, id, part, undefined, "friend"));
    expect(s.cash).toBe(cash - FRIEND_FEE);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.friend", amount: -FRIEND_FEE });
    expect(dev(s, id).maintenance!.doneAt).toBe(s.hour + 1 + 0.5);
    expect(s.playerBusyUntil).toBe(0);
    expect(s.friendFavours).toEqual({ year: 2005, used: 1 });
  });

  it("is limited to three favours a year and starts over in January", () => {
    const { s, loc, id } = setup("interaction-fra");
    for (let i = 0; i < 3; i++) {
      ok(installPart(s, id, stick(s, loc), undefined, "friend"));
      dev(s, id).maintenance = null;
    }
    expect(handWork(s, loc)!.friend!.left).toBe(0);
    const part = stick(s, loc), cash = s.cash;
    expect(err(installPart(s, id, part, undefined, "friend"))).toBe("error.noFavours");
    expect(s.cash).toBe(cash);
    skipTo(s, 2006);
    expect(handWork(s, loc)!.friend!.left).toBe(3);
    ok(installPart(s, id, stick(s, loc), undefined, "friend"));
    expect(s.friendFavours).toEqual({ year: 2006, used: 1 });
  });

  it("takes twice as long for a seed that rolls a mishap", () => {
    const hours = (hit: boolean) => {
      const { s, loc, id } = setup("interaction-fra");
      s.rng = { s: rolls(hit) };
      ok(installPart(s, id, stick(s, loc), undefined, "friend"));
      return dev(s, id).maintenance!.doneAt - s.hour;
    };
    expect(hours(false)).toBe(1 + 0.5);
    expect(hours(true)).toBe(1 + 1);
  });
});

describe("saves", () => {
  it("fills the favours of an old save", () => {
    const s = newGame(3), old = JSON.parse(serialize(s));
    delete old.friendFavours;
    expect(deserialize(JSON.stringify(old)).friendFavours).toEqual({ year: 0, used: 0 });
  });
});
