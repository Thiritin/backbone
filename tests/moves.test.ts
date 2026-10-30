import { describe, expect, it } from "vitest";
import { moveWindowStart } from "../src/sim/10-catalog/attention";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { ZONE_LINK_LEAD_HOURS } from "../src/sim/10-catalog/network";
import { dateOf, hourOf, yearOf } from "../src/sim/00-core/time";
import type { Profile } from "../src/sim/30-customers/customers";
import { newGame, type GameState } from "../src/sim/50-state";
import { workloadsOf } from "../src/sim/60-infra/cluster";
import { tick } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { addLocation, buyRack, connect, moveServer, MOVE_INSTALL_HOURS } from "../src/sim/90-actions/hardware";
import { planMaintenance } from "../src/sim/90-actions/maintenance";
import { locationOf, working } from "../src/sim/60-infra/status";
import { workloadsUp } from "../src/sim/60-infra/cluster";
import { MOVE } from "../src/sim/20-world/datacenters";
import { handWork, TRAVEL } from "../src/sim/60-infra/handwork";
import { addressesOf, RENUMBER_ANNOUNCED_PENALTY, RENUMBER_PENALTY } from "../src/sim/60-infra/addresses";
import { buyAddresses } from "../src/sim/90-actions/addresses";
import { announceMigration, BASEMENT_BONUS, DECLINE_BELOW, MISSED_AFTER_HOURS, MISSED_PENALTY, moveTargets, movesTick, offerMigration } from "../src/sim/90-actions/moves";
import { orderZoneLink } from "../src/sim/90-actions/network";
import { closeTicket, resolveTicket } from "../src/sim/90-actions/support";
import { migrateWorkload, migrationTargets, webspaceTargets } from "../src/sim/90-actions/vms";
import { LAN_GB_PER_HOUR, moveGbit, WAN_GB_PER_HOUR, zoneLinkGbit } from "../src/sim/85-products/products";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { basement, buyDevice, hypervisor, panelVm, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { expect(r.error).toBeUndefined(); return r.id!; };
const err = (r: { ok: boolean; error?: string }) => r.error;

// A hypervisor cluster in the basement and one on a second server, both in zone fra1. place() then rents two datacenter
// locations, loc2 (zone fra2) and loc3 (fra3) in the same city, and labels the clusters with the zones given; the servers
// stay put. Services are provisioned first, so they land in the basement.
function world() {
  const s = { ...withServer(newGame(1)), cash: 100_000 };
  const second = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, second, "rack2", 2));
  ok(connect(s, { device: second, port: 0 }, { device: "dev4", port: 1 }));
  const a = basement(s), b = hypervisor(s, [second], "Remote");
  const place = (zones: { a?: string; b?: string } = {}, line = "vdsl-50") => {
    const home = s.locations[0];
    s.locations = [...s.locations, { ...home, id: "loc2", dc: "equinox-fr5", az: "fra2", name: "FR5", space: "cage" }, { ...home, id: "loc3", dc: "equinox-fr5", az: "fra3", name: "FR5 B", space: "cage" }];
    s.clusters = s.clusters.map((c) => (c.id === b ? { ...c, az: zones.b ?? "fra2" } : c.id === a ? { ...c, az: zones.a ?? c.az } : c));
    s.homeLine = { id: line, next: null };
    for (const loc of ["loc2", "loc3"]) ok(buyAddresses(s, loc, 4, 4));
  };
  return { s, a, b, second, place };
}
const vps = (s: GameState, cus: string, label: string) => ok(provisionService(s, cus, "vps", { label, spec: sizeSpec("vps", 0, yearOf(s.hour)) }));
const customer = (s: GameState, profile: Profile = "hobbyDev") => addCustomer(s, `Ada Lang ${s.nextId}`, profile);
const who = (s: GameState) => (id: string) => s.customers.find((c) => c.id === id)!;
const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };
const ticketOf = (s: GameState, id: string) => s.tickets.find((t) => t.id === id)!;

describe("zone link speed", () => {
  it("reads the links between two zones once they are ready", () => {
    const { s, place } = world();
    place();
    s.unlocks = [...s.unlocks, "network"];
    expect(zoneLinkGbit(s, "fra2", "fra2")).toBe(1);
    expect(zoneLinkGbit(s, "fra2", "fra3")).toBe(0);
    ok(orderZoneLink(s, "loc2", "loc3", "fiber", 0));
    expect(zoneLinkGbit(s, "fra2", "fra3")).toBe(0);
    s.hour += ZONE_LINK_LEAD_HOURS;
    expect(zoneLinkGbit(s, "fra2", "fra3")).toBe(100);
    expect(zoneLinkGbit(s, "fra3", "fra2")).toBe(100);
    expect(zoneLinkGbit(s, "fra1", "fra3")).toBe(0);
  });

  it("lets a VM move to a zone a link reaches, with the downtime of the link", () => {
    const { s, second, place } = world();
    const cus = customer(s), id = vps(s, cus, "vm"), w = workloadsOf(s, id)[0];
    place({ a: "fra2", b: "fra3" });
    expect(migrationTargets(s, w.id)[0].down).toBe(Math.ceil((w.diskGb + w.ramGb) / WAN_GB_PER_HOUR));
    s.unlocks = [...s.unlocks, "network"];
    ok(orderZoneLink(s, "loc2", "loc3", "fiber", 0));
    s.hour += ZONE_LINK_LEAD_HOURS;
    expect(migrationTargets(s, w.id).map((t) => t.to)).toEqual([second]);
    const hour = s.hour;
    ok(migrateWorkload(s, w.id, second));
    const moved = workloadsOf(s, id)[0];
    expect(moved.busyUntil).toBe(hour + Math.max(1, Math.ceil((w.diskGb + w.ramGb) / (100 * LAN_GB_PER_HOUR))));
    expect(s.services.find((v) => v.id === id)!.zone).toBe("fra3");
  });
});

describe("moves out of the basement", () => {
  it("runs over the home line's upload speed as a cold move", () => {
    const { s, second, place } = world();
    const cus = customer(s), id = vps(s, cus, "vm"), w = workloadsOf(s, id)[0];
    place();
    expect(moveGbit(s, "fra1", "fra2")).toBeCloseTo(0.01);
    expect(moveGbit(s, "fra2", "fra1")).toBe(0);
    expect(migrationTargets(s, w.id).map((t) => t.to)).toEqual([second]);
    const down = Math.ceil((w.diskGb + w.ramGb) / (0.01 * LAN_GB_PER_HOUR));
    expect(down).toBeGreaterThan(1);
    expect(migrationTargets(s, w.id)[0].down).toBe(down);
    const hour = s.hour;
    ok(migrateWorkload(s, w.id, second));
    expect(workloadsOf(s, id)[0].busyUntil).toBe(hour + down);
    expect(s.services.find((v) => v.id === id)!.zone).toBe("fra2");
  });

  it("is capped by what the internet moves in an hour and needs a line", () => {
    const { s, second, place } = world();
    const cus = customer(s), id = vps(s, cus, "vm"), w = workloadsOf(s, id)[0];
    place({}, "biz-fiber-1000");
    expect(moveGbit(s, "fra1", "fra2") * LAN_GB_PER_HOUR).toBe(WAN_GB_PER_HOUR);
    s.homeLine = { id: "", next: null };
    expect(err(migrateWorkload(s, w.id, second))).toBe("error.noZoneLink");
  });

  it("adds the copy time to a web space's hand task into another zone", () => {
    const { s, a, b, place } = world();
    const home = panelVm(s, a), cus = customer(s);
    ok(provisionService(s, cus, "webHosting", { label: "site.com", spec: sizeSpec("webHosting", 1, yearOf(s.hour)) }));
    const twin = panelVm(s, a), far = panelVm(s, b);
    place();
    s.clusters = s.clusters.map((c) => (c.id === far ? { ...c, az: "fra2" } : c));
    const w = s.workloads.find((x) => x.clusterId === home)!;
    const hours = (id: string) => webspaceTargets(s, w.id).find((t) => t.clusterId === id)!.hours;
    expect(hours(far)).toBeGreaterThan(hours(twin));
  });
});

describe("move windows", () => {
  const at = (iso: string) => hourOf(new Date(iso));
  const hours = (h: number) => `${dateOf(h).getUTCDay()} ${dateOf(h).getUTCHours()}`;
  it("opens at 02:00 for players, 18:00 on the next weekday for businesses and at once for private customers", () => {
    const tuesdayNoon = at("2006-03-07T12:00:00Z");
    expect(hours(moveWindowStart("game", tuesdayNoon))).toBe("3 2");
    expect(hours(moveWindowStart("game", at("2006-03-07T01:00:00Z")))).toBe("2 2");
    expect(hours(moveWindowStart("business", tuesdayNoon))).toBe("3 18");
    expect(hours(moveWindowStart("business", at("2006-03-10T12:00:00Z")))).toBe("1 18");
    expect(moveWindowStart("private", tuesdayNoon)).toBe(tuesdayNoon);
  });
});

describe("migration offers", () => {
  it("sends the customer a ticket that nobody answers for the player", () => {
    const { s, second, place } = world();
    const cus = customer(s), id = vps(s, cus, "vm");
    place();
    const t = ticketOf(s, ok(offerMigration(s, id, second)));
    expect([t.kind, t.status, t.customerId, t.serviceId, t.move!.to, t.move!.windowAt]).toEqual(["migration", "waiting", cus, id, second, null]);
    expect(err(resolveTicket(s, t.id, "credit"))).toBe("error.unknownTicketAction");
    expect(err(resolveTicket(s, t.id))).toBe("error.ticketNotAnswered");
    expect(err(offerMigration(s, id, second))).toBe("error.moveOffered");
    expect(err(offerMigration(s, id, "dev3"))).toBe("error.moveTarget");
    ok(closeTicket(s, t.id));
    expect(ticketOf(s, t.id).status).toBe("closed");
    expect(s.customers.find((c) => c.id === cus)!.happiness).toBe(who(s)(cus).happiness);
  });

  it("is accepted by a private customer at once and resolves when the player moves it, with the basement bonus once", () => {
    const { s, second, place } = world();
    const cus = customer(s), id = vps(s, cus, "vm"), c = who(s)(cus);
    place();
    c.happiness = 60;
    const t = ticketOf(s, ok(offerMigration(s, id, second)));
    s.hour = t.dueAt;
    const events = movesTick(s, who(s));
    expect(events.map((e) => e.key)).toEqual(["event.moveAccepted"]);
    expect([t.status, workloadsOf(s, id)[0].deviceId]).toEqual(["waiting", "dev3"]);
    ok(migrateWorkload(s, workloadsOf(s, id)[0].id, second));
    expect(movesTick(s, who(s)).map((e) => e.key)).toEqual(["event.moveDone"]);
    expect([t.status, t.outcome, c.happiness]).toEqual(["resolved", "moved", 60 + BASEMENT_BONUS - RENUMBER_ANNOUNCED_PENALTY]);
    expect(workloadsOf(s, id)[0].deviceId).toBe(second);
    expect(s.services.find((v) => v.id === id)!.zone).toBe("fra2");
    expect(t.move!.log.map((l) => l.key)).toEqual(["ticket.migration.acceptAny.text"]);
  });

  it("is accepted by a business for the next weekday evening and waits for the player to move it", () => {
    const { s, second, place } = world();
    const cus = customer(s, "smallBiz"), id = vps(s, cus, "vm"), c = who(s)(cus);
    place();
    c.happiness = 60;
    const t = ticketOf(s, ok(offerMigration(s, id, second)));
    s.hour = t.dueAt;
    expect(movesTick(s, who(s)).map((e) => e.key)).toEqual(["event.moveAccepted"]);
    const start = t.move!.windowAt!;
    expect([dateOf(start).getUTCHours(), [0, 6].includes(dateOf(start).getUTCDay())]).toEqual([18, false]);
    expect(start).toBeGreaterThan(t.dueAt);
    s.hour = start - 1;
    expect(movesTick(s, who(s))).toEqual([]);
    s.hour = start;
    expect(movesTick(s, who(s)).map((e) => e.key)).toEqual(["event.moveWindow"]);
    s.hour = start + 1;
    expect(movesTick(s, who(s))).toEqual([]);
    expect([t.status, workloadsOf(s, id)[0].deviceId]).toEqual(["waiting", "dev3"]);
    ok(migrateWorkload(s, workloadsOf(s, id)[0].id, second));
    expect(movesTick(s, who(s)).map((e) => e.key)).toEqual(["event.moveDone"]);
    expect([t.status, t.outcome, c.happiness]).toEqual(["resolved", "moved", 60 + BASEMENT_BONUS - RENUMBER_ANNOUNCED_PENALTY]);
  });

  it("is declined below the happiness line", () => {
    const { s, second, place } = world();
    const cus = customer(s), id = vps(s, cus, "vm"), c = who(s)(cus);
    place();
    c.happiness = DECLINE_BELOW - 1;
    const t = ticketOf(s, ok(offerMigration(s, id, second)));
    s.hour = t.dueAt - 1;
    expect(movesTick(s, who(s))).toEqual([]);
    s.hour = t.dueAt;
    expect(movesTick(s, who(s)).map((e) => e.key)).toEqual(["event.moveDeclined"]);
    expect([t.status, t.outcome, c.happiness]).toEqual(["resolved", "moveDeclined", DECLINE_BELOW - 1]);
    expect(workloadsOf(s, id)[0].busyUntil).toBe(0);
  });

  it("announces a move for every service on a host", () => {
    const { s, second, place } = world();
    const ids = [vps(s, customer(s), "one"), vps(s, customer(s), "two")];
    place();
    expect(moveTargets(s, workloadsOf(s, ids[0])[0].id).map((t) => t.to)).toEqual([second]);
    expect(ok(announceMigration(s, "dev3", second))).toBe("2");
    expect(s.tickets.filter((t) => t.kind === "migration").map((t) => t.serviceId)).toEqual(ids);
    expect(err(announceMigration(s, "dev3", second))).toBe("error.moveTarget");
  });

  it("costs the customer happiness and reopens the ticket when the player did not move a window customer in time", () => {
    const { s, second, place } = world();
    const cus = customer(s, "smallBiz"), id = vps(s, cus, "vm"), c = who(s)(cus);
    place();
    c.happiness = 60;
    const t = ticketOf(s, ok(offerMigration(s, id, second)));
    s.hour = t.dueAt;
    movesTick(s, who(s));
    const start = t.move!.windowAt!;
    s.hour = start + 3;
    expect(movesTick(s, who(s))).toEqual([]);
    expect(t.status).toBe("waiting");
    s.hour = start + 4;
    expect(movesTick(s, who(s)).map((e) => e.key)).toEqual(["event.moveMissed"]);
    expect([t.status, c.happiness]).toEqual(["open", 60 - MISSED_PENALTY]);
    s.hour += 1;
    expect(movesTick(s, who(s))).toEqual([]);
  });

  it("costs a customer with no particular time happiness when the player does not move it within 48 hours", () => {
    const { s, second, place } = world();
    const cus = customer(s), id = vps(s, cus, "vm"), c = who(s)(cus);
    place();
    c.happiness = 60;
    const t = ticketOf(s, ok(offerMigration(s, id, second)));
    s.hour = t.dueAt;
    movesTick(s, who(s));
    s.hour = t.move!.windowAt! + MISSED_AFTER_HOURS - 1;
    expect(movesTick(s, who(s))).toEqual([]);
    s.hour += 1;
    expect(movesTick(s, who(s)).map((e) => e.key)).toEqual(["event.moveMissed"]);
    expect([t.status, c.happiness]).toEqual(["open", 60 - MISSED_PENALTY]);
  });

  it("runs end to end through the tick", () => {
    const { s, second, place } = world();
    const cus = customer(s), id = vps(s, cus, "vm");
    place();
    who(s)(cus).happiness = 90;
    const t = ticketOf(s, ok(offerMigration(s, id, second)));
    run(s, Math.ceil(t.dueAt - s.hour) + 2);
    expect(ticketOf(s, t.id).status).toBe("waiting");
    ok(migrateWorkload(s, workloadsOf(s, id)[0].id, second));
    run(s, 1);
    expect(ticketOf(s, t.id).status).toBe("resolved");
    expect(ticketOf(s, t.id).outcome).toBe("moved");
    expect(workloadsOf(s, id)[0].clusterId).toBe(s.clusters.find((c) => c.name === "Remote")!.id);
  });
});

// Two Frankfurt datacenter locations, each with a rack and a hypervisor server; a and b are the location ids, ca and cb the
// clusters, da and db the servers, az the zone of a location.
function twoDcs() {
  const s = { ...withServer(newGame(1)), cash: 10_000_000 };
  const [a, b] = [ok(addLocation(s, "interaction-fra", "cage", 4)), ok(addLocation(s, "mainqubes-fra", "cage", 4))];
  for (const l of s.locations) l.readyAt = 0;
  const racks = [a, b].map((loc) => ok(buyRack(s, loc, "rack-42", 1)));
  const [da, db] = [a, b].map((loc, i) => { const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, loc)); ok(mountDevice(s, id, racks[i], 1)); return id; });
  const [ca, cb] = [hypervisor(s, [da], "A"), hypervisor(s, [db], "B")];
  const az = (id: string) => s.locations.find((l) => l.id === id)!.az;
  const vmAt = (cluster: string, cus: string, label = "vm") => ok(provisionService(s, cus, "vps", { label, spec: sizeSpec("vps", 0, yearOf(s.hour)), clusterId: cluster }));
  return { s, a, b, da, db, ca, cb, az, vmAt };
}
const ipsOf = (s: GameState, id: string) => addressesOf(s, id).filter((x) => x.v === 4);

describe("moves between datacenters", () => {
  it("runs a cold move over the internet at the capped speed", () => {
    const { s, a, b, db, ca, az, vmAt } = twoDcs();
    ok(buyAddresses(s, a, 4, 1));
    ok(buyAddresses(s, b, 4, 1));
    const cus = customer(s), id = vmAt(ca, cus), w = workloadsOf(s, id)[0];
    expect(moveGbit(s, az(a), az(b))).toBeCloseTo(WAN_GB_PER_HOUR / LAN_GB_PER_HOUR);
    expect(moveGbit(s, az(b), az(a))).toBeCloseTo(WAN_GB_PER_HOUR / LAN_GB_PER_HOUR);
    const down = Math.ceil((w.diskGb + w.ramGb) / WAN_GB_PER_HOUR);
    expect(migrationTargets(s, w.id).find((t) => t.to === db)!.down).toBe(down);
    const hour = s.hour;
    ok(migrateWorkload(s, w.id, db));
    expect(workloadsOf(s, id)[0].busyUntil).toBe(hour + down);
    expect(s.services.find((v) => v.id === id)!.zone).toBe(az(b));
  });

  it("gives a customer new addresses from the target and costs happiness, less when announced", () => {
    for (const announced of [false, true]) {
      const { s, a, b, db, ca, vmAt } = twoDcs();
      ok(buyAddresses(s, a, 4, 1));
      ok(buyAddresses(s, b, 4, 1));
      const cus = customer(s), id = vmAt(ca, cus), w = workloadsOf(s, id)[0];
      who(s)(cus).happiness = 50;
      const old = ipsOf(s, id)[0];
      expect(old.locationId).toBe(a);
      ok(migrateWorkload(s, w.id, db, announced));
      const now = ipsOf(s, id);
      expect(now.map((x) => x.locationId)).toEqual([b]);
      expect(now[0].ip).not.toBe(old.ip);
      expect(s.ips.addresses.some((x) => x.id === old.id)).toBe(false);
      expect(who(s)(cus).happiness).toBe(50 - (announced ? RENUMBER_ANNOUNCED_PENALTY : RENUMBER_PENALTY));
    }
  });

  it("refuses the move when the target has no free address", () => {
    const { s, a, b, db, ca, az, vmAt } = twoDcs();
    ok(buyAddresses(s, a, 4, 1));
    const cus = customer(s), id = vmAt(ca, cus), w = workloadsOf(s, id)[0];
    expect(err(migrateWorkload(s, w.id, db))).toBe("error.noFreeAddress");
    expect(s.services.find((v) => v.id === id)!.zone).not.toBe(az(b));
    expect(ipsOf(s, id)[0].locationId).toBe(a);
  });

  it("keeps the addresses of an own block announced at both ends", () => {
    const { s, a, b, db, ca, vmAt } = twoDcs();
    s.ips = { ...s.ips, lir: { since: 0, asn: 1 }, blocks: [a, b].map((loc, i) => ({ id: `blk${i}`, prefix: `185.${i + 1}.0.0/24`, size: 256, locationId: loc, boughtAt: 0 })) };
    const cus = customer(s), id = vmAt(ca, cus), w = workloadsOf(s, id)[0];
    who(s)(cus).happiness = 50;
    const old = ipsOf(s, id)[0];
    expect(old.source).toBe("lir");
    ok(migrateWorkload(s, w.id, db));
    expect(ipsOf(s, id).map((x) => [x.ip, x.locationId])).toEqual([[old.ip, b]]);
    expect(who(s)(cus).happiness).toBe(50);
  });
});

describe("moving a loaded server", () => {
  // The server at a is cabled to a switch in its rack; b has a switch of its own.
  function loaded(prep: (s: GameState, a: string, b: string) => void = (s, a) => { ok(buyAddresses(s, a, 4, 1)); }) {
    const w = twoDcs(), { s, a, b, da, ca } = w;
    prep(s, a, b);
    const rackOf = (loc: string) => s.racks.find((r) => r.locationId === loc)!.id;
    const [swA, swB] = [a, b].map((loc) => { const id = ok(buyDevice(s, "sw-8", "Sysko", 1, loc)); ok(mountDevice(s, id, rackOf(loc), 20)); return id; });
    ok(connect(s, { device: da, port: 0 }, { device: swA, port: 0 }));
    const cus = customer(s), id = w.vmAt(ca, cus);
    who(s)(cus).happiness = 50;
    return { ...w, swB, cus, id };
  }
  const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;

  it("takes the trip and the install offline, renumbers and plans a window", () => {
    const { s, b, da, ca, az, swB, cus, id } = loaded();
    ok(buyAddresses(s, b, 4, 1));
    const old = ipsOf(s, id)[0], cash = s.cash, hour = s.hour, wait = handWork(s, b)!.hands.wait;
    expect(working(s, da)).toBe(true);
    ok(moveServer(s, da, b));
    const d = dev(s, da), down = d.bootUntil! - hour;
    // The drive across town overlaps the hands' wait; the install follows.
    expect(down).toBeGreaterThanOrEqual(Math.max(TRAVEL.city.hours, wait) + MOVE_INSTALL_HOURS.min);
    expect(down).toBeLessThanOrEqual(Math.max(TRAVEL.city.hours, wait) + MOVE_INSTALL_HOURS.max);
    expect(s.cash).toBeLessThan(cash - MOVE.sameCity.price);
    expect(locationOf(s, d)!.id).toBe(b);
    expect(s.cables.some((c) => [c.a, c.b].some((e) => e.device === da) && [c.a, c.b].some((e) => e.device === swB))).toBe(true);
    expect(s.clusters.find((c) => c.id === ca)!.az).toBe(az(b));
    expect(s.services.find((v) => v.id === id)!.zone).toBe(az(b));
    expect([working(s, da), workloadsUp(s, id)]).toEqual([false, false]);
    expect(ipsOf(s, id).map((x) => [x.locationId, x.ip !== old.ip])).toEqual([[b, true]]);
    expect(who(s)(cus).happiness).toBe(50 - RENUMBER_PENALTY);
    expect(s.maintenance).toMatchObject([{ target: { kind: "device", id: da }, from: hour, hours: down }]);
    s.hour = d.bootUntil!;
    expect(dev(s, da).bootUntil).toBe(s.hour);
  });

  it("costs less happiness and plans nothing new when a window a day ahead covers the move", () => {
    const { s, b, da, cus, id } = loaded();
    ok(buyAddresses(s, b, 4, 1));
    const win = ok(planMaintenance(s, { kind: "device", id: da }, s.hour + 30, 60));
    s.hour += 30;
    ok(moveServer(s, da, b));
    expect(s.maintenance.map((m) => m.id)).toEqual([win]);
    expect(who(s)(cus).happiness).toBe(50 - RENUMBER_ANNOUNCED_PENALTY);
    expect(ipsOf(s, id)[0].locationId).toBe(b);
  });

  it("is refused without free addresses at the target and changes nothing", () => {
    const { s, a, b, da, ca, id } = loaded();
    const cash = s.cash, rack = dev(s, da).rackId;
    expect(err(moveServer(s, da, b))).toBe("error.noFreeAddress");
    expect([s.cash, dev(s, da).rackId, dev(s, da).bootUntil ?? 0, s.maintenance.length]).toEqual([cash, rack, 0, 0]);
    expect(ipsOf(s, id)[0].locationId).toBe(a);
    expect(s.clusters.find((c) => c.id === ca)!.az).toBe(s.locations.find((l) => l.id === a)!.az);
  });

  it("renumbers nothing when an own block is announced at both ends", () => {
    const { s, b, da, cus, id } = loaded((s, a, b) => {
      s.ips = { ...s.ips, lir: { since: 0, asn: 1 }, blocks: [a, b].map((loc, i) => ({ id: `blk${i}`, prefix: `185.${i + 1}.0.0/24`, size: 256, locationId: loc, boughtAt: 0 })) };
    });
    const old = ipsOf(s, id)[0];
    expect(old.source).toBe("lir");
    ok(moveServer(s, da, b));
    expect(ipsOf(s, id).map((x) => [x.ip, x.locationId])).toEqual([[old.ip, b]]);
    expect(who(s)(cus).happiness).toBe(50);
  });

  it("refuses the same location, a cluster on several servers, a target without a rack and a server in storage", () => {
    const { s, a, b, da, ca } = loaded();
    ok(buyAddresses(s, b, 4, 1));
    expect(err(moveServer(s, da, a))).toBe("error.sameZone");
    const third = ok(buyDevice(s, "g1-compute", "Dwell", 1, a));
    ok(mountDevice(s, third, dev(s, da).rackId!, 30));
    s.clusters = s.clusters.map((c) => (c.id === ca ? { ...c, nodes: [...c.nodes, { deviceId: third, state: "active" as const }] } : c));
    expect(err(moveServer(s, da, b))).toBe("error.clusterSpans");
    s.clusters = s.clusters.map((c) => (c.id === ca ? { ...c, nodes: c.nodes.slice(0, 1) } : c));
    const rack = s.racks.find((r) => r.locationId === b)!;
    rack.arriveAt = s.hour + 5;
    expect(err(moveServer(s, da, b))).toBe("error.noRoom");
    rack.arriveAt = null;
    expect(err(moveServer(s, third, b))).toBeUndefined();
    const stored = ok(buyDevice(s, "g1-compute", "Dwell", 1, a));
    expect(err(moveServer(s, stored, b))).toBe("error.notMounted");
  });
});

describe("old saves", () => {
  it("loads a save without move offers and keeps an offer through a save", () => {
    const { s, second, place } = world();
    const cus = customer(s), id = vps(s, cus, "vm");
    place();
    const before = deserialize(serialize(s));
    expect(before.tickets.filter((t) => t.kind === "migration")).toEqual([]);
    ok(offerMigration(s, id, second));
    const back = deserialize(serialize(s));
    expect(back.tickets.find((t) => t.kind === "migration")!.move).toMatchObject({ to: second, windowAt: null });
  });
});
