import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { hourOf } from "../src/sim/00-core/time";
import { GENERATIONS } from "../src/sim/10-catalog/economy";
import { MODELS, modelById, NET_LIFE, NEWEST, shopModels } from "../src/sim/10-catalog/hardware";
import { erodedPrice, FAILURE_FACTOR, outOfSupport, supportEnd } from "../src/sim/10-catalog/lifecycle";
import { presetPrice } from "../src/sim/10-catalog/parts";
import { type GameState } from "../src/sim/50-state";
import { failComponents, failureChance } from "../src/sim/88-tick/tick";
import { feed, NEWS, newsTick } from "../src/sim/80-business/news";
import { INSTALL_HOURS, installPart, removePart, replaceComponent, SWAP_HOURS } from "../src/sim/90-actions/hardware";
import { buyDevice, newGame } from "./fixtures";
import { withServer } from "./fixtures";

const jan = (year: number) => hourOf(new Date(Date.UTC(year, 0, 1, 9)));
const rich = (year: number): GameState => {
  const s = { ...withServer(newGame(1)), cash: 1_000_000 };
  s.hour = jan(year);
  return s;
};
const ok = (r: { ok: boolean; id?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;

// The newest model of each line stays on sale (Lane 5.2, Successors).

describe("hardware lifecycle", () => {
  it("gives every model an end of sale and support, except patch panels, unsold models and the newest servers", () => {
    for (const m of MODELS) {
      if (m.kind === "part" || m.price === 0 || m.kind === "kvm" || m.kind === "console" || m.kind === "oob") expect([m.until, m.supportYears], m.id).toEqual([null, 0]);
      else if (m.kind === "patch") expect(m.until, m.id).toBeNull();
      else if (m.server || m.nodes) {
        const i = GENERATIONS.findIndex((g) => g.year === m.from);
        expect([m.until, m.supportYears], m.id).toEqual([GENERATIONS[i + 2] ? GENERATIONS[i + 2].year - 1 : null, 5]);
      } else if (NEWEST.has(m.id)) expect(m.until, m.id).toBeNull();
      else if (m.kind === "ups" || m.kind === "pdu") expect([m.until, m.supportYears], m.id).toEqual([m.from + 8, 3]);
      else if (m.kind === "switch" || m.kind === "firewall") expect([m.until, m.supportYears], m.id).toEqual([m.from + NET_LIFE[m.brand!].sale, NET_LIFE[m.brand!].support]);
      else expect([m.until, m.supportYears], m.id).toEqual([m.from + 6, 5]);
    }
    expect(modelById("g1-compute")).toMatchObject({ until: 2010, supportYears: 5 });
    expect(supportEnd(modelById("sw-8"))).toBe(2016);
    expect(supportEnd(modelById("patch-24"))).toBeNull();
  });

  it("takes a switch out of the shop after its last year on sale", () => {
    const ids = (y: number) => shopModels(y).map((m) => m.id);
    expect(ids(2011)).toContain("sw-8");
    expect(ids(2012)).not.toContain("sw-8");
    expect(ids(2012)).toContain("sw-48");
    expect(ids(2040)).toContain("patch-24");
    const s = rich(2012);
    expect(buyDevice(s, "sw-8", "Sysko", 1, "loc1").ok).toBe(false);
    expect(buyDevice(s, "sw-48", "Sysko", 1, "loc1").ok).toBe(true);
  });

  it("announces the end of sale on the first of January after the last year", () => {
    const sw = NEWS.find((d) => d.id === "endOfSale.sw-8")!;
    expect(sw).toMatchObject({ key: "event.news.endOfSale", at: jan(2012), params: { name: "Catalust 2960-8TC", supportEnd: 2016 } });
    expect(NEWS.some((d) => d.id.startsWith("endOfSale.g1") || d.id.startsWith("endOfSale.patch"))).toBe(false);
    const s = newGame(1);
    s.hour = jan(2012);
    const e = newsTick(s).find((x) => x.key === "event.news.endOfSale" && x.params.name === "Catalust 2960-8TC")!;
    expect(t(`${e.key}.title`, e.params)).toBe("Catalust 2960-8TC off the market");
    expect(t(`${e.key}.text`, e.params)).toContain("Heize online");
    expect(feed(s).some((f) => f.key === "event.news.endOfSale")).toBe(true);
  });

  it("lowers a non-server price 5% a year from the second year of sale", () => {
    const m = modelById("sw-48");
    expect(presetPrice(m, m.from)).toBe(m.price);
    expect(presetPrice(m, m.from + 1)).toBe(Math.round(m.price * 0.95));
    expect(presetPrice(m, m.from + 3)).toBe(Math.round(m.price * 0.95 ** 3));
    expect(presetPrice(m, m.until!)).toBe(Math.round(m.price * 0.95 ** 6));
    expect(erodedPrice(m, 1000, m.until! + 4)).toBe(erodedPrice(m, 1000, m.until!));
    // A switch comes from one maker at its list price; the UPS keeps the maker factors.
    expect(presetPrice(m, m.from + 1, "Sysko")).toBe(Math.round(m.price * 0.95));
    expect(presetPrice(modelById("ups-3000"), 2006, "Vertivo")).toBe(Math.round(900 * 0.95 * 1.1));
    expect(presetPrice(modelById("patch-24"), 2030)).toBe(80);
  });

  it("leaves server prices to their parts", () => {
    const g1 = modelById("g1-compute");
    expect(erodedPrice(g1, g1.price, 2009)).toBe(g1.price);
    expect(presetPrice(g1, 2005)).toBe(g1.price);
  });

  it("is out of support only after end of support", () => {
    const m = modelById("sw-8");
    expect(outOfSupport(m, 2016)).toBe(false);
    expect(outOfSupport(m, 2017)).toBe(true);
    expect(outOfSupport(modelById("patch-24"), 2060)).toBe(false);
  });

  it("raises the failure rate by 20% out of support", () => {
    const rate = (year: number) => {
      const s = rich(year), d = dev(s, "dev3"), c = d.components[0];
      c.installedAt = s.hour;
      return failureChance(s, d, c);
    };
    expect(rate(2016)).toBeGreaterThan(0);
    expect(rate(2016) / rate(2015)).toBeCloseTo(FAILURE_FACTOR, 10);
    expect(rate(2015)).toBeCloseTo(rate(2010), 12);
  });

  it("doubles the swap time and charges the grey market out of support", () => {
    const swap = (year: number) => {
      const s = rich(year), d = dev(s, "dev3"), fan = d.components.find((c) => c.kind === "fan")!;
      s.devices = s.devices.map((x) => (x.id === "dev3" ? failComponents(s, x, [fan.id]) : x));
      ok(buyDevice(s, "part-fan", "Generic", 1, "loc1"));
      const cash = s.cash;
      ok(replaceComponent(s, "dev3", fan.id));
      return { hours: dev(s, "dev3").maintenance!.doneAt - s.hour, paid: cash - s.cash, grey: s.ledger.filter((e) => e.key === "ledger.greyMarket") };
    };
    const inside = swap(2015), past = swap(2016);
    expect(inside).toEqual({ hours: SWAP_HOURS, paid: 0, grey: [] });
    expect(past.hours).toBe(2 * SWAP_HOURS);
    expect(past.paid).toBe(12.5);
    expect(past.grey).toMatchObject([{ amount: -12.5, params: { component: "fan" } }]);
  });

  it("doubles the time to install and remove a part out of support", () => {
    const work = (year: number) => {
      const s = rich(year), d = dev(s, "dev3"), ram = d.components.find((c) => c.kind === "ram")!;
      d.on = false;
      ok(removePart(s, "dev3", ram.id));
      const remove = dev(s, "dev3").maintenance!.doneAt - s.hour;
      dev(s, "dev3").maintenance = null;
      const part = ok(buyDevice(s, "part-ram", "Generic", 1, "loc1"));
      const cash = s.cash;
      ok(installPart(s, "dev3", part));
      return { remove, install: dev(s, "dev3").maintenance!.doneAt - s.hour, paid: cash - s.cash };
    };
    const inside = work(2015), past = work(2016);
    expect(inside).toMatchObject({ remove: INSTALL_HOURS, install: INSTALL_HOURS, paid: 0 });
    expect(past).toMatchObject({ remove: 2 * INSTALL_HOURS, install: 2 * INSTALL_HOURS });
    expect(past.paid).toBeGreaterThan(0);
  });
});
