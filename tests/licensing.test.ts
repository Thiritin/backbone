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
import { bootFromUsb, installFromSite, installOs } from "../src/sim/90-actions/console";
import { assignedKey, issueKey, licenceStatus, trialOf, unassignedKeys } from "../src/sim/60-infra/licence";
import { activateLicence } from "../src/sim/90-actions/licence";
import { createPanelVm, createVm, PANEL_VM_SIZE } from "../src/sim/90-actions/clusters";
import type { ServerOsId } from "../src/sim/10-catalog/server-os";
import { createSoftwareVm, installSoftware, uninstallSoftware } from "../src/sim/90-actions/software";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { hypervisor, readyGame, skipTo, withNetwork, withServer, withStick, newGame } from "./fixtures";
import { installScript } from "../src/sim/60-infra/apt";
import { t } from "../src/i18n/en";

const err = (r: object) => (r as { error?: string }).error;
const ok = (r: { ok: boolean; id?: string }) => { expect(err(r)).toBeUndefined(); expect(r.ok).toBe(true); return r.id; };
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

describe("license eras", () => {
  it("pick the era of the game year", () => {
    const w = serverOsById("windoors"), v = softwareById("vmwhere");
    expect(licensingAt(w, 2005)).toEqual({ from: 2005, kind: "once", fee: 600 });
    expect(licensingAt(w, 2015).kind).toBe("once");
    expect(licensingAt(w, 2016)).toEqual({ from: 2016, kind: "core", fee: 4 });
    expect(licensingAt(v, 2023).kind).toBe("once");
    expect(licensingAt(v, 2024)).toEqual({ from: 2024, kind: "core", fee: 8 });
    expect(licensingAt(softwareById("tcadmen"), 2030)).toEqual({ from: 2005, kind: "server", fee: 25 });
  });
});

describe("Windoors Server", () => {
  it("installs on a 180 day trial at no charge, once per machine, and ends", () => {
    const s = readyGame(7), id = atInstaller(s), cash = s.cash;
    ok(install(s, id, "windoors"));
    expect([s.cash, once(s), s.licenses]).toEqual([cash, [], []]);
    expect(licenceStatus(s, id, "windoors")).toBe("trial");
    ok(bootFromUsb(s, id));
    ok(install(s, id, "windoors"));
    expect(s.trials).toHaveLength(1);
    s.hour += 181 * 24;
    expect(licenceStatus(s, id, "windoors")).toBe("ended");
  });

  it("takes a typed key and hands it back on a reinstall", () => {
    const s = readyGame(7), id = atInstaller(s), k = issueKey(s, "windoors", null);
    withStick(s, id, "windoors");
    ok(installOs(s, id, "windoors", undefined, undefined, k.key.toLowerCase()));
    expect([assignedKey(s, id, "windoors")?.id, licenceStatus(s, id, "windoors")]).toEqual([k.id, "active"]);
    expect(trialOf(s, id, "windoors")).toBeUndefined();
    ok(bootFromUsb(s, id));
    ok(install(s, id, "windoors"));
    expect(unassignedKeys(s, "windoors").map((x) => x.id)).toEqual([k.id]);
    expect(licenceStatus(s, id, "windoors")).toBe("trial");
  });

  it("refuses a key it does not know, and leaves the machine as it was", () => {
    const s = readyGame(7), id = atInstaller(s), vmwhere = issueKey(s, "vmwhere", null);
    withStick(s, id, "windoors");
    expect(err(installOs(s, id, "windoors", undefined, undefined, vmwhere.key))).toBe("error.licenceKey");
    expect(err(installOs(s, id, "windoors", undefined, undefined, "AAAA-AAAA-AAAA-AAAA"))).toBe("error.licenceKey");
    expect(dev(s, id).os).toBeNull();
  });

  it("gives a new VM from a template a key from My account in order, or its trial", () => {
    const s = withServer(newGame(1)), cloud = hypervisor(s, ["dev3"]), cash = s.cash;
    const first = ok(createSoftwareVm(s, cloud, "tcadmen")) as string;
    const vm1 = s.clusters.find((c) => c.id === first)!.vm!;
    expect([s.cash, licenceStatus(s, vm1, "windoors"), licenceStatus(s, vm1, "tcadmen")]).toEqual([cash, "trial", "trial"]);
    const [a] = [issueKey(s, "windoors", null), issueKey(s, "windoors", null)];
    const second = ok(createSoftwareVm(s, cloud, "tcadmen")), vm2 = s.clusters.find((c) => c.id === second)!.vm!;
    expect(assignedKey(s, vm2, "windoors")?.id).toBe(a.id);
  });

  it("refuses a VM build short of a key, naming the product", () => {
    const s = withServer(newGame(1)), cloud = hypervisor(s, ["dev3"]), vms = s.workloads.length;
    expect(createPanelVm(s, cloud, "directadmen")).toEqual({ ok: false, error: "error.licenceKeysShort", params: { name: "DirectAdmen" } });
    expect(t("error.licenceKeysShort", { name: "DirectAdmen" })).toContain("DirectAdmen");
    expect(s.workloads).toHaveLength(vms);
  });

  it("from 2016 costs nothing at install and 4 euros per core a month after", () => {
    const s = readyGame(7);
    skipTo(s, 2016);
    const id = atInstaller(s), k = issueKey(s, "windoors", null);
    const cash = s.cash;
    withStick(s, id, "windoors");
    ok(installOs(s, id, "windoors", undefined, undefined, k.key));
    expect(s.cash).toBe(cash);
    expect(s.licenses).toMatchObject([{ product: "windoors", kind: "core", machineId: id }]);
    s.hour = s.licenses[0].renewsAt! - 1;
    tick(s);
    expect(s.ledger.filter((l) => l.key === "ledger.licenceRenewal").map((l) => l.amount)).toEqual([-4 * installedCores(dev(s, id))]);
  });
});

describe("VMwhere", () => {
  it("installs on a 60 day trial at no charge in 2010", () => {
    const s = readyGame(7);
    skipTo(s, 2010);
    const id = atInstaller(s);
    ok(install(s, id, "lunix"));
    for (let h = 0; h < 2; h++) tick(s);
    const cash = s.cash;
    ok(installSoftware(s, id, "vmwhere"));
    expect([s.cash, once(s), licenceStatus(s, id, "vmwhere")]).toEqual([cash, [], "trial"]);
    for (let h = 0; h < 6; h++) tick(s);
    const c = clusterOf(s, id)!;
    expect(licenseCost(s, c)).toEqual({ panel: 0, platform: 0 });
  });

  it("refuses new VMs once the trial ends, until a key is entered", () => {
    const s = readyGame(7), id = atInstaller(s);
    ok(install(s, id, "lunix"));
    for (let h = 0; h < 2; h++) tick(s);
    ok(installSoftware(s, id, "vmwhere"));
    for (let h = 0; h < 6; h++) tick(s);
    const c = clusterOf(s, id)!, k = issueKey(s, "vmwhere", null);
    s.hour += 61 * 24;
    expect(err(createVm(s, c.id, PANEL_VM_SIZE))).toBe("error.licenceExpired");
    expect(err(activateLicence(s, id, "vmwhere", "AAAA-AAAA-AAAA-AAAA"))).toBe("error.licenceKey");
    ok(activateLicence(s, id, "vmwhere", k.key));
    expect(licenceStatus(s, id, "vmwhere")).toBe("active");
    ok(createVm(s, c.id, PANEL_VM_SIZE));
  });

  it("replaces the key it held with an entered one, and removing it releases the key", () => {
    const s = readyGame(7), id = atInstaller(s);
    ok(install(s, id, "lunix"));
    for (let h = 0; h < 2; h++) tick(s);
    const [a, b] = [issueKey(s, "vmwhere", null), issueKey(s, "vmwhere", null)];
    ok(installSoftware(s, id, "vmwhere", a.key));
    ok(activateLicence(s, id, "vmwhere", b.key));
    expect(unassignedKeys(s, "vmwhere").map((x) => x.id)).toEqual([a.id]);
    for (let h = 0; h < 6; h++) tick(s);
    ok(uninstallSoftware(s, id, "vmwhere"));
    expect(unassignedKeys(s, "vmwhere").map((x) => x.id)).toEqual([a.id, b.id]);
  });

  it("from 2024 costs nothing at install and 8 euros per physical core each month", () => {
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
    expect(licenseCost(s, c)).toEqual({ panel: 0, platform: 8 * installedCores(dev(s, id)) });
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
  it("refuses the DirectAdmen install line without a key and takes one with --key", () => {
    const s = readyGame(7), id = atInstaller(s);
    ok(install(s, id, "lunix"));
    for (let h = 0; h < 2; h++) tick(s);
    const line = softwareById("directadmen").install.commands[0], k = issueKey(s, "directadmen", null);
    expect(installScript(s, id, line)).toMatchObject({ output: [t("error.licenceKey")], failed: true });
    const r = installScript(s, id, `${line} --key ${k.key}`)!;
    expect(r.action).toEqual([installFromSite, id, "directadmen", k.key]);
    ok(installFromSite(s, id, "directadmen", k.key));
    expect(licenceStatus(s, id, "directadmen")).toBe("active");
  });
});
