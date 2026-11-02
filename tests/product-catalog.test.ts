import { describe, expect, it } from "vitest";
import { yearOf } from "../src/sim/00-core/time";
import { offerPrice, setupFee } from "../src/sim/30-market/spec";
import { defaultSpecFor } from "../src/sim/80-business/packages";
import { addProduct, publishCatalog, removeProduct, updateProduct } from "../src/sim/90-actions/catalog";
import { unpublished } from "../src/sim/80-business/catalog";
import { siteContent } from "../src/sim/80-business/website";
import { t as tr } from "../src/i18n/en";
import { deserialize, serialize } from "../src/sim/91-save/save";
import type { Product } from "../src/sim/30-customers/customers";
import type { GameState } from "../src/sim/50-state";
import { newGame, readyGame } from "./fixtures";
import { sizeSpec, type Sla } from "../src/sim/10-catalog/products";
import { orderLead } from "../src/sim/30-market/orders";
import { applyStep } from "../src/sim/30-market/manual";
import { editRequest, salesTick } from "../src/sim/30-market/sales";
import { marketingTick, wonLeads } from "../src/sim/80-business/marketing";
import { createQuote } from "../src/sim/90-actions/orders";

const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);
const added = (s: GameState, line: Product): string => {
  const r = addProduct(s, line);
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};

describe("product catalog", () => {
  it("adds a product at the middle size, the player's rate and the line's setup fee", () => {
    const s = newGame(1), spec = defaultSpecFor("vps", yearOf(s.hour));
    const id = added(s, "vps");
    expect(s.catalog).toEqual([{ id, name: "VPS 1", line: "vps", spec, sla: "basic", prices: { monthly: offerPrice(s, "vps", spec) }, setup: setupFee(s, "vps"), hidden: false }]);
    expect(addProduct(s, "vps").ok).toBe(true);
    expect(s.catalog[1].name).toBe("VPS 2");
  });

  it("updates and removes a product", () => {
    const s = newGame(2), id = added(s, "webHosting");
    expect(err(updateProduct(s, id, { name: " Starter ", prices: { monthly: 4, annual: 40 }, setup: 0, hidden: true, sla: "business" }))).toBe("ok");
    expect(s.catalog[0]).toMatchObject({ name: "Starter", prices: { monthly: 4, annual: 40 }, setup: 0, hidden: true, sla: "business", line: "webHosting" });
    expect(err(updateProduct(s, id, { prices: {} }))).toBe("error.productPrice");
    expect(err(updateProduct(s, id, { prices: { monthly: -1 } }))).toBe("error.productPrice");
    expect(err(updateProduct(s, id, { name: "x".repeat(25) }))).toBe("error.productName");
    expect(err(removeProduct(s, id))).toBe("ok");
    expect(s.catalog).toEqual([]);
    expect(err(removeProduct(s, id))).toBe("error.productMissing");
  });

  it("keeps names unique per line", () => {
    const s = newGame(3), a = added(s, "vps"), b = added(s, "vps"), c = added(s, "dedicated");
    expect(err(updateProduct(s, a, { name: "Pro" }))).toBe("ok");
    expect(err(updateProduct(s, b, { name: "pro" }))).toBe("error.productTaken");
    expect(err(updateProduct(s, c, { name: "Pro" }))).toBe("ok");
    expect(err(updateProduct(s, a, { name: "PRO" }))).toBe("ok");
  });

  it("stays editable in Books once a shop is chosen", () => {
    const s = newGame(4), id = added(s, "vps");
    s.shop.variant = "modemBill";
    expect(err(addProduct(s, "vps"))).toBe("ok");
    expect(err(updateProduct(s, id, { name: "Pro" }))).toBe("ok");
    expect(err(removeProduct(s, id))).toBe("ok");
  });

  it("loads a save without a catalog", () => {
    const s = newGame(5);
    const { catalog: _, ...old } = JSON.parse(serialize(s));
    expect(deserialize(JSON.stringify(old)).catalog).toEqual([]);
  });
});

describe("product-based demand", () => {
  const need = { product: "vps" as Product, size: 1, sla: "basic" as Sla };
  const sized = (s: GameState, size: number) => sizeSpec("vps", size, yearOf(s.hour));
  const offer = (s: GameState, size: number, monthly: number, sla: Sla = "basic"): string => {
    const id = added(s, "vps");
    expect(err(updateProduct(s, id, { spec: sized(s, size), prices: { monthly }, sla }))).toBe("ok");
    publishCatalog(s);
    return id;
  };
  const lead = (s: GameState, budget = 100) => orderLead(s, "private", "Frankfurt", [], need, true, undefined, { budget });
  const req = (s: GameState, id: string) => s.sales.requests.find((x) => x.id === id)!;

  it("picks the cheapest offered product that covers the need and its SLA", () => {
    const s = readyGame(11);
    offer(s, 0, 2);
    offer(s, 2, 30);
    offer(s, 1, 12);
    const premium = offer(s, 1, 8, "premium");
    const hidden = offer(s, 1, 5);
    expect(err(updateProduct(s, hidden, { hidden: true }))).toBe("ok");
    publishCatalog(s);
    const r = lead(s);
    expect(r.productId).toBe(premium);
    expect(r.quote).toBe(8);
    expect(r.spec.ramGb).toBe(sized(s, 1).ramGb);
  });

  it("takes a bigger product when none of the needed size is offered", () => {
    const s = readyGame(12);
    offer(s, 0, 2);
    const big = offer(s, 2, 15);
    const r = lead(s);
    expect(r.productId).toBe(big);
    expect(r.spec.ramGb).toBe(sized(s, 2).ramGb);
    expect(r.status).toBe("open");
  });

  it("loses the lead as no fitting package and counts it for the line", () => {
    const s = readyGame(13);
    offer(s, 0, 2);
    offer(s, 1, 1e4);
    const r = lead(s, 1);
    expect(req(s, r.id).status).toBe("lost");
    expect(s.sales.lost.at(-1)!.reason).toBe("lost.noFittingProduct");
    expect(s.marketing.unmet.month.vps).toBe(1);
    while (new Date(Date.UTC(2005, 0, 1) + s.hour * 3600e3).getUTCDate() !== 1 || s.hour % 24 !== 0) s.hour++;
    marketingTick(s);
    expect(s.marketing.unmet).toEqual({ month: {}, last: { vps: 1 } });
  });

  it("counts won orders per line by the month the lead arrived", () => {
    const s = readyGame(14);
    offer(s, 0, 2);
    const old = lead(s), lost = lead(s, 1);
    editRequest(s, old.id, () => ({ status: "won" }));
    expect(req(s, lost.id).status).toBe("lost");
    expect(wonLeads(s, 0)).toEqual({ vps: 1 });
    do s.hour++; while (new Date(Date.UTC(2005, 0, 1) + s.hour * 3600e3).getUTCDate() !== 1 || s.hour % 24 !== 0);
    const fresh = lead(s);
    editRequest(s, fresh.id, () => ({ status: "won" }));
    expect(wonLeads(s, 0)).toEqual({ vps: 1 });
    expect(wonLeads(s, 1)).toEqual({ vps: 1 });
    s.hour += 24 * 40;
    expect(wonLeads(s, 1)).toEqual({ vps: 1 });
    expect(wonLeads(s, 0)).toEqual({});
  });

  it("prefills the Books quote from the product and declines a quote above its price", () => {
    const s = readyGame(14);
    offer(s, 1, 9.99);
    const r = lead(s), t = s.tickets.find((x) => x.id === r.ticketId)!;
    expect(createQuote(s, t.id).ok).toBe(true);
    expect(s.quotes.at(-1)!.monthly).toBe(9.99);
    const answer = (price: number) => {
      editRequest(s, r.id, () => ({ quote: price, status: "open", replyAt: null }));
      expect(applyStep(s, t, "quote")).toBeNull();
      s.hour = req(s, r.id).replyAt!;
      salesTick(s);
      return req(s, r.id).status;
    };
    expect(answer(12)).toBe("refused");
    expect(req(s, r.id).counter).toBeNull();
  });

  it("accepts a quote at the product's price", () => {
    const s = readyGame(14);
    offer(s, 1, 9.99);
    const r = lead(s), t = s.tickets.find((x) => x.id === r.ticketId)!;
    expect(applyStep(s, t, "quote")).toBeNull();
    s.hour = req(s, r.id).replyAt!;
    salesTick(s);
    expect(req(s, r.id).status).toBe("accepted");
  });

  it("leaves a line without offered products on free quotes", () => {
    const a = readyGame(15), b = readyGame(15);
    b.catalog = [
      { id: "prdX", name: "Box", line: "dedicated", spec: sized(b, 1), sla: "basic", prices: { monthly: 1 }, setup: 0, hidden: false },
      { id: "prdY", name: "Hidden", line: "vps", spec: sized(b, 2), sla: "premium", prices: { monthly: 1 }, setup: 0, hidden: true },
    ];
    publishCatalog(b);
    const ra = lead(a), rb = lead(b);
    expect(rb).toEqual(ra);
    expect(rb.productId).toBeUndefined();
  });

  it("publishes a snapshot of the offered, visible products", () => {
    const s = readyGame(16);
    const a = offer(s, 1, 9.99), b = offer(s, 2, 20);
    expect(err(updateProduct(s, b, { hidden: true }))).toBe("ok");
    expect(s.marketing.published!.map((x) => x.id)).toEqual([a, b]);
    expect(unpublished(s)).toBe(1);
    publishCatalog(s);
    expect(s.marketing.published!.map((x) => x.id)).toEqual([a]);
    expect(unpublished(s)).toBe(0);
    const { published: _, ...marketing } = JSON.parse(serialize(s)).marketing;
    expect(deserialize(JSON.stringify({ ...JSON.parse(serialize(s)), marketing })).marketing.published).toBeNull();
  });

  it("keeps the site and leads on the published price until the next publish", () => {
    const s = readyGame(14);
    s.marketing = { ...s.marketing, lines: ["vps"] };
    const id = offer(s, 1, 9.99);
    expect(err(updateProduct(s, id, { prices: { monthly: 20 } }))).toBe("ok");
    const site = () => siteContent(s).lines.find((l) => l.product === "vps")!.items[0].prices.monthly;
    expect(site()).toBe(9.99);
    const r = lead(s), t = s.tickets.find((x) => x.id === r.ticketId)!;
    expect(r.quote).toBe(9.99);
    editRequest(s, r.id, () => ({ quote: 12 }));
    expect(applyStep(s, t, "quote")).toBeNull();
    s.hour = req(s, r.id).replyAt!;
    salesTick(s);
    expect(req(s, r.id).status).toBe("refused");
    publishCatalog(s);
    expect(site()).toBe(20);
    expect(lead(s).quote).toBe(20);
  });

  it("names the product in the order email", () => {
    const s = readyGame(14);
    const id = offer(s, 1, 9.99);
    expect(err(updateProduct(s, id, { name: "Starter" }))).toBe("ok");
    publishCatalog(s);
    const m = lead(s).thread[0];
    expect(m.params.item).toBe("Starter");
    expect(tr("order.msg.item", m.params)).toContain("Starter");
  });
});
