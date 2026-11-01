import { describe, expect, it } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { softwareById } from "../src/sim/10-catalog/platforms";
import { type GameState } from "../src/sim/50-state";
import { installScript } from "../src/sim/60-infra/apt";
import { setMachine } from "../src/sim/60-infra/cluster";
import { assignedKey, assignKey, installedVersion, issueKey, licenceStatus, lookOf } from "../src/sim/60-infra/licence";
import { machineScreen } from "../src/sim/60-infra/oob";
import { hostOf, upgradeOffers } from "../src/sim/80-business/vendor-shop";
import { softwareTarget, upgradeSoftware } from "../src/sim/90-actions/console";
import { type ActionResult } from "../src/sim/90-actions/hardware";
import { addToCart, checkout } from "../src/sim/90-actions/vendor-shop";
import { newGame, panelServer, withServer } from "./fixtures";

const ok = (r: ActionResult) => { if (!r.ok) throw new Error(r.error); return r.id!; };
const err = (r: ActionResult) => (r.ok ? "ok" : r.error);
const start = () => ({ ...withServer(newGame(3)), cash: 100_000 });
const DA = "wget -O setup.sh https://download.directadmen.com/setup.sh && sh setup.sh auto";
// Finishes an upgrade that is running.
const finish = (s: GameState, product: string) => { s.hour += softwareById(product).installHours; };

describe("software upgrade", () => {
  it("steps free software up one major at a time and keeps the old version and look until each step is done", () => {
    const s = start();
    panelServer(s, "dev3");
    expect(installedVersion(s, "dev3", "freepanel")).toBe("1.200");
    expect(err(upgradeSoftware(s, "dev3", "freepanel"))).toBe("error.noMajorUpgrade");
    s.hour = hourOfMonth("2015-01");
    expect(ok(upgradeSoftware(s, "dev3", "freepanel"))).toBe("1.400");
    expect(installedVersion(s, "dev3", "freepanel")).toBe("1.200");
    expect(machineScreen(s, "dev3").kind).toBe("installing");
    expect(err(upgradeSoftware(s, "dev3", "freepanel"))).toBe("error.noMajorUpgrade");
    finish(s, "freepanel");
    expect(installedVersion(s, "dev3", "freepanel")).toBe("1.400");
    ok(upgradeSoftware(s, "dev3", "freepanel"));
    finish(s, "freepanel");
    expect(softwareTarget(s, "dev3", "freepanel")?.version).toBe("1.700");
    ok(upgradeSoftware(s, "dev3", "freepanel"));
    expect(lookOf(s, "dev3", "freepanel")).toBe("early");
    finish(s, "freepanel");
    expect(lookOf(s, "dev3", "freepanel")).toBe("late");
    expect(s.cash).toBe(100_000);
  });

  it("needs an upgrade key past a version-bound key, from the console or the command, and hands the old key back", () => {
    const s = start();
    panelServer(s, "dev3", "directadmen");
    const old = issueKey(s, "directadmen", null);
    assignKey(s, old.id, "dev3");
    s.hour = hourOfMonth("2008-01");
    expect(err(upgradeSoftware(s, "dev3", "directadmen"))).toBe("error.licenceKey");
    expect(installScript(s, "dev3", `${DA} --upgrade`)).toMatchObject({ failed: true });
    ok(addToCart(s, "directadmen", null, "1.24"));
    ok(checkout(s, hostOf("directadmen")!));
    const up = s.licenses.at(-1)!;
    expect(up).toMatchObject({ covers: { kind: "version", major: "1.30" }, machineId: null });
    expect(s.cash).toBe(100_000 - 100);
    expect(installScript(s, "dev3", `${DA} --upgrade --key ${up.key}`)?.action?.[0]).toBe(upgradeSoftware);
    ok(upgradeSoftware(s, "dev3", "directadmen", up.key));
    expect(assignedKey(s, "dev3", "directadmen")?.id).toBe(up.id);
    expect(s.licenses.find((k) => k.id === old.id)?.machineId).toBeNull();
    finish(s, "directadmen");
    expect([installedVersion(s, "dev3", "directadmen"), licenceStatus(s, "dev3", "directadmen")]).toEqual(["1.30", "active"]);
  });

  it("prices an upgrade at the discount within 12 months of the old key and at full price after", () => {
    const s = start();
    s.hour = hourOfMonth("2010-09");
    issueKey(s, "vmwhere", null);
    s.hour = hourOfMonth("2011-08");
    expect(upgradeOffers(s, "vmwhere")).toEqual([{ from: "4", to: "5", fee: 300, discounted: true }]);
    s.hour = hourOfMonth("2011-10");
    expect(upgradeOffers(s, "vmwhere")).toEqual([{ from: "4", to: "5", fee: 600, discounted: false }]);
  });

  it("stops selling upgrades once the vendor no longer sells version-bound licences", () => {
    const s = start();
    s.hour = hourOfMonth("2015-06");
    issueKey(s, "windoors", null);
    s.hour = hourOfMonth("2016-02");
    expect(upgradeOffers(s, "windoors")).toEqual([{ from: "2012 R2", to: "2016", fee: 300, discounted: true }]);
    ok(addToCart(s, "windoors", null, "2012 R2"));
    s.hour = hourOfMonth("2016-10");
    expect(upgradeOffers(s, "windoors")).toEqual([]);
    expect(err(addToCart(s, "windoors", null, "2012 R2"))).toBe("error.notForSale");
    expect(err(checkout(s, hostOf("windoors")!))).toBe("error.notForSale");
  });

  it("upgrades a term licence that is paid without a new key", () => {
    const s = start();
    panelServer(s, "dev3", "cpanic");
    setMachine(s, "dev3", (m) => ({ software: m.software.map((x) => ({ ...x, version: "11.24" })) }));
    const k = issueKey(s, "cpanic", "dedicated");
    assignKey(s, k.id, "dev3");
    s.hour = hourOfMonth("2010-11");
    expect(ok(upgradeSoftware(s, "dev3", "cpanic"))).toBe("11.28");
    finish(s, "cpanic");
    expect(assignedKey(s, "dev3", "cpanic")?.id).toBe(k.id);
    expect(licenceStatus(s, "dev3", "cpanic")).toBe("active");
    expect(s.cash).toBe(100_000);
  });
});
