import { describe, expect, it } from "vitest";
import { modelById } from "../src/sim/10-catalog/hardware";
import { device, type GameState } from "../src/sim/50-state";
import { apt, installScript } from "../src/sim/60-infra/apt";
import { clusterOf } from "../src/sim/60-infra/cluster";
import { machineScreen } from "../src/sim/60-infra/oob";
import { tickMinute } from "../src/sim/88-tick/tick";
import { bootFromUsb, dismissInstallFail, installFromSite, installOs, setMedia } from "../src/sim/90-actions/console";
import { createVm, PANEL_VM_SIZE } from "../src/sim/90-actions/clusters";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { bootedMachine, readyGame, skipTo, isoOf, withImage, withNetwork, withStick } from "./fixtures";

const err = (r: object) => (r as { error?: string }).error;
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
// A fresh storage server in rack2, uncabled.
const fresh = (s: GameState, id = "dev90"): string => {
  s.devices.push(device(id, "g1-storage", "Dwell", "rack2", 10, null, `st-${id}`, modelById("g1-storage").price));
  return id;
};
const atInstaller = (s: GameState, os: "lunix" | "windoors" = "lunix"): string => {
  const id = fresh(s);
  withStick(s, id, os);
  expect(bootFromUsb(s, id).ok).toBe(true);
  return id;
};
const text = (r: { output: string[] }) => r.output.join("\n");

describe("Debiant netinst", () => {
  it("is refused on an uncabled server and on one whose line is down, and installs once linked", () => {
    const s = readyGame(7), id = atInstaller(s);
    expect(err(installOs(s, id, "lunix"))).toBe("error.noInterfaces");
    withNetwork(s, id);
    const line = s.homeLine.id;
    s.homeLine.id = "";
    expect(err(installOs(s, id, "lunix"))).toBe("error.noAutoconf");
    s.homeLine.id = line;
    expect(installOs(s, id, "lunix").ok).toBe(true);
    expect(machineScreen(s, id).kind).toBe("osInstall");
  });

  it("reaches no mirror with a static address off the router's network, and stores the setting it installs with", () => {
    const s = readyGame(7), id = atInstaller(s), fixed = { mode: "static" as const, ip: "192.168.178.10", prefix: 24, gw: "192.168.178.1" };
    withNetwork(s, id);
    expect(err(installOs(s, id, "lunix", undefined, { ...fixed, gw: undefined }))).toBe("error.noMirror");
    expect(err(installOs(s, id, "lunix", undefined, { ...fixed, ip: "10.0.0.10", gw: "10.0.0.1" }))).toBe("error.noMirror");
    expect(installOs(s, id, "lunix", undefined, fixed).ok).toBe(true);
    expect(dev(s, id).iface).toEqual(fixed);
  });

  it("is abandoned when the cable comes out mid-install, and the failure shows until a key", () => {
    const s = readyGame(7), id = atInstaller(s);
    withNetwork(s, id);
    expect(installOs(s, id, "lunix").ok).toBe(true);
    tickMinute(s);
    expect(dev(s, id).os?.id).toBe("lunix");
    s.cables = s.cables.filter((c) => c.a.device !== id);
    tickMinute(s);
    expect(dev(s, id).os).toBeNull();
    expect(dev(s, id).bootUntil).toBeUndefined();
    expect(machineScreen(s, id)).toEqual({ kind: "osInstallFailed", reason: "noInterfaces" });
    const back = deserialize(serialize(s));
    expect(machineScreen(back, id)).toEqual({ kind: "osInstallFailed", reason: "noInterfaces" });
    expect(dismissInstallFail(s, id).ok).toBe(true);
    expect(machineScreen(s, id).kind).toBe("notFound");
  });

  it("follows the host's network in a VM", () => {
    const s = readyGame(7), made = createVm(s, clusterOf(s, "dev3")!.id, PANEL_VM_SIZE), vm = made.ok ? made.id! : "";
    withImage(s, "lunix");
    expect(setMedia(s, vm, isoOf(s, "lunix")).ok).toBe(true);
    const cables = s.cables;
    s.cables = cables.filter((c) => c.a.device !== "dev3");
    expect(err(installOs(s, vm, "lunix"))).toBe("error.noAutoconf");
    s.cables = cables;
    expect(installOs(s, vm, "lunix").ok).toBe(true);
    s.cables = cables.filter((c) => c.a.device !== "dev3");
    tickMinute(s);
    expect(machineScreen(s, vm)).toEqual({ kind: "osInstallFailed", reason: "noLink" });
  });
});

describe("Windoors offline", () => {
  it("installs without network", () => {
    const s = readyGame(7), id = atInstaller(s, "windoors");
    s.cash = 100000;
    expect(installOs(s, id, "windoors").ok).toBe(true);
    tickMinute(s);
    expect(dev(s, id).os?.id).toBe("windoors");
  });

  it("refuses a Server Manager install without network", () => {
    const s = readyGame(7), id = bootedMachine(s, fresh(s), "windoors");
    s.cash = 100000;
    skipTo(s, 2010);
    expect(err(installFromSite(s, id, "tcadmen"))).toBe("error.noDownload");
    withNetwork(s, id);
    expect(installFromSite(s, id, "tcadmen").ok).toBe(true);
  });
});

describe("apt and scripts offline", () => {
  it("fails to resolve the mirror and installs nothing", () => {
    const s = readyGame(7), id = bootedMachine(s, fresh(s));
    const r = apt(s, id, ["install", "-y", "bound9"], true);
    expect(text(r)).toContain("Could not resolve 'deb.debiant.org'");
    expect(text(r)).toContain("E: Unable to fetch some archives");
    expect(r.action).toBeUndefined();
    expect(text(apt(s, id, ["update"], true))).toContain("Err:1 http://deb.debiant.org");
    withNetwork(s, id);
    expect(apt(s, id, ["install", "-y", "bound9"], true).action).toBeDefined();
  });

  it("fails a script one-liner at curl", () => {
    const s = readyGame(7), id = bootedMachine(s, fresh(s));
    const r = installScript(s, id, "cd /home && curl -o latest -L https://securedownloads.cpanic.net/latest && sh latest")!;
    expect(r.output).toEqual(["curl: (6) Could not resolve host: securedownloads.cpanic.net"]);
    expect(r.action).toBeUndefined();
  });
});
