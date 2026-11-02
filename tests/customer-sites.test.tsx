import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Profile } from "../src/sim/30-customers/customers";
import type { GameState } from "../src/sim/50-state";
import { siteDesign } from "../src/sim/80-business/site-design";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { CustomerSite } from "../src/ui/apps/browser/sites/Pages";
import { readyGame, skipTo } from "./fixtures";

const PROFILES: Profile[] = ["private", "gamer", "hobbyDev", "soleProp", "smallBiz", "agency", "office", "onlineShop", "enterprise"];

// 30 web hosting customers cycling through the profiles, then a jump to the year; skipTo adds years, so each year needs a fresh game.
function setup(year = 0): { s: GameState; sites: { cus: string; svc: string }[] } {
  const s = readyGame(7);
  const sites = Array.from({ length: 30 }, (_, i) => {
    const cus = addCustomer(s, `Kunde ${i} Muster`, PROFILES[i % PROFILES.length]);
    return { cus, svc: addService(s, cus, "webHosting", `kunde${i}.de`, 60, "year") };
  });
  if (year) skipTo(s, year);
  return { s, sites };
}

const signature = (s: GameState, id: string): string => {
  const d = siteDesign(s, id);
  return `${d.layout}|${d.scheme.variant}|${[...d.blocks].sort().join(",")}`;
};

describe("customer site designs", () => {
  it("never repeats among the first 30 customers in any period", () => {
    for (const year of [0, 2010, 2016, 2022]) {
      const { s, sites } = setup(year);
      const own = sites.map((x) => x.cus);
      const first30 = s.customers.slice(0, 30).map((c) => c.id);
      for (const ids of [own, first30]) expect(new Set(ids.map((id) => signature(s, id))).size).toBe(30);
    }
  });

  it("redesigns a site when the period changes", () => {
    const { s, sites } = setup();
    const id = sites[3].cus, before = signature(s, id);
    expect(signature(s, id)).toBe(before);
    skipTo(s, 2016);
    expect(signature(s, id)).not.toBe(before);
  });

  it("renders the layout and its blocks", () => {
    for (const year of [0, 2010, 2016, 2022]) {
      const { s, sites } = setup(year);
      for (const { cus, svc } of sites.slice(0, 9)) {
        const d = siteDesign(s, cus);
        const html = renderToString(<CustomerSite game={s} serviceId={svc} />);
        expect(html).toContain(`cs-${d.layout}`);
        expect(html).toContain(`cs-scheme-${d.scheme.variant}`);
        expect(html).toContain(`cs-b-${d.blocks.find((b) => b !== "about")}`);
        expect(html).not.toContain("undefined");
        expect(html).not.toContain("site.block.");
      }
    }
  });

  it("still shows the hacked page when defaced", () => {
    const { s, sites } = setup();
    s.sites = { ...s.sites, defaced: [sites[0].svc] };
    const html = renderToString(<CustomerSite game={s} serviceId={sites[0].svc} />);
    expect(html).toContain("cs-defaced");
    expect(html).not.toContain("cs-b-");
  });
});
