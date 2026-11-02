import { describe, expect, it } from "vitest";
import { nowMinutes } from "../src/sim/00-core/time";
import { companyDomain } from "../src/sim/30-customers/domains";
import { monthlyDomains, wholesale } from "../src/sim/30-customers/registrar";
import { domainOf, nameServers, NS_MINUTES, nsPropagating, parked } from "../src/sim/30-customers/registry";
import { resolve } from "../src/sim/80-business/browser";
import { siteStatus } from "../src/sim/80-business/website";
import { tick } from "../src/sim/88-tick/tick";
import { orderDomain, setNameServers } from "../src/sim/90-actions/registrar";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";

const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);

describe("orderDomain", () => {
  it("parks a further company domain at the partner and adds its twelfth to the monthly bill", () => {
    const s = readyGame(3), before = monthlyDomains(s);
    expect(err(orderDomain(s, "abc"))).toBe("error.domainInvalid");
    expect(err(orderDomain(s, companyDomain(s)))).toBe("error.domainTaken");
    expect(orderDomain(s, " Second-Shop.de ").ok).toBe(true);
    const d = domainOf(s, "second-shop.de")!;
    expect(d.customerId).toBeNull();
    expect(parked(s, d)).toBe(true);
    expect(nameServers(s, d)).toEqual(["ns1.namecheep.com", "ns2.namecheep.com"]);
    expect(monthlyDomains(s)).toBeCloseTo(before + wholesale(s, "second-shop.de") / 12, 1);
    s.registrar = null;
    expect(err(orderDomain(s, "third-shop.de"))).toBe("error.needsRegistrar");
  });
});

describe("name servers", () => {
  it("shows the parking page and reaches the company only after propagation", () => {
    const s = readyGame(4);
    orderDomain(s, "second-shop.de");
    expect(resolve(s, "www.second-shop.de").page).toEqual({ kind: "parked", registrar: "nameCheep", domain: "second-shop.de" });
    expect(setNameServers(s, "second-shop.de", "company").ok).toBe(true);
    const d = () => domainOf(s, "second-shop.de")!;
    expect(nsPropagating(s, d())).toBe(true);
    expect(resolve(s, "second-shop.de").page.kind).toBe("parked");
    const ready = nowMinutes(s) + NS_MINUTES;
    while (nowMinutes(s) < ready) tick(s);
    expect(nsPropagating(s, d())).toBe(false);
    expect(parked(s, d())).toBe(false);
    expect(nameServers(s, d())).toEqual([`ns1.${companyDomain(s)}`, `ns2.${companyDomain(s)}`]);
    expect(resolve(s, "second-shop.de").page.kind).toBe("notfound");
  });

  it("takes the company site down while its domain is parked", () => {
    const s = readyGame(5), host = companyDomain(s);
    expect(resolve(s, host).page.kind).toBe("company");
    expect(siteStatus(s)).toBe("up");
    setNameServers(s, host, "registrar");
    const ready = nowMinutes(s) + NS_MINUTES;
    while (nowMinutes(s) < ready) tick(s);
    expect(resolve(s, `www.${host}`).page.kind).toBe("parked");
    expect(siteStatus(s)).toBe("down");
    setNameServers(s, host, "custom", ["ns1.elsewhere.de", "ns2.elsewhere.de"]);
    while (nowMinutes(s) < ready + NS_MINUTES) tick(s);
    expect(resolve(s, host).page.kind).toBe("notfound");
    expect(nameServers(s, domainOf(s, host)!)).toEqual(["ns1.elsewhere.de", "ns2.elsewhere.de"]);
  });

  it("validates custom hosts and ignores an unchanged setting", () => {
    const s = readyGame(6), host = companyDomain(s);
    expect(err(setNameServers(s, "nope.de", "company"))).toBe("error.unknownDomain");
    expect(err(setNameServers(s, host, "custom"))).toBe("error.nsInvalid");
    for (const bad of [["ns1", "ns2.a.de"], ["ns1.a.de", "ns1.a.de"], ["-x.a.de", "ns2.a.de"], ["ns1.a.de", "ns 2.a.de"]] as [string, string][]) {
      expect(err(setNameServers(s, host, "custom", bad))).toBe("error.nsInvalid");
    }
    expect(setNameServers(s, host, "company").ok).toBe(true);
    expect(domainOf(s, host)!.nsReadyAt).toBeUndefined();
  });
});

describe("save", () => {
  it("loads domains saved before name servers on the company's own", () => {
    const s = readyGame(8), raw = JSON.parse(serialize(s));
    for (const d of raw.domains) delete d.ns;
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.domains.length).toBeGreaterThan(0);
    for (const d of loaded.domains) expect(d.ns).toBe("company");
    expect(resolve(loaded, companyDomain(loaded)).page.kind).toBe("company");
  });
});
