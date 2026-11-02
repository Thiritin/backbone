import { describe, expect, it } from "vitest";
import { DAYS_PER_MONTH } from "../src/sim/00-core/time";
import { FLYER_RESPONSE, flyerPrice } from "../src/sim/10-catalog/flyers";
import { profileStats } from "../src/sim/40-support/tickets";
import { leadsThisMonth } from "../src/sim/80-business/marketing";
import { tick } from "../src/sim/88-tick/tick";
import { orderFlyers } from "../src/sim/90-actions/marketing";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { startGame } from "./fixtures";

describe("flyers", () => {
  it("refuses a city without a location, an unknown size and a short purse", () => {
    const s = startGame(7);
    expect(orderFlyers(s, "Atlantis", 5000)).toEqual({ ok: false, error: "error.flyerCity" });
    expect(orderFlyers(s, s.locations[0].city, 123)).toEqual({ ok: false, error: "error.flyerSize" });
    s.cash = 1;
    expect(orderFlyers(s, s.locations[0].city, 5000)).toEqual({ ok: false, error: "error.noCash" });
    expect(s.marketing.flyers).toEqual([]);
  });

  it("books the run, hands it out within 31 days and counts leads at the response rate", () => {
    const s = startGame(7), city = s.locations[0].city, cash = s.cash, price = flyerPrice(5000, 2005);
    expect(price).toBeCloseTo(5000 * 0.07 * 0.6 ** (21 / 21), 2);
    expect(orderFlyers(s, city, 5000).ok).toBe(true);
    expect(s.cash).toBeCloseTo(cash - price, 2);
    expect(s.ledger.at(-1)).toMatchObject({ category: "marketing", key: "ledger.flyers", amount: -price });
    expect(leadsThisMonth(s).some((b) => b.source === "flyer")).toBe(false);

    for (let i = 0; i < 72; i++) tick(s);
    const batches = leadsThisMonth(s).filter((b) => b.source === "flyer");
    expect(batches.map((b) => b.profile).sort()).toEqual(["private", "smallBiz", "soleProp"]);
    expect(batches.every((b) => b.city === city && b.conversion === 0.8)).toBe(true);
    const total = batches.reduce((n, b) => n + b.count, 0);
    expect(total).toBeCloseTo((5000 / 672) * FLYER_RESPONSE * 24 * DAYS_PER_MONTH, 6);
    const share = (p: "private" | "soleProp" | "smallBiz") => profileStats(p).mix / (profileStats("private").mix + profileStats("soleProp").mix + profileStats("smallBiz").mix);
    expect(batches.find((b) => b.profile === "soleProp")!.count).toBeCloseTo(total * share("soleProp"), 6);

    for (let i = 72; i < 31 * 24; i++) tick(s);
    const [run] = s.marketing.flyers;
    expect(run.flyersLeft).toBe(0);
    expect(run.leads).toBeCloseTo(5000 * FLYER_RESPONSE, 6);
    expect(leadsThisMonth(s).some((b) => b.source === "flyer")).toBe(false);
  });

  it("loads a saved game from before flyers with no runs", () => {
    const s = startGame(7), data = JSON.parse(serialize(s));
    delete data.marketing.flyers;
    expect(deserialize(JSON.stringify(data)).marketing.flyers).toEqual([]);
  });
});
