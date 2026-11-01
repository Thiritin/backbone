import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hourOf, yearOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { serverOsAt } from "../src/sim/10-catalog/server-os";
import { type GameState } from "../src/sim/50-state";
import { apt } from "../src/sim/60-infra/apt";
import { clusterOf, vmById } from "../src/sim/60-infra/cluster";
import { consoleScreen, machineScreen } from "../src/sim/60-infra/oob";
import { pullPlug } from "../src/sim/60-infra/power";
import { createVm, PANEL_VM_SIZE, provisionService } from "../src/sim/90-actions/clusters";
import { installOs, setMedia, upgradeHours, upgradeOs } from "../src/sim/90-actions/console";
import { addCustomer } from "../src/sim/90-actions/customers";
import { connect, type ActionResult } from "../src/sim/90-actions/hardware";
import { downloadImage } from "../src/sim/90-actions/media";
import { migrateWorkload, stopWorkload } from "../src/sim/90-actions/vms";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { bootedMachine, buyDevice, hypervisor, panelServer, readyGame, withServer, newGame } from "./fixtures";
import { mountDevice } from "./plugged";
import { Screen } from "../src/ui/apps/console/Screen";
import { VmConsole } from "../src/ui/apps/console/VmConsole";

const ok = (r: ActionResult) => { if (!r.ok) throw new Error(r.error); return r.id!; };
const err = (r: ActionResult) => (r.ok ? "ok" : r.error);
const year = (y: number) => hourOf(new Date(Date.UTC(y, 0, 1)));
const dev = (s: GameState, id = "dev3") => s.devices.find((d) => d.id === id)!;
const start = () => ({ ...withServer(newGame(1)), cash: 100_000 });
function second(s: GameState): string {
  const id = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, id, "rack2", 2));
  ok(connect(s, { device: id, port: 0 }, { device: "dev4", port: 1 }));
  return id;
}

describe("versioned OS images", () => {
  it("downloads each release on its own", () => {
    const s = readyGame(7);
    s.hour = year(2008);
    expect(err(downloadImage(s, "lunix@99"))).toBe("error.unknownOs");
    ok(downloadImage(s, "lunix@3.1"));
    expect(s.media.images).toEqual(["lunix@3.1"]);
    ok(downloadImage(s, "lunix@4"));
    ok(downloadImage(s, "lunix@4"));
    expect(s.media.images).toEqual(["lunix@3.1", "lunix@4"]);
  });

  it("installs the release on the media, not the newest of the year", () => {
    const s = readyGame(7), vm = ok(createVm(s, clusterOf(s, "dev3")!.id, PANEL_VM_SIZE));
    s.hour = year(2008);
    ok(downloadImage(s, "lunix@3.1"));
    ok(setMedia(s, vm, "lunix@3.1"));
    ok(installOs(s, vm, "lunix"));
    expect(vmById(s, vm)!.os?.version).toBe("3.1");
  });

  it("reads an old save's bare images as the newest release of its year", () => {
    const s = readyGame(7), vm = ok(createVm(s, clusterOf(s, "dev3")!.id, PANEL_VM_SIZE));
    const data = JSON.parse(serialize(s));
    data.media = { images: ["lunix", "windoors"], stick: { os: "windoors", in: null } };
    data.workloads.find((w: { id: string }) => w.id === vm).media = "lunix";
    const back = deserialize(JSON.stringify(data)), y = yearOf(back.hour);
    const lunix = `lunix@${serverOsAt("lunix", y).version}`, windoors = `windoors@${serverOsAt("windoors", y).version}`;
    expect(back.media).toEqual({ images: [lunix, windoors], stick: { os: windoors, in: null } });
    expect(vmById(back, vm)!.media).toBe(lunix);
  });
});

describe("in-place OS upgrade", () => {
  it("upgrades Debiant one release from the shell and takes the hosted sites down for it", () => {
    const s = start(), panel = panelServer(s, "dev3"), cus = addCustomer(s, "Ada Lang", "hobbyDev");
    ok(provisionService(s, cus, "webHosting", { label: "ada.de", spec: sizeSpec("webHosting", 0, yearOf(s.hour)), clusterId: panel }));
    expect(err(upgradeOs(s, "dev3"))).toBe("error.noUpgrade");
    s.hour = year(2010);
    const software = dev(s).software.length, hours = upgradeHours(s, "dev3");
    const asked = apt(s, "dev3", ["full-upgrade"], true);
    expect(asked.confirm).toBe(true);
    expect(asked.output.join("\n")).toContain("Debiant GNU/Lunix 4 (etch)");
    const run = apt(s, "dev3", ["full-upgrade", "-y"], true);
    expect(run.action?.[0]).toBe(upgradeOs);
    ok(upgradeOs(s, "dev3"));
    expect(dev(s).os).toMatchObject({ version: "4", from: "3.1" });
    expect(dev(s).software.length).toBe(software);
    expect(machineScreen(s, "dev3").kind).toBe("osInstall");
    expect(consoleScreen(s, dev(s)).key).toBe("term.console.osUpgrade");
    expect(renderToString(createElement(Screen, { game: s, device: dev(s), via: "bmc" }))).toContain("Upgrade to Debiant GNU/Lunix 4");
    const w = s.workloads.find((x) => x.serviceId)!;
    expect(w.busyUntil).toBe(s.hour + hours);
    expect(s.downHours[w.serviceId]).toBeCloseTo(hours - (Math.ceil(hours) - 1), 9);
  });

  it("leaves a virtual machine migrated off the node up", () => {
    const s = start(), other = second(s), id = hypervisor(s, ["dev3", other], "Web 1");
    const vps = () => s.workloads.filter((x) => x.serviceId);
    for (const name of ["Ada Lang", "Bo Berg"]) ok(provisionService(s, addCustomer(s, name, "hobbyDev"), "vps", { label: name, spec: sizeSpec("vps", 0, 2005), clusterId: id }));
    for (const w of vps()) if (w.deviceId !== "dev3") ok(migrateWorkload(s, w.id, "dev3"));
    s.hour = year(2008);
    const [moved, stays] = vps();
    ok(migrateWorkload(s, moved.id, other));
    s.hour += 24;
    const busy = s.workloads.find((x) => x.id === moved.id)!.busyUntil;
    ok(upgradeOs(s, "dev3"));
    expect(s.workloads.find((x) => x.id === moved.id)!.busyUntil).toBe(busy);
    expect(s.downHours[moved.serviceId] ?? 0).toBe(0);
    expect(s.workloads.find((x) => x.id === stays.id)!.busyUntil).toBe(s.hour + upgradeHours(s, "dev3"));
  });

  it("rolls back to the old release when the power goes mid-upgrade", () => {
    const s = start();
    panelServer(s, "dev3");
    s.hour = year(2008);
    ok(upgradeOs(s, "dev3"));
    pullPlug(s, dev(s));
    expect(dev(s).os).toMatchObject({ id: "lunix", version: "3.1" });
    expect(dev(s).software.length).toBe(1);
    expect(dev(s).log.at(-1)?.key).toBe("ipmi.log.upgradeAborted");
  });

  it("upgrades Windoors from the next release's media and rolls a stopped VM back", () => {
    const s = readyGame(7), vm = ok(createVm(s, clusterOf(s, "dev3")!.id, PANEL_VM_SIZE));
    bootedMachine(s, vm, "windoors");
    vmById(s, vm)!.os!.version = "2008";
    s.hour = year(2011);
    ok(downloadImage(s, "windoors@2008"));
    ok(downloadImage(s, "windoors@2008 R2"));
    expect(err(upgradeOs(s, vm))).toBe("error.noMedia");
    ok(setMedia(s, vm, "windoors@2008"));
    expect(err(upgradeOs(s, vm))).toBe("error.otherMedia");
    ok(setMedia(s, vm, "windoors@2008 R2"));
    const busy = vmById(s, vm)!.busyUntil;
    s.cash = 599;
    expect(err(upgradeOs(s, vm))).toBe("error.noCash");
    s.cash = 1000;
    ok(upgradeOs(s, vm));
    expect(s.cash).toBe(400);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.licenseOnce", amount: -600, params: { name: "Windoors Server 2008 R2" } });
    expect(vmById(s, vm)).toMatchObject({ os: { version: "2008 R2", from: "2008" }, media: undefined, busyUntil: busy });
    expect(machineScreen(s, vm).kind).toBe("osInstall");
    expect(renderToString(createElement(VmConsole, { game: s, vm: vmById(s, vm)!, front: false }))).toContain("Upgrading Windoors Server 2008 R2");
    ok(stopWorkload(s, vm));
    expect(vmById(s, vm)!.os).toMatchObject({ version: "2008" });
  });
});
