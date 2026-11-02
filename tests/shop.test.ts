import type { ShopId } from "../src/sim/10-catalog/shops";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { PREFERENCE } from "../src/sim/10-catalog/payments";
import { orderLead } from "../src/sim/30-market/orders";
import type { GameState } from "../src/sim/50-state";
import { hasModule, shopActive, shopBills, shopTick, WHM_BREACH_AT } from "../src/sim/80-business/shop";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { addToGroup, buyModule, createGroup, installShop, moveMember, removeFromGroup, setGroupFill, setMemberActive } from "../src/sim/90-actions/shop";
import { createProduct, createProductGroup, updateProduct } from "../src/sim/90-actions/portal";
import { targetFor } from "../src/sim/30-market/sales";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { cordon, uncordon } from "../src/sim/90-actions/clusters";
import { keyFee } from "../src/sim/85-products/products";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { automate, readyGame, installWithKey, panelVm } from "./fixtures";

// Private customers pay by bank transfer here, so no shop order is lost for its payment method.
const saved = PREFERENCE.private;
beforeEach(() => { PREFERENCE.private = { transfer: 1 }; });
afterEach(() => { PREFERENCE.private = saved; });

const web = { product: "webHosting" as const, size: 1, sla: "basic" as const };

const withShop = (seed: number, id: ShopId = "whmCache") => {
  const s = readyGame(seed);
  s.cash = 1e6;
  setUpChannel(s, "website");
  s.unlocks = [...s.unlocks, "shops"];
  installWithKey(s, id);
  return s;
};
const plan = (s: GameState) => {
  const id = (createProduct(s, (createProductGroup(s, "Web") as { id: string }).id, "Mini", "webHosting") as { id: string }).id;
  return s.shop.products.find((p) => p.id === id)!;
};
const at = (s: GameState, year: number) => { s.hour = hourOf(new Date(Date.UTC(year, 0, 1))); return s; };

describe("shop systems", () => {
  it("need the research and the website, and take orders once installed", () => {
    const s = readyGame(1);
    s.cash = 1e6;
    const host = s.clusters.find((c) => c.kind === "panel")!.id;
    expect(installShop(s, host, "whmCache")).toMatchObject({ ok: false, error: "error.needsShopSkill" });
    s.unlocks = [...s.unlocks, "shops"];
    expect(installShop(s, host, "whmCache")).toMatchObject({ ok: false, error: "error.needsWebsite" });
    setUpChannel(s, "website");
    installWithKey(s, "clientExit", true);
    expect(s.shop.variant).toBe("clientExit");
    expect(shopActive(s)).toBe(true);
    expect(installShop(s, host, "hostBull")).toMatchObject({ ok: false, error: "error.shopNotSold" });
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
    installWithKey(box, "boxBillin");
    expect(buyModule(box, "proxmocks").ok).toBe(true);
    expect(hasModule(box, "proxmocks")).toBe(false);
    box.hour += 12;
    expect(hasModule(box, "proxmocks")).toBe(true);
  });

  it("start a free shop system and a free module while the account is overdrawn", () => {
    const s = at(readyGame(6), 2012);
    setUpChannel(s, "website");
    s.unlocks = [...s.unlocks, "shops"];
    s.cash = -500;
    installWithKey(s, "orderBocks");
    installWithKey(s, "boxBillin");
    expect(buyModule(s, "proxmocks").ok).toBe(true);
    expect(s.cash).toBe(-500);
  });

  it("sell from a plan's stock, and cancel an order they cannot set up without a lost sale", () => {
    const s = automate(withShop(5, "modemBill"));
    const p = plan(s);
    expect(updateProduct(s, p.id, { stock: 1 }).ok).toBe(true);
    const first = orderLead(s, "private", "Frankfurt", [], web, false, undefined, undefined, p);
    expect(s.sales.requests.find((x) => x.id === first.id)!.status).toBe("won");
    expect(s.shop.products[0].stock).toBe(0);
    updateProduct(s, p.id, { stock: 5 });
    const lost = s.sales.lost.length;
    const r = orderLead(s, "private", "London", [], web, false, undefined, undefined, p);
    expect(s.sales.requests.find((x) => x.id === r.id)!.status).toBe("lost");
    expect(s.sales.lost.length).toBe(lost);
  });

  it("lease as licence keys and bill only revenue shares", () => {
    const whm = withShop(6), key = whm.licenses.find((k) => k.product === "whmCache")!;
    expect(shopBills(whm)).toEqual([]);
    expect(key).toMatchObject({ edition: "leased", kind: "server", covers: { kind: "term" } });
    expect(keyFee(whm, key)).toBe(15);
    const box = at(withShop(8, "modemBill"), 2007);
    box.shop = { ...box.shop, variant: "orderBocks" };
    box.services = [{ ...box.services[0], viaShop: true, endedAt: null, price: 10 / 730 }];
    expect(shopBills(box)).toMatchObject([{ key: "ledger.shopCut", amount: 0.6 }]);
  });

  it("keeps the shop through a save and gives old saves none", () => {
    const s = withShop(9);
    const back = deserialize(serialize(s));
    expect(back.shop).toEqual(s.shop);
    const old = JSON.parse(serialize(readyGame(9)));
    delete old.shop;
    expect(deserialize(JSON.stringify(old)).shop.variant).toBeNull();
  });
});

describe("server groups", () => {
  // A second panel host on the basement hypervisor, in the shop's panel group behind the first.
  const twoHosts = () => {
    const s = automate(withShop(10));
    const g = s.shop.groups.find((x) => x.members.some((m) => s.clusters.find((c) => c.id === m)?.kind === "panel"))!, [a] = g.members;
    const b = panelVm(s, s.clusters.find((c) => c.name === "Basement 1")!.id);
    expect(addToGroup(s, g.id, b).ok).toBe(true);
    const p = plan(s), r = { city: s.locations[0].city, product: "webHosting" as const, spec: sizeSpec("webHosting", 0, 2005), shop: true, productId: p.id };
    return { s, g, a, b, p, on: () => targetFor(s, r)?.clusterId };
  };

  it("start with the company's software, all active, and new plans sell from it", () => {
    const s = automate(withShop(10));
    const g = s.shop.groups.find((x) => x.members.some((m) => s.clusters.find((c) => c.id === m)?.kind === "panel"))!;
    expect(g).toMatchObject({ members: s.clusters.filter((c) => c.kind === "panel").map((c) => c.id), inactive: [], fill: "spread" });
    const p = plan(s);
    expect(p.serverGroupId).toBe(g.id);
    const first = orderLead(s, "private", "Frankfurt", [], web, false, undefined, undefined, p);
    expect(s.sales.requests.find((x) => x.id === first.id)!.status).toBe("won");
    updateProduct(s, p.id, { serverGroupId: null });
    const waiting = orderLead(s, "private", "Frankfurt", [], web, false, undefined, undefined, s.shop.products[0]);
    expect(s.sales.requests.find((x) => x.id === waiting.id)!.status).toBe("accepted");
  });

  it("spread to the least full server, or fill the first active one in their order", () => {
    const { s, g, a, b, on } = twoHosts();
    expect(on()).toBe(b);
    expect(setGroupFill(s, g.id, "fill").ok).toBe(true);
    expect(on()).toBe(a);
    expect(moveMember(s, g.id, b, -1).ok).toBe(true);
    expect(s.shop.groups.find((x) => x.id === g.id)!.members).toEqual([b, a]);
    expect(on()).toBe(b);
    expect(setMemberActive(s, g.id, b, false).ok).toBe(true);
    expect(on()).toBe(a);
    setMemberActive(s, g.id, a, false);
    expect(on()).toBeUndefined();
  });

  it("hold each installation once and only of their kind", () => {
    const s = withShop(11);
    const panel = s.clusters.find((c) => c.kind === "panel")!, g = s.shop.groups.find((x) => x.members.includes(panel.id))!;
    const cloud = s.shop.groups.find((x) => x.id !== g.id && x.members.length)!;
    expect(addToGroup(s, cloud.id, panel.id)).toMatchObject({ ok: false, error: "error.groupKind" });
    const other = (createGroup(s, "Second") as { id: string }).id;
    expect(addToGroup(s, other, panel.id)).toMatchObject({ ok: false, error: "error.inGroup" });
    expect(removeFromGroup(s, g.id, panel.id).ok).toBe(true);
    expect(addToGroup(s, other, panel.id).ok).toBe(true);
    const back = deserialize(serialize(s));
    expect(back.shop.groups).toEqual(s.shop.groups);
  });

  it("load old groups without their kind and sell switches, a group that did not deploy with every server inactive", () => {
    const s = withShop(12);
    const old = JSON.parse(serialize(s)), [g] = old.shop.groups;
    old.shop.groups = [{ ...g, kind: "panel", sale: ["webHosting"], deploy: false, inactive: undefined, fill: undefined }];
    old.shop.stock = { webHosting: 3 };
    const back = deserialize(JSON.stringify(old)).shop;
    expect(back.groups).toEqual([{ id: g.id, name: g.name, members: g.members, inactive: g.members, fill: "spread" }]);
    expect("stock" in back).toBe(false);
  });
});

describe("node actions", () => {
  it("cordon one software installation and leave the other software on the server alone", () => {
    const s = readyGame(12);
    const c = s.clusters.find((x) => x.nodes.length)!, dev = c.nodes[0].deviceId;
    s.clusters = [...s.clusters, { ...c, id: "cl-other", name: "Other" }];
    expect(cordon(s, dev, "cl-other").ok).toBe(true);
    expect(s.clusters.find((x) => x.id === "cl-other")!.nodes[0].state).toBe("cordoned");
    expect(s.clusters.find((x) => x.id === c.id)!.nodes[0].state).toBe("active");
    expect(uncordon(s, dev, "cl-other").ok).toBe(true);
    expect(cordon(s, dev, "nope")).toMatchObject({ ok: false, error: "error.notNode" });
  });
});

describe("shop era events", () => {
  it("leak WHMCache's customer data in May 2012 and upset every customer", () => {
    const s = withShop(13);
    s.hour = WHM_BREACH_AT;
    const before = s.customers.map((c) => c.happiness), events: Parameters<typeof shopTick>[1] = [];
    shopTick(s, events);
    expect(events).toMatchObject([{ app: "Security", key: "event.shopBreach", params: { name: "WHMCache" } }]);
    s.customers.forEach((c, i) => expect(c.happiness).toBeLessThan(before[i]));
    const blessta = withShop(14, "clientExit");
    blessta.hour = WHM_BREACH_AT;
    const none: typeof events = [];
    shopTick(blessta, none);
    expect(none).toEqual([]);
  });
});
