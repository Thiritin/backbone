import { describe, expect, it } from "vitest";
import { hourOf, yearOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { newGame } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setPower } from "../src/sim/90-actions/hardware";
import { planMaintenance } from "../src/sim/90-actions/maintenance";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { statusBars, statusNow } from "../src/sim/80-business/status";
import { sitePages } from "../src/sim/80-business/website";
import { basement, BASEMENT_SERVER, readyGame, skipTo, withServer } from "./fixtures";

const at = (day: number, hour: number) => hourOf(new Date(Date.UTC(2005, 0, day, hour)));
const run = (s: ReturnType<typeof newGame>, hours: number) => { for (let i = 0; i < hours; i++) tick(s); };

// A basement VPS customer; the server loses power one hour into a window at Tuesday 10:00 that may be announced.
function outage(planned: boolean) {
  const from = at(11, 10), s = withServer(newGame(1));
  s.cash = 100_000;
  basement(s);
  s.hour = from - 30;
  const cus = addCustomer(s, "Ada Lang", "smallBiz");
  expect(provisionService(s, cus, "vps", { label: "vm", spec: sizeSpec("vps", 0, yearOf(s.hour)) }).ok).toBe(true);
  if (planned) expect(planMaintenance(s, { kind: "device", id: BASEMENT_SERVER }, from, 4).ok).toBe(true);
  while (s.hour < from - 1) tick(s);
  setPower(s, BASEMENT_SERVER, false);
  run(s, 3);
  return s;
}

describe("status record", () => {
  it("records an unannounced outage as down and an announced window as maintenance", () => {
    const hard = outage(false);
    expect(hard.statusDays.some((d) => d.down.includes("vps"))).toBe(true);
    expect(statusBars(hard, "vps").at(-1)).toBe("down");
    expect(statusNow(hard).get("vps")).toBe("down");
    const planned = outage(true);
    expect(planned.statusDays.some((d) => d.down.includes("vps"))).toBe(false);
    expect(statusBars(planned, "vps").at(-1)).toBe("maint");
  });

  it("keeps at most 90 days and survives a save round trip", () => {
    const s = outage(false);
    s.statusDays = Array.from({ length: 95 }, (_, i) => ({ day: i, down: [], slow: [], maint: [] }));
    s.hour = 95 * 24;
    tick(s);
    expect(s.statusDays.length).toBeLessThanOrEqual(90);
    expect(deserialize(serialize(s)).statusDays).toEqual(s.statusDays);
  });

  it("fills statusDays for a save without it", () => {
    const data = JSON.parse(serialize(newGame(3)));
    delete data.statusDays;
    expect(deserialize(JSON.stringify(data)).statusDays).toEqual([]);
  });
});

describe("site pages by era and size", () => {
  it("gates the status page on the year and the customers and the rest on the website", () => {
    const s = readyGame(7);
    expect(sitePages(s)).toEqual(["home"]);
    s.marketing.owned = ["website"];
    const base = sitePages(s);
    expect(base).toEqual(expect.arrayContaining(["about", "contact", "legal"]));
    expect(base).not.toContain("status");
    const c = s.customers[0];
    s.customers = Array.from({ length: 10 }, (_, i) => ({ ...c, id: `c${i}`, churnedAt: null }));
    expect(sitePages(s)).not.toContain("status");
    skipTo(s, 2009);
    expect(sitePages(s)).toContain("status");
  });
});
