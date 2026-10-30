import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { SHOP_SETUP_HOURS } from "../src/sim/10-catalog/shops";
import { orderLead } from "../src/sim/30-market/orders";
import type { GameState } from "../src/sim/50-state";
import { hasOrderForm, owns } from "../src/sim/80-business/marketing";
import { hasModule, inStock, shopBills, stockOf } from "../src/sim/80-business/shop";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { addToGroup, buyModule, chooseShop, createGroup, removeFromGroup, setGroupDeploy, setGroupSale, setStock } from "../src/sim/90-actions/shop";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { automate, readyGame } from "./fixtures";

const web = { product: "webHosting" as const, size: 1, sla: "basic" as const };

const withShop = (seed: number, id: Parameters<typeof chooseShop>[1] = "whmCache") => {
  const s = readyGame(seed);
  s.cash = 1e6;
  setUpChannel(s, "website");
  setUpChannel(s, "orderForm");
  s.unlocks = [...s.unlocks, "shops"];
  expect(chooseShop(s, id).ok).toBe(true);
  s.hour += SHOP_SETUP_HOURS;
  return s;
};
const at = (s: GameState, year: number) => { s.hour = hourOf(new Date(Date.UTC(year, 0, 1))); return s; };

describe("shop systems", () => {
  it("need the research and the website, and replace the order form after their setup days", () => {
    const s = readyGame(1);
    s.cash = 1e6;
    expect(chooseShop(s, "whmCache")).toMatchObject({ ok: false, error: "error.needsShopSkill" });
    s.unlocks = [...s.unlocks, "shops"];
    expect(chooseShop(s, "whmCache")).toMatchObject({ ok: false, error: "error.needsWebsite" });
    setUpChannel(s, "website");
    setUpChannel(s, "orderForm");
    const cash = s.cash;
    expect(chooseShop(s, "clientExit").ok).toBe(true);
    expect(s.cash).toBe(cash - 250);
    expect(owns(s, "orderForm")).toBe(false);
    expect(hasOrderForm(s)).toBe(false);
    s.hour += SHOP_SETUP_HOURS;
    expect(hasOrderForm(s)).toBe(true);
    expect(chooseShop(s, "hostBull")).toMatchObject({ ok: false, error: "error.shopNotSold" });
  });

  it("include modules by variant and year, and sell the others at their price", () => {
    const s = withShop(2);
    expect(hasModule(s, "cpanic")).toBe(true);
    expect(hasModule(s, "tcadmen")).toBe(false);
    at(s, 2008);
    expect(hasModule(s, "tcadmen")).toBe(true);
    const cash = s.cash;
    expect(buyModule(s, "vmwhere").ok).toBe(true);
    expect(s.cash).toBe(cash - 200);
    expect(hasModule(s, "vmwhere")).toBe(true);
    expect(buyModule(s, "vmwhere")).toMatchObject({ ok: false, error: "error.moduleOwned" });

    const bull = withShop(3, "modemBill");
    expect(buyModule(bull, "vmwhere")).toMatchObject({ ok: false, error: "error.moduleNotSold" });
    const box = at(readyGame(4), 2012);
    box.cash = 1e6;
    setUpChannel(box, "website");
    box.unlocks = [...box.unlocks, "shops"];
    expect(chooseShop(box, "boxBillin").ok).toBe(true);
    expect(buyModule(box, "proxmocks").ok).toBe(true);
    expect(hasModule(box, "proxmocks")).toBe(false);
    box.hour += 12;
    expect(hasModule(box, "proxmocks")).toBe(true);
  });

  it("sell from stock, and cancel an order they cannot set up without a lost sale", () => {
    const s = automate(withShop(5, "modemBill"));
    expect(stockOf(s, "webHosting")).toBe(10);
    expect(setStock(s, "webHosting", "auto")).toMatchObject({ ok: false, error: "error.noAutoStock" });
    expect(setStock(s, "webHosting", 1).ok).toBe(true);
    const first = orderLead(s, "private", "Frankfurt", [], web, false);
    expect(s.sales.requests.find((x) => x.id === first.id)!.status).toBe("won");
    expect(stockOf(s, "webHosting")).toBe(0);
    expect(inStock(s, first)).toBe(false);
    setStock(s, "webHosting", 5);
    const lost = s.sales.lost.length;
    const r = orderLead(s, "private", "London", [], web, false);
    expect(s.sales.requests.find((x) => x.id === r.id)!.status).toBe("lost");
    expect(s.sales.lost.length).toBe(lost);
    expect(s.shop.soldOut.webHosting).toBe(1);
  });

  it("bill leases, per-server minimums and revenue shares", () => {
    const whm = withShop(6);
    expect(shopBills(whm)).toMatchObject([{ key: "ledger.shopLicence", amount: 15 }]);
    at(whm, 2020);
    expect(shopBills(whm)[0].amount).toBe(18);
    const uber = at(withShop(7, "modemBill"), 2007);
    uber.shop = { ...uber.shop, variant: "ubersmyth" };
    expect(shopBills(uber)).toMatchObject([{ key: "ledger.shopLicence", amount: 100 }]);
    const box = at(withShop(8, "modemBill"), 2007);
    box.shop = { ...box.shop, variant: "orderBocks" };
    box.services = [{ ...box.services[0], viaShop: true, endedAt: null, price: 10 / 730 }];
    expect(shopBills(box)).toMatchObject([{ key: "ledger.shopCut", amount: 0.6 }]);
  });

  it("keeps the shop through a save and gives old saves none", () => {
    const s = withShop(9);
    setStock(s, "vps", "off");
    const back = deserialize(serialize(s));
    expect(back.shop).toEqual(s.shop);
    const old = JSON.parse(serialize(readyGame(9)));
    delete old.shop;
    expect(deserialize(JSON.stringify(old)).shop.variant).toBeNull();
  });
});

describe("server groups", () => {
  it("start with the company's software, and decide what the shop sells and where it deploys", () => {
    const s = automate(withShop(10));
    const g = s.shop.groups.find((x) => x.kind === "panel")!;
    expect(g.members).toEqual(s.clusters.filter((c) => c.kind === "panel").map((c) => c.id));
    expect(g.sale).toEqual(["webHosting"]);
    const first = orderLead(s, "private", "Frankfurt", [], web, false);
    expect(s.sales.requests.find((x) => x.id === first.id)!.status).toBe("won");

    expect(setGroupDeploy(s, g.id, false).ok).toBe(true);
    const waiting = orderLead(s, "private", "Frankfurt", [], web, false);
    expect(s.sales.requests.find((x) => x.id === waiting.id)!.status).toBe("accepted");

    expect(setGroupSale(s, g.id, "webHosting", false).ok).toBe(true);
    expect(inStock(s, first)).toBe(false);
    expect(setGroupSale(s, g.id, "vps", true)).toMatchObject({ ok: false, error: "error.groupKind" });
  });

  it("hold each installation once and only of their kind", () => {
    const s = withShop(11);
    const panel = s.clusters.find((c) => c.kind === "panel")!, g = s.shop.groups.find((x) => x.members.includes(panel.id))!;
    const id = (createGroup(s, "cloud", "Rack two") as { id: string }).id;
    expect(addToGroup(s, id, panel.id)).toMatchObject({ ok: false, error: "error.groupKind" });
    const other = (createGroup(s, "panel", "Second") as { id: string }).id;
    expect(addToGroup(s, other, panel.id)).toMatchObject({ ok: false, error: "error.inGroup" });
    expect(removeFromGroup(s, g.id, panel.id).ok).toBe(true);
    expect(addToGroup(s, other, panel.id).ok).toBe(true);
    const back = deserialize(serialize(s));
    expect(back.shop.groups).toEqual(s.shop.groups);
  });
});
