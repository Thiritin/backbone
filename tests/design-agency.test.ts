import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import type { GameState } from "../src/sim/50-state";
import { AGENCY_HOST, resolve } from "../src/sim/80-business/browser";
import { siteIndex } from "../src/sim/80-business/index";
import { DESIGN_DAYS, designPrice, designQuote } from "../src/sim/80-business/website";
import { tick } from "../src/sim/88-tick/tick";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { redesign } from "../src/sim/90-actions/website";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { metrics } from "../src/sim/metrics";
import { readyGame } from "./fixtures";

const inYear = (s: GameState, y: number) => { s.hour = hourOf(new Date(Date.UTC(y, 5, 15))); };
const run = (s: GameState, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };

describe("design price", () => {
  it("grows with the year and with the company level", () => {
    expect(designPrice(2005, 1)).toBe(400);
    expect(designPrice(2009, 1)).toBe(650);
    expect(designPrice(2007, 1)).toBe(525);
    expect(designPrice(2025, 1)).toBe(3500);
    expect(designPrice(2031, 1)).toBe(3500);
    expect(designPrice(2025, 6)).toBe(12250);
  });

  it("is what the first web design costs", () => {
    const s = readyGame(1);
    s.cash = 100000;
    const price = designQuote(s);
    expect(price).toBe(designPrice(2005, metrics(s).level.level));
    setUpChannel(s, "website");
    expect(s.ledger.at(-1)).toMatchObject({ category: "marketing", amount: -price });
  });
});

describe("redesign", () => {
  it("is accepted for a current design, books the price and flips the design only after 14 days", () => {
    const s = readyGame(1);
    s.cash = 100000;
    expect(setUpChannel(s, "website").ok).toBe(true);
    inYear(s, 2017);
    const price = designQuote(s), cash = s.cash;
    s.marketing = { ...s.marketing, designYear: 2017 };
    expect(redesign(s).ok).toBe(true);
    expect(s.cash).toBe(cash - price);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.redesign", category: "marketing", amount: -price });
    expect(redesign(s)).toEqual({ ok: false, error: "error.designOrdered" });
    s.marketing = { ...s.marketing, designYear: 2013 };
    // Nothing else of the design changes in between, so the wait is skipped up to its last hours.
    s.hour += DESIGN_DAYS * 24 - 4;
    run(s, 2);
    expect(s.marketing.designYear).toBe(2013);
    run(s, 4);
    expect(s.marketing).toMatchObject({ designYear: 2017, designReady: null });
  });
});

describe("agency site", () => {
  it("answers at its host and sits in the Marketing category of the index", () => {
    const s = readyGame(1);
    expect(resolve(s, `www.${AGENCY_HOST}/quote`).page).toEqual({ kind: "agency" });
    expect(siteIndex(s).find((c) => c.rows.some((r) => r.url.includes(AGENCY_HOST)))).toBeDefined();
  });
});

describe("old saves", () => {
  it("load without a design on order", () => {
    const old = JSON.parse(serialize(readyGame(1)));
    delete old.marketing.designReady;
    expect(deserialize(JSON.stringify(old)).marketing.designReady).toBeNull();
  });
});
