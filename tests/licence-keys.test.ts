import { describe, expect, it } from "vitest";
import { hourOf, isMonthStart } from "../src/sim/00-core/time";
import { buyUpgradeLicense, productsTick } from "../src/sim/85-products/products";
import { SOFTWARE } from "../src/sim/10-catalog/platforms";
import { SERVER_OS } from "../src/sim/10-catalog/server-os";
import { newGame } from "../src/sim/50-state";
import { assignedKey, assignKey, issueKey, trialOf, licenceStatus, panelMachine, releaseKey, startTrial, unassignedKeys, updateKey } from "../src/sim/60-infra/licence";
import { createPanelVm } from "../src/sim/90-actions/clusters";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { panelVm, readyGame } from "./fixtures";

describe("licence terms", () => {
  it("give every licensed product its trial length and free software none", () => {
    const days = Object.fromEntries([...SERVER_OS, ...SOFTWARE].filter((x) => x.licensing.some((e) => e.kind !== "free")).map((x) => [x.id, x.trialDays]));
    expect(days).toEqual({ windoors: 180, hypervee: 180, cpanic: 15, pleskit: 14, directadmen: null, vmwhere: 60, veeham: 30, tcadmen: 30, multikraft: null, anyconnekt: null });
    expect([...SERVER_OS, ...SOFTWARE].filter((x) => x.licensing.every((e) => e.kind === "free")).every((x) => x.trialDays === undefined)).toBe(true);
  });
});

describe("licence status", () => {
  it("runs a trial, ends it, and turns active and lapsed with an assigned key", () => {
    const s = newGame(3);
    expect(licenceStatus(s, "m1", "lunix")).toBeNull();
    expect(licenceStatus(s, "m1", "vmwhere")).toBe("ended");
    startTrial(s, "m1", "vmwhere");
    expect(licenceStatus(s, "m1", "vmwhere")).toBe("trial");
    s.hour += 60 * 24;
    expect(licenceStatus(s, "m1", "vmwhere")).toBe("ended");
    const k = issueKey(s, "vmwhere", null);
    assignKey(s, k.id, "m1");
    expect(licenceStatus(s, "m1", "vmwhere")).toBe("active");
    updateKey(s, k.id, { lapsedAt: s.hour });
    expect(licenceStatus(s, "m1", "vmwhere")).toBe("lapsed");
  });

  it("runs a trial once per machine and product", () => {
    const s = newGame(3);
    startTrial(s, "m1", "cpanic");
    s.hour += 20 * 24;
    startTrial(s, "m1", "cpanic");
    startTrial(s, "m2", "cpanic");
    startTrial(s, "m1", "multikraft");
    expect(s.trials).toEqual([{ machineId: "m1", product: "cpanic", until: 15 * 24 }, { machineId: "m2", product: "cpanic", until: 35 * 24 }]);
    expect(licenceStatus(s, "m1", "cpanic")).toBe("ended");
    expect(licenceStatus(s, "m1", "multikraft")).toBe("ended");
  });
});

describe("licence keys", () => {
  it("are seeded four groups of four, renew monthly unless bought once, and move between machines", () => {
    const s = newGame(5);
    const once = issueKey(s, "windoors", null, "ord9"), monthly = issueKey(s, "cpanic", "premier");
    expect(once).toMatchObject({ id: "lic1", product: "windoors", edition: null, kind: "once", orderId: "ord9", machineId: null, covers: { kind: "version", major: "2003" }, renewsAt: null, lapsedAt: null });
    expect(monthly).toMatchObject({ id: "lic2", edition: "premier", kind: "account", orderId: "ord2" });
    expect(isMonthStart(monthly.renewsAt!)).toBe(true);
    expect(monthly.covers).toEqual({ kind: "term", until: monthly.renewsAt });
    expect(once.key).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    expect(once.key).not.toBe(monthly.key);
    expect(issueKey(newGame(5), "windoors", null).key).toBe(once.key);
    expect(unassignedKeys(s, "windoors")).toEqual([once]);
    assignKey(s, once.id, "m1");
    expect(unassignedKeys(s, "windoors")).toEqual([]);
    expect(licenceStatus(s, "m1", "windoors")).toBe("active");
    releaseKey(s, once.id);
    expect(unassignedKeys(s, "windoors").map((k) => k.id)).toEqual(["lic1"]);
    expect(licenceStatus(s, "m1", "windoors")).toBe("ended");
    assignKey(s, once.id, "m2");
    expect(licenceStatus(s, "m2", "windoors")).toBe("active");
  });
});

describe("panel installs", () => {
  it("start cPanic on a trial and give DirectAdmen, which has none, a key for its top tier", () => {
    const s = readyGame(1);
    s.cash = 10_000;
    const cloud = s.clusters.find((c) => c.kind === "cloud")!.id;
    const vm = (panel: string) => { const r = createPanelVm(s, cloud, panel); if (!r.ok) throw new Error(r.error); return panelMachine(s.clusters.find((c) => c.id === r.id)!)!; };
    const da = vm("directadmen"), cp = vm("cpanic");
    expect(assignedKey(s, da, "directadmen")).toMatchObject({ edition: "standard", kind: "server", covers: { kind: "term" } });
    expect(assignedKey(s, cp, "cpanic")).toBeUndefined();
    s.hour += 24;
    productsTick(s);
    expect(trialOf(s, cp, "cpanic")).toBeDefined();
    expect(trialOf(s, da, "directadmen")).toBeUndefined();
    expect([licenceStatus(s, cp, "cpanic"), licenceStatus(s, da, "directadmen")]).toEqual(["trial", "active"]);
  });
});

describe("version-bound keys", () => {
  it("leave a newer major unlicensed until a paid upgrade moves the key, and term keys renew with the monthly bill", () => {
    const s = readyGame(7), id = s.devices.find((d) => d.os)!.id;
    s.devices = s.devices.map((d) => (d.id === id ? { ...d, os: { id: "windoors", version: "2003", installedAt: 0 } } : d));
    assignKey(s, issueKey(s, "windoors", null).id, id);
    expect(licenceStatus(s, id, "windoors")).toBe("active");
    s.devices = s.devices.map((d) => (d.id === id ? { ...d, os: { ...d.os!, version: "2008" } } : d));
    expect(licenceStatus(s, id, "windoors")).toBe("unlicensed");
    s.cash = 1000;
    buyUpgradeLicense(s, id, "windoors", "2008");
    expect(assignedKey(s, id, "windoors")!.covers).toEqual({ kind: "version", major: "2008" });
    expect(licenceStatus(s, id, "windoors")).toBe("active");
    const term = issueKey(s, "tcadmen", null);
    assignKey(s, term.id, id);
    s.hour = hourOf(new Date(Date.UTC(2005, 5, 1)));
    productsTick(s);
    expect(assignedKey(s, id, "tcadmen")).toMatchObject({ covers: { kind: "term", until: hourOf(new Date(Date.UTC(2005, 6, 1))) }, renewsAt: hourOf(new Date(Date.UTC(2005, 6, 1))) });
  });
});

describe("old saves", () => {
  it("turn one-time licences and panel licences into assigned keys and trials", () => {
    const s = readyGame(1);
    const cloud = s.clusters.find((c) => c.kind === "cloud")!.id;
    const paid = panelVm(s, cloud, "cpanic"), trial = panelVm(s, cloud, "pleskit");
    const vm = (id: string) => panelMachine(s.clusters.find((c) => c.id === id)!)!;
    const raw = JSON.parse(serialize(s));
    delete raw.trials;
    raw.licenses = [{ id: "windoors", machineId: "dev3", boughtAt: 5 }];
    for (const c of raw.clusters) {
      if (c.id === paid) c.licence = { tier: "pro", trialUntil: null, lapsedAt: 100 };
      if (c.id === trial) c.licence = { tier: "webHost", trialUntil: s.hour + 48, lapsedAt: null };
    }
    const back = deserialize(JSON.stringify(raw));
    expect(back.licenses).toMatchObject([
      { product: "windoors", kind: "once", machineId: "dev3", boughtAt: 5, covers: { kind: "version", major: "2003" }, renewsAt: null },
      { product: "cpanic", edition: "pro", kind: "server", machineId: vm(paid), lapsedAt: 100 },
    ]);
    expect(back.trials).toEqual([{ machineId: vm(trial), product: "pleskit", until: s.hour + 48 }]);
    expect(back.clusters.some((c) => "licence" in c)).toBe(false);
    expect(licenceStatus(back, vm(paid), "cpanic")).toBe("lapsed");
    expect(licenceStatus(back, vm(trial), "pleskit")).toBe("trial");
    expect(deserialize(serialize(back)).licenses).toEqual(back.licenses);
  });
});
