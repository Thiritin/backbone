import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { PANEL_JACKS, PROVIDER_CABLE, uplinkOffers, uplinkPrice } from "../src/sim/10-catalog/uplinks";
import { rackUnits } from "../src/sim/20-world/datacenters";
import { type GameState } from "../src/sim/50-state";
import { networkBills, uplinkMbps } from "../src/sim/60-infra/network";
import { jackRoles, panelOf } from "../src/sim/60-infra/panels";
import { tick } from "../src/sim/88-tick/tick";
import { cancelProviderCable, orderProviderCable } from "../src/sim/90-actions/connectivity";
import { addLocation, buyRack, connect, orderCrossConnect } from "../src/sim/90-actions/hardware";
import { addUplinkLink, orderTransit } from "../src/sim/90-actions/network";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { buyDevice, freeFloor, newGame } from "./fixtures";
import { mountDevice } from "./plugged";

type R = { ok: boolean; id?: string; error?: string };
const ok = (r: R) => { if (!r.ok) throw new Error(r.error); return r.id!; };
const err = (r: R) => (r.ok ? "ok" : r.error);
const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };

function game(year: number): GameState {
  const s = freeFloor({ ...newGame(1), cash: 1e7 });
  s.hour = hourOf(new Date(Date.UTC(year, 0, 1, 9)));
  s.unlocks = ["network"];
  return s;
}
const ready = (s: GameState) => { s.locations = s.locations.map((l) => ({ ...l, readyAt: 0 })); };
const shareRack = (s: GameState) => {
  const loc = ok(addLocation(s, "equinox-fr5", "share", 8));
  ready(s);
  return s.racks.find((r) => r.locationId === loc)!;
};
// A cage at FR5 with a racked router of the model.
function cage(s: GameState, model = "edge-s") {
  const loc = ok(addLocation(s, "equinox-fr5", "cage", 4));
  ready(s);
  const rack = ok(buyRack(s, loc, "rack-42", 1));
  const router = ok(buyDevice(s, model, "Sysko", 1, loc));
  ok(mountDevice(s, router, rack, 1));
  return { loc, rack, router };
}

describe("provider panel", () => {
  it("comes in the top unit of every rented rack and never on the player's own floor", () => {
    const s = game(2010);
    const r = shareRack(s);
    const p = panelOf(s, r.id)!;
    expect(p).toMatchObject({ model: "panel-provider", slot: rackUnits(r.model) });
    expect(jackRoles(s, p.id)).toEqual(Array(PANEL_JACKS).fill("free"));
    const { rack } = cage(s);
    expect(panelOf(s, rack)!.slot).toBe(42);
    for (const own of s.racks.filter((x) => !s.locations.find((l) => l.id === x.locationId)!.dc)) expect(panelOf(s, own.id)).toBeUndefined();
  });

  it("is added to old saves, moving a device out of the top unit without losing one", () => {
    const s = game(2010);
    const { rack } = cage(s);
    const top = ok(buyDevice(s, "edge-s", "Sysko", 1, s.racks.find((r) => r.id === rack)!.locationId));
    const raw = JSON.parse(serialize(s));
    raw.devices = raw.devices.filter((d: { model: string }) => d.model !== "panel-provider");
    Object.assign(raw.devices.find((d: { id: string }) => d.id === top), { rackId: rack, slot: 42, store: null });
    const before = raw.devices.length;
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.devices).toHaveLength(before + 1);
    expect(panelOf(loaded, rack)!.slot).toBe(42);
    const moved = loaded.devices.find((d) => d.id === top)!;
    expect(moved.rackId).toBe(rack);
    expect(moved.slot).toBeLessThan(42);
  });
});

describe("uplinks by year", () => {
  it("offers the speeds of the year's band", () => {
    expect([2005, 2010, 2015, 2020, 2025, 2030].map(uplinkOffers)).toEqual([
      [0.01, 0.1, 1], [0.1, 1, 10], [0.1, 1, 10, 40], [1, 10, 25, 40, 100], [1, 10, 25, 100, 400], [10, 25, 100, 400, 800, 1600],
    ]);
    expect(uplinkOffers(2012)).toEqual(uplinkOffers(2010));
  });

  it("refuses a speed below the floor or above the ceiling and lands a line on a jack", () => {
    const s = game(2022);
    const { loc, rack } = cage(s, "edge-xl");
    expect(err(orderTransit(s, rack, "cogentle", 0.1, 0.2))).toBe("error.speedRetired");
    expect(err(orderTransit(s, rack, "cogentle", 400, 0.2))).toBe("error.speedLater");
    ok(orderTransit(s, loc, "cogentle", 1, 0.2));
    expect(s.network.uplinks[0].links[0].jack).toEqual({ device: panelOf(s, rack)!.id, port: 0 });
    expect(jackRoles(s, panelOf(s, rack)!.id)[0]).toBe("uplink");
  });

  it("needs a port of the kind and a module for a 25 Gbit/s line", () => {
    const s = game(2022);
    const { rack, router } = cage(s, "edge-xl");
    expect(err(orderTransit(s, rack, "cogentle", 25, 0.2))).toBe("error.needsModule");
    s.devices.find((d) => d.id === router)!.components.push({ id: "opt1", kind: "optic", size: 400, installedAt: s.hour, failedAt: null });
    ok(orderTransit(s, rack, "cogentle", 25, 0.2));
    expect(err(orderTransit(s, rack, "cogentle", 25, 0.2))).toBe("error.needsModule");
    const ib = game(2030);
    expect(err(orderTransit(ib, cage(ib, "ib-switch").rack, "cogentle", 100, 0.2))).toBe("error.noRouterPort");
  });

  it("bills a second line again and bundles both into one uplink", () => {
    const s = game(2010);
    const { rack } = cage(s);
    ok(orderTransit(s, rack, "cogentle", 1, 0.2));
    const u = s.network.uplinks[0];
    ok(addUplinkLink(s, u.id, 1, rack));
    expect(s.network.uplinks).toHaveLength(1);
    const v = s.network.uplinks[0];
    expect(v.links.map((l) => l.jack!.port)).toEqual([0, 1]);
    s.hour += 24 * 15;
    expect(networkBills(s).find((b) => b.key === "ledger.uplinkLines")!.amount).toBe(-2 * uplinkPrice(1, 2010));
    expect(uplinkMbps(s, s.network.uplinks[0])).toBe(2000);
  });
});

describe("cross-connects and provider cables", () => {
  it("land a cross-connect on a jack of the chosen rack", () => {
    const s = game(2010);
    const r = shareRack(s);
    const c = s.contracts.find((x) => x.locationId === r.locationId)!;
    ok(orderCrossConnect(s, c.id, "cogentle", r.id));
    expect(jackRoles(s, panelOf(s, r.id)!.id)[0]).toBe("xconnect");
  });

  it("bill a provider cable on completion and link the two jacks", () => {
    const s = game(2010);
    const a = shareRack(s), b = shareRack(s);
    const pa = panelOf(s, a.id)!.id, pb = panelOf(s, b.id)!.id;
    expect(err(orderProviderCable(s, a.id, 0, a.id, 1))).toBe("error.providerCableSameRack");
    const cancelled = ok(orderProviderCable(s, a.id, 0, b.id, 0));
    ok(cancelProviderCable(s, cancelled));
    const cash = s.cash;
    ok(orderProviderCable(s, a.id, 3, b.id, 5));
    expect(err(orderProviderCable(s, a.id, 3, b.id, 6))).toBe("error.jackTaken");
    expect(s.cash).toBe(cash);
    runTo(s, s.hour + PROVIDER_CABLE.leadHours);
    const cable = s.cables.find((c) => c.kind === "provider")!;
    expect(cable).toMatchObject({ a: { device: pa, port: 3 }, b: { device: pb, port: 5 } });
    expect(s.ledger.find((l) => l.key === "ledger.providerCable")!.amount).toBe(-PROVIDER_CABLE.fee);
    expect(jackRoles(s, pa)[3]).toBe("provider-cable");
    expect(jackRoles(s, pb)[5]).toBe("provider-cable");
    expect(s.providerCables).toEqual([]);
  });

  it("are cabled by hand across racks in a cage and refused across shares", () => {
    const s = game(2010);
    const { loc, rack, router } = cage(s);
    const second = ok(buyRack(s, loc, "rack-42", 2));
    const sw = ok(buyDevice(s, "sw-8", "Sysko", 1, loc));
    ok(mountDevice(s, sw, second, 1));
    ok(connect(s, { device: router, port: 0 }, { device: sw, port: 0 }, true));
    expect(err(orderProviderCable(s, rack, 0, second, 0))).toBe("error.cableByHand");
    const a = shareRack(s), b = shareRack(s);
    const x = ok(buyDevice(s, "sw-8", "Sysko", 1, a.locationId)), y = ok(buyDevice(s, "sw-8", "Sysko", 1, b.locationId));
    ok(mountDevice(s, x, a.id, 1));
    ok(mountDevice(s, y, b.id, 1));
    expect(err(connect(s, { device: x, port: 0 }, { device: y, port: 0 }, true))).toBe("error.useProviderCable");
  });
});
