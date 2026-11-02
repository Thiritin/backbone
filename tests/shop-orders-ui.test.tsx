import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SHOPS } from "../src/sim/10-catalog/shops";
import { orderLead } from "../src/sim/30-market/orders";
import { parsePortal, portalPath } from "../src/sim/80-business/portal";
import { skinOf } from "../src/ui/apps/browser/sites/portal/skins";
import { shopGame } from "./portal-helpers";

const web = { product: "webHosting" as const, size: 1, sla: "basic" as const };

describe("shop admin orders", () => {
  it("list an order and open its detail page in every shop system", () => {
    let shown = 0;
    for (const { id } of SHOPS) {
      const s = shopGame(id, 2016);
      const r = orderLead(s, "private", "Frankfurt", [], web, false), o = s.shop.orders.find((x) => x.items[0].requestId === r.id);
      if (!o) continue;
      const Admin = skinOf(id).Admin;
      const html = (screen: Record<string, string>) => renderToString(<Admin game={s} variant={id} route={parsePortal(id, portalPath(id, "admin", {}, screen))!} open={() => {}} version="" major="" browse={() => {}} />);
      expect(html({ s: "orders" })).toContain(o.id.slice(3));
      expect(html({ s: "order", id: o.id })).toContain("Accept");
      shown++;
    }
    expect(shown).toBeGreaterThan(4);
  });
});
