import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { shopEditionFor } from "../src/sim/10-catalog/shop-licences";
import { nextMajor, versionAt, versionInfo } from "../src/sim/10-catalog/software-versions";
import type { GameState } from "../src/sim/50-state";
import { accountsOn, assignedKey, assignKey, issueKey, licenceStatus, SHOP_MACHINE, yearAfter } from "../src/sim/60-infra/licence";
import { clusterFactor } from "../src/sim/60-infra/lifecycle";
import { companyDomain } from "../src/sim/30-customers/domains";
import { resolve } from "../src/sim/80-business/browser";
import { shopUpdate } from "../src/sim/80-business/shop";
import { shopBlock } from "../src/sim/80-business/website";
import { renewKeys } from "../src/sim/85-products/products";
import { activateLicence } from "../src/sim/90-actions/licence";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { chooseShop, installShop, renewShopUpdates, updateShop, upgradeShop } from "../src/sim/90-actions/shop";
import { deserialize, serialize } from "../src/sim/91-save/save";
import type { ActionResult } from "../src/sim/90-actions/hardware";
import { readyGame } from "./fixtures";

// readyGame's FreePanel VM is the first panel host.
const panelHost = (s: GameState) => s.clusters.find((c) => c.kind === "panel")!;
const game = (ym: string, seed = 5): GameState => {
  const s = readyGame(seed);
  s.hour = hourOfMonth(ym);
  s.cash = 1e6;
  s.marketing.launched = true;
  setUpChannel(s, "website");
  s.unlocks = [...s.unlocks, "shops"];
  return s;
};
const err = (r: ActionResult): string | null => (r.ok ? null : r.error);
const ok = (r: ActionResult) => expect(err(r)).toBeNull();
const chosen = (ym: string, id: Parameters<typeof chooseShop>[1], own = false) => {
  const s = game(ym);
  ok(chooseShop(s, id, own));
  s.shop.readyAt = s.hour;
  return s;
};
const key = (s: GameState) => assignedKey(s, SHOP_MACHINE, s.shop.variant!)!;

describe("installing a shop system", () => {
  it("puts the chosen shop with its key into a web space of the first panel host", () => {
    const s = game("2009-05"), c = panelHost(s), before = accountsOn(s, c);
    ok(chooseShop(s, "clientExit", true));
    expect(s.shop.install).toEqual({ clusterId: c.id, version: versionAt("clientExit", s.hour).version, at: s.hour });
    expect(accountsOn(s, c)).toBe(before + 1);
    expect(key(s)).toMatchObject({ kind: "once", covers: { kind: "version", major: versionAt("clientExit", s.hour).major } });
    expect(licenceStatus(s, SHOP_MACHINE, "clientExit")).toBe("active");
  });

  it("needs a panel host, and a key for a shop without a trial", () => {
    const s = game("2009-05");
    s.shop = { ...s.shop, variant: "whmCache" };
    expect(err(installShop(s, s.clusters.find((c) => c.kind !== "panel")!.id))).toBe("error.shopHostPanel");
    expect(err(installShop(s, panelHost(s).id))).toBe("error.licenceKey");
    const k = issueKey(s, "whmCache", null);
    ok(installShop(s, panelHost(s).id, k.key.toLowerCase()));
    expect(key(s).id).toBe(k.id);
    expect(err(installShop(s, panelHost(s).id))).toBe("error.shopInUse");
  });

  it("takes orders only while installed, its host up and its licence valid", () => {
    const s = game("2009-05"), portal = `portal.${companyDomain(s)}/`;
    s.clusters = s.clusters.filter((c) => c.kind !== "panel");
    ok(chooseShop(s, "clientExit", true));
    s.shop.readyAt = s.hour;
    expect(shopBlock(s)).toBe("error.shopNotInstalled");
    expect(resolve(s, portal).page.kind).toBe("notfound");
    const t = chosen("2009-05", "clientExit", true);
    expect(shopBlock(t)).toBeNull();
    expect(resolve(t, `portal.${companyDomain(t)}/`)).toMatchObject({ page: { kind: "shop" }, load: "fast" });
    t.security = { ...t.security, offline: [...t.security.offline, panelHost(t).id] };
    expect(shopBlock(t)).toBe("error.shopDown");
    expect(resolve(t, `portal.${companyDomain(t)}/`).load).toBe("down");
  });
});

describe("shop licences", () => {
  it("run a trial, then block orders until a key is entered", () => {
    const s = chosen("2009-05", "clientExit", true);
    const bought = key(s);
    s.licenses = s.licenses.map((k) => ({ ...k, machineId: null }));
    s.shop.install = null;
    ok(installShop(s, panelHost(s).id));
    expect(licenceStatus(s, SHOP_MACHINE, "clientExit")).toBe("trial");
    s.hour += 15 * 24;
    expect(shopBlock(s)).toBe("error.licenceExpired");
    ok(activateLicence(s, SHOP_MACHINE, "clientExit", bought.key));
    expect(shopBlock(s)).toBeNull();
  });

  it("block new orders once the edition's client cap is full", () => {
    const s = chosen("2006-03", "modemBill", true);
    assignKey(s, issueKey(s, "modemBill", "lite").id, SHOP_MACHINE);
    const live = s.customers.find((c) => c.churnedAt === null)!;
    const n = s.customers.filter((c) => c.churnedAt === null).length;
    s.customers = [...s.customers, ...Array.from({ length: 49 - n }, (_, i) => ({ ...live, id: `cap${i}` }))];
    expect(shopBlock(s)).toBeNull();
    s.customers = [...s.customers, { ...live, id: "cap-last" }];
    expect(shopBlock(s)).toBe("error.licenceCap");
  });

  it("let a lease lapse after the grace days and block orders", () => {
    const s = chosen("2021-03", "whmCache");
    const k = key(s), active = s.customers.filter((c) => c.churnedAt === null).length;
    expect(k).toMatchObject({ edition: shopEditionFor("whmCache", s.hour, active)!.id, covers: { kind: "term" } });
    s.cash = 0;
    s.bank = null;
    s.hour = k.renewsAt! + 8 * 24;
    renewKeys(s);
    expect(licenceStatus(s, SHOP_MACHINE, "whmCache")).toBe("lapsed");
    expect(shopBlock(s)).toBe("error.licenceExpired");
  });
});

describe("shop updates", () => {
  it("install minor updates only inside the key's updates window, which a renewal extends", () => {
    const s = chosen("2008-04", "whmCache", true), k = key(s);
    expect(s.shop.install!.version).toBe("3.0");
    expect(k.updatesUntil).toBe(yearAfter(k.boughtAt));
    s.hour = hourOfMonth("2010-01");
    expect(shopUpdate(s)).toBeNull();
    expect(err(updateShop(s))).toBe("error.noUpdate");
    const cash = s.cash;
    ok(renewShopUpdates(s));
    expect(s.cash).toBe(cash - 45);
    expect(key(s).updatesUntil).toBe(yearAfter(s.hour));
    // Version 4.0 is a new major the key does not cover.
    expect(shopUpdate(s)).toBeNull();
  });

  it("upgrade to the next major at the vendor's price for a key of the new major", () => {
    const s = chosen("2008-04", "whmCache", true), old = key(s);
    s.hour = hourOfMonth("2009-08");
    const next = nextMajor("whmCache", s.shop.install!.version, s.hour)!, cash = s.cash;
    ok(upgradeShop(s));
    expect(s.shop.install!.version).toBe(next.version);
    expect(s.cash).toBe(cash - 325);
    expect(key(s)).toMatchObject({ covers: { kind: "version", major: next.major } });
    expect(s.licenses.find((k) => k.id === old.id)!.machineId).toBeNull();
    expect(licenceStatus(s, SHOP_MACHINE, "whmCache")).toBe("active");
  });

  it("raise the host's exposure once the installed version is past its security updates", () => {
    const s = chosen("2008-04", "whmCache", true), c = panelHost(s);
    const base = clusterFactor(s, c);
    s.hour = versionInfo("whmCache", "3.0")!.securityUntil! + 365 * 24;
    expect(clusterFactor(s, c)).toBeGreaterThan(base);
  });
});

describe("old saves", () => {
  it("install a saved shop on the first panel host with a year of updates from the save", () => {
    const s = game("2012-06");
    ok(chooseShop(s, "blessta", true));
    const data = JSON.parse(serialize(s));
    delete data.shop.install;
    data.licenses = data.licenses.filter((k: { product: string }) => k.product !== "blessta");
    const back = deserialize(JSON.stringify(data));
    expect(back.shop.install).toEqual({ clusterId: panelHost(s).id, version: versionAt("blessta", s.hour).version, at: s.hour });
    expect(key(back)).toMatchObject({ kind: "once", covers: { kind: "version", major: versionAt("blessta", s.hour).major }, updatesUntil: yearAfter(s.hour) });
  });

  it("keep a saved shop uninstalled without a panel host", () => {
    const s = game("2012-06");
    s.clusters = s.clusters.filter((c) => c.kind !== "panel");
    ok(chooseShop(s, "blessta", true));
    const data = JSON.parse(serialize(s));
    delete data.shop.install;
    const back = deserialize(JSON.stringify(data));
    expect(back.shop).toMatchObject({ variant: "blessta", install: null });
    expect(shopBlock(back)).toBe("error.shopNotInstalled");
  });
});
