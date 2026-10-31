import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { serviceOnline } from "../src/sim/40-support/status";
import { BREAK_CHANCE, channelOf, featureYear, targetYear, updateBreaks, type Channel } from "../src/sim/60-infra/channel";
import { workloadsOf } from "../src/sim/60-infra/cluster";
import { howToFactor } from "../src/sim/85-products/products";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { updateDue, updateSoftware } from "../src/sim/90-actions/software";
import { panelVm, readyGame } from "./fixtures";

const at = (y: number, m: number, d = 1) => hourOf(new Date(Date.UTC(y, m - 1, d)));

function setup(channel: Channel | undefined) {
  const s = readyGame(1);
  const id = panelVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, "cpanic");
  s.clusters = s.clusters.map((c) => (c.id === id ? { ...c, channel, version: 2005 } : c));
  s.hour = at(2006, 2, 1);
  const cus = addCustomer(s, "Ada Lang", "hobbyDev");
  const r = provisionService(s, cus, "webHosting", { label: "a.com", clusterId: id });
  const svc = (r as { id: string }).id;
  const host = () => s.clusters.find((c) => c.id === id)!;
  return { s, id, host, svc, cus };
}

describe("update channels", () => {
  it("targets the previous year until its month", () => {
    expect([1, 3, 4, 6, 7, 12].map((m) => targetYear("edge", at(2006, m)))).toEqual([2006, 2006, 2006, 2006, 2006, 2006]);
    expect([1, 3, 4, 6, 7, 12].map((m) => targetYear("release", at(2006, m)))).toEqual([2005, 2005, 2006, 2006, 2006, 2006]);
    expect([1, 3, 4, 6, 7, 12].map((m) => targetYear("stable", at(2006, m)))).toEqual([2005, 2005, 2005, 2005, 2006, 2006]);
  });

  it("makes an update due by channel and sets the channel's release", () => {
    for (const [channel, due] of [["edge", true], ["release", false], ["stable", false]] as const) {
      const { s, host } = setup(channel);
      expect(updateDue(s, host())).toBe(due);
    }
    const { s, id, host } = setup("edge");
    expect(updateSoftware(s, id).ok).toBe(true);
    expect(host().version).toBe(2006);
    expect(featureYear(s, host())).toBe(2006);
  });

  it("breaks at the channel's rate over a seeded sample", () => {
    const { s, host } = setup("stable");
    for (const channel of ["stable", "release", "edge"] as const) {
      const c = { ...host(), channel };
      let n = 0;
      for (let i = 0; i < 4000; i++) { s.hour = i; if (updateBreaks(s, c)) n++; }
      expect(Math.abs(n / 4000 - BREAK_CHANCE[channel])).toBeLessThan(0.03);
    }
  });

  it("keeps the customers of a broken update down for longer", () => {
    const { s, id, host, svc } = setup("edge");
    const day = s.hour;
    let bad = -1, good = -1;
    for (let h = day; (bad < 0 || good < 0) && h < day + 2000; h++) { s.hour = h; if (updateBreaks(s, host())) bad = bad < 0 ? h : bad; else good = good < 0 ? h : good; }
    s.hour = good;
    expect(updateSoftware(s, id).ok).toBe(true);
    expect(workloadsOf(s, svc)[0].busyUntil).toBeCloseTo(good + 0.5);
    s.clusters = s.clusters.map((c) => (c.id === id ? { ...c, version: 2005 } : c));
    s.hour = bad;
    expect(updateSoftware(s, id).ok).toBe(true);
    expect(workloadsOf(s, svc)[0].busyUntil).toBeCloseTo(bad + 6.5);
    s.hour = bad + 3;
    expect(serviceOnline(s, svc)).toBe(false);
  });

  it("cuts how-to tickets a little on Edge and defaults old clusters to Release", () => {
    expect(channelOf({})).toBe("release");
    const a = setup("release"), b = setup("edge");
    expect(howToFactor(b.s, b.cus)).toBeCloseTo(howToFactor(a.s, a.cus) * 0.97, 5);
  });
});
