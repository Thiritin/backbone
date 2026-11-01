import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { versionInfo } from "../src/sim/10-catalog/software-versions";
import { resolve } from "../src/sim/80-business/browser";
import { hostOf } from "../src/sim/80-business/vendor-shop";
import { upgradeShop } from "../src/sim/90-actions/shop";
import { BoxBillin } from "../src/ui/apps/browser/sites/shopvendors/boxbillin";
import { eraOf } from "../src/ui/apps/browser/sites/portal/boxbillin";
import { shopGame } from "./portal-helpers";

const page = (year: number, path: string) => {
  const s = shopGame("boxBillin", year);
  return { s, html: renderToString(<BoxBillin game={s} path={path} />) };
};

describe("BoxBillin' vendor site", () => {
  it("serves My account at the host the admin's Upgrade button opens", () => {
    const { s } = page(2013, "/");
    expect(hostOf("boxBillin")).toBe("boxbillin.com");
    expect(resolve(s, "boxbillin.com/account").page).toEqual({ kind: "shopVendor", id: "boxBillin" });
  });

  it("changes its look by year and takes the FOSSBillin' name with the first 0.x release", () => {
    expect(page(2012, "/").html).toContain("bxs-cube");
    expect(page(2016, "/").html).toContain("bxs-flat");
    const late = page(2024, "/").html;
    expect(late).toContain("bxs-foss");
    expect(late).toContain("FOSSBillin&#x27;");
  });

  it("lists the installation and upgrades it for free", () => {
    const { s, html } = page(2013, "/account");
    const at = s.shop.install!;
    expect(html).toContain(at.version);
    s.shop.install!.version = "2.0";
    const cash = s.cash;
    expect(upgradeShop(s).ok).toBe(true);
    expect(versionInfo("boxBillin", s.shop.install!.version)!.major).toBe("3");
    expect(s.cash).toBe(cash);
  });

  it("lists releases up to the game month only", () => {
    const { s } = page(2012, "/releases");
    s.hour = hourOfMonth("2012-04");
    const html = renderToString(<BoxBillin game={s} path="/releases" />);
    expect(html).toContain("2.0");
    expect(html).not.toContain("3.0");
  });
});

describe("BoxBillin' skin eras", () => {
  it("follows the installed major", () => {
    expect([eraOf("1"), eraOf("2"), eraOf("3"), eraOf("4"), eraOf("0.1"), eraOf("0.8")]).toEqual(["cube", "cube", "slate", "slate", "foss", "foss"]);
  });
});
