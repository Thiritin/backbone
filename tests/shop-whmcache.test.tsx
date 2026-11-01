import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { issueKey } from "../src/sim/60-infra/licence";
import { resolve } from "../src/sim/80-business/browser";
import { hostOf } from "../src/sim/80-business/vendor-shop";
import { lookOf } from "../src/ui/apps/browser/sites/portal/whmCache/Admin";
import { skinOf } from "../src/ui/apps/browser/sites/portal/skins";
import { WHMCache } from "../src/ui/apps/browser/sites/shopvendors/whmcache";
import { parsePortal, portalPath } from "../src/sim/80-business/portal";
import { shopGame } from "./portal-helpers";

const site = (s: ReturnType<typeof shopGame>, path: string) => renderToString(<WHMCache game={s} path={path} go={() => {}} />);

describe("WHMCache vendor site and skin", () => {
  it("sells keys at whmcache.com", () => {
    const s = shopGame();
    expect(hostOf("whmCache")).toBe("whmcache.com");
    expect(resolve(s, "www.whmcache.com/account").page).toMatchObject({ kind: "shopVendor", id: "whmCache" });
  });

  it("changes its look with the game year", () => {
    const s = shopGame();
    expect(site(s, "/")).toContain("wcv-boxed");
    s.hour = hourOfMonth("2014-01");
    expect(site(s, "/")).toContain("wcv-gloss");
    s.hour = hourOfMonth("2024-01");
    expect(site(s, "/")).toContain("wcv-flat");
  });

  it("prices the owned licence with its updates and lists keys under My account", () => {
    const s = shopGame();
    const pricing = site(s, "/pricing");
    expect(pricing).toContain("12 months of updates included");
    expect(pricing).toContain("Add to cart");
    issueKey(s, "whmCache", null, undefined, "2");
    const account = site(s, "/account");
    expect(account).toContain("Copy key");
    expect(account).toContain("Unassigned");
  });

  it("picks the admin look from the installed major", () => {
    expect([lookOf("3.0"), lookOf("5"), lookOf("7.0"), lookOf("8.0"), lookOf("9.0")]).toEqual(["classic", "gloss", "gloss", "flat", "flat"]);
    const s = shopGame(), route = parsePortal("whmCache", portalPath("whmCache", "admin"))!;
    const Admin = skinOf("whmCache").Admin;
    const html = (major: string) => renderToString(<Admin game={s} variant="whmCache" route={route} open={() => {}} version="" major={major} browse={() => {}} />);
    expect(html("3")).toContain("whc-classic");
    expect(html("8")).toContain("whc-sidenav");
  });
});
