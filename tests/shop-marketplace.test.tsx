import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { moduleOffer, shopById } from "../src/sim/10-catalog/shops";
import { parsePortal, portalPath } from "../src/sim/80-business/portal";
import { createProduct, createProductGroup, updateProduct } from "../src/sim/90-actions/portal";
import { buyModule } from "../src/sim/90-actions/shop";
import { skinOf } from "../src/ui/apps/browser/sites/portal/skins";
import { idOf, shopGame } from "./portal-helpers";

describe("shop marketplace", () => {
  it("marks each module as included, for sale or not offered per shop system", () => {
    expect(moduleOffer(shopById("whmCache"), "cpanic", 2005)).toBe("included");
    expect(moduleOffer(shopById("whmCache"), "vmwhere", 2005)).toBe(200);
    expect(moduleOffer(shopById("modemBill"), "vmwhere", 2005)).toBe("unavailable");
    expect(moduleOffer(shopById("boxBillin"), "vmwhere", 2012)).toBe("unavailable");
    expect(moduleOffer(shopById("boxBillin"), "proxmocks", 2012)).toBe(0);
    const box = shopGame("boxBillin", 2012);
    expect(buyModule(box, "vmwhere")).toMatchObject({ ok: false, error: "error.moduleNotSold" });
  });

  it("bind products only to server groups the shop has the module for, else leave them manual", () => {
    const s = shopGame("ubersmyth", 2007);
    const panel = s.clusters.find((c) => c.kind === "panel" && c.panel)!, group = s.shop.groups.find((g) => g.members.includes(panel.id))!;
    const p = idOf(createProduct(s, idOf(createProductGroup(s, "Web")), "Mini", "webHosting"));
    expect(s.shop.products.find((x) => x.id === p)!.serverGroupId).toBeNull();
    expect(updateProduct(s, p, { serverGroupId: group.id })).toMatchObject({ ok: false, error: "error.noShopModule" });
    expect(buyModule(s, panel.panel!).ok).toBe(true);
    expect(updateProduct(s, p, { serverGroupId: group.id }).ok).toBe(true);
  });

  it("list the modules, gateways and the Books link in every shop system's admin", () => {
    for (const id of ["whmCache", "boxBillin", "ubersmyth", "orderBocks", "clientExit", "blessta", "modemBill", "hostBull"] as const) {
      const s = shopGame(id, Math.max(2012, shopById(id).from)), Admin = skinOf(id).Admin;
      const html = renderToString(<Admin game={s} variant={id} route={parsePortal(id, portalPath(id, "admin", {}, { s: "marketplace" }))!} open={() => {}} version="" major="" browse={() => {}} />);
      const gateways = renderToString(<Admin game={s} variant={id} route={parsePortal(id, portalPath(id, "admin", {}, { s: "marketplace", tab: "gateways" }))!} open={() => {}} version="" major="" browse={() => {}} />);
      expect(html).toContain(t("shop-admin.d.available"));
      expect(html).toContain(t("vendor-sites.module.shop-link"));
      expect(gateways).toContain(t("shop-market.gateways"));
      if (id === "boxBillin") expect(html).toContain(t("marketing.notAvailable"));
    }
  });
});
