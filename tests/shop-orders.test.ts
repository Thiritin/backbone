import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PREFERENCE } from "../src/sim/10-catalog/payments";
import { orderLead } from "../src/sim/30-market/orders";
import { moduleRuns, orderFor, serviceStatus } from "../src/sim/80-business/shop-orders";
import { suspendService, terminateService } from "../src/sim/90-actions/holds";
import { createProduct, createProductGroup, updateProduct } from "../src/sim/90-actions/portal";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { acceptOrder, cancelOrder, changeServicePassword, deleteOrder, fraudOrder } from "../src/sim/90-actions/shop-orders";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { automate, installWithKey, readyGame } from "./fixtures";

const saved = PREFERENCE.private;
beforeEach(() => { PREFERENCE.private = { transfer: 1 }; });
afterEach(() => { PREFERENCE.private = saved; });

const web = { product: "webHosting" as const, size: 1, sla: "basic" as const };
const withShop = (seed: number) => {
  const s = readyGame(seed);
  s.cash = 1e6;
  setUpChannel(s, "website");
  s.unlocks = [...s.unlocks, "shops"];
  installWithKey(s, "whmCache");
  return s;
};

describe("shop orders", () => {
  it("wait as pending until Accept creates the service and bills it", () => {
    const s = withShop(41);
    const r = orderLead(s, "private", "Frankfurt", [], web, false), o = orderFor(s, r.id)!;
    expect(o).toMatchObject({ status: "pending", customerId: null, invoiceId: null });
    expect(acceptOrder(s, o.id).ok).toBe(true);
    const done = orderFor(s, r.id)!, svc = s.services.find((v) => v.id === done.items[0].serviceId)!;
    expect(done.status).toBe("active");
    expect(svc.viaShop).toBe(true);
    expect(s.invoices.find((i) => i.id === done.invoiceId)!.customerId).toBe(svc.customerId);
    expect(s.tickets.find((t) => t.id === r.ticketId)!.status).toBe("resolved");
    expect(acceptOrder(s, o.id)).toMatchObject({ ok: false, error: "error.orderNotPending" });
  });

  it("turn active at checkout when the shop sets them up itself", () => {
    const s = automate(withShop(42));
    const r = orderLead(s, "private", "Frankfurt", [], web, false), o = orderFor(s, r.id)!;
    expect(o.status).toBe("active");
    expect(o.invoiceId).not.toBeNull();
    expect(o.items[0].amount).toBeGreaterThan(0);
  });

  it("cancel, mark as fraud and delete pending orders", () => {
    const s = withShop(43);
    const a = orderLead(s, "private", "Frankfurt", [], web, false), b = orderLead(s, "private", "Frankfurt", [], web, false);
    expect(cancelOrder(s, orderFor(s, a.id)!.id).ok).toBe(true);
    expect(orderFor(s, a.id)!.status).toBe("cancelled");
    expect(s.sales.requests.find((x) => x.id === a.id)!.status).toBe("lost");
    expect(fraudOrder(s, orderFor(s, b.id)!.id).ok).toBe(true);
    expect(orderFor(s, b.id)!.status).toBe("fraud");
    expect(s.sales.requests.find((x) => x.id === b.id)!.status).toBe("declined");
    const c = orderLead(s, "private", "Frankfurt", [], web, false), id = orderFor(s, c.id)!.id;
    expect(deleteOrder(s, id).ok).toBe(true);
    expect(orderFor(s, c.id)).toBeUndefined();
    expect(s.sales.requests.find((x) => x.id === c.id)!.status).toBe("lost");
  });

  it("refuse Accept for a product without a server group", () => {
    const s = withShop(44);
    const g = (createProductGroup(s, "Web") as { id: string }).id, id = (createProduct(s, g, "Mini", "webHosting") as { id: string }).id;
    updateProduct(s, id, { serverGroupId: null });
    const r = orderLead(s, "private", "Frankfurt", [], web, false, undefined, undefined, s.shop.products.find((x) => x.id === id));
    expect(acceptOrder(s, orderFor(s, r.id)!.id)).toMatchObject({ ok: false, error: "error.manualProduct" });
  });

  it("keep orders through a save, and give old saves none", () => {
    const s = withShop(45);
    orderLead(s, "private", "Frankfurt", [], web, false);
    expect(deserialize(serialize(s)).shop.orders).toEqual(s.shop.orders);
    const old = JSON.parse(serialize(s));
    delete old.shop.orders;
    expect(deserialize(JSON.stringify(old)).shop.orders).toEqual([]);
  });

  it("give services a status, the module check and a new password on Change Password", () => {
    const s = automate(withShop(46));
    const r = orderLead(s, "private", "Frankfurt", [], web, false), id = orderFor(s, r.id)!.items[0].serviceId!;
    const v = () => s.services.find((x) => x.id === id)!;
    expect(serviceStatus(s, v())).toBe("active");
    expect(moduleRuns(s, v())).toBe(true);
    const before = v().password;
    expect(changeServicePassword(s, id).ok).toBe(true);
    expect(v().password).toMatch(/^[a-z0-9]{8}$/);
    expect(v().password).not.toBe(before);
    suspendService(s, id);
    expect(serviceStatus(s, v())).toBe("suspended");
    terminateService(s, id, "notice", null);
    expect(serviceStatus(s, v())).toBe("cancelled");
    s.shop = { ...s.shop, modules: {}, variant: "modemBill" };
    expect(moduleRuns(s, v())).toBe(false);
  });
});
