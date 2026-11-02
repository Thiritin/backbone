import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { leadCapShare, vmPlanGb, vmRatePerGb, vpsDemand, vpsPlanGb } from "../src/sim/10-catalog/economy";
import { marketPrice, SIZES, sizeSpec } from "../src/sim/10-catalog/products";
import { cityMarket, leadFlows, needsOf } from "../src/sim/30-market/market";
import { profileStats } from "../src/sim/40-support/tickets";
import { readyGame } from "./fixtures";

const plans = (year: number) => SIZES.vps.map((_, i) => {
  const spec = sizeSpec("vps", i, year);
  return [spec.vcpu, spec.ramGb, Math.round(marketPrice("vps", spec, year))];
});
const entry = (year: number) => marketPrice("vps", sizeSpec("vps", 0, year), year);
const months = Array.from({ length: 21 * 12 + 1 }, (_, m) => 2005 + m / 12);

describe("VPS plan sizes", () => {
  it("start at a quarter GB for €13 in 2005", () => {
    expect(plans(2005)).toEqual([[1, 0.25, 13], [1, 0.5, 20], [1, 1, 33], [1, 2, 61]]);
    expect(sizeSpec("cloud", 0, 2005)).toMatchObject({ vcpu: 1, ramGb: 0.5, diskGb: 10 });
  });

  it("end at 2 vCPUs and 4 GB for €6 in 2026", () => {
    expect(plans(2026)).toEqual([[2, 4, 6], [4, 8, 12], [8, 16, 24], [16, 32, 48]]);
    expect(sizeSpec("cloud", 0, 2026)).toMatchObject({ vcpu: 4, ramGb: 8, diskGb: 160 });
  });

  it("double every 5.25 years and follow the base RAM after 2026", () => {
    expect(vmPlanGb(2010.25)).toBeCloseTo(1, 9);
    expect(vmPlanGb(2033)).toBe(vpsPlanGb(2033));
  });
});

describe("VPS rates", () => {
  it("fall from €30 to €1.50 a GB and never rise", () => {
    expect([vmRatePerGb(2005), vmRatePerGb(2026), vmRatePerGb(2030)]).toEqual([30, 1.5, 1.5]);
    for (let i = 1; i < months.length; i++) expect(vmRatePerGb(months[i])).toBeLessThanOrEqual(vmRatePerGb(months[i - 1]));
  });

  it("keep the entry plan from rising year over year, from €12.66 to €6", () => {
    expect([entry(2005), entry(2026)]).toEqual([12.66, 6]);
    expect(entry(2010)).toBeCloseTo(9.39, 2);
    for (let i = 12; i < months.length; i++) expect(entry(months[i])).toBeLessThanOrEqual(entry(months[i - 12]));
    for (const y of months) expect(entry(y)).toBeGreaterThanOrEqual(6);
  });
});

describe("VPS demand", () => {
  it("grows from 1.5 in 2005 to 4 from mid 2013", () => {
    expect([2005, 2011, 2013.5, 2020].map(vpsDemand)).toEqual([1.5, 2, 4, 4]);
  });

  it("adds VPS leads on top and keeps the web hosting leads", () => {
    const s = readyGame(1), year = yearOf(s.hour);
    s.marketing = { ...s.marketing, awareness: Object.fromEntries(Object.keys(s.marketing.awareness).map((p) => [p, 1])) as typeof s.marketing.awareness };
    const f = leadFlows(s).find((x) => x.profile === "smallBiz")!, capped = leadCapShare(1) * cityMarket("Frankfurt", s.hour) * profileStats("smallBiz").mix;
    const leads = Object.fromEntries(needsOf("smallBiz", year).map(([p, w]) => [p, w * f.leads]));
    expect(leads.webHosting).toBeCloseTo(0.6 * capped);
    expect(leads.vps).toBeCloseTo(0.4 * vpsDemand(year) * capped);
  });
});
