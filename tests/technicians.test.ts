import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { phpAt, phpBehind } from "../src/sim/10-catalog/platforms";
import { visibleCandidates, type Task } from "../src/sim/47-staff/staff";
import { nextSlot } from "../src/sim/47-staff/technicians";
import { newGame, type GameState } from "../src/sim/50-state";
import { workloadsOn } from "../src/sim/60-infra/cluster";
import { phpNeeded, phpRefusal, phpTickets } from "../src/sim/60-infra/php";
import { nodeUsage } from "../src/sim/60-infra/usage";
import { failComponents, tick, type SimEvent } from "../src/sim/88-tick/tick";
import { howToFactor } from "../src/sim/85-products/products";
import { addNode, createCluster, provisionService, upgradePhp } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { addLocation, buyDevice, buyRack, connect, setPower } from "../src/sim/90-actions/hardware";
import { mountDevice } from "./plugged";
import { cancelOperation, hire, queueOperation, queuePhpUpgrade, setTechLocation, setTechRules } from "../src/sim/90-actions/staff";
import { deserialize, serialize } from "../src/sim/91-save/save";

type R = ReturnType<typeof setPower>;
const ok = (r: R) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const err = (r: R) => (r.ok ? "ok" : r.error);
// 2005-01-03 is a Monday; the tick at this hour is the first office hour.
const MONDAY_9 = 48 + 9;
const run = (s: GameState, hours: number) => {
  const events: SimEvent[] = [];
  for (let h = 0; h < hours; h++) events.push(...tick(s));
  return events;
};
const toMonday = (s: GameState) => { s.hour = MONDAY_9 - 1; };
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;

function technician(s: GameState, trained: Task[] = ["hardware", "servers", "panels"]): string {
  const c = visibleCandidates(s).find((x) => x.role === "technician")!;
  const id = ok(hire(s, c.id));
  s.staff = s.staff.map((e) => (e.id === id ? { ...e, trained: [...trained] } : e));
  return id;
}

// The basement with a second server cabled to the switch and both in one cluster.
function twoNodes(s: GameState) {
  const second = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, second, "rack2", 2));
  ok(connect(s, { device: second, port: 0 }, { device: "dev4", port: 1 }));
  const cluster = ok(createCluster(s, "loc1", "Web 1"));
  ok(addNode(s, cluster, "dev3"));
  ok(addNode(s, cluster, second));
  return { cluster, second };
}

describe("technicians", () => {
  it("are hired into the basement and do at most one operation per office hour", () => {
    const s = { ...newGame(1), cash: 100_000 };
    expect(err(queueOperation(s, "off", "dev3"))).toBe("error.noTechnician");
    const id = technician(s);
    expect(s.staff[0].location).toBe("loc1");
    toMonday(s);
    ok(queueOperation(s, "off", "dev3"));
    ok(queueOperation(s, "off", "dev4"));
    expect(err(queueOperation(s, "off", "dev4"))).toBe("error.alreadyQueued");
    expect(nextSlot(s, "loc1", "hardware")).toEqual({ name: s.staff[0].name, hour: MONDAY_9 + 2 });
    run(s, 1);
    expect([dev(s, "dev3").on, dev(s, "dev4").on]).toEqual([false, true]);
    run(s, 1);
    expect(dev(s, "dev4").on).toBe(false);
    expect(s.techOps).toHaveLength(0);
    // Outside office hours the queue waits.
    s.hour = MONDAY_9 + 10;
    ok(queueOperation(s, "on", "dev3"));
    run(s, 1);
    expect(dev(s, "dev3").on).toBe(false);
    expect(err(setTechLocation(s, id, "nowhere"))).toBe("error.unknownLocation");
  });

  it("only take the kinds of operation they are trained on", () => {
    const s = { ...newGame(1), cash: 100_000 };
    technician(s, ["servers"]);
    expect(err(queueOperation(s, "off", "dev3"))).toBe("error.noTechnician");
  });

  it("drain a node with all its VMs as a single operation", () => {
    const s = { ...newGame(1), cash: 100_000 };
    const { second } = twoNodes(s);
    const cus = addCustomer(s, "Ada Lang", "hobbyDev");
    for (let i = 0; i < 3; i++) ok(provisionService(s, cus, "vps", { label: `v${i}`, plan: "vps-s" }));
    expect(workloadsOn(s, "dev3")).toHaveLength(3);
    technician(s);
    toMonday(s);
    ok(queueOperation(s, "drain", "dev3"));
    ok(queueOperation(s, "off", "dev4"));
    run(s, 1);
    expect(workloadsOn(s, second)).toHaveLength(3);
    expect(s.clusters[0].nodes[0].state).toBe("maintenance");
    expect(s.techOps.map((o) => o.kind)).toEqual(["off"]);
  });

  it("replace a failed part from storage by rule, with no remote hands bill", () => {
    const s = { ...newGame(1), cash: 100_000 };
    technician(s);
    toMonday(s);
    const fan = dev(s, "dev3").components.find((c) => c.kind === "fan")!;
    s.devices = s.devices.map((d) => (d.id === "dev3" ? failComponents(s, d, [fan.id]) : d));
    run(s, 1);
    // No spare: nothing is queued and the fan stays failed.
    expect(s.techOps).toHaveLength(0);
    ok(buyDevice(s, "part-fan", "Generic", 1, "loc1"));
    const events = run(s, 2);
    expect(dev(s, "dev3").components.find((c) => c.id === fan.id)).toBeUndefined();
    expect(dev(s, "dev3").components.filter((c) => c.kind === "fan").every((c) => c.failedAt === null)).toBe(true);
    expect(s.devices.some((d) => d.model === "part-fan")).toBe(false);
    expect(events.some((e) => e.key === "event.techReplaced")).toBe(true);
    expect(s.ledger.some((l) => l.key === "ledger.remoteHands")).toBe(false);
  });

  it("leave failed parts alone with the rule off", () => {
    const s = { ...newGame(1), cash: 100_000 };
    technician(s);
    ok(setTechRules(s, { failed: false }));
    toMonday(s);
    const fan = dev(s, "dev3").components.find((c) => c.kind === "fan")!;
    s.devices = s.devices.map((d) => (d.id === "dev3" ? failComponents(s, d, [fan.id]) : d));
    ok(buyDevice(s, "part-fan", "Generic", 1, "loc1"));
    run(s, 3);
    expect(dev(s, "dev3").components.find((c) => c.id === fan.id)?.failedAt).not.toBeNull();
  });

  it("shut a server down for a part that needs it, swap it and start it again, one operation an hour", () => {
    const s = { ...newGame(1), cash: 100_000 };
    technician(s);
    ok(setTechRules(s, { failed: false }));
    toMonday(s);
    const ram = dev(s, "dev3").components.find((c) => c.kind === "ram")!;
    ok(buyDevice(s, "part-ram", "Generic", 1, "loc1"));
    ok(queueOperation(s, "replace", "dev3", ram.id));
    run(s, 1);
    expect(dev(s, "dev3").on).toBe(false);
    expect(s.techOps.map((o) => o.kind)).toEqual(["replace", "on"]);
    run(s, 1);
    expect(dev(s, "dev3").maintenance).not.toBeNull();
    run(s, 1);
    expect(dev(s, "dev3").on).toBe(true);
    expect(dev(s, "dev3").components.some((c) => c.id === ram.id)).toBe(false);
    expect(s.techOps).toHaveLength(0);
  });

  it("work at a datacenter instead of remote hands", () => {
    const s = { ...newGame(1), cash: 1_000_000 };
    const loc = ok(addLocation(s, "interaction-fra", "positions", 1));
    s.locations.find((l) => l.id === loc)!.readyAt = 0;
    const rack = ok(buyRack(s, loc, "rack-42", 1));
    const server = ok(buyDevice(s, "g1-compute", "Dwell", 1, loc));
    ok(mountDevice(s, server, rack, 1));
    ok(buyDevice(s, "part-fan", "Generic", 1, loc));
    const id = technician(s);
    ok(setTechLocation(s, id, loc));
    expect(err(queueOperation(s, "off", "dev3"))).toBe("error.noTechnician");
    toMonday(s);
    const fan = dev(s, server).components.find((c) => c.kind === "fan")!;
    ok(queueOperation(s, "replace", server, fan.id));
    run(s, 2);
    expect(dev(s, server).components.some((c) => c.id === fan.id)).toBe(false);
    expect(s.ledger.some((l) => l.key === "ledger.remoteHands")).toBe(false);
  });

  it("cancel a queued operation", () => {
    const s = { ...newGame(1), cash: 100_000 };
    technician(s);
    const op = ok(queueOperation(s, "off", "dev3"));
    ok(cancelOperation(s, op));
    expect(s.techOps).toHaveLength(0);
    expect(err(cancelOperation(s, op))).toBe("error.unknownOperation");
  });
});

describe("PHP versions", () => {
  it("follow a dated catalogue", () => {
    expect(phpAt(2005)).toBe("4.4");
    expect(phpAt(2009)).toBe("5.2");
    expect(phpAt(2016)).toBe("7.0");
    expect(phpBehind("4.4", 2010)).toBe(3);
    expect(phpRefusal(2)).toBe(0);
    expect(phpRefusal(3)).toBe(0.25);
    expect(phpRefusal(9)).toBe(1);
  });

  it("age on a cluster, raise how-to tickets and block some web hosting sales", () => {
    const s = { ...newGame(1), cash: 100_000 };
    const { cluster } = twoNodes(s);
    const cus = addCustomer(s, "Ada Lang", "hobbyDev");
    ok(provisionService(s, cus, "webHosting", { label: "ada.de", plan: "web-s" }));
    const fresh = howToFactor(s, cus);
    expect(s.clusters[0].nodes.map((n) => n.php)).toEqual(["4.4", "4.4"]);
    s.hour = hourOf(new Date(Date.UTC(2010, 0, 4, 8)));
    expect(phpTickets(s, s.clusters[0])).toBeCloseTo(1.15);
    expect(howToFactor(s, cus)).toBeCloseTo(fresh * 1.15);
    const blocked = Array.from({ length: 200 }, (_, i) => phpNeeded(s, `sr${i}`, cluster)).filter(Boolean);
    expect(blocked.length).toBeGreaterThan(20);
    expect(blocked.length).toBeLessThan(80);
    expect(blocked[0]).toBe("5.1");
  });

  it("upgrade one node per technician operation with a short slowdown", () => {
    const s = { ...newGame(1), cash: 100_000 };
    const { cluster, second } = twoNodes(s);
    technician(s);
    s.hour = hourOf(new Date(Date.UTC(2010, 0, 4, 8)));
    ok(queuePhpUpgrade(s, cluster));
    expect(s.techOps.map((o) => o.deviceId)).toEqual(["dev3", second]);
    expect(err(queuePhpUpgrade(s, cluster))).toBe("error.phpCurrent");
    run(s, 1);
    expect(s.clusters[0].nodes.map((n) => n.php)).toEqual(["5.3", "4.4"]);
    expect(nodeUsage(s, "dev3").perf).toBe(0.7);
    const events = run(s, 1);
    expect(s.clusters[0].nodes.map((n) => n.php)).toEqual(["5.3", "5.3"]);
    expect(events.some((e) => e.key === "event.phpUpgraded")).toBe(true);
    run(s, 1);
    expect(nodeUsage(s, "dev3").perf).toBe(1);
    expect(err(upgradePhp(s, cluster))).toBe("error.phpCurrent");
  });
});

describe("old saves", () => {
  it("load without technicians, queues or PHP versions", () => {
    const s = { ...newGame(1), cash: 100_000 };
    twoNodes(s);
    technician(s);
    s.hour = hourOf(new Date(Date.UTC(2012, 5, 1)));
    const data = JSON.parse(serialize(s));
    delete data.techOps;
    delete data.techRules;
    for (const e of data.staff) delete e.location;
    for (const c of data.clusters) for (const n of c.nodes) { delete n.php; delete n.phpUntil; }
    const back = deserialize(JSON.stringify(data));
    expect(back.techOps).toEqual([]);
    expect(back.techRules).toEqual({ failed: true, worn: false });
    expect(back.staff[0].location).toBeNull();
    expect(back.clusters[0].nodes.map((n) => n.php)).toEqual(["5.3", "5.3"]);
    run(back, 24);
  });
});
