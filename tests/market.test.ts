import { describe, expect, it } from "vitest";
import { COMPETITORS } from "../src/sim/10-catalog/economy";
import { cityMarket } from "../src/sim/30-market/market";
import { demand, lostReasons, segmentsOf, studied, studyCost } from "../src/sim/30-market/research";
import { buyStudy } from "../src/sim/90-actions/market";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { startGame } from "../src/sim/90-actions/start";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { t } from "../src/i18n/en";

describe("market research", () => {
  it("splits each product's buyers between you and the competitors", () => {
    const s = startGame(1);
    setUpChannel(s, "website");
    const rows = demand(s, "Frankfurt");
    const total = rows.reduce((n, r) => n + r.buyers, 0);
    expect(total).toBeCloseTo(cityMarket("Frankfurt", s.hour), 3);
    for (const r of rows) expect(r.you + r.rivals.reduce((n, x) => n + x.buyers, 0)).toBeCloseTo(r.buyers, 3);
    const web = rows.find((r) => r.product === "webHosting")!;
    expect(web.you).toBeGreaterThan(0);
    expect(web.you / web.buyers).toBeLessThan(0.1);
    // Only the game server specialist's segment buys game servers from Nitradoh.
    expect(rows.find((r) => r.product === "gameServer")!.rivals.map((x) => x.name)).toContain("Nitradoh");
    expect(web.rivals.map((x) => x.name)).not.toContain("Nitradoh");
    // Without a location in Paris you only get website spill leads there.
    expect(demand(s, "Paris").find((r) => r.product === "webHosting")!.you).toBeLessThan(web.you);
  });

  it("groups lost sales of the last months by reason", () => {
    const s = startGame(1);
    s.hour = 8760;
    const lose = (hour: number, reason: string, params: Record<string, string | number> = {}, reference = 3) =>
      s.sales.lost.push({ hour, name: "x", product: "webHosting", plan: "web-s", reference, reason, params });
    lose(8000, "lost.price");
    lose(8100, "lost.price");
    lose(8200, "sales.need.location", { city: "London" });
    lose(8300, "sales.need.location", { city: "Paris" }, 10);
    lose(1000, "lost.price");
    const g = lostReasons(s, 3);
    expect(g.map((x) => [x.reason, x.count])).toEqual([["lost.price", 2], ["sales.need.location", 1], ["sales.need.location", 1]]);
    expect(g[1].params).toEqual({ city: "Paris" });
    expect(g[0].reference).toBe(6);
    expect(lostReasons(s, 12)[0].count).toBe(3);
  });

  it("sells one study per profile and keeps it across a save", () => {
    const s = startGame(1);
    s.cash = 5000;
    expect(studied(s, "onlineShop")).toBe(false);
    expect(buyStudy(s, "onlineShop")).toEqual({ ok: true, id: "onlineShop" });
    expect(s.cash).toBe(5000 - studyCost("onlineShop"));
    expect(studyCost("onlineShop")).toBeGreaterThan(studyCost("gamer"));
    expect(t(s.ledger.at(-1)!.key, s.ledger.at(-1)!.params)).toBe("Market study by Gartnah: Online shops");
    expect(buyStudy(s, "onlineShop")).toEqual({ ok: false, error: "error.studyDone" });
    expect(buyStudy(s, "enterprise")).toEqual({ ok: false, error: "error.noCash" });
    expect(deserialize(serialize(s)).marketing.studies).toEqual(["onlineShop"]);
    const old = JSON.parse(serialize(s));
    delete old.marketing.studies;
    expect(deserialize(JSON.stringify(old)).marketing.studies).toEqual([]);
  });

  it("lists the segments each competitor sells to", () => {
    const by = (n: string) => segmentsOf(COMPETITORS.find((c) => c.name === n)!);
    expect(by("Nitradoh")).toEqual(["gamer"]);
    expect(by("Ionose")).toHaveLength(9);
    // WP Engyne's price is above what low budgets pay.
    expect(by("WP Engyne")).toEqual(["soleProp", "smallBiz", "agency", "office"]);
  });
});
