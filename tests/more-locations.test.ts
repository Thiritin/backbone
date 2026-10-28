import { describe, expect, it } from "vitest";
import { CITIES } from "../src/sim/10-catalog/economy";
import { exchangeAt, zoneLinkPrice } from "../src/sim/10-catalog/network";
import { DATACENTERS, datacenterById, inUs, MOVE, regionOf } from "../src/sim/20-world/datacenters";
import type { Profile } from "../src/sim/30-customers/customers";
import { CITY_TLD } from "../src/sim/30-customers/domains";
import { registryCost } from "../src/sim/30-customers/registry";
import { orderLead } from "../src/sim/30-market/orders";
import { newGame, type GameState } from "../src/sim/50-state";
import { travelCost } from "../src/sim/60-infra/status";
import { addLocation } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { CITIES as MAP_CITIES } from "../src/ui/map/world-data";
import { readyGame } from "./fixtures";

const NEW = ["Düsseldorf", "Kerkrade", "Nuremberg", "Falkenstein", "Munich", "Ashburn", "New York", "Chicago", "Dallas", "Los Angeles"];
const US = ["Ashburn", "New York", "Chicago", "Dallas", "Los Angeles"];
const PROFILES: Profile[] = ["private", "gamer", "hobbyDev", "soleProp", "smallBiz", "agency", "office", "onlineShop", "enterprise"];
const web = { product: "webHosting" as const, plan: "web-s", sla: "basic" as const };
const rich = (): GameState => ({ ...newGame(3), cash: 1_000_000 });
const open = (s: GameState, dc: string) => {
  const r = addLocation(s, dc, "share", 8);
  if (!r.ok) throw new Error(r.error);
  return s.locations.find((l) => l.id === r.id)!;
};

describe("more locations", () => {
  it("gives every new city datacenters, a market, a region, a TLD and a map pin", () => {
    for (const city of NEW) {
      expect(DATACENTERS.some((d) => d.city === city)).toBe(true);
      expect(CITIES.some((c) => c.name === city)).toBe(true);
      expect(regionOf({ city })).toBeDefined();
      expect(CITY_TLD[city]).toBeDefined();
      expect(MAP_CITIES.some((c) => c.name === city)).toBe(true);
      expect(inUs(city)).toBe(US.includes(city));
    }
    for (const dc of DATACENTERS.filter((d) => d.exchange)) expect(exchangeAt(dc)?.name).toBe(dc.exchange!.name);
    expect(datacenterById("skyblink-eygelshoven")).toMatchObject({ city: "Kerkrade", provider: "skyblink", carriers: 20, positionPrice: 300, size: "small" });
    for (const id of ["equinox-du1", "interaction-dus", "ntd-dus1"]) expect(datacenterById(id).city).toBe("Düsseldorf");
    expect(datacenterById("equinox-du1").positionPrice).toBeLessThan(datacenterById("equinox-fr5").positionPrice);
  });

  it("names American customers the American way, on .com", () => {
    const s = readyGame(5);
    const leads = PROFILES.flatMap((p) => US.map((city) => orderLead(s, p, city, [], web)));
    for (const r of leads) expect(r.domain).toMatch(/^[a-z0-9-]+\.com$/);
    expect(leads.find((r) => r.profile === "enterprise")!.company).toMatch(/Industries Inc$/);
    expect(orderLead(s, "smallBiz", "Düsseldorf", [], web).domain).toMatch(/\.de$/);
    expect(orderLead(s, "smallBiz", "Kerkrade", [], web).domain).toMatch(/\.nl$/);
    expect(registryCost("example.com", 2005)).toBe(6);
  });

  it("opens locations in Düsseldorf, Kerkrade and Ashburn", () => {
    const s = rich();
    expect(open(s, "equinox-du1").az).toBe("dus1");
    expect(open(s, "skyblink-eygelshoven").az).toBe("ker1");
    expect(open(s, "equinox-dc2").az).toBe("ash1");
  });

  it("charges more to cross the Atlantic", () => {
    const s = rich();
    const [dus, ker, ash] = [open(s, "equinox-du1"), open(s, "skyblink-eygelshoven"), open(s, "equinox-dc2")];
    expect(travelCost(s, dus.id, ker.id)).toEqual(MOVE.otherCity);
    expect(travelCost(s, dus.id, ash.id)).toEqual(MOVE.overseas);
    expect(zoneLinkPrice("wave", 10, false, 2026, true)).toBe(zoneLinkPrice("wave", 10, false, 2026) / 3 * 10);
  });

  it("seeds the new datacenters when an old save loads", () => {
    const s = newGame(7);
    const old = JSON.parse(serialize(s));
    for (const dc of DATACENTERS.filter((d) => NEW.includes(d.city))) delete old.dcs[dc.id];
    const loaded = deserialize(JSON.stringify(old));
    for (const dc of DATACENTERS) expect(loaded.dcs[dc.id].others).toBeGreaterThan(0);
  });
});
