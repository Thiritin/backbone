import { describe, expect, it } from "vitest";
import { curveFor, growthRate, JOB_CPU, nightJob, TRAFFIC_USE, trafficShape } from "../src/sim/10-catalog/usage";
import type { Product, Profile } from "../src/sim/30-customers/customers";
import type { GameState } from "../src/sim/50-state";
import { serviceMbps } from "../src/sim/60-infra/network";
import { ASK_FILL, backupFlows, diskFill, FULL_PENALTY, portLinks, usageOf, usageTick, workloadLoad } from "../src/sim/60-infra/usage";
import { provisionService, setBackup } from "../src/sim/90-actions/clusters";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { connect, setPower } from "../src/sim/90-actions/hardware";
import { buyDevice } from "./fixtures";
import { named, panelServer, readyGame } from "./fixtures";
import { mountDevice } from "./plugged";

type R = ReturnType<typeof setPower>;
const ok = (r: R) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};

const dev = (s: ReturnType<typeof readyGame>, id: string) => s.devices.find((d) => d.id === id)!;

describe("utilization", () => {
  it("shows the friends' load on the server, its switch, rack and location", () => {
    const s = readyGame(1);
    const u = usageOf(s, [dev(s, "dev3")]);
    for (const k of ["cpu", "ram", "disk", "net"] as const) expect(u[k]).toBeGreaterThan(0);
    for (const k of ["cpu", "ram", "disk", "net"] as const) expect(u[k]).toBeLessThanOrEqual(1);
    expect(usageOf(s, s.devices.filter((d) => d.rackId === dev(s, "dev3").rackId))).toEqual(u);
    expect(usageOf(s, [dev(s, "dev4")]).net).toBeGreaterThan(0);
  });

  it("changes over the day and goes dark when the server is off", () => {
    const s = readyGame(1);
    const day = Array.from({ length: 24 }, (_, h) => { s.hour = h; return usageOf(s, [dev(s, "dev3")]).cpu; });
    expect(Math.max(...day)).toBeGreaterThan(Math.min(...day));
    setPower(s, "dev3", false);
    expect(usageOf(s, [dev(s, "dev3")])).toEqual({ cpu: 0, ram: 0, disk: 0, net: 0 });
  });
});

const shape = (s: GameState, id: string) => { const v = s.services.find((x) => x.id === id)!; return serviceMbps(s, v); };
// A customer with a service on the friends' cluster; the customer id is redrawn until its traits match.
function customerWith(s: GameState, profile: Profile, product: Product, want: (id: string) => boolean = () => true) {
  let cus = addCustomer(s, `C${s.nextId}`, profile);
  while (!want(cus)) cus = addCustomer(s, `C${s.nextId}`, profile);
  const v = ok(provisionService(s, cus, product, { label: `${product} ${s.nextId}` }));
  return { cus, v };
}
const at = (day: number, h: number) => day * 24 + h;
// Hour 0 is Saturday 1 January 2005; day 3 is a Tuesday.
const TUE = 3, SAT = 7;

describe("traffic follows activity", () => {
  it("rises and falls with the load over a day, and weekends differ from weekdays", () => {
    const s = readyGame(3);
    const { v, cus } = customerWith(s, "smallBiz", "webHosting");
    const quiet = (h: number) => nightJob(s.seed, cus, h) === 0;
    const day = Array.from({ length: 24 }, (_, h) => { s.hour = at(TUE, h); return { h, mbps: shape(s, v) }; }).filter((x) => quiet(at(TUE, x.h)));
    const peak = day.reduce((a, b) => (b.mbps > a.mbps ? b : a)), low = day.reduce((a, b) => (b.mbps < a.mbps ? b : a));
    expect(peak.h).toBeGreaterThanOrEqual(8);
    expect(peak.h).toBeLessThanOrEqual(18);
    expect(peak.mbps).toBeGreaterThan(low.mbps * 4);
    s.hour = at(TUE, 10); const weekday = shape(s, v);
    s.hour = at(SAT, 10); expect(shape(s, v)).toBeLessThan(weekday / 3);
  });

  it("keeps game servers busier at night than websites", () => {
    const s = readyGame(1);
    const game = customerWith(s, "gamer", "gameServer"), web = customerWith(s, "private", "webHosting");
    const base = (x: { v: string; cus: string }) => {
      const v = s.services.find((y) => y.id === x.v)!, c = s.customers.find((y) => y.id === x.cus)!;
      return Math.min(...Array.from({ length: 24 }, (_, h) => trafficShape(s.seed, v, c.profile, at(TUE, h))));
    };
    expect(base(game)).toBeGreaterThan(base(web) * 2);
  });

  it("keeps a month's traffic at the economy table's figure", () => {
    const s = readyGame(5);
    const ids = (["gameServer", "webHosting", "vps", "vpn"] as Product[]).flatMap((p) =>
      (["gamer", "smallBiz", "onlineShop", "private"] as Profile[]).map((prof) => addService(s, addCustomer(s, `C${s.nextId}`, prof), p, p, 1, "hour")));
    for (const id of ids) {
      const v = s.services.find((x) => x.id === id)!;
      let gb = 0;
      for (let h = 0; h < 730; h++) { s.hour = h; gb += (shape(s, id) * 3600) / 8000; }
      const use = TRAFFIC_USE[curveFor(v.product, s.customers.find((c) => c.id === v.customerId)!.profile, s.seed, v.customerId)] ?? 1;
      expect(gb / v.spec.trafficGb / use).toBeGreaterThan(0.9);
      expect(gb / v.spec.trafficGb / use).toBeLessThan(1.1);
    }
  });
});

describe("night jobs", () => {
  it("run for an hour at each customer's drawn time and raise CPU and traffic", () => {
    const s = readyGame(6);
    const starts = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const id = `cus${i}`, day = Array.from({ length: 24 }, (_, h) => nightJob(s.seed, id, at(TUE, h)));
      expect(day.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
      expect(day.slice(7).every((x) => x === 0)).toBe(true);
      starts.add(day.findIndex((x) => x > 0) + (day.find((x) => x > 0)! < 1 ? 0.5 : 0));
    }
    expect(starts.size).toBeGreaterThan(5);
    expect([...starts].some((h) => h % 1 === 0.5)).toBe(true);
    const { v, cus } = customerWith(s, "smallBiz", "vps", (id) => nightJob(s.seed, id, at(TUE, 3)) === 1 && nightJob(s.seed, id, at(TUE + 1, 3)) === 1);
    const w = s.workloads.find((x) => x.serviceId === v)!;
    expect(workloadLoad(s, w, at(TUE, 3))).toBeGreaterThan(workloadLoad(s, w, at(TUE, 5)) + JOB_CPU * 0.6);
    s.hour = at(TUE, 3); const job = shape(s, v);
    s.hour = at(TUE, 5); expect(job).toBeGreaterThan(shape(s, v) * 3);
    expect(nightJob(s.seed, cus, at(TUE, 4))).toBe(0);
  });

  it("send the player's cluster backups from the source servers to the target at 02:00", () => {
    const s = readyGame(7);
    s.cash = 100_000;
    const third = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
    ok(mountDevice(s, third, "rack2", 3));
    ok(connect(s, { device: third, port: 0 }, { device: "dev4", port: 2 }));
    const backup = named(s, panelServer(s, third, "backula"), "Backup 1");
    ok(setBackup(s, s.clusters[0].id, backup, "daily"));
    s.hour = at(TUE, 2);
    const flows = backupFlows(s);
    expect(flows.map((f) => [f.from, f.to])).toEqual([["dev3", third]]);
    expect(portLinks(s).get(third)![0]!.mbps).toBeCloseTo(flows[0].mbps, 6);
    expect(usageOf(s, [dev(s, third)]).net).toBeGreaterThan(0);
    s.hour = at(TUE, 3);
    expect(backupFlows(s)).toEqual([]);
    expect(portLinks(s).get(third)![0]!.mbps).toBe(0);
  });
});

describe("growth", () => {
  const years = (y: number) => Math.round(y * 8760 / 24) * 24 + 12;
  it("fills disks per customer up to the booked limit and asks for more room near it", () => {
    const s = readyGame(8);
    const fast = customerWith(s, "smallBiz", "vps", (id) => growthRate(s.seed, id, "disk") === 0.5 && growthRate(s.seed, id, "cpu") < 0.5);
    const flat = customerWith(s, "smallBiz", "vps", (id) => growthRate(s.seed, id, "disk") === 0.02 && growthRate(s.seed, id, "cpu") < 0.5);
    const wOf = (v: string) => s.workloads.find((w) => w.serviceId === v)!;
    expect(diskFill(s, wOf(fast.v), years(1))).toBeCloseTo(0.8, 2);
    expect(diskFill(s, wOf(flat.v), years(2))).toBeLessThan(0.35);
    expect(diskFill(s, wOf(fast.v), years(3))).toBe(1);
    s.hour = years(1.25);
    expect(diskFill(s, wOf(fast.v), s.hour)).toBeGreaterThan(ASK_FILL);
    for (let d = 0; d < 60 && !s.tickets.some((t) => t.serviceId === fast.v); d++, s.hour += 24) usageTick(s);
    expect(s.tickets.filter((t) => t.serviceId === fast.v).map((t) => [t.kind, t.topic])).toEqual([["upgrade", "disk"]]);
    expect(s.tickets.some((t) => t.serviceId === flat.v)).toBe(false);
  });

  it("breaks a full disk's site until the customer writes in", () => {
    const s = readyGame(9);
    const fast = customerWith(s, "smallBiz", "vps", (id) => growthRate(s.seed, id, "disk") === 0.5);
    s.hour = years(1.5);
    const before = s.customers.find((c) => c.id === fast.cus)!.happiness;
    for (let d = 0; d < 30 && !s.tickets.some((t) => t.serviceId === fast.v); d++, s.hour += 24) usageTick(s);
    expect(s.tickets.find((t) => t.serviceId === fast.v)?.topic).toBe("full");
    expect(s.customers.find((c) => c.id === fast.cus)!.happiness).toBeLessThanOrEqual(before - FULL_PENALTY);
  });

  it("asks for an upgrade when the CPU runs near 100% most of the week", () => {
    const s = readyGame(10);
    const busy = customerWith(s, "onlineShop", "vps", (id) => growthRate(s.seed, id, "cpu") === 0.5 && growthRate(s.seed, id, "disk") === 0.02);
    const w = s.workloads.find((x) => x.serviceId === busy.v)!;
    const share = (from: number) => Array.from({ length: 168 }, (_, h) => workloadLoad(s, w, from + h)).filter((x) => x >= 0.9).length / 168;
    expect(share(years(0))).toBeLessThan(0.1);
    s.hour = years(4);
    expect(share(s.hour)).toBeGreaterThan(0.5);
    for (let d = 0; d < 60 && !s.tickets.some((t) => t.serviceId === busy.v); d++, s.hour += 24) usageTick(s);
    expect(s.tickets.find((t) => t.serviceId === busy.v)?.topic).toBe("cpu");
  });
});
