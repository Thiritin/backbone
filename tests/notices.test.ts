import { describe, expect, it } from "vitest";
import { createRng, hashRng } from "../src/sim/00-core/rng";
import { serviceOnline } from "../src/sim/40-support/status";
import { applyNoticeWork, domainOf, opsTick, spawnLegal, spawnNotice, TAKEDOWN_HOURS } from "../src/sim/40-support/notices";
import { monthlyValue, type Ticket } from "../src/sim/40-support/tickets";
import type { GameState } from "../src/sim/50-state";
import { workloadsOf } from "../src/sim/60-infra/cluster";
import { DATA_LOSS, gridOutage, RESTORED, seize } from "../src/sim/60-infra/incidents";
import { linkStatus, powered } from "../src/sim/60-infra/status";
import { tick } from "../src/sim/88-tick/tick";
import { addNode } from "../src/sim/90-actions/clusters";
import { buyDevice, connect } from "../src/sim/90-actions/hardware";
import { mountDevice } from "./plugged";
import { closeTicket, resolveTicket } from "../src/sim/90-actions/support";
import { readyGame } from "./fixtures";
import { deserialize, serialize } from "../src/sim/91-save/save";

type R = { ok: boolean; id?: string; error?: string };
const ok = (r: R) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const run = (s: GameState, hours: number) => {
  for (let h = 0; h < hours; h++) tick(s);
};
const friend = (s: GameState, i = 0) => s.customers[i];
const ticket = (s: GameState, id: string) => s.tickets.find((t) => t.id === id)!;
// Applies a queued action at once, the way the support tick does.
const apply = (s: GameState, t: Ticket, action: string) => applyNoticeWork(s, t, s.customers.find((c) => c.id === t.customerId), action);

// Two basement nodes in the starting cluster, so a seized server's workloads have somewhere to go.
function twoNodes(seed = 1) {
  const s = { ...readyGame(seed), cash: 100_000 };
  const second = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, second, "rack2", 2));
  ok(connect(s, { device: second, port: 0 }, { device: "dev4", port: 1 }));
  ok(addNode(s, s.clusters[0].id, second));
  return { s, second };
}

describe("copyright and abuse notices", () => {
  it("names a URL on the customer's domain", () => {
    const s = readyGame(1);
    const t = spawnNotice(s, friend(s), true, createRng(3), "movie");
    expect(t.notice!.url).toMatch(/^https:\/\/jonasweber\.de\//);
    expect(t.customerId).toBe(friend(s).id);
    expect(domainOf(s, friend(s))!.domain).toBe("jonasweber.de");
  });

  it("writes a fake notice from a free mail address and a real one from the sender's domain", () => {
    const s = readyGame(1);
    const real = spawnNotice(s, friend(s), true, createRng(3), "music");
    const fake = spawnNotice(s, friend(s), false, createRng(3), "music");
    expect(real.notice!.from).toMatch(/^legal@/);
    expect(fake.notice!.from).toMatch(/@gmale\.com$/);
    expect(spawnNotice(s, friend(s), true, createRng(3), "youtuber").notice!.real).toBe(false);
  });

  it("taking down content on a fake notice angers the customer and takes the service offline briefly", () => {
    const s = readyGame(1);
    const t = spawnNotice(s, friend(s), false, createRng(3), "movie");
    const before = friend(s).happiness;
    apply(s, t, "takedown");
    expect(t.outcome).toBe("takenDown");
    expect(friend(s).happiness).toBe(before - 25);
    expect(serviceOnline(s, t.serviceId!)).toBe(false);
    s.hour += TAKEDOWN_HOURS;
    expect(serviceOnline(s, t.serviceId!)).toBe(true);
  });

  it("rejecting a fake notice closes it for good", () => {
    const s = readyGame(1);
    const t = spawnNotice(s, friend(s), false, createRng(3), "movie");
    apply(s, t, "reject");
    expect(t.notice!.followAt).toBeNull();
  });

  it("ignoring a real notice brings an angrier second notice, then a legal request", () => {
    const s = readyGame(1);
    const t = spawnNotice(s, friend(s), true, createRng(3), "movie");
    ok(closeTicket(s, t.id));
    const first = ticket(s, t.id);
    expect(first.outcome).toBe("ignored");
    expect(first.notice!.followAt).not.toBeNull();
    s.hour = first.notice!.followAt!;
    opsTick(s);
    const second = s.tickets.find((x) => x.kind === "notice" && x.notice!.round === 2)!;
    expect(second.notice!.url).toBe(first.notice!.url);
    expect(second.notice!.sender).toBe(first.notice!.sender);
    s.hour = second.dueAt;
    opsTick(s);
    const ignored = ticket(s, second.id);
    expect(ignored.outcome).toBe("ignored");
    s.hour = ignored.notice!.followAt!;
    opsTick(s);
    const legal = s.tickets.find((x) => x.kind === "legal")!;
    expect(legal.customerId).toBe(friend(s).id);
    expect(legal.notice!.url).toBe(first.notice!.url);
  });

  it("forwarding a notice about a domain nobody hosts fails", () => {
    const s = readyGame(1);
    const t = spawnNotice(s, null, true, createRng(3), "spam");
    expect(t.customerId).toBe("");
    expect(resolveTicket(s, t.id, "forward")).toEqual({ ok: false, error: "error.notHosted" });
    expect(resolveTicket(s, t.id, "reject").ok).toBe(true);
  });

  it("a shady customer leaves forwarded content up", () => {
    const s = readyGame(1);
    friend(s).shady = true;
    const t = spawnNotice(s, friend(s), true, createRng(3), "phishing");
    apply(s, t, "forward");
    expect(t.notice!.followAt).not.toBeNull();
  });
});

describe("legal requests", () => {
  it("closes when answered before the deadline", () => {
    const s = readyGame(1);
    const t = spawnLegal(s, friend(s), createRng(5))!;
    expect(t.dueAt - t.createdAt).toBeGreaterThanOrEqual(5 * 24);
    ok(resolveTicket(s, t.id, "comply"));
    run(s, t.dueAt - s.hour + 2);
    expect(ticket(s, t.id).outcome).toBe("complied");
    expect(s.devices.some((d) => d.id === "dev3")).toBe(true);
  });

  it("seizes the server when the deadline passes, and returns it to storage 3 to 24 months later", () => {
    const s = readyGame(1);
    const t = spawnLegal(s, friend(s), createRng(5))!;
    s.hour = t.dueAt;
    opsTick(s);
    expect(ticket(s, t.id).outcome).toBe("seized");
    expect(s.devices.some((d) => d.id === "dev3")).toBe(false);
    const seized = s.ops.seized[0];
    expect(seized.device.id).toBe("dev3");
    expect(seized.returnAt - s.hour).toBeGreaterThanOrEqual(3 * 730);
    expect(seized.returnAt - s.hour).toBeLessThanOrEqual(24 * 730);
    const inc = s.ops.incidents.at(-1)!;
    expect(inc.cause).toBe("seizure");
    expect(inc.customers).toHaveLength(3);
    // The only node is gone, so every friend's site is offline.
    for (const v of s.services) expect(serviceOnline(s, v.id)).toBe(false);
    s.hour = seized.returnAt;
    opsTick(s);
    const back = s.devices.find((d) => d.id === "dev3")!;
    expect(back.store).toBe("loc1");
    expect(back.rackId).toBeNull();
    expect(s.ops.seized).toHaveLength(0);
  });

  it("loses the data without a backup: the workload restarts empty on another node and the customer wants a refund", () => {
    const { s, second } = twoNodes();
    const before = friend(s).happiness;
    seize(s, "dev3", "Europoll", hashRng(1), []);
    const w = workloadsOf(s, s.services[0].id)[0];
    expect(w.deviceId).toBe(second);
    expect(w.placedAt).toBe(s.hour);
    expect(friend(s).happiness).toBe(Math.max(0, before + DATA_LOSS));
    expect(s.tickets.filter((t) => t.kind === "refund" && t.topic === "dataLoss")).toHaveLength(3);
  });

  it("restores from a backup on another system with a smaller hit and an outage ticket", () => {
    const { s } = twoNodes();
    s.workloads = s.workloads.map((w) => ({ ...w, backupAt: s.hour }));
    const before = friend(s).happiness;
    seize(s, "dev3", "Europoll", hashRng(1), []);
    expect(friend(s).happiness).toBe(before + RESTORED);
    expect(s.tickets.filter((t) => t.kind === "outage")).toHaveLength(3);
    expect(s.tickets.some((t) => t.kind === "refund")).toBe(false);
  });

  it("an objection to a shady customer's request can bring a court order with a short deadline", () => {
    const s = readyGame(1);
    friend(s).shady = true;
    let court: Ticket | undefined;
    for (let seed = 1; seed < 40 && !court; seed++) {
      const t = spawnLegal(s, friend(s), createRng(seed))!;
      apply(s, t, "object");
      if (t.notice!.followAt === null) continue;
      s.hour = t.notice!.followAt;
      opsTick(s);
      court = s.tickets.find((x) => x.kind === "legal" && x.notice!.round === 2);
    }
    expect(court!.dueAt - court!.createdAt).toBe(3 * 24);
  });
});

describe("shady customers", () => {
  it("draw far more notices and legal requests", () => {
    const count = (shady: boolean) => {
      const s = readyGame(7);
      for (const c of s.customers) c.shady = shady;
      for (let h = 0; h < 730 * 6; h++) {
        s.hour++;
        opsTick(s);
      }
      return s.tickets.filter((t) => t.customerId && (t.kind === "notice" || t.kind === "legal")).length;
    };
    const normal = count(false), shady = count(true);
    expect(shady).toBeGreaterThan(normal * 5);
    expect(shady).toBeGreaterThan(5);
  });
});

describe("grid outages", () => {
  it("takes the basement dark without a UPS and records the incident", () => {
    const s = readyGame(1);
    const inc = gridOutage(s, s.locations[0], 150, createRng(1), []);
    expect(inc.dark).toBe(150);
    expect(inc.customers).toHaveLength(3);
    expect(powered(s, "dev3")).toBe(false);
    expect(linkStatus(s, "dev3").online).toBe(false);
    s.hour += 3;
    expect(powered(s, "dev3")).toBe(true);
  });

  it("a basement UPS carries a short outage", () => {
    const s = { ...readyGame(1), cash: 10_000 };
    const ups = ok(buyDevice(s, "ups-1500", "Eatin", 1, "loc1"));
    ok(mountDevice(s, ups, "rack2", 4));
    const inc = gridOutage(s, s.locations[0], 60, createRng(1), []);
    expect(inc.dark).toBe(0);
    expect(powered(s, "dev3")).toBe(true);
  });

  it("happens a few times a year in the basement and shows up as incidents", () => {
    const s = readyGame(2);
    run(s, 8760);
    const grid = s.ops.incidents.filter((i) => i.cause === "grid");
    expect(grid.length).toBeGreaterThan(0);
    expect(grid.length).toBeLessThan(10);
  });
});

describe("refunds", () => {
  it("a refund pays back one month and refusing one after a data loss loses the customer", () => {
    const { s } = twoNodes();
    seize(s, "dev3", "Europoll", hashRng(1), []);
    const [a, b] = s.tickets.filter((t) => t.kind === "refund");
    const cash = s.cash, monthly = monthlyValue(s.services, a.customerId);
    const happy = s.customers.find((c) => c.id === a.customerId)!.happiness;
    apply(s, a, "refund");
    expect(s.cash).toBeCloseTo(cash - monthly, 2);
    expect(s.customers.find((c) => c.id === a.customerId)!.happiness).toBe(happy + 20);
    apply(s, b, "reject");
    expect(s.customers.find((c) => c.id === b.customerId)!.churnedAt).toBe(s.hour);
  });
});

describe("saves", () => {
  it("an old save without incidents loads with an empty log", () => {
    const s = readyGame(1);
    const raw = JSON.parse(serialize(s));
    delete raw.ops;
    expect(deserialize(JSON.stringify(raw)).ops).toEqual({ incidents: [], seized: [], dark: {}, takedowns: {} });
  });
});
