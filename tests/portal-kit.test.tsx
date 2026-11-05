import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { shopById } from "../src/sim/10-catalog/shops";
import { parsePortal, portalPath } from "../src/sim/80-business/portal";
import { createProduct, createProductGroup } from "../src/sim/90-actions/portal";
import { skinOf } from "../src/ui/apps/browser/sites/portal/skins";
import { idOf, shopGame } from "./portal-helpers";

const IDS = ["whmCache", "boxBillin", "ubersmyth", "orderBocks", "clientExit", "blessta", "modemBill", "hostBull"] as const;
const SCREENS: Record<string, string>[] = [{ s: "home" }, { s: "products" }, { s: "product", id: "new" }, { s: "invoices" }, { s: "marketplace" }, { s: "marketplace", tab: "gateways" }, { s: "settings" }, { s: "settings", tab: "invoices" }, { s: "gateways" }, { s: "orders" }, { s: "clients" }, { s: "servers" }, { s: "emails" }, { s: "quotes" }, { s: "licence" }];
const DESKTOP = new Set(["btn", "pill", "switch", "side-h", "field"]);

describe("portal kit", () => {
  it("leaves the desktop control styles out of every admin screen of every shop system", () => {
    for (const id of IDS) {
      const s = shopGame(id, Math.max(2012, shopById(id).from));
      idOf(createProduct(s, idOf(createProductGroup(s, "Web")), "Mini", "webHosting"));
      const { Admin } = skinOf(id);
      for (const q of SCREENS) {
        const html = renderToString(<Admin game={s} variant={id} route={parsePortal(id, portalPath(id, "admin", {}, q))!} open={() => {}} version="" major="" browse={() => {}} />);
        const classes = [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => DESKTOP.has(c) || c.startsWith("mkt-"));
        if (q.s === "products") expect(html).toContain("pt-btn");
        expect(classes, `${id} ${JSON.stringify(q)}`).toEqual([]);
      }
    }
  });
});
