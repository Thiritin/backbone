import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { nextMonthStart, yearOf } from "../src/sim/00-core/time";
import { marketRates, marketSetup, sizeSpec, specPrice, TRAFFIC_SHARE } from "../src/sim/10-catalog/products";
import { orderLead } from "../src/sim/30-market/orders";
import { setupFee, specFor, specText } from "../src/sim/30-market/spec";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { createProduct, createProductGroup } from "../src/sim/90-actions/portal";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { automate, readyGame, openShop } from "./fixtures";

const withShop = (seed: number) => {
  const s = readyGame(seed);
  s.cash = 1e6;
  openShop(s);
  s.shop.optionDiscount = { quarterly: -3, annual: -3, biennial: -3 };
  automate(s);
  createProduct(s, (createProductGroup(s, "Plans") as { id: string }).id, "Web", "webHosting");
  return s;
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
    // economy/README.md: the middle sizes stay near the former €2 and €5 a service.
    expect(specPrice("dns", sizeSpec("dns", 1, 2005), 2005)).toBeCloseTo(2, 0);
    expect(specPrice("vpn", sizeSpec("vpn", 1, 2005), 2005)).toBeCloseTo(5, 0);
    expect(specPrice("vpn", sizeSpec("vpn", 2, 2005), 2005)).toBeGreaterThan(specPrice("vpn", sizeSpec("vpn", 0, 2005), 2005));
  });
});

describe("traffic", () => {
  it("charges per 100 GB at the market rate, a few percent of a bill that falls with the years", () => {
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
  it("bill a shop order at once with the first month, and the monthly run skips that month", () => {
    const s = withShop(1), fee = setupFee(s, "webHosting");
    const r = orderLead(s, "private", "Frankfurt", [], web, false, undefined, undefined, s.shop.products[0]);
    const won = s.sales.requests.find((x) => x.id === r.id)!;
    expect(won.status).toBe("won");
    const invs = s.invoices.filter((i) => i.customerId === won.customerId);
    expect(invs).toHaveLength(1);
    expect(invs[0].lines.map((l) => [l.key, l.amount])).toEqual([["invoice.line.setupFee", fee], ["invoice.line.firstMonth", won.quote]]);
    expect(t(invs[0].lines[0].key, invs[0].lines[0].params)).toMatch(/setup fee$/);
    const hours = () => s.invoices.flatMap((i) => i.lines).filter((l) => l.serviceId === won.serviceId && l.key === "invoice.line.hours");
    // The first month start after the order bills nothing for it; the one after bills the hours past the prepaid month.
    const until = s.services.find((v) => v.id === won.serviceId)!.prepaidUntil!;
    expect(until).toBe(s.hour + 730);
    const toMonthStart = () => { s.hour = nextMonthStart(s.hour) - 1; tick(s); };
    while (nextMonthStart(s.hour) < until) toMonthStart();
    expect(hours()).toHaveLength(0);
    toMonthStart();
    expect(hours()).toHaveLength(1);
    expect(hours()[0].params.hours).toBeLessThan(730);
  });

  it("default to the market's and fall with the years", () => {
    const s = withShop(3), year = yearOf(s.hour);
    expect(setupFee(s, "vps")).toBe(marketSetup("vps", year));
    expect(marketSetup("dedicated", 2005)).toBeGreaterThan(marketSetup("vps", 2005));
    expect(marketSetup("vps", 2026)).toBeLessThan(marketSetup("vps", 2005));
  });
});

describe("old saves", () => {
  it("give DNS and VPN services without units the count their price buys, and drop saved rates", () => {
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
    raw.rates = { dns: { zone: 1 } };
    const back = deserialize(JSON.stringify(raw));
    expect(back.services.find((v) => v.id === "svc-dns")!.spec.zones).toBe(8);
    expect(back.services.find((v) => v.id === "svc-vpn")!.spec.users).toBeGreaterThanOrEqual(1);
    expect("rates" in back).toBe(false);
    expect(setupFee(back, "vps")).toBe(marketSetup("vps", year));
  });
});
