import { describe, expect, it } from "vitest";
import { rand } from "../src/sim/00-core/rng";
import { DATACENTERS } from "../src/sim/20-world/datacenters";
import { newGame, type GameState } from "../src/sim/50-state";
import { BOOKED_HOURS, FRIEND_FEE, handWork } from "../src/sim/60-infra/handwork";
import { drive, travelTo } from "../src/sim/90-actions/travel";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { addLocation, atServer, buyRack, installPart, pullPower, setPower } from "../src/sim/90-actions/hardware";
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
  it("prices the drive by distance from where the player is", () => {
    const at = (dc: string) => { const { s, loc } = setup(dc); return drive(s, loc); };
    expect(at("interaction-fra")).toEqual({ hours: 1, fee: 20 });
    expect(at("interaction-muc")).toEqual({ hours: 4, fee: 90 });
    expect(at("ironmolehill-ams")).toEqual({ hours: 9, fee: 250 });
    const { s, loc } = setup("interaction-fra");
    expect(handWork(s, loc)!.friend).toMatchObject({ wait: 1, fee: FRIEND_FEE, left: 3 });
    expect(handWork(s, loc)!.hands).toMatchObject({ perHour: 120, wait: 2 });
  });

  it("is not offered overseas", () => {
    const { s, loc, id } = setup("digitalreality-ash");
    expect(drive(s, loc)).toBeNull();
    expect(err(travelTo(s, loc))).toBe("error.tooFar");
    expect(handWork(s, loc)!.friend).toBeNull();
    const part = stick(s, loc);
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

  it("adds a day to the drive to a booked visit", () => {
    const { s, loc } = setup("equinox-fr5");
    expect(drive(s, loc)!.hours).toBe(1 + BOOKED_HOURS);
  });
});

describe("driving there", () => {
  it("pays the fare, locks the player until arrival and then works on site", () => {
    const { s, loc, id } = setup("interaction-muc");
    const part = stick(s, loc), cash = s.cash, hour = s.hour;
    expect(err(installPart(s, id, part, undefined, "self"))).toBe("error.notThere");
    ok(travelTo(s, loc));
    expect(s.cash).toBe(cash - 90);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.drive", amount: -90 });
    expect(s.player).toEqual({ at: loc, until: hour + 4, doing: "travel" });
    expect(err(travelTo(s, "loc1"))).toBe("error.away");
    expect(err(installPart(s, id, part, undefined, "self"))).toBe("error.notThere");
    s.hour = hour + 4;
    expect(handWork(s, loc)!.here).toBe(true);
    ok(installPart(s, id, part, undefined, "self"));
    expect(s.cash).toBe(cash - 90);
    expect(dev(s, id).maintenance!.doneAt).toBe(s.hour + 0.5);
    expect(s.player).toEqual({ at: loc, until: s.hour + 0.5, doing: "work" });
  });

  it("pulls a plug on site without a fee and refuses a drive without cash", () => {
    const { s, loc, id } = setup("interaction-fra");
    ok(setPower(s, id, true));
    s.cash = 10;
    expect(err(travelTo(s, loc))).toBe("error.noCash");
    s.cash = 1000;
    ok(travelTo(s, loc));
    s.hour += 1;
    ok(pullPower(s, id, "self"));
    expect(s.cash).toBe(980);
    expect(dev(s, id).hands).toMatchObject({ kind: "pull", doneAt: s.hour });
  });

  it("presses the front buttons on site at once, without remote hands", () => {
    const hands = DATACENTERS.find((d) => d.id === "interaction-fra")!.remoteHands;
    const away = setup("interaction-fra");
    expect(err(atServer(away.s, away.id, "power", "self"))).toBe("error.notThere");
    const cash = away.s.cash;
    ok(atServer(away.s, away.id, "power"));
    expect(dev(away.s, away.id).hands).toEqual({ kind: "power", doneAt: away.s.hour + hands.responseHours });
    expect(away.s.cash).toBe(cash - hands.perHour);

    const { s, loc, id } = setup("interaction-fra");
    ok(travelTo(s, loc));
    s.hour += 1;
    const before = s.cash;
    ok(atServer(s, id, "power", "self"));
    expect(dev(s, id).on).toBe(true);
    expect(dev(s, id).hands).toBeUndefined();
    expect(s.cash).toBe(before);
  });

  it("starts an old save at home", () => {
    const old = JSON.parse(serialize(newGame(1)));
    delete old.player;
    expect(deserialize(JSON.stringify(old)).player).toEqual({ at: "loc1", until: 0, doing: "work" });
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
