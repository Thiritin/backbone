import { describe, expect, it } from "vitest";
import { isMonthStart } from "../src/sim/00-core/time";
import { modelById } from "../src/sim/10-catalog/hardware";
import { softwareById } from "../src/sim/10-catalog/platforms";
import { licensingAt, serverOsById } from "../src/sim/10-catalog/server-os";
import { device, type GameState } from "../src/sim/50-state";
import { clusterOf } from "../src/sim/60-infra/cluster";
import { installedCores } from "../src/sim/60-infra/status";
import { licenseCost } from "../src/sim/85-products/products";
import { tick } from "../src/sim/88-tick/tick";
import { bootFromUsb, installOs } from "../src/sim/90-actions/console";
import type { ServerOsId } from "../src/sim/10-catalog/server-os";
import { createSoftwareVm, installSoftware } from "../src/sim/90-actions/software";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { hypervisor, readyGame, skipTo, withNetwork, withServer, withStick, newGame } from "./fixtures";
import { installScript } from "../src/sim/60-infra/apt";
import { t } from "../src/i18n/en";

const err = (r: object) => (r as { error?: string }).error;
const ok = (r: { ok: boolean }) => { expect(err(r)).toBeUndefined(); expect(r.ok).toBe(true); };
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const once = (s: GameState) => s.ledger.filter((l) => l.key === "ledger.licenseOnce");
const monthEnd = (s: GameState) => {
  while (!isMonthStart(s.hour + 1)) s.hour++;
  tick(s);
};
// A fresh G1 storage server in rack2, booted from the USB stick into the installer.
const atInstaller = (s: GameState, id = "dev90", slot = 10): string => {
  s.devices.push(device(id, "g1-storage", "Dwell", "rack2", slot, null, `st-${id}`, modelById("g1-storage").price));
  withStick(s, id);
  withNetwork(s, id);
  ok(bootFromUsb(s, id));
  return id;
};
// The stick rewritten with the OS the installer installs.
const install = (s: GameState, id: string, os: ServerOsId) => { withStick(s, id, os); return installOs(s, id, os); };
const sockets = (s: GameState, id: string) => dev(s, id).components.filter((p) => p.kind === "cpu").length;

describe("license eras", () => {
  it("pick the era of the game year", () => {
    const w = serverOsById("windoors"), v = softwareById("vmwhere");
    expect(licensingAt(w, 2005)).toEqual({ from: 2005, kind: "once", fee: 600, upgrade: 300 });
    expect(licensingAt(w, 2015).kind).toBe("once");
    expect(licensingAt(w, 2016, 9).kind).toBe("once");
    expect(licensingAt(w, 2016, 10)).toMatchObject({ kind: "core", fee: 4, minCores: 16, minCoresPerCpu: 8 });
    expect(licensingAt(v, 2023, 11).kind).toBe("once");
    expect(licensingAt(v, 2023, 12)).toMatchObject({ kind: "core", fee: 96, period: "year", minCoresPerCpu: 16 });
    expect(licensingAt(softwareById("tcadmen"), 2030)).toEqual({ from: 2005, kind: "server", fee: 25 });
  });
});

describe("Windoors Server", () => {
  it("is bought once per machine in 2005, kept on a reinstall and bills nothing monthly", () => {
    const s = readyGame(7), id = atInstaller(s);
    s.cash = 1000;
    ok(install(s, id, "windoors"));
    expect(s.cash).toBe(400);
    expect(once(s)).toMatchObject([{ category: "licenses", params: { name: "Windoors Server 2003", machine: "st-dev90" }, amount: -600 }]);
    expect(s.licenses).toMatchObject([{ product: "windoors", kind: "once", machineId: id, renewsAt: null }]);
    ok(bootFromUsb(s, id));
    ok(install(s, id, "windoors"));
    expect(s.cash).toBe(400);
    monthEnd(s);
    expect(s.ledger.filter((l) => l.key === "ledger.windoors")).toEqual([]);
  });

  it("is bought again for a new VM from a template", () => {
    const s = withServer(newGame(1));
    s.cash = 10_000;
    const cloud = hypervisor(s, ["dev3"]);
    const cash = s.cash;
    ok(createSoftwareVm(s, cloud, "tcadmen"));
    expect(s.cash).toBe(cash - 600);
    expect(once(s)).toHaveLength(1);
  });

  it("is refused without the cash, and leaves the machine as it was", () => {
    const s = readyGame(7), id = atInstaller(s);
    s.cash = 100;
    expect(err(install(s, id, "windoors"))).toBe("error.noCash");
    expect(dev(s, id).os).toBeNull();
    expect(s.cash).toBe(100);
    ok(install(s, id, "lunix"));
  });

  it("from October 2016 costs nothing at install and 4 euros per core a month after, 16 at least", () => {
    const s = readyGame(7);
    skipTo(s, 2017);
    const id = atInstaller(s);
    const cash = s.cash;
    ok(install(s, id, "windoors"));
    expect(s.cash).toBe(cash);
    expect(s.licenses).toMatchObject([{ product: "windoors", kind: "core", machineId: id }]);
    s.hour = s.licenses[0].renewsAt! - 1;
    tick(s);
    expect(s.ledger.filter((l) => l.key === "ledger.licenceRenewal").map((l) => l.amount)).toEqual([-4 * Math.max(16, installedCores(dev(s, id)), 8 * sockets(s, id))]);
  });
});

describe("VMwhere", () => {
  it("is bought once per CPU socket in 2010", () => {
    const s = readyGame(7);
    skipTo(s, 2010);
    const id = atInstaller(s);
    ok(install(s, id, "lunix"));
    for (let h = 0; h < 2; h++) tick(s);
    s.cash = 5000;
    ok(installSoftware(s, id, "vmwhere"));
    expect(s.cash).toBe(5000 - 600 * sockets(s, id));
    expect(once(s)).toMatchObject([{ params: { name: "VMwhere", machine: "st-dev90" } }]);
    for (let h = 0; h < 6; h++) tick(s);
    const c = clusterOf(s, id)!;
    expect(licenseCost(s, c)).toEqual({ panel: 0, platform: 0 });
  });

  it("is refused without the cash", () => {
    const s = readyGame(7), id = atInstaller(s);
    ok(install(s, id, "lunix"));
    for (let h = 0; h < 2; h++) tick(s);
    s.cash = 100;
    expect(err(installSoftware(s, id, "vmwhere"))).toBe("error.noCash");
  });

  it("from December 2023 costs nothing at install and 96 euros per physical core a year, 16 per CPU at least", () => {
    const s = readyGame(7);
    skipTo(s, 2024);
    const id = atInstaller(s);
    ok(install(s, id, "lunix"));
    for (let h = 0; h < 2; h++) tick(s);
    const cash = s.cash;
    ok(installSoftware(s, id, "vmwhere"));
    expect(s.cash).toBe(cash);
    for (let h = 0; h < 6; h++) tick(s);
    const c = clusterOf(s, id)!;
    expect(licenseCost(s, c)).toEqual({ panel: 0, platform: 8 * Math.max(installedCores(dev(s, id)), 16 * sockets(s, id)) });
  });
});

describe("old saves", () => {
  it("give every Windoors and VMwhere machine its license for free, billed nothing at month end", () => {
    const s = readyGame(7), id = atInstaller(s);
    s.cash = 1000;
    ok(install(s, id, "windoors"));
    const raw = JSON.parse(serialize(s));
    delete raw.licenses;
    delete raw.trials;
    const back = deserialize(JSON.stringify(raw));
    expect(back.licenses).toMatchObject([{ product: "windoors", machineId: id }]);
    const cash = back.cash, lines = back.ledger.length;
    monthEnd(back);
    expect(back.ledger.slice(lines).filter((l) => l.category === "licenses")).toEqual([]);
    ok(bootFromUsb(back, id));
    ok(install(back, id, "windoors"));
    expect(back.ledger.slice(lines).filter((l) => l.key === "ledger.licenseOnce")).toEqual([]);
    expect(back.cash).toBeGreaterThan(cash - 600);
  });
});

describe("the Terminal", () => {
  it("refuses the VMwhere install line without the cash", () => {
    const s = readyGame(7), id = atInstaller(s);
    ok(install(s, id, "lunix"));
    for (let h = 0; h < 2; h++) tick(s);
    s.cash = 100;
    const r = installScript(s, id, softwareById("vmwhere").install.commands[0]);
    expect(r).toMatchObject({ output: [t("error.noCash")], failed: true });
  });
});
