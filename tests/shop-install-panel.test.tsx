import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { companyDomain } from "../src/sim/30-customers/domains";
import { licenceStatus, SHOP_MACHINE } from "../src/sim/60-infra/licence";
import { resolve } from "../src/sim/80-business/browser";
import { shopActive } from "../src/sim/80-business/shop";
import { shopBlock } from "../src/sim/80-business/website";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { installShop } from "../src/sim/90-actions/shop";
import { ShopInstall } from "../src/ui/apps/browser/consoles/HostSettings";
import { MarketingApp } from "../src/ui/apps/marketing/MarketingApp";
import { useStore } from "../src/ui/store";
import { readyGame } from "./fixtures";

const game = () => {
  const s = readyGame(7);
  s.hour = hourOfMonth("2009-05");
  s.cash = 1e6;
  setUpChannel(s, "website");
  s.unlocks = [...s.unlocks, "shops"];
  return s;
};

describe("installing a shop from a panel host", () => {
  it("runs a new shop on its trial and takes orders at once", () => {
    const s = game(), host = s.clusters.find((c) => c.kind === "panel")!;
    expect(s.shop.variant).toBeNull();
    expect(installShop(s, host.id, "clientExit").ok).toBe(true);
    expect(s.shop).toMatchObject({ variant: "clientExit", install: { clusterId: host.id } });
    expect(licenceStatus(s, SHOP_MACHINE, "clientExit")).toBe("trial");
    expect(shopActive(s)).toBe(true);
    expect(shopBlock(s)).toBeNull();
    expect(resolve(s, `portal.${companyDomain(s)}/`).page.kind).toBe("shop");
  });

  it("shows the release the shop runs on its panel host's software page, without an install button", () => {
    const s = game(), host = s.clusters.find((c) => c.kind === "panel")!;
    expect(renderToString(<ShopInstall game={s} c={host} />)).toBe("");
    installShop(s, host.id, "clientExit");
    const html = renderToString(<ShopInstall game={s} c={host} />);
    expect(html).toContain("ClientExit");
    expect(html).not.toContain("<button");
  });

  it("leaves the Marketing app without a shop section", () => {
    useStore.setState({ game: game() });
    const html = renderToString(<MarketingApp />);
    expect(html).toContain(">Channels<");
    expect(html).not.toContain(">Shop<");
  });
});
