import { describe, expect, it } from "vitest";
import { modelById } from "../src/sim/10-catalog/hardware";
import { device, type GameState } from "../src/sim/50-state";
import { clusterOf, hostOfVm, vmById, workloadsOn } from "../src/sim/60-infra/cluster";
import { consoleScreen } from "../src/sim/60-infra/oob";
import { hardReboot, powerTick } from "../src/sim/60-infra/power";
import { BOOT_HOURS, booting, deviceHealth, working } from "../src/sim/60-infra/status";
import { tick } from "../src/sim/88-tick/tick";
import { bootFromUsb, enterSetup, eraseDisk, exitSetup, installCase, installFromIso, installFromUsb, setMedia } from "../src/sim/90-actions/console";
import { createVm, PANEL_VM_SIZE } from "../src/sim/90-actions/clusters";
import { stopWorkload } from "../src/sim/90-actions/vms";
import { softwareOn } from "../src/sim/90-actions/software";
import { setPower, setRaid } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";

// readyGame: dev3 is a G1 Dwell server in rack2, cabled and up.
const dev = (s: GameState, id: string) => s.devices.find((d) => d.id === id)!;
const err = (r: object) => (r as { error?: string }).error;
const ok = (r: { ok: boolean }) => { expect(err(r)).toBeUndefined(); expect(r.ok).toBe(true); };
const hour = (s: GameState, n = 1) => { for (let i = 0; i < n; i++) { s.hour += 1; powerTick(s); } };
const minutes = (s: GameState, n: number) => { s.minute += n; };
const storage = (s: GameState): string => {
  s.devices.push(device("dev90", "g1-storage", "Dwell", "rack2", 10, null, "fra1-st-01", modelById("g1-storage").price));
  return "dev90";
};

describe("BIOS setup", () => {
  it("opens during the boot hour, holds the boot and the workloads, and lets it run on when left", () => {
    const s = readyGame(7), d = dev(s, "dev3");
    expect(working(s, d.id)).toBe(true);
    expect(err(enterSetup(s, d.id))).toBe("error.notAtPost");
    hardReboot(s, d, "ipmi.log.reset");
    expect(booting(s, d)).toBe(true);
    ok(enterSetup(s, d.id));
    expect(d.setup).toBe(true);
    expect(deviceHealth(s, d.id).state).toBe("setup");
    expect(consoleScreen(d, "setup").key).toBe("term.console.setup");
    hour(s, 3);
    expect(booting(s, dev(s, "dev3"))).toBe(true);
    expect(working(s, "dev3")).toBe(false);
    ok(exitSetup(s, "dev3"));
    expect(dev(s, "dev3").setup).toBe(false);
    expect(dev(s, "dev3").bootUntil).toBe(s.hour + BOOT_HOURS);
    minutes(s, 2);
    expect(working(s, "dev3")).toBe(false);
    minutes(s, 2);
    expect(working(s, "dev3")).toBe(true);
    expect(err(exitSetup(s, "dev3"))).toBe("error.notInSetup");
  });

  it("opens from the firmware prompt a stuck boot waits at", () => {
    const s = readyGame(7), d = dev(s, "dev3");
    d.stuck = true;
    d.bootUntil = s.hour;
    expect(working(s, d.id)).toBe(false);
    ok(enterSetup(s, d.id));
    expect(d.stuck).toBe(false);
    expect(d.setup).toBe(true);
  });

  it("ends with a reset or a pulled plug", () => {
    const s = readyGame(7), d = dev(s, "dev3");
    hardReboot(s, d, "ipmi.log.reset");
    ok(enterSetup(s, d.id));
    hardReboot(s, d, "ipmi.log.reset");
    expect(d.setup).toBe(false);
    ok(enterSetup(s, d.id));
    ok(setPower(s, d.id, false));
    expect(d.setup).toBe(false);
    expect(err(enterSetup(s, d.id))).toBe("error.serverOff");
  });

  it("is where the RAID level changes on a running server", () => {
    const s = readyGame(7), id = storage(s), d = dev(s, id);
    expect(err(setRaid(s, id, "5"))).toBe("error.raidInSetup");
    hardReboot(s, d, "ipmi.log.reset");
    ok(enterSetup(s, id));
    ok(setRaid(s, id, "5"));
    expect(d.raid).toBe("5");
    d.on = false;
    d.setup = false;
    ok(setRaid(s, id, "1"));
  });

  it("survives a save and defaults in an old one", () => {
    const s = readyGame(7), d = dev(s, "dev3");
    hardReboot(s, d, "ipmi.log.reset");
    ok(enterSetup(s, d.id));
    expect(dev(deserialize(serialize(s)), "dev3").setup).toBe(true);
    const old = JSON.parse(serialize(s)) as { devices: Record<string, unknown>[] };
    for (const x of old.devices) delete x.setup;
    expect(dev(deserialize(JSON.stringify(old)), "dev3").setup).toBe(false);
  });
});

describe("USB installer", () => {
  const host = (d: { hostname?: string; label: string | null; name: string }) => d.hostname ?? d.label ?? d.name;
  const installed = (s: GameState, id: string) => { ok(bootFromUsb(s, id)); ok(installFromUsb(s, id, "vmwhere")); for (let h = 0; h < 6; h++) tick(s); };

  it("installs from the stick and reboots the server off it when done", () => {
    const s = readyGame(7), id = storage(s), d = dev(s, id);
    expect(err(installFromUsb(s, id, "vmwhere"))).toBe("error.notFromUsb");
    ok(bootFromUsb(s, id));
    expect(consoleScreen(d, "ok").key).toBe("term.console.installer");
    expect(installCase(s, id).kind).toBe("empty");
    ok(installFromUsb(s, id, "vmwhere"));
    expect(softwareOn(s, id)[0]).toMatchObject({ id: "vmwhere" });
    expect(softwareOn(s, id)[0].doneAt).not.toBeNull();
    for (let h = 0; h < 6; h++) tick(s);
    expect(softwareOn(s, id)[0].doneAt).toBeNull();
    expect(dev(s, id).bootFrom).toBe("disk");
    expect(dev(s, id).bootUntil).toBe(5 + BOOT_HOURS);
  });

  it("boots for the full three minutes after a reset late in the hour", () => {
    const s = readyGame(7), d = dev(s, "dev3");
    minutes(s, 40);
    hardReboot(s, d, "ipmi.log.reset");
    expect(booting(s, d)).toBe(true);
    minutes(s, 2);
    expect(booting(s, d)).toBe(true);
    minutes(s, 2);
    expect(booting(s, d)).toBe(false);
  });

  it("aborts a first install on a reset or a pulled plug, leaving the disks empty", () => {
    const s = readyGame(7), id = storage(s), d = dev(s, id);
    ok(bootFromUsb(s, id));
    ok(installFromUsb(s, id, "vmwhere"));
    hardReboot(s, d, "ipmi.log.reset");
    expect(clusterOf(s, id)).toBeUndefined();
    expect(d.bootFrom).toBe("disk");
    expect(d.log.at(-2)?.key).toBe("ipmi.log.installAborted");
    expect(err(installFromUsb(s, id, "vmwhere"))).toBe("error.notFromUsb");
  });

  it("replaces software nobody uses, and puts it back when the new one is refused", () => {
    const s = readyGame(7), id = storage(s);
    installed(s, id);
    expect(installCase(s, id).kind).toBe("idle");
    ok(bootFromUsb(s, id));
    expect(err(installFromUsb(s, id, "nope"))).toBe("error.unknownSoftware");
    expect(softwareOn(s, id)[0]).toMatchObject({ id: "vmwhere", doneAt: null });
    ok(installFromUsb(s, id, "freepanel"));
    expect(softwareOn(s, id)[0]).toMatchObject({ id: "freepanel" });
    expect(s.clusters.filter((c) => c.nodes.some((n) => n.deviceId === id))).toHaveLength(1);
  });

  it("needs the hostname typed to erase software with customers on it, and loses their data", () => {
    const s = readyGame(7), d = dev(s, "dev3"), before = s.workloads.length;
    expect(installCase(s, "dev3").kind).toBe("busy");
    ok(bootFromUsb(s, "dev3"));
    expect(working(s, "dev3")).toBe(true);
    expect(err(installFromUsb(s, "dev3", "vmwhere"))).toBe("error.confirmHostname");
    expect(err(installFromUsb(s, "dev3", "vmwhere", "wrong"))).toBe("error.confirmHostname");
    expect(s.workloads).toHaveLength(before);
    ok(installFromUsb(s, "dev3", "vmwhere", host(d)));
    expect(workloadsOn(s, "dev3")).toHaveLength(0);
    expect(s.lossReports).toHaveLength(1);
    expect(s.lossReports[0].items.length).toBeGreaterThan(0);
    expect(s.services.filter((v) => v.endedAt === null)).toHaveLength(0);
    expect(s.tickets.some((t) => t.kind === "refund")).toBe(true);
    expect(s.clusters).toHaveLength(1);
    expect(softwareOn(s, "dev3")[0]).toMatchObject({ id: "vmwhere" });
    expect(softwareOn(s, "dev3")[0].doneAt).not.toBeNull();
  });

  it("erases to bare metal under the same confirmation", () => {
    const s = readyGame(7), d = dev(s, "dev3");
    ok(bootFromUsb(s, "dev3"));
    expect(err(eraseDisk(s, "dev3"))).toBe("error.confirmHostname");
    ok(eraseDisk(s, "dev3", host(d)));
    expect(clusterOf(s, "dev3")).toBeUndefined();
    expect(s.workloads).toHaveLength(0);
    expect(err(eraseDisk(s, "dev3"))).toBe("error.noSoftware");
    expect(d.bootFrom).toBe("usb");
    expect(dev(deserialize(serialize(s)), "dev3").bootFrom).toBe("usb");
    const old = JSON.parse(serialize(s)) as { devices: Record<string, unknown>[] };
    for (const x of old.devices) delete x.bootFrom;
    expect(dev(deserialize(JSON.stringify(old)), "dev3").bootFrom).toBe("disk");
  });
});

describe("VM console", () => {
  const basement = (s: GameState) => clusterOf(s, "dev3")!;
  const panelVm = (s: GameState) => s.clusters.find((c) => c.vm)!.vm!;

  it("boots the installer from the ISO and ejects it once the install is done", () => {
    const s = readyGame(7), made = createVm(s, basement(s).id, PANEL_VM_SIZE), vm = made.ok ? made.id! : "";
    ok(made);
    expect(err(installFromIso(s, vm, "cpanic"))).toBe("error.noMedia");
    ok(setMedia(s, vm, "lunix"));
    expect(vmById(s, vm)?.media).toBe("lunix");
    expect(installCase(s, vm).kind).toBe("empty");
    ok(installFromIso(s, vm, "cpanic"));
    expect(hostOfVm(s, vm)?.switching?.to).toBe("cpanic");
    expect(vmById(deserialize(serialize(s)), vm)?.media).toBe("lunix");
    for (let h = 0; h < 4; h++) tick(s);
    expect(hostOfVm(s, vm)?.panel).toBe("cpanic");
    expect(vmById(s, vm)?.media).toBeUndefined();
    ok(stopWorkload(s, vm));
    ok(setMedia(s, vm, "lunix"));
    expect(err(installFromIso(s, vm, "cpanic"))).toBe("error.alreadyStopped");
  });

  it("needs the VM's hostname to erase a panel with customers on it, booked on the host", () => {
    const s = readyGame(7), vm = panelVm(s), w = vmById(s, vm)!, before = s.workloads.length;
    ok(setMedia(s, vm, "lunix"));
    expect(installCase(s, vm).kind).toBe("busy");
    expect(err(installFromIso(s, vm, "cpanic"))).toBe("error.confirmHostname");
    expect(s.workloads).toHaveLength(before);
    expect(err(installFromIso(s, vm, "nope", w.hostname))).toBe("error.unknownSoftware");
    expect(s.workloads).toHaveLength(before);
    expect(hostOfVm(s, vm)?.panel).toBe("freepanel");
    ok(installFromIso(s, vm, "cpanic", w.hostname));
    expect(s.workloads.filter((x) => x.clusterId === hostOfVm(s, vm)?.id)).toHaveLength(0);
    expect(s.lossReports[0]).toMatchObject({ deviceId: "dev3" });
    expect(s.services.filter((v) => v.endedAt === null)).toHaveLength(0);
    expect(hostOfVm(s, vm)?.switching?.to).toBe("cpanic");
    expect(vmById(s, vm)).toBeDefined();
  });

  it("erases a VM to an empty disk", () => {
    const s = readyGame(7), vm = panelVm(s), w = vmById(s, vm)!;
    ok(setMedia(s, vm, "lunix"));
    expect(err(eraseDisk(s, vm))).toBe("error.confirmHostname");
    ok(eraseDisk(s, vm, w.hostname));
    expect(hostOfVm(s, vm)).toBeUndefined();
    expect(err(eraseDisk(s, vm))).toBe("error.noSoftware");
    ok(setMedia(s, vm, null));
    expect(vmById(s, vm)?.media).toBeUndefined();
  });
});
