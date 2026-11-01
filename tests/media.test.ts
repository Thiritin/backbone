import { describe, expect, it } from "vitest";
import { DATACENTERS } from "../src/sim/20-world/datacenters";
import { consoleScreen, machineScreen } from "../src/sim/60-infra/oob";
import { powerTick } from "../src/sim/60-infra/power";
import { bootFromUsb, installOs, setMedia } from "../src/sim/90-actions/console";
import { createVm, PANEL_VM_SIZE } from "../src/sim/90-actions/clusters";
import { downloadImage, downloadMbps, mountableImages, plugStick, stickHome, unplugStick, writeStick } from "../src/sim/90-actions/media";
import { clusterOf } from "../src/sim/60-infra/cluster";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { bootedMachine, isoOf, readyGame, newGame } from "./fixtures";

// readyGame: dev3 is a server in the basement rack, cabled and up, with a hypervisor cluster on it.
const dev = (s: ReturnType<typeof readyGame>, id = "dev3") => s.devices.find((d) => d.id === id)!;
const err = (r: { ok: boolean; error?: string }) => (r.ok ? "ok" : r.error);

describe("installation media", () => {
  it("starts with no images and an empty stick that is out", () => {
    expect(newGame(1).media).toEqual({ images: [], stick: { os: null, in: null } });
  });

  it("downloads an image once", () => {
    const s = readyGame(7);
    expect(err(downloadImage(s, "lunix@99"))).toBe("error.unknownOs");
    expect(err(downloadImage(s, isoOf(s, "lunix")))).toBe("ok");
    expect(err(downloadImage(s, isoOf(s, "lunix")))).toBe("ok");
    expect(s.media.images).toEqual([isoOf(s)]);
  });

  it("writes the stick only from a downloaded image, one OS at a time", () => {
    const s = readyGame(7);
    expect(err(writeStick(s, isoOf(s, "lunix")))).toBe("error.noImage");
    downloadImage(s, isoOf(s, "lunix"));
    downloadImage(s, isoOf(s, "windoors"));
    expect(err(writeStick(s, isoOf(s, "lunix")))).toBe("ok");
    expect(err(writeStick(s, isoOf(s, "windoors")))).toBe("ok");
    expect(s.media.stick.os).toBe(isoOf(s, "windoors"));
  });

  it("downloads at the speed of the line where the player is", () => {
    const s = newGame(1);
    expect(downloadMbps(s)).toBe(6);
    s.homeLine.id = "dsl-16";
    expect(downloadMbps(s)).toBe(16);
    s.player = { ...s.player, doing: "travel", until: s.hour + 5 };
    expect(downloadMbps(s)).toBe(0);
  });

  it("writes the stick only while it is in the computer", () => {
    const s = readyGame(7);
    downloadImage(s, isoOf(s, "lunix"));
    plugStick(s, "dev3");
    expect(stickHome(s)).toBe(false);
    expect(err(writeStick(s, isoOf(s, "lunix")))).toBe("error.stickAway");
    unplugStick(s);
    expect(err(writeStick(s, isoOf(s, "lunix")))).toBe("ok");
    dev(s).hands = { kind: "stick", doneAt: s.hour + 1 };
    expect(err(writeStick(s, isoOf(s, "lunix")))).toBe("error.stickAway");
  });

  it("plugs the stick in, moves it to a second server and unplugs it", () => {
    const s = readyGame(7), other = s.devices.find((d) => d.id !== "dev3" && d.rackId && d.model === dev(s).model);
    expect(err(unplugStick(s))).toBe("error.stickOut");
    expect(err(plugStick(s, "dev3"))).toBe("ok");
    expect(s.media.stick.in).toBe("dev3");
    expect(err(plugStick(s, "dev3"))).toBe("error.stickIn");
    if (other) {
      expect(err(plugStick(s, other.id))).toBe("ok");
      expect(s.media.stick.in).toBe(other.id);
    }
    expect(err(unplugStick(s))).toBe("ok");
    expect(s.media.stick.in).toBeNull();
  });

  it("boots from USB only with a written stick in the server", () => {
    const s = readyGame(7), d = dev(s);
    expect(err(bootFromUsb(s, "dev3"))).toBe("error.noBootDevice");
    plugStick(s, "dev3");
    expect(err(bootFromUsb(s, "dev3"))).toBe("error.noBootDevice");
    unplugStick(s);
    downloadImage(s, isoOf(s, "lunix"));
    writeStick(s, isoOf(s, "lunix"));
    plugStick(s, "dev3");
    expect(err(bootFromUsb(s, "dev3"))).toBe("ok");
    expect(machineScreen(s, "dev3")).toEqual({ kind: "bootMenu", media: [isoOf(s)] });
    expect(err(installOs(s, "dev3", "windoors"))).toBe("error.otherMedia");
    unplugStick(s);
    expect(machineScreen(s, "dev3").kind).toBe("notFound");
    expect(err(installOs(s, "dev3", "lunix"))).toBe("error.noBootDevice");
    plugStick(s, "dev3");
    expect(d.bootFrom).toBe("usb");
  });

  it("sends remote hands with the stick to a datacenter the player is away from", () => {
    const s = readyGame(7), dc = DATACENTERS[0];
    s.locations[0].dc = dc.id;
    s.player = { ...s.player, doing: "travel", until: s.hour + 100 };
    expect(err(unplugStick(s))).toBe("error.stickOut");
    const cash = s.cash;
    expect(err(plugStick(s, "dev3", "hands"))).toBe("ok");
    expect(s.cash).toBeCloseTo(cash - dc.remoteHands.perHour, 6);
    expect(dev(s).hands?.kind).toBe("stick");
    expect(s.media.stick.in).toBeNull();
    s.hour = Math.ceil(dev(s).hands!.doneAt);
    powerTick(s);
    expect(s.media.stick.in).toBe("dev3");
    expect(err(unplugStick(s))).toBe("error.notThere");
  });

  it("mounts only downloaded images in a VM", () => {
    const s = readyGame(7), made = createVm(s, clusterOf(s, "dev3")!.id, PANEL_VM_SIZE), vm = made.ok ? made.id! : "";
    expect(mountableImages(s)).toEqual([]);
    expect(err(setMedia(s, vm, isoOf(s)))).toBe("error.noImage");
    downloadImage(s, isoOf(s, "lunix"));
    expect(mountableImages(s)).toEqual([isoOf(s)]);
    expect(err(setMedia(s, vm, isoOf(s)))).toBe("ok");
    expect(err(setMedia(s, vm, null))).toBe("ok");
  });

  it("loads an old save with the defaults and leaves installed machines alone", () => {
    const s = readyGame(7);
    bootedMachine(s, "dev3");
    const data = JSON.parse(serialize(s));
    delete data.media;
    const back = deserialize(JSON.stringify(data));
    expect(back.media).toEqual({ images: [], stick: { os: null, in: null } });
    expect(dev(back).os?.id).toBe("lunix");
  });

  it("shows the Windoors logon line on the KVM page", () => {
    const s = readyGame(7);
    bootedMachine(s, "dev3", "windoors");
    expect(machineScreen(s, "dev3").kind).toBe("login");
    expect(consoleScreen(s, dev(s)).key).toBe("term.console.logon");
  });
});
