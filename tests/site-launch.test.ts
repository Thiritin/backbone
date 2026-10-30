import { describe, expect, it } from "vitest";
import type { GameState } from "../src/sim/50-state";
import { resolve } from "../src/sim/80-business/browser";
import { companyDomain } from "../src/sim/30-customers/domains";
import { SITE_BUILD_HOURS, siteBuilt, siteHostingCost } from "../src/sim/80-business/website";
import { tick } from "../src/sim/88-tick/tick";
import { setUpChannel } from "../src/sim/90-actions/marketing";
import { buildSite, launchSite, setLine } from "../src/sim/90-actions/website";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";

const run = (s: GameState, hours: number) => { const out = []; for (let i = 0; i < hours; i++) out.push(...tick(s)); return out; };

// A game ready to sell, with its site taken back to the start: nothing built and nothing online.
function fresh(seed: number): GameState {
  const s = readyGame(seed);
  s.marketing = { ...s.marketing, siteReady: null, launched: false, lines: [] };
  return s;
}

describe("site launch", () => {
  it("builds the first site for free in three days and launches it on the picked host", () => {
    const s = fresh(1), cash = s.cash;
    expect(resolve(s, companyDomain(s)).page.kind).toBe("notfound");
    expect(launchSite(s, { kind: "rented" })).toEqual({ ok: false, error: "error.siteNotBuilt" });
    expect(buildSite(s).ok).toBe(true);
    expect(buildSite(s)).toEqual({ ok: false, error: "error.siteStarted" });
    expect(s.cash).toBe(cash);
    const events = run(s, SITE_BUILD_HOURS - 1);
    expect(siteBuilt(s)).toBe(false);
    expect(events.some((e) => e.key === "event.siteBuilt")).toBe(false);
    expect(run(s, 1).some((e) => e.key === "event.siteBuilt")).toBe(true);
    expect(siteBuilt(s)).toBe(true);

    expect(setLine(s, "webHosting", true)).toEqual({ ok: false, error: "error.needsLaunch" });
    expect(setUpChannel(s, "website")).toEqual({ ok: false, error: "error.needsLaunch" });
    expect(siteHostingCost(s)).toBe(0);
    expect(launchSite(s, { kind: "own", clusterId: "nope" })).toEqual({ ok: false, error: "error.unknownCluster" });
    expect(s.marketing.launched).toBe(false);
    expect(launchSite(s, { kind: "rented" }).ok).toBe(true);
    expect(launchSite(s, { kind: "rented" })).toEqual({ ok: false, error: "error.siteLaunched" });
    expect(siteHostingCost(s)).toBeGreaterThan(0);
    expect(resolve(s, companyDomain(s)).page.kind).toBe("company");
    expect(setLine(s, "webHosting", true).ok).toBe(true);
  });

  it("sells SSL only as an add-on of listed web hosting", () => {
    const s = readyGame(2);
    s.marketing = { ...s.marketing, lines: [] };
    expect(setLine(s, "ssl", true)).toEqual({ ok: false, error: "error.needsWebHostingLine" });
    expect(setLine(s, "webHosting", true).ok).toBe(true);
    expect(setLine(s, "ssl", true).ok).toBe(true);
    expect(setLine(s, "webHosting", false).ok).toBe(true);
    expect(s.marketing.lines).toEqual([]);
  });

  it("counts an old save with a domain and listed lines as launched", () => {
    const s = readyGame(3);
    const old = JSON.parse(serialize(s));
    delete old.marketing.launched;
    delete old.marketing.siteReady;
    expect(deserialize(JSON.stringify(old)).marketing).toMatchObject({ launched: true, siteReady: 0 });
    old.marketing.lines = [];
    expect(deserialize(JSON.stringify(old)).marketing).toMatchObject({ launched: false, siteReady: null });
  });
});
