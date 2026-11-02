import { describe, expect, it } from "vitest";
import { hashRng } from "../src/sim/00-core/rng";
import { PROFILES } from "../src/sim/10-catalog/economy";
import { AGENCY_LEAD_SHARE, WEBDEV_LEAD_SHARE } from "../src/sim/30-customers/resellers";
import { needFor, senderFor } from "../src/sim/30-market/market";
import { tick } from "../src/sim/88-tick/tick";
import { EVENTS } from "../src/sim/80-business/community";
import { awareness } from "../src/sim/80-business/marketing";
import { newGame } from "../src/sim/50-state";
import { deserialize, serialize } from "../src/sim/91-save/save";

describe("web developer segment", () => {
  it("takes its share from private individuals", () => {
    expect(PROFILES.reduce((a, p) => a + p.mix, 0)).toBeCloseTo(1, 6);
    expect(PROFILES.find((p) => p.id === "webdev")!.mix).toBe(0.03);
    expect(PROFILES.find((p) => p.id === "private")!.mix).toBe(0.22);
  });

  it("starts at a quarter of the usual awareness and stays there without outreach", () => {
    const s = newGame(1);
    expect(awareness(s, "webDev")).toBeCloseTo(0.005, 6);
    expect(awareness(s, "agency")).toBeCloseTo(0.02, 6);
    for (let i = 0; i < 40 * 24; i++) tick(s);
    expect(awareness(s, "webDev")).toBeGreaterThanOrEqual(0.005);
    expect(awareness(s, "webDev")).toBeLessThan(awareness(s, "agency"));
  });

  it("asks for web hosting, writes as a freelancer and prefers resellers more than agencies", () => {
    const r = hashRng(3, 1);
    const products = new Set(Array.from({ length: 200 }, () => needFor(r, "webDev", 2006).product));
    expect([...products].sort()).toEqual(["vps", "webHosting"]);
    const company = senderFor(hashRng(3, 2), "webDev").company!;
    expect(company).toMatch(/ (Webdesign|Media)$/);
    expect(WEBDEV_LEAD_SHARE).toBeGreaterThan(AGENCY_LEAD_SHARE);
  });

  it("is reached by developer events and loads from a save without its awareness entry", () => {
    expect(EVENTS.filter((e) => e.audience.includes("webDev")).map((e) => e.id)).toEqual(["chaosClub", "hackASorus", "openData", "devOops"]);
    const s = newGame(2);
    const raw = JSON.parse(serialize(s));
    delete raw.marketing.awareness.webDev;
    expect(awareness(deserialize(JSON.stringify(raw)), "webDev")).toBeCloseTo(0.005, 6);
  });
});
