import { describe, expect, it } from "vitest";
import { nowHours } from "../src/sim/00-core/time";
import { softwareById } from "../src/sim/10-catalog/platforms";
import type { GameState } from "../src/sim/50-state";
import { clusterOf } from "../src/sim/60-infra/cluster";
import { machineScreen } from "../src/sim/60-infra/oob";
import { hardReboot } from "../src/sim/60-infra/power";
import { BOOT_HOURS, HALT_MINUTES } from "../src/sim/60-infra/status";
import { tick } from "../src/sim/88-tick/tick";
import { bootFromUsb, enterSetup, installOs } from "../src/sim/90-actions/console";
import { reboot } from "../src/sim/90-actions/hardware";
import { installSoftware, uninstallSoftware } from "../src/sim/90-actions/software";
import { newGame } from "../src/sim/50-state";
import { readyGame, skipTo, withServer, withStick } from "./fixtures";

// withServer: dev3 is a free, cabled server with an empty disk.
const err = (r: { ok: boolean; error?: string }) => r.error;
const ok = (r: { ok: boolean; error?: string }) => expect(r.error).toBeUndefined();
const minutes = (s: GameState, n: number) => { s.minute += n; };
const dev = (s: GameState) => s.devices.find((d) => d.id === "dev3")!;
const installed = (os: "lunix" | "windoors" = "lunix") => {
  const s = withServer(newGame(4));
  withStick(s, "dev3", os);
  ok(bootFromUsb(s, "dev3"));
  ok(installOs(s, "dev3", os));
  for (let h = 0; h < 3; h++) tick(s);
  return s;
};

describe("install pipeline", () => {
  it("boots an empty disk through POST to Operating system not found", () => {
    const s = withServer(newGame(4));
    expect(machineScreen(s, "dev3").kind).toBe("notFound");
    hardReboot(s, dev(s), "ipmi.log.reset");
    expect(machineScreen(s, "dev3").kind).toBe("post");
    minutes(s, 4);
    expect(machineScreen(s, "dev3").kind).toBe("notFound");
  });

  it("installs the OS from the stick over its install hours, then boots it to the login", () => {
    const s = withServer(newGame(4));
    withStick(s, "dev3");
    ok(bootFromUsb(s, "dev3"));
    expect(machineScreen(s, "dev3")).toEqual({ kind: "bootMenu", media: ["lunix"] });
    ok(installOs(s, "dev3", "lunix"));
    expect(machineScreen(s, "dev3")).toEqual({ kind: "osInstall", os: "lunix", progress: 0 });
    expect(err(enterSetup(s, "dev3"))).toBe("error.notAtPost");
    minutes(s, 30);
    expect(machineScreen(s, "dev3")).toMatchObject({ kind: "osInstall", progress: 0.5 });
    minutes(s, 31);
    expect(machineScreen(s, "dev3").kind).toBe("post");
    minutes(s, 5);
    expect(machineScreen(s, "dev3")).toEqual({ kind: "booting", os: "lunix" });
    minutes(s, 20);
    expect(machineScreen(s, "dev3")).toEqual({ kind: "login", os: "lunix" });
    expect(machineScreen(s, "dev3", true)).toEqual({ kind: "login", os: "lunix" });
  });

  it("boots Windoors to its logon, and the desktop once logged in", () => {
    const s = installed("windoors");
    expect(machineScreen(s, "dev3")).toEqual({ kind: "login", os: "windoors" });
    expect(machineScreen(s, "dev3", true)).toEqual({ kind: "desktop" });
  });

  it("leaves the disk empty after a reset mid-install", () => {
    const s = withServer(newGame(4));
    withStick(s, "dev3", "windoors");
    ok(bootFromUsb(s, "dev3"));
    ok(installOs(s, "dev3", "windoors"));
    minutes(s, 50);
    hardReboot(s, dev(s), "ipmi.log.reset");
    expect(dev(s).os).toBeNull();
    minutes(s, 4);
    expect(machineScreen(s, "dev3").kind).toBe("notFound");
  });

  it("adds the OS's boot minutes to every boot of an installed machine", () => {
    const lunix = installed(), win = installed("windoors");
    ok(reboot(lunix, "dev3"));
    ok(reboot(win, "dev3"));
    expect(dev(lunix).bootUntil).toBeCloseTo(nowHours(lunix) + (HALT_MINUTES + 5) / 60 + BOOT_HOURS + 20 / 60);
    expect(dev(win).bootUntil).toBeCloseTo(nowHours(win) + (HALT_MINUTES + 10) / 60 + BOOT_HOURS + 40 / 60);
  });

  it("refuses software until the OS is up, and software the OS does not run", () => {
    const s = withServer(newGame(4));
    skipTo(s, 2010);
    expect(err(installSoftware(s, "dev3", "proxmocks"))).toBe("error.noOs");
    withStick(s, "dev3");
    ok(bootFromUsb(s, "dev3"));
    ok(installOs(s, "dev3", "lunix"));
    expect(err(installSoftware(s, "dev3", "proxmocks"))).toBe("error.osNotUp");
    for (let h = 0; h < 3; h++) tick(s);
    expect(err(installSoftware(s, "dev3", "hypervee"))).toBe("error.wrongOs");
    expect(err(installSoftware(s, "dev3", "proxmocks"))).toBeUndefined();
  });

  it("creates the hypervisor cluster from doneAt, the console showing the install until then", () => {
    const s = installed(), hours = softwareById("proxmocks").installHours;
    skipTo(s, 2010);
    ok(installSoftware(s, "dev3", "proxmocks"));
    expect(clusterOf(s, "dev3")).toMatchObject({ platform: null, switching: { to: "proxmocks", doneAt: s.hour + hours } });
    expect(machineScreen(s, "dev3")).toMatchObject({ kind: "installing", software: "proxmocks", progress: 0 });
    for (let h = 0; h < hours; h++) tick(s);
    expect(clusterOf(s, "dev3")).toMatchObject({ platform: "proxmocks", switching: null });
    expect(machineScreen(s, "dev3")).toEqual({ kind: "login", os: "lunix" });
  });

  it("names the one cluster per server before the OS, and refuses an uninstall with workloads on it", () => {
    const s = readyGame(4);
    expect(err(installSoftware(s, "dev3", "freepanel"))).toBe("error.serverInUse");
    expect(err(uninstallSoftware(s, "dev3"))).toBe("error.softwareInUse");
  });
});
