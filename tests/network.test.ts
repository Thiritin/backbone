import { describe, expect, it } from "vitest";
import { ASN_FEE, carriersAt, DDOS, EXCHANGE_FEES, PEERS, TRANSIT, transitPerMbps } from "../src/sim/10-catalog/network";
import { trafficGb } from "../src/sim/10-catalog/products";
import { datacenterById } from "../src/sim/20-world/datacenters";
import type { Profile } from "../src/sim/30-customers/customers";
import { serviceOnline } from "../src/sim/40-support/status";
import { newGame, type GameState } from "../src/sim/50-state";
import { blackholed, networkBills, networkTick, p95, route, serviceMbps, transitBill, zoneDemand } from "../src/sim/60-infra/network";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { addLocation, buyDevice } from "../src/sim/90-actions/hardware";
import {
  acceptPeering, addUplinkLink, freeRouterPort, joinExchange, orderExchangePort, orderTransit, orderZoneLink, registerAsn, rejectPeering, requestPeering, setBlackhole, setProtection,
} from "../src/sim/90-actions/network";
import { deserialize, serialize } from "../src/sim/91-save/save";

type R = ReturnType<typeof registerAsn>;
const ok = (r: R) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: R) => (r.ok ? "ok" : r.error);

// A running service in a zone: a service with one workload, which is all the traffic model looks at.
function service(s: GameState, az: string, product: "vps" | "gameServer" | "colocation" = "vps", profile: Profile = "hobbyDev", plan: string | null = null) {
  const c = addCustomer(s, `C${s.nextId}`, profile);
  const id = addService(s, c, product, `${product} ${s.nextId}`, 10, "hour", 0, az, plan);
  s.workloads.push({ id: `w${s.nextId++}`, serviceId: id, clusterId: null, deviceId: null, rackId: null, slot: 0, units: 0, watts: 0, placedAt: s.hour, vcpu: 1, ramGb: 1, diskGb: 10, stopped: false, busyUntil: 0, backupAt: null });
  return id;
}

// A rented position at Equinox FR5 (fra2), ready, with an edge router S (4 × 1G) next to the handoff (2 × 1G) and Network operations learned.
function datacenter(seed = 1) {
  const s = newGame(seed);
  s.cash = 1e6;
  s.unlocks = ["network"];
  const loc = ok(addLocation(s, "equinox-fr5", "positions", 1));
  s.locations = s.locations.map((l) => ({ ...l, readyAt: 0 }));
  const router = ok(buyDevice(s, "edge-s", "Sysko", 1, loc));
  s.devices = s.devices.map((d) => (d.id === router ? { ...d, store: null, panel: loc } : d));
  return { s, loc };
}
const ready = (s: GameState) => { s.hour += 24 * 15; };

describe("traffic", () => {
  it("follows the plan and the year, averaging the economy table over a day", () => {
    expect(trafficGb("vps", "vps-m", 2005)).toBe(20);
    expect(trafficGb("vps", "vps-s", 2005)).toBe(10);
    expect(trafficGb("gameServer", "game-s", 2005)).toBe(60);
    expect(trafficGb("vps", "vps-m", 2026)).toBeCloseTo(20 * Math.pow(1.2, 21), 5);
    const s = newGame(1);
    const id = service(s, "fra1", "vps", "hobbyDev", "vps-m");
    const v = s.services.find((x) => x.id === id)!;
    let sum = 0;
    for (let h = 0; h < 24; h++) { s.hour = h; sum += serviceMbps(s, v); }
    expect(sum / 24).toBeCloseTo((20 * 8000) / (730 * 3600), 6);
  });

  it("ten VPS fill the basement's 1 Mbit/s upload in the evening and degrade without going offline", () => {
    const s = newGame(2);
    const ids = Array.from({ length: 10 }, () => service(s, "fra1", "vps", "hobbyDev", "vps-m"));
    s.hour = 21;
    const r = route(s);
    const z = r.zones.loc1;
    expect(z.demand).toBeGreaterThan(1);
    expect(z.carried).toBeCloseTo(1, 6);
    expect(z.dropped).toBeCloseTo(z.demand - 1, 6);
    const before = s.customers.map((c) => c.happiness);
    networkTick(s);
    expect(s.network.saturated).toEqual(["loc1"]);
    expect(s.customers.every((c, i) => c.happiness < before[i])).toBe(true);
    expect(ids.length).toBe(10);
  });
});

describe("routing", () => {
  it("prefers exchange peering, then transit, then the datacenter's bandwidth, and spills over", () => {
    const { s, loc } = datacenter();
    ok(registerAsn(s));
    ok(joinExchange(s, "dekicks"));
    ok(orderExchangePort(s, loc, 1));
    ok(orderTransit(s, loc, "cogentle", 1, 0.2));
    ready(s);
    // 300 colocation customers at 21:00 send far more than 1 Gbit/s.
    for (let i = 0; i < 300; i++) service(s, "fra2", "colocation", "smallBiz", "colo-f");
    s.hour = s.hour - (s.hour % 24) + 21;
    const r = route(s), z = r.zones[loc];
    const [ex, tr] = s.network.uplinks;
    const share = PEERS.filter((p) => p.policy === "routeServer").reduce((n, p) => n + p.share, 0);
    expect(z.exits[ex.id]).toBeCloseTo(Math.min(1000, z.demand * share), 6);
    expect(z.exits[tr.id]).toBeCloseTo(1000, 6);
    expect(z.exits[`dc:${loc}`]).toBeCloseTo(1000, 6);
    expect(z.dropped).toBeCloseTo(z.demand - z.exits[ex.id] - 2000, 6);
  });

  it("equal exits share the load by capacity", () => {
    const { s, loc } = datacenter();
    ok(orderTransit(s, loc, "cogentle", 1, 0.2));
    ok(addUplinkLink(s, ok(orderTransit(s, loc, "cogentle", 1, 0.2)) && s.network.uplinks[1].id, 1));
    ready(s);
    service(s, "fra2", "colocation", "smallBiz");
    s.hour = s.hour - (s.hour % 24) + 21;
    const z = route(s).zones[loc], [a, b] = s.network.uplinks;
    expect(z.exits[b.id] / z.exits[a.id]).toBeCloseTo(2, 6);
    expect(z.exits[`dc:${loc}`]).toBe(0);
  });

  it("sends overflow over a link to another zone's spare capacity", () => {
    const { s, loc } = datacenter();
    const second = ok(addLocation(s, "interaction-fra", "positions", 1));
    s.locations = s.locations.map((l) => ({ ...l, readyAt: 0 }));
    ok(orderZoneLink(s, loc, second, "fiber", 0));
    s.hour += 24 * 31;
    for (let i = 0; i < 120; i++) service(s, "fra2", "colocation", "smallBiz", "colo-f");
    s.hour = s.hour - (s.hour % 24) + 21;
    const r = route(s), z = r.zones[loc], other = r.zones[second];
    const link = s.network.zoneLinks[0];
    expect(z.demand).toBeGreaterThan(1000);
    expect(r.links[link.id]).toBeCloseTo(Math.min(z.demand - 1000, 1000), 6);
    expect(other.exits[`dc:${second}`]).toBeCloseTo(r.links[link.id], 6);
  });

  it("needs a free router port for every link", () => {
    const { s, loc } = datacenter();
    expect(freeRouterPort(s, loc, 10)).toBeNull();
    expect(err(orderTransit(s, loc, "cogentle", 10, 0.2))).toBe("error.speedLater");
    for (let i = 0; i < 6; i++) ok(orderTransit(s, loc, "cogentle", 1, 0.2));
    expect(err(orderTransit(s, loc, "cogentle", 1, 0.2))).toBe("error.noRouterPort");
    expect(err(orderTransit(s, "loc1", "cogentle", 1, 0.2))).toBe("error.basementUplink");
    expect(err(orderTransit(s, loc, "nobody", 1, 0.2))).toBe("error.carrierAbsent");
    expect(carriersAt(datacenterById("hetzler-park")).map((c) => c.id)).toEqual(["cogentle"]);
  });
});

describe("95th percentile billing", () => {
  it("drops the top 5% of hours and never bills below the commit", () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(p95(samples)).toBe(95);
    const { s, loc } = datacenter();
    ok(orderTransit(s, loc, "tellya", 1, 0.2));
    const u = s.network.uplinks[0];
    const price = transitPerMbps({ id: "tellya", name: "", factor: 1 }, 2005);
    expect(price).toBeCloseTo(TRANSIT.perMbps2026 * TRANSIT.m, 6);
    s.network = { ...s.network, uplinks: [{ ...u, samples: Array.from({ length: 720 }, (_, i) => (i < 700 ? 300 : 900)) }] };
    expect(transitBill(s, s.network.uplinks[0]).mbps).toBe(300);
    s.network = { ...s.network, uplinks: [{ ...u, samples: Array(720).fill(50) }] };
    expect(transitBill(s, s.network.uplinks[0])).toEqual({ mbps: 200, amount: Math.round(200 * price * 100) / 100 });
  });

  it("bills transit, ports, cross-connects and memberships at the month start", () => {
    const { s, loc } = datacenter();
    ok(registerAsn(s));
    ok(joinExchange(s, "dekicks"));
    ok(orderExchangePort(s, loc, 1));
    ok(orderTransit(s, loc, "cogentle", 1, 0.5));
    expect(networkBills(s).map((b) => b.key)).toEqual(["ledger.exchangeMember"]);
    ready(s);
    const keys = networkBills(s).map((b) => b.key);
    expect(keys).toEqual(["ledger.exchangePorts", "ledger.crossConnects", "ledger.transit", "ledger.crossConnects", "ledger.exchangeMember"]);
    expect(networkBills(s).find((b) => b.key === "ledger.exchangeMember")!.amount).toBe(-EXCHANGE_FEES.yearly / 12);
    expect(s.ledger.slice(-2).map((l) => l.amount)).toEqual([-ASN_FEE, -EXCHANGE_FEES.setup]);
    const cash = s.cash;
    s.hour = 744;
    networkTick(s);
    const billed = s.ledger.filter((l) => l.hour === 744 && l.category === "transit");
    expect(billed.length).toBeGreaterThan(0);
    expect(s.cash).toBeCloseTo(cash + billed.reduce((n, b) => n + b.amount, 0), 2);
  });

  it("bills datacenter bandwidth per TB carried", () => {
    const { s, loc } = datacenter();
    service(s, "fra2", "colocation", "smallBiz");
    for (let h = 0; h < 743; h++) { s.hour = h; networkTick(s); }
    const tb = s.network.dcTb[loc];
    expect(tb).toBeGreaterThan(0.2);
    s.hour = 744;
    networkTick(s);
    expect(s.ledger.some((l) => l.key === "ledger.dcBandwidth" && l.amount < 0)).toBe(true);
    expect(s.network.dcTb).toEqual({});
  });
});

describe("exchanges and peering", () => {
  it("needs an AS number before joining, and one membership per exchange", () => {
    const { s, loc } = datacenter();
    expect(err(joinExchange(s, "dekicks"))).toBe("error.needsAsn");
    expect(err(orderExchangePort(s, loc, 1))).toBe("error.notMember");
    const asn = ok(registerAsn(s));
    expect(Number(asn)).toBeGreaterThanOrEqual(20000);
    expect(err(registerAsn(s))).toBe("error.hasAsn");
    ok(joinExchange(s, "dekicks"));
    expect(err(joinExchange(s, "dekicks"))).toBe("error.alreadyMember");
    expect(deserialize(serialize(s)).network.asn).toBe(Number(asn));
  });

  it("brings peering requests from networks on the exchange; accepting moves their traffic off transit", () => {
    const { s, loc } = datacenter(7);
    ok(registerAsn(s));
    ok(joinExchange(s, "dekicks"));
    ok(orderExchangePort(s, loc, 1));
    ok(orderTransit(s, loc, "cogentle", 1, 0.2));
    ready(s);
    for (let i = 0; i < 40; i++) service(s, "fra2", "colocation", "smallBiz");
    s.hour -= s.hour % 24;
    const start = s.hour;
    while (!s.network.requests.length && s.hour < start + 24 * 400) { s.hour += 24; networkTick(s); }
    expect(s.network.requests.length).toBeGreaterThan(0);
    const req = s.network.requests[0];
    const peer = PEERS.find((p) => p.id === req.peer)!;
    expect(peer.policy).not.toBe("routeServer");
    s.hour = s.hour - (s.hour % 24) + 21;
    const before = route(s).zones[loc].exits[s.network.uplinks[0].id];
    ok(acceptPeering(s, req.id));
    const after = route(s).zones[loc].exits[s.network.uplinks[0].id];
    expect(after - before).toBeCloseTo(zoneDemand(s)[loc] * peer.share, 6);
    expect(err(acceptPeering(s, req.id))).toBe("error.unknownRequest");
  });

  it("small open networks always say yes; big eyeballs turn a small player down and stay away a while", () => {
    const { s, loc } = datacenter(3);
    ok(registerAsn(s));
    ok(joinExchange(s, "dekicks"));
    ok(orderExchangePort(s, loc, 1));
    expect(err(requestPeering(s, "ohv", "dekicks"))).toBe("error.peerNotThere");
    ready(s);
    expect(ok(requestPeering(s, "ohv", "dekicks"))).toBe("accepted");
    expect(err(requestPeering(s, "ohv", "dekicks"))).toBe("error.alreadyPeering");
    expect(err(requestPeering(s, "crowdflare", "dekicks"))).toBe("error.unknownPeer");
    expect(ok(requestPeering(s, "doitsche", "dekicks"))).toBe("declined");
    expect(err(requestPeering(s, "doitsche", "dekicks"))).toBe("error.peerDeclined");
    s.network = { ...s.network, requests: [{ id: "r1", peer: "volve", exchange: "dekicks", at: s.hour }] };
    ok(rejectPeering(s, "r1"));
    expect(err(requestPeering(s, "volve", "dekicks"))).toBe("error.peerDeclined");
  });

  it("trade fair goodwill raises the chance a selective network accepts", async () => {
    const { acceptChance, addGoodwill } = await import("../src/sim/60-infra/network");
    const s = newGame(1);
    const goggle = PEERS.find((p) => p.id === "goggle")!;
    const base = acceptChance(s, goggle);
    addGoodwill(s, 0.5);
    expect(acceptChance(s, goggle)).toBeGreaterThan(base);
  });
});

describe("DDoS", () => {
  it("saturates the target's zone until blackholed, which takes only the target offline", () => {
    const { s, loc } = datacenter(5);
    const target = service(s, "fra2", "gameServer", "gamer");
    const other = service(s, "fra2", "vps", "hobbyDev");
    s.hour = 24 * 100 + 21;
    s.network = { ...s.network, attacks: [{ id: "a1", serviceId: target, locationId: loc, mbps: DDOS.mbps2005 * 4, startedAt: s.hour, endsAt: s.hour + 3, blackholed: false }] };
    expect(route(s).zones[loc].dropped).toBeGreaterThan(0);
    ok(setBlackhole(s, "a1", true));
    expect(route(s).zones[loc].dropped).toBe(0);
    expect(blackholed(s, target)).toBe(true);
    expect(blackholed(s, other)).toBe(false);
    // serviceOnline drops a blackholed service even when its workloads are up; a service without workloads always is.
    const bare = addService(s, s.services[0].customerId, "vps", "bare", 10, "hour", 0, "fra2");
    expect(serviceOnline(s, bare)).toBe(true);
    s.network = { ...s.network, attacks: [...s.network.attacks, { ...s.network.attacks[0], id: "a2", serviceId: bare }] };
    expect(serviceOnline(s, bare)).toBe(false);
    s.network = { ...s.network, attacks: s.network.attacks.filter((a) => a.id !== "a2") };
    expect(s.network.attacks.length).toBe(1);
    expect(err(setBlackhole(s, "nope", true))).toBe("error.unknownAttack");
    ok(setBlackhole(s, "a1", false));
    ok(setProtection(s, "alwaysOn"));
    expect(route(s).zones[loc].dropped).toBe(0);
    ok(setProtection(s, "onDemand"));
    expect(route(s).zones[loc].demand).toBeCloseTo(zoneDemand(s)[loc], 6);
  });

  it("hits gamers far more often than other customers, deterministically by seed", () => {
    const count = (profile: Profile) => {
      const s = newGame(11);
      for (let i = 0; i < 50; i++) service(s, "fra1", "vps", profile);
      let n = 0;
      for (let h = 1; h <= 24 * 365; h++) { s.hour = h; n += networkTick(s).filter((e) => e.key === "event.ddos").length; }
      return n;
    };
    const gamers = count("gamer"), others = count("smallBiz");
    expect(gamers).toBe(count("gamer"));
    expect(gamers).toBeGreaterThan(others * 3);
    expect(gamers).toBeGreaterThan(5);
  });
});
