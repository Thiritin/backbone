import { describe, expect, it } from "vitest";
import { chooseShop } from "../src/sim/90-actions/shop";
import { t } from "../src/i18n/en";
import { yearOf } from "../src/sim/00-core/time";
import { marketRates, marketSetup, sizeSpec, specPrice, TRAFFIC_SHARE } from "../src/sim/10-catalog/products";
import { share } from "../src/sim/30-market/market";
import { orderLead } from "../src/sim/30-market/orders";
import { offerPrice, setupFee, setupPremium, specFor, specText } from "../src/sim/30-market/spec";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { resetRates, setRate } from "../src/sim/90-actions/rates";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { automate, readyGame } from "./fixtures";

const withForm = (seed: number) => {
  const s = readyGame(seed);
  s.cash = 1e6;
  setUpChannel(s, "website");
  chooseShop(s, "handRolled");
  s.shop.optionDiscount = { annual: -3 };
  return automate(s);
};
const web = { product: "webHosting" as const, size: 1, sla: "basic" as const };

describe("DNS zones and VPN users", () => {
  it("vary between customers, show in the spec and are priced per unit", () => {
    const zones = new Set<number>(), users = new Set<number>();
    for (let key = 0; key < 40; key++) {
      const d = specFor(1, key, "dns", 1, 2006), v = specFor(1, key, "vpn", 1, 2006);
      zones.add(d.zones!);
      users.add(v.users!);
      const m = marketRates("dns", 2006);
      expect(specPrice("dns", d, 2006)).toBeCloseTo(m.base! + m.zone! * d.zones! + (m.traffic! * d.trafficGb) / 100, 2);
    }
    expect(zones.size).toBeGreaterThan(2);
    expect(users.size).toBeGreaterThan(2);
    expect(specText("dns", { ...sizeSpec("dns", 2, 2005), zones: 12 })).toBe("DNS hosting, 12 zones");
    expect(specText("vpn", { ...sizeSpec("vpn", 0, 2005), users: 1 })).toBe("VPN, 1 user");
    // economy.md: the middle sizes stay near the former €2 and €5 a service.
    expect(specPrice("dns", sizeSpec("dns", 1, 2005), 2005)).toBeCloseTo(2, 0);
    expect(specPrice("vpn", sizeSpec("vpn", 1, 2005), 2005)).toBeCloseTo(5, 0);
    expect(specPrice("vpn", sizeSpec("vpn", 2, 2005), 2005)).toBeGreaterThan(specPrice("vpn", sizeSpec("vpn", 0, 2005), 2005));
  });

  it("charge the player's per-zone rate on the order form", () => {
    const s = withForm(1), spec = { ...sizeSpec("dns", 1, yearOf(s.hour)), zones: 10 };
    const before = offerPrice(s, "dns", spec);
    expect(setRate(s, "dns", "zone", 1).ok).toBe(true);
    expect(offerPrice(s, "dns", spec)).toBeCloseTo(before + 10 * (1 - marketRates("dns", yearOf(s.hour)).zone!), 2);
  });
});

describe("traffic", () => {
  it("charges per 100 GB at its rate, a few percent of a bill that falls with the years", () => {
    const s = withForm(1), year = yearOf(s.hour), spec = sizeSpec("vps", 1, year);
    const before = offerPrice(s, "vps", spec);
    expect(setRate(s, "vps", "traffic", 10).ok).toBe(true);
    expect(offerPrice(s, "vps", spec)).toBeCloseTo(before + (10 - marketRates("vps", year).traffic!) * (spec.trafficGb / 100), 2);
    for (const p of ["webHosting", "vps", "gameServer", "dns", "vpn"] as const) {
      const mid = sizeSpec(p, 1, 2005), total = specPrice(p, mid, 2005), traffic = (marketRates(p, 2005).traffic! * mid.trafficGb) / 100;
      expect(traffic / total).toBeGreaterThan(0.01);
      expect(traffic / total).toBeLessThan(0.07);
    }
    expect(TRAFFIC_SHARE.gameServer!).toBeGreaterThan(TRAFFIC_SHARE.vps!);
    expect(marketRates("vps", 2020).traffic!).toBeLessThan(marketRates("vps", 2005).traffic!);
    expect(marketRates("domain", 2005).traffic).toBeUndefined();
  });
});

describe("setup fees", () => {
  it("bill a form order at once with the first month, and the monthly run skips that month", () => {
    const s = withForm(1);
    expect(setRate(s, "webHosting", "setup", 25).ok).toBe(true);
    const r = orderLead(s, "private", "Frankfurt", [], web, false);
    const won = s.sales.requests.find((x) => x.id === r.id)!;
    expect(won.status).toBe("won");
    const invs = s.invoices.filter((i) => i.customerId === won.customerId);
    expect(invs).toHaveLength(1);
    expect(invs[0].lines.map((l) => [l.key, l.amount])).toEqual([["invoice.line.setupFee", 25], ["invoice.line.firstMonth", won.quote]]);
    expect(t(invs[0].lines[0].key, invs[0].lines[0].params)).toMatch(/setup fee$/);
    const hours = () => s.invoices.flatMap((i) => i.lines).filter((l) => l.serviceId === won.serviceId && l.key === "invoice.line.hours");
    // The first month start after the order bills nothing for it; the one after bills the hours past the prepaid month.
    const until = s.services.find((v) => v.id === won.serviceId)!.prepaidUntil!;
    expect(until).toBe(s.hour + 730);
    while (s.hour < until) tick(s);
    expect(hours()).toHaveLength(0);
    for (let i = 0; i < 800 && !hours().length; i++) tick(s);
    expect(hours()).toHaveLength(1);
    expect(hours()[0].params.hours).toBeLessThan(730);
  });

  it("default to the market's, are set per line and leave out a zero fee", () => {
    const s = withForm(3), year = yearOf(s.hour);
    expect(setupFee(s, "vps")).toBe(marketSetup("vps", year));
    expect(marketSetup("dedicated", 2005)).toBeGreaterThan(marketSetup("vps", 2005));
    expect(marketSetup("vps", 2026)).toBeLessThan(marketSetup("vps", 2005));
    expect(setRate(s, "domain", "setup", 5)).toEqual({ ok: false, error: "error.unknownLineRate" });
    expect(setRate(s, "webHosting", "setup", 0).ok).toBe(true);
    const r = orderLead(s, "private", "Frankfurt", [], web, false);
    const won = s.sales.requests.find((x) => x.id === r.id)!;
    expect(s.invoices.find((i) => i.customerId === won.customerId)!.lines.map((l) => l.key)).toEqual(["invoice.line.firstMonth"]);
    expect(resetRates(s, "webHosting").ok).toBe(true);
    expect(setupFee(s, "webHosting")).toBe(marketSetup("webHosting", year));
  });

  it("lower the form's share of leads when above the market and raise it below", () => {
    const s = withForm(4), base = share(s, "private", "webHosting", "Frankfurt");
    expect(setupPremium(s, "webHosting")).toBe(0);
    setRate(s, "webHosting", "setup", 60);
    const dear = share(s, "private", "webHosting", "Frankfurt", setupPremium(s, "webHosting"));
    setRate(s, "webHosting", "setup", 0);
    const free = share(s, "private", "webHosting", "Frankfurt", setupPremium(s, "webHosting"));
    expect(dear).toBeLessThan(base);
    expect(free).toBeGreaterThan(base);
    // A small effect: twice the market fee costs less than a tenth of the share.
    setRate(s, "webHosting", "setup", 2 * marketSetup("webHosting", yearOf(s.hour)));
    expect(share(s, "private", "webHosting", "Frankfurt", setupPremium(s, "webHosting"))).toBeGreaterThan(0.9 * base);
  });
});

describe("old saves", () => {
  it("give DNS and VPN services without units the count their price buys, and keep rates and setup fees at the market", () => {
    const s: GameState = readyGame(5), year = yearOf(s.hour), friend = s.services[0];
    const dnsMarket = marketRates("dns", year);
    const spec = { ...sizeSpec("dns", 1, year) };
    delete spec.zones;
    const vpnSpec = { ...sizeSpec("vpn", 1, year) };
    delete vpnSpec.users;
    s.services = [
      ...s.services,
      { ...friend, id: "svc-dns", product: "dns", spec, price: (dnsMarket.base! + 8 * dnsMarket.zone! + (dnsMarket.traffic! * spec.trafficGb) / 100) / 730 },
      { ...friend, id: "svc-vpn", product: "vpn", spec: vpnSpec, sla: "business", price: 6 / 730 },
    ];
    const raw = JSON.parse(serialize(s));
    delete raw.rates;
    const back = deserialize(JSON.stringify(raw));
    expect(back.services.find((v) => v.id === "svc-dns")!.spec.zones).toBe(8);
    expect(back.services.find((v) => v.id === "svc-vpn")!.spec.users).toBeGreaterThanOrEqual(1);
    expect(back.rates).toEqual({});
    expect(setupFee(back, "vps")).toBe(marketSetup("vps", year));
  });
});
