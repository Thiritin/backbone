import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { freeBlock, providerV4, REP, retailV4, withAddressNeeds } from "../src/sim/10-catalog/addresses";
import { noticed, type Segment } from "../src/sim/10-catalog/attention";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { requirementsFor } from "../src/sim/30-market/market";
import { specText } from "../src/sim/30-market/spec";
import { createTicket } from "../src/sim/40-support/tickets";
import { device, newGame, type GameState } from "../src/sim/50-state";
import { addressBills, addressesOf, addressTick, addSpam, mailAddress, publicV4, sharedAddress, machineAddress } from "../src/sim/60-infra/addresses";
import { lineOffered } from "../src/sim/60-infra/cluster";
import { tick } from "../src/sim/88-tick/tick";
import { addAddress, announceBlock, assignAddress, buyAddresses, joinLir, releaseAddress, requestDelist } from "../src/sim/90-actions/addresses";
import { createVm, provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { addLocation, buyRack, connect } from "../src/sim/90-actions/hardware";
import { buyDevice, freeFloor } from "./fixtures";
import { cleanUp } from "../src/sim/90-actions/security";
import { setLine } from "../src/sim/90-actions/website";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { basement, BASEMENT_SERVER, hypervisor, panelServer, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id ?? "";
};
const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);
const at = (day: number, hour: number) => hourOf(new Date(Date.UTC(2005, 0, day, hour)));
const run = (s: GameState, hours: number) => { for (let h = 0; h < hours; h++) tick(s); };

// A ready rented rack in Frankfurt with one mounted server cabled to the carrier panel; returns the location and the server.
function datacenter(s: GameState) {
  s.cash = 100_000;
  const loc = ok(addLocation(freeFloor(s), "hetzler-park", "suite", 20));
  s.locations = s.locations.map((l) => (l.id === loc ? { ...l, readyAt: s.hour } : l));
  const rack = ok(buyRack(s, loc, "rack-42", 1));
  s.racks = s.racks.map((r) => (r.id === rack ? { ...r, arriveAt: null } : r));
  const srv = ok(buyDevice(s, "g1-compute", "Dwell", 1, loc));
  ok(mountDevice(s, srv, rack, 1));
  ok(connect(s, { device: srv, port: 0 }, { device: s.devices.find((d) => d.panel === loc)!.id, port: 0 }));
  return { loc, srv };
}

describe("addresses", () => {
  it("gives every server a private address and a public IPv4: the line's shared one at home, its own in a datacenter", () => {
    const s = withServer(newGame(1));
    addressTick(s);
    expect(machineAddress(s, BASEMENT_SERVER)).toMatch(/^192\.168\.1\.\d+$/);
    expect(publicV4(s, BASEMENT_SERVER)).toEqual({ ip: sharedAddress(s)!.ip, shared: true });
    const { srv } = datacenter(s);
    addressTick(s);
    expect(machineAddress(s, srv)).toMatch(/^10\.2\.0\.\d+$/);
    expect(publicV4(s, srv)).toMatchObject({ shared: false });
    expect(addressesOf(s, srv)).toMatchObject([{ v: 4, source: "provider" }]);
  });

  it("bills provider addresses at the volume tier of their count", () => {
    expect(providerV4(2005)).toBe(1);
    expect(providerV4(2005, 100)).toBe(0.6);
    expect(providerV4(2024)).toBe(3.5);
    expect(retailV4(2005)).toBe(2);
    const s = withServer(newGame(1));
    const { loc } = datacenter(s);
    addressTick(s);
    ok(buyAddresses(s, loc, 4, 19));
    expect(addressBills(s)).toEqual([expect.objectContaining({ key: "ledger.addresses", params: { count: 20 }, amount: -16 })]);
  });

  it("lets a VM reach the internet only with an assigned address", () => {
    const s = withServer(newGame(1));
    const { loc, srv } = datacenter(s);
    const c = hypervisor(s, [srv]);
    const vm = ok(createVm(s, c, { vcpu: 1, ramGb: 1, diskGb: 10 }));
    addressTick(s);
    expect(publicV4(s, vm)).toBeNull();
    ok(buyAddresses(s, loc, 4, 1));
    const free = s.ips.addresses.find((a) => a.holder === null && a.locationId === loc)!;
    ok(assignAddress(s, free.id, vm));
    expect(publicV4(s, vm)).toEqual({ ip: free.ip, shared: false });
    expect(err(releaseAddress(s, free.id))).toBe("error.addressInUse");
    ok(assignAddress(s, free.id, null));
    ok(releaseAddress(s, free.id));
    // Adding one buys it when the location has none free, and takes a free one first.
    const before = s.ips.addresses.length;
    ok(addAddress(s, vm, 4));
    expect(s.ips.addresses).toHaveLength(before + 1);
    expect(publicV4(s, vm)?.shared).toBe(false);
    expect(err(addAddress(s, "nope", 4))).toBe("error.unknownMachine");
  });

  it("blocks a VPS sale in a datacenter without a free address", () => {
    const s = withServer(newGame(1));
    const { loc, srv } = datacenter(s);
    hypervisor(s, [srv]);
    addressTick(s);
    const cus = addCustomer(s, "Ada Lang", "hobbyDev");
    const spec = sizeSpec("vps", 0, 2005), az = s.locations.find((l) => l.id === loc)!.az;
    expect(err(provisionService(s, cus, "vps", { label: "ada", spec, zone: az, clusterId: s.clusters.at(-1)!.id }))).toBe("error.noFreeAddress");
    ok(buyAddresses(s, loc, 4, 1));
    const id = ok(provisionService(s, cus, "vps", { label: "ada", spec, zone: az, clusterId: s.clusters.at(-1)!.id }));
    expect(s.ips.addresses.filter((a) => a.holder === id)).toHaveLength(1);
  });

  it("states a dedicated IPv4 and IPv6 in the spec and needs them free to sell", () => {
    const spec = { ...sizeSpec("webHosting", 1, 2015), ipv4: 1, ipv6: true };
    expect(specText("webHosting", spec)).toMatch(/1 dedicated IPv4, IPv6$/);
    expect(withAddressNeeds(1, 5, "gamer", "gameServer", sizeSpec("gameServer", 0, 2005), 2005).ipv4).toBe(1);
    const shares = Array.from({ length: 400 }, (_, k) => withAddressNeeds(1, k, "private", "vps", sizeSpec("vps", 0, 2020), 2020).ipv6 ? 1 : 0);
    expect(shares.reduce((a: number, b) => a + b, 0) / 400).toBeCloseTo(0.27, 1);
    const s = withServer(newGame(1));
    s.ips = { ...s.ips, blocks: [] };
    addressTick(s);
    const r = { city: "Frankfurt", product: "webHosting" as const, sla: "basic" as const, profile: "onlineShop" as const, kind: "order" as const };
    // The business line has four addresses to give; a dynamic line has none, and IPv6 comes to home lines in 2013.
    expect(requirementsFor(s, { ...r, spec: { ...spec, ipv6: false } })).toContainEqual(expect.objectContaining({ key: "sales.need.ipv4", ok: true }));
    s.homeLine = { id: "dsl-16", next: null };
    addressTick(s);
    expect(requirementsFor(s, { ...r, spec: { ...spec, ipv6: false } })).toContainEqual(expect.objectContaining({ key: "sales.need.ipv4", ok: false }));
    expect(requirementsFor(s, { ...r, spec: { ...spec, ipv4: 0 } })).toContainEqual(expect.objectContaining({ key: "sales.need.ipv6", ok: false }));
    s.hour = hourOf(new Date(Date.UTC(2013, 5, 1)));
    expect(requirementsFor(s, { ...r, spec: { ...spec, ipv4: 0 } })).toContainEqual(expect.objectContaining({ key: "sales.need.ipv6", ok: true }));
  });

  it("joins RIPE for a block of the year's size and announces it from a datacenter", () => {
    expect(freeBlock(0)).toEqual({ size: 2048, prefix: 21 });
    expect(freeBlock(hourOf(new Date(Date.UTC(2015, 0, 1))))).toEqual({ size: 1024, prefix: 22 });
    expect(freeBlock(hourOf(new Date(Date.UTC(2021, 0, 1))))).toEqual({ size: 256, prefix: 24 });
    const s = withServer(newGame(1));
    s.ips = { ...s.ips, blocks: [] };
    s.cash = 10_000;
    expect(err(joinLir(s))).toBe("error.lirNeedsDatacenter");
    const { loc } = datacenter(s);
    ok(joinLir(s));
    expect(s.ips.lir?.asn).toBeGreaterThan(0);
    expect(s.network.asn).toBe(s.ips.lir?.asn);
    const block = s.ips.blocks[0];
    expect(block).toMatchObject({ size: 2048, locationId: null });
    expect(err(announceBlock(s, block.id, loc))).toBe("error.needsBgpRouter");
    s.devices.push(device("devbgp", "edge-m", "Sysko", s.racks.find((r) => r.locationId === loc)!.id, 10, null, "gw", 0));
    ok(announceBlock(s, block.id, loc));
    addressTick(s);
    expect(s.ips.addresses.find((a) => a.source === "lir")?.ip.startsWith(block.prefix.split(".").slice(0, 2).join("."))).toBe(true);
  });
});

describe("internet lines", () => {
  it("reconnects a dynamic line every night at 3:00 with a new address, and businesses on it lose patience", () => {
    const s = withServer(newGame(1));
    s.homeLine = { id: "dsl-16", next: null };
    const host = panelServer(s, BASEMENT_SERVER);
    const shop = addCustomer(s, "Socken Shop", "onlineShop"), anna = addCustomer(s, "Anna Albers", "private");
    for (const c of [shop, anna]) ok(provisionService(s, c, "webHosting", { label: c, spec: sizeSpec("webHosting", 0, 2005), clusterId: host }));
    run(s, 2);
    const ip = sharedAddress(s)!.ip, mood = () => s.customers.map((c) => c.happiness);
    const before = mood();
    run(s, 1);
    expect(s.hour % 24).toBe(3);
    expect(sharedAddress(s)!.ip).not.toBe(ip);
    expect(mood()[0]).toBeLessThan(before[0]);
    expect(mood()[1]).toBe(before[1]);
  });

  it("sells only web hosting from a dynamic line", () => {
    const s = withServer(newGame(1));
    s.ips = { ...s.ips, blocks: [] };
    basement(s);
    expect(lineOffered(s, "vps")).toBe(true);
    s.homeLine = { id: "dsl-16", next: null };
    expect(lineOffered(s, "vps")).toBe(false);
    expect(err(setLine(s, "vps", true))).toBe("error.needsStaticLine");
  });

  it("buys extra addresses on a business line only", () => {
    const s = withServer(newGame(1));
    addressTick(s);
    ok(buyAddresses(s, "loc1", 4, 2));
    expect(s.ips.addresses.filter((a) => a.source === "lineExtra")).toHaveLength(2);
    expect(addressBills(s)).toEqual([expect.objectContaining({ amount: -6 })]);
    s.homeLine = { id: "dsl-16", next: null };
    expect(err(buyAddresses(s, "loc1", 4, 1))).toBe("error.addressesFromLine");
  });
});

describe("mail reputation", () => {
  it("drops with spam, lists the address, and recovers once the spam stops, faster with a delist request", () => {
    const s = withServer(newGame(1));
    const { srv } = datacenter(s);
    addressTick(s);
    const a = () => addressesOf(s, srv)[0];
    expect(a().listed).toBe(false);
    for (let day = 0; day < 4; day++) {
      addSpam(s, srv, 5);
      run(s, 24);
    }
    expect(a().listed).toBe(true);
    expect(a().rep).toBeLessThan(30);
    const low = a().rep;
    run(s, 24 * 3);
    expect(a().rep).toBe(low + 3);
    ok(requestDelist(s, a().id));
    run(s, 24);
    expect(a().listed).toBe(false);
  });

  it("drops for a compromised panel host through addSpam a day, and recovers after the clean-up", () => {
    const s = withServer(newGame(1));
    const host = panelServer(s, BASEMENT_SERVER);
    addressTick(s);
    const a = () => mailAddress(s, host)!;
    const start = a().rep;
    expect(a().v).toBe(4);
    s.security = { ...s.security, hacked: [host] };
    run(s, 24);
    // 12 thousand spam mails at 5 points per thousand.
    expect(a().rep).toBe(Math.max(0, start - 12 * REP.perThousand));
    expect(a().listed).toBe(true);
    const low = a().rep;
    ok(cleanUp(s, host));
    run(s, 24 * 2);
    expect(a().rep).toBe(low + 2 * REP.recover);
    ok(requestDelist(s, a().id));
    run(s, 24);
    expect(a().listed).toBe(false);
  });

  it("starts dynamic addresses on the blocklists and refuses to delist them", () => {
    const s = withServer(newGame(1));
    s.homeLine = { id: "dsl-16", next: null };
    addressTick(s);
    expect(sharedAddress(s)).toMatchObject({ listed: true, rep: 20 });
    expect(err(requestDelist(s, sharedAddress(s)!.id))).toBe("error.dynamicRange");
  });

  it("loses reputation for phishing reported on a customer's address", () => {
    const s = withServer(newGame(1));
    const { loc, srv } = datacenter(s);
    hypervisor(s, [srv]);
    ok(buyAddresses(s, loc, 4, 1));
    const cus = addCustomer(s, "Ada Lang", "hobbyDev");
    const az = s.locations.find((l) => l.id === loc)!.az;
    const id = ok(provisionService(s, cus, "vps", { label: "ada", spec: sizeSpec("vps", 0, 2005), zone: az, clusterId: s.clusters.at(-1)!.id }));
    createTicket(s, s.customers.find((c) => c.id === cus)!, "notice", id, "phishing");
    const rep = s.ips.addresses.find((a) => a.holder === id)!.rep;
    run(s, 24);
    expect(s.ips.addresses.find((a) => a.holder === id)!.rep).toBe(rep - 15 + 1);
  });
});

describe("the start", () => {
  it("offers no product line in a new game and unlocks web hosting with a panel and a line", () => {
    const s = newGame(1);
    for (const p of ["webHosting", "vps", "dedicated", "colocation"] as const) expect(lineOffered(s, p)).toBe(false);
    withServer(s);
    s.homeLine = { id: "", next: null };
    const host = panelServer(s, BASEMENT_SERVER);
    expect(lineOffered(s, "webHosting")).toBe(false);
    expect(err(setLine(s, "webHosting", true))).toBe("error.needsInternet");
    s.homeLine = { id: "dsl-16", next: null };
    expect(lineOffered(s, "webHosting")).toBe(true);
    expect(host).toBeTruthy();
    datacenter(s);
    expect(lineOffered(s, "colocation")).toBe(true);
  });

  it("fills addresses into an old save", () => {
    const s = withServer(newGame(1));
    const { srv } = datacenter(s);
    const raw = JSON.parse(serialize(s));
    delete raw.ips;
    const back = deserialize(JSON.stringify(raw));
    expect(addressesOf(back, srv)).toHaveLength(1);
    expect(back.ips.addresses.filter((a) => a.source === "line")).toHaveLength(5);
  });
});

describe("noticing outages", () => {
  const share = (segment: Segment, since: number, hours: number) =>
    Array.from({ length: 500 }, (_, i) => (noticed(1, `cus${i}`, `svc${i}`, segment, since, since + hours - 1).seen ? 1 : 0)).reduce((a: number, b) => a + b, 0) / 500;

  it("leaves a short game server outage at 04:00 on a Tuesday mostly unnoticed and catches one on Saturday at 21:00 at once", () => {
    expect(share("game", at(11, 4), 2)).toBeLessThan(0.1);
    expect(share("game", at(8, 21), 1)).toBeGreaterThan(0.9);
  });

  it("lets offices notice in business hours far sooner than at night", () => {
    expect(share("business", at(11, 10), 1)).toBeGreaterThan(0.8);
    expect(share("business", at(11, 1), 3)).toBeLessThan(0.2);
  });

  it("spreads private customers' delays over days with a long tail", () => {
    const delays = Array.from({ length: 400 }, (_, i) => {
      let h = 0;
      while (h < 24 * 60 && !noticed(1, `cus${i}`, `svc${i}`, "private", at(11, 9), at(11, 9) + h).seen) h++;
      return h;
    }).sort((a, b) => a - b);
    const within = (hours: number) => delays.filter((d) => d < hours).length / delays.length;
    expect(delays[200]).toBeGreaterThan(24);
    expect(delays[200]).toBeLessThan(24 * 7);
    expect(within(12)).toBeGreaterThan(0.03);
    expect(1 - within(24 * 10)).toBeGreaterThan(0.05);
  });
});
