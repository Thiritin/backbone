import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SIZES } from "../src/sim/10-catalog/products";
import { rivalOffer } from "../src/sim/30-market/rival-offer";
import { newGame } from "../src/sim/50-state";
import { feed } from "../src/sim/80-business/news";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { ProviderSite } from "../src/ui/apps/browser/sites/providers/registry";
import { skipTo } from "./fixtures";

const site = (s: ReturnType<typeof newGame>) => renderToString(<ProviderSite game={s} id="hetzler" path="/" go={() => {}} />);

describe("Hetzler, rival and provider in one", () => {
  it("prices every size it sells at the market price times its factor, colocation left out", () => {
    const s = newGame(7);
    skipTo(s, 2018);
    const rows = rivalOffer(s, "hetzler");
    expect(new Set(rows.map((r) => r.product))).toEqual(new Set(["vps", "dedicated", "storage", "cloud", "gpu"]));
    expect(rows).toHaveLength(SIZES.vps.length + SIZES.dedicated.length + SIZES.storage.length + SIZES.cloud.length + SIZES.gpu.length);
    expect(rows.every((r) => r.price > 0 && r.spec)).toBe(true);
    expect(rivalOffer(s, "nobody")).toEqual([]);
    s.competitors = s.competitors.map((r) => (r.id === "hetzler" ? { ...r, closed: 5 } : r));
    expect(rivalOffer(s, "hetzler")).toEqual([]);
  });

  it("shows the price list on the home page in both looks and hides it while closed", () => {
    for (const year of [2005, 2018]) {
      const s = newGame(7);
      skipTo(s, year);
      const html = site(s), first = rivalOffer(s, "hetzler")[0];
      expect(html).toContain("ps-table");
      expect(html).toContain(first.spec);
      s.competitors = s.competitors.map((r) => (r.id === "hetzler" ? { ...r, closed: 5 } : r));
      expect(site(s)).not.toContain(first.spec);
    }
  });

  it("loads a save from when the rival was called Hetzna", () => {
    const s = newGame(7);
    const old = JSON.parse(serialize(s));
    const cut = (x: string) => x.replace(/hetzler/g, "hetzna").replace(/Hetzler/g, "Hetzna");
    old.competitors = old.competitors.map((r: { id: string; name: string }) => ({ ...r, id: cut(r.id), name: cut(r.name) }));
    old.shareLog = [{ month: 3, you: [1], rivals: { hetzna: [2], ionose: [3] } }];
    old.hosttoast.awards = [{ year: 2005, kind: "uptime", id: "hetzna" }];
    old.news = ["rival.bust.hetzna.12@999"];
    const back = deserialize(JSON.stringify(old));
    expect(back.competitors.find((r) => r.id === "hetzler")?.name).toBe("Hetzler");
    expect(back.competitors.some((r) => r.id === "hetzna" || r.name === "Hetzna")).toBe(false);
    expect(back.shareLog[0].rivals).toEqual({ hetzler: [2], ionose: [3] });
    expect(back.hosttoast.awards[0].id).toBe("hetzler");
    expect(back.news).toEqual(["rival.bust.hetzler.12@999"]);
    expect(feed(back)[0].params).toEqual({ name: "Hetzler" });
  });
});
