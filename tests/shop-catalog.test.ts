import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { tiersOf } from "../src/sim/10-catalog/licence-tiers";
import { SHOP_LICENCES, shopEditionFor, shopEra, shopKeyPrice, shopLease, shopOnSale, shopUpfront } from "../src/sim/10-catalog/shop-licences";
import { SHOPS } from "../src/sim/10-catalog/shops";
import { UI_LOOKS, versionAt, versionsOf } from "../src/sim/10-catalog/software-versions";
import { isLicensed, productOf } from "../src/sim/60-infra/licence";
import { offers } from "../src/sim/80-business/vendor-shop";
import { shopBills } from "../src/sim/80-business/shop";
import { readyGame } from "./fixtures";

const at = (ym: string) => hourOfMonth(ym);

describe("shop system versions", () => {
  it("give every variant a version line with a look per generation", () => {
    for (const v of SHOPS) {
      expect(versionsOf(v.id).length).toBeGreaterThan(1);
      for (const [version] of UI_LOOKS[v.id]) expect(versionsOf(v.id).some((x) => x.version === version)).toBe(true);
    }
  });

  it("return the release out in a given month", () => {
    expect(versionAt("whmCache", at("2005-01")).major).toBe("2");
    expect(versionAt("whmCache", at("2015-06")).major).toBe("6");
    expect(versionAt("whmCache", at("2020-09")).major).toBe("8");
    expect(versionAt("blessta", at("2014-01")).major).toBe("3");
    expect(versionAt("ubersmyth", at("2016-04")).version).toBe("4.0");
    expect(versionAt("hostBull", at("2020-01")).version).toBe("2019");
    expect(versionAt("boxBillin", at("2024-01"))).toMatchObject({ major: "0.6", name: "FOSSBillin'" });
    expect(versionAt("modemBill", at("2009-01")).securityUntil).toBe(at("2010-12"));
  });
});

describe("shop system licences", () => {
  it("are products of the licence catalog", () => {
    expect(SHOP_LICENCES.map((x) => x.id)).toEqual(SHOPS.map((x) => x.id));
    expect(productOf("blessta")?.name).toBe("Blessta");
    expect(isLicensed("blessta")).toBe(true);
    expect(isLicensed("orderBocks")).toBe(false);
  });

  it("sell the era's options in each year", () => {
    expect(shopKeyPrice("whmCache", at("2006-01"))).toBe(250);
    expect(shopKeyPrice("whmCache", at("2008-01"))).toBe(325);
    expect(shopEra("whmCache", at("2008-01"))).toMatchObject({ updates: 12, updatesFee: 45 });
    expect(shopKeyPrice("whmCache", at("2021-01"))).toBeNull();
    expect(shopLease("whmCache", at("2021-01"))).toBe(18);
    expect(shopLease("blessta", at("2008-01"))).toBe(13);
    expect(shopLease("blessta", at("2011-01"))).toBeNull();
    expect(shopKeyPrice("blessta", at("2011-01"))).toBe(100);
    expect(shopOnSale("modemBill", at("2010-12"))).toBe(true);
    expect(shopOnSale("modemBill", at("2011-01"))).toBe(false);
    expect(offers("modemBill", at("2011-01"))).toEqual([]);
    expect(shopOnSale("hostBull", at("2008-06"))).toBe(false);
    expect(shopUpfront("ubersmyth", at("2010-01"))).toBe(1000);
    expect(shopUpfront("ubersmyth", at("2017-01"))).toBe(2500);
    expect(shopEra("orderBocks", at("2010-01"))).toMatchObject({ kind: "free", cut: 0.06 });
    expect(shopEra("boxBillin", at("2012-01")).kind).toBe("free");
  });

  it("cap editions by active clients or managed servers", () => {
    expect(tiersOf("whmCache").map((x) => x.cap)).toEqual([null, 250, 500, 1000, 5000, null]);
    expect(shopEditionFor("whmCache", at("2005-01"), 4000)?.id).toBe("leased");
    expect(shopEditionFor("whmCache", at("2021-01"), 300)?.id).toBe("professional");
    expect(shopEditionFor("whmCache", at("2021-01"), 20_000)?.id).toBe("unlimited");
    expect(shopEditionFor("ubersmyth", at("2010-01"), 0)?.id).toBe("starter");
    expect(shopEditionFor("ubersmyth", at("2017-01"), 0)?.id).toBe("standard");
    expect(shopEditionFor("modemBill", at("2006-01"), 51)?.id).toBe("unlimited");
  });

  it("bill a lease by the edition the active clients need", () => {
    const s = readyGame(41);
    s.hour = at("2021-02");
    s.shop = { ...s.shop, variant: "whmCache", owned: false, since: at("2021-01") };
    const active = s.customers.filter((c) => c.churnedAt === null).length;
    expect(shopBills(s)).toEqual([{ key: "ledger.shopLicence", params: { name: "WHMCache" }, amount: shopLease("whmCache", s.hour, active) }]);
  });
});
