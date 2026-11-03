// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "../src/i18n/en";
import { useStore } from "../src/ui/store";
import { roomOf, World } from "../src/ui/world/World";
import { tick } from "../src/sim/88-tick/tick";
import { addLocation, buyDevice, buyRack } from "../src/sim/90-actions/hardware";
import { atDesk, inLetterbox, post } from "../src/sim/40-support/letters";
import { OFFICE_NAME } from "../src/sim/80-business/paperwork";
import { readyGame } from "./fixtures";
import { devName } from "../src/ui/apps/hw";
import { connectError, portPeers } from "../src/sim/60-infra/status";
import type { End } from "../src/sim/50-state";
import { dateOf, hourOf } from "../src/sim/00-core/time";
import { NIGHT } from "../src/ui/world/draw";
import { modelById } from "../src/sim/10-catalog/hardware";
import { panelOf } from "../src/sim/60-infra/panels";
import { buyDevice as buyDev, freeFloor, newGame } from "./fixtures";
import { mountDevice } from "./plugged";

afterEach(cleanup);

describe("world", () => {
  it("opens a new game in the room, Escape stays there and the room clock pauses", () => {
    useStore.getState().startGame();
    expect(useStore.getState().surface).toBe("world");
    render(createElement(World));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useStore.getState().surface).toBe("world");
    fireEvent.click(screen.getByRole("button", { name: t("desktop.menu.speedN", { n: 1 }) }));
    expect(useStore.getState().speed).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: t("desktop.menu.pause") }));
    expect(useStore.getState().speed).toBe(0);
    useStore.setState({ windows: [] });
  });

  it("draws every rack of the room and the PC returns to the desktop", () => {
    const s = readyGame(7);
    useStore.setState({ game: s, speed: 0, surface: "world" });
    const { container } = render(createElement(World));
    const here = s.racks.filter((r) => r.locationId === roomOf(s).id);
    expect(here.length).toBeGreaterThan(0);
    expect(container.querySelectorAll("[data-rack]").length).toBe(here.length);
    fireEvent.click(screen.getByRole("button", { name: t("world.obj.pc") }));
    expect(useStore.getState().surface).toBe("desktop");
  });

  it("opens a rack in the room, shows the picked device and closes on Escape", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout", "performance"] });
    try {
      const s = readyGame(7);
      useStore.setState({ game: s, speed: 0, surface: "world" });
      const { container } = render(createElement(World));
      const rack = s.racks.find((r) => r.locationId === roomOf(s).id)!;
      const dev = s.devices.find((d) => d.rackId === rack.id && !d.chassisId)!;
      fireEvent.click(container.querySelector(`[data-rack="${rack.id}"]`)!);
      act(() => { vi.advanceTimersByTime(20_000); });
      const panel = screen.getByRole("dialog", { name: rack.name });
      fireEvent.click(panel.querySelector(`.rack-dev[aria-label="${dev.name}"]`)!);
      expect(panel.querySelector(`[data-device="${dev.id}"]`)!.textContent).toContain(devName(dev));
      fireEvent.keyDown(window, { key: "Escape" });
      act(() => { vi.advanceTimersByTime(1000); });
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(useStore.getState().surface).toBe("world");
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("pulls a server out with the lid off, tags a slot and pushes it back into the rack", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout", "performance"] });
    try {
      const s = readyGame(7);
      useStore.setState({ game: s, speed: 0, surface: "world" });
      const { container } = render(createElement(World));
      const rack = s.racks.find((r) => r.locationId === roomOf(s).id)!;
      const dev = s.devices.find((d) => d.rackId === rack.id && !d.chassisId && modelById(d.model).kind === "server")!;
      fireEvent.click(container.querySelector(`[data-rack="${rack.id}"]`)!);
      act(() => { vi.advanceTimersByTime(20_000); });
      const panel = screen.getByRole("dialog", { name: rack.name });
      fireEvent.click(panel.querySelector(`.rack-dev[aria-label="${dev.name}"]`)!);
      fireEvent.click(screen.getByRole("button", { name: t("locations-1.changeParts") }));
      act(() => { vi.advanceTimersByTime(1000); });
      const lid = panel.querySelector(`[data-lid="${dev.id}"]`)!;
      expect(lid.querySelector(".lid-view")).not.toBeNull();
      expect(lid.querySelector("[data-spec]")).not.toBeNull();
      fireEvent.click(lid.querySelector(".lid-slot")!);
      expect(lid.querySelector("[data-slot]")).not.toBeNull();
      fireEvent.click(lid.querySelector("[data-spec] button")!);
      act(() => { vi.advanceTimersByTime(2000); });
      expect(panel.querySelector("[data-lid]")).toBeNull();
      expect(screen.getByRole("dialog", { name: rack.name })).toBe(panel);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("takes a parcel from the door into the hand and puts it on the shelf", () => {
    const s = readyGame(7), here = roomOf(s);
    s.cash = 1_000_000;
    buyDevice(s, "g1-compute", "Dwell", 1, here.id);
    const r = buyDevice(s, "g1-compute", "Dwell", 1, here.id);
    if (!r.ok) throw new Error(r.error);
    while (s.devices.find((d) => d.id === r.id)!.arriveAt !== null) tick(s);
    useStore.setState({ game: s, speed: 0, surface: "world" });
    const { container } = render(createElement(World));
    const parcels = container.querySelector("[data-parcels]")!;
    const id = s.devices.filter((d) => d.door?.at === here.id).pop()!.id;
    fireEvent.click(parcels);
    expect(useStore.getState().game.player.carrying).toBe(id);
    fireEvent.pointerMove(container.querySelector("svg")!, { clientX: 40, clientY: 40 });
    expect(container.querySelector(`.w-hand[data-carried="${id}"]`)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t("world.obj.shelf") }));
    const g = useStore.getState().game;
    expect(g.player.carrying).toBeNull();
    expect(g.devices.find((d) => d.id === id)!.store).toBe(here.id);
    expect(container.querySelector(".w-hand")).toBeNull();
    // With empty hands the shelf opens the storage panel in the room, where a stored unit can be taken again.
    fireEvent.click(screen.getByRole("button", { name: t("world.obj.shelf") }));
    const panel = screen.getByRole("dialog", { name: t("world.obj.shelf") });
    fireEvent.click(panel.querySelector(`[data-unit="${id}"] button`)!);
    expect(useStore.getState().game.player.carrying).toBe(id);
    expect(useStore.getState().windows.length).toBe(0);
  });

  it("plugs two ports on the rack back by hand and Escape drops the cable in hand", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout", "performance"] });
    try {
      const s = readyGame(7);
      useStore.setState({ game: s, speed: 0, surface: "world" });
      const { container } = render(createElement(World));
      const rack = s.racks.find((r) => r.locationId === roomOf(s).id)!;
      fireEvent.click(container.querySelector(`[data-rack="${rack.id}"]`)!);
      act(() => { vi.advanceTimersByTime(20_000); });
      const panel = screen.getByRole("dialog", { name: rack.name });
      fireEvent.click(screen.getByRole("button", { name: t("locations-2.back") }));
      const end = (el: Element): End => { const [device, port] = el.getAttribute("data-end")!.split(":"); return { device, port: Number(port) }; };
      const g = () => useStore.getState().game;
      const free = [...panel.querySelectorAll(".rack-port[data-end]")].filter((el) => { const e = end(el); return s.devices.find((d) => d.id === e.device)?.rackId === rack.id && !portPeers(g(), e.device)[e.port]; });
      expect(free.length).toBeGreaterThan(1);
      const a = free[0], b = free.find((el) => end(el).device !== end(a).device && !connectError(g(), end(a), end(el)))!;
      expect(b).toBeDefined();

      fireEvent.click(a);
      expect(panel.querySelector("[data-hand]")).not.toBeNull();
      fireEvent.keyDown(window, { key: "Escape" });
      expect(panel.querySelector("[data-hand]")).toBeNull();
      expect(screen.getByRole("dialog", { name: rack.name })).toBe(panel);

      const before = g().cables.length;
      fireEvent.click(panel.querySelector(`[data-end="${a.getAttribute("data-end")}"]`)!);
      fireEvent.click(panel.querySelector(`[data-end="${b.getAttribute("data-end")}"]`)!);
      expect(g().cables.length).toBe(before + 1);
      expect(portPeers(g(), end(a).device)[end(a).port]).toEqual(end(b));
      expect(panel.querySelector("[data-hand]")).toBeNull();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("drags a cable from port to port on the rack back and a drop elsewhere cancels it", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout", "performance"] });
    const at = document.elementFromPoint;
    try {
      const s = readyGame(7);
      useStore.setState({ game: s, speed: 0, surface: "world" });
      const { container } = render(createElement(World));
      const rack = s.racks.find((r) => r.locationId === roomOf(s).id)!;
      fireEvent.click(container.querySelector(`[data-rack="${rack.id}"]`)!);
      act(() => { vi.advanceTimersByTime(20_000); });
      const panel = screen.getByRole("dialog", { name: rack.name });
      fireEvent.click(screen.getByRole("button", { name: t("locations-2.back") }));
      act(() => { vi.advanceTimersByTime(1000); });
      const end = (el: Element): End => { const [device, port] = el.getAttribute("data-end")!.split(":"); return { device, port: Number(port) }; };
      const g = () => useStore.getState().game;
      const free = [...panel.querySelectorAll(".rack-port[data-end]")].filter((el) => { const e = end(el); return s.devices.find((d) => d.id === e.device)?.rackId === rack.id && !portPeers(g(), e.device)[e.port]; });
      const a = free[0], b = free.find((el) => end(el).device !== end(a).device && !connectError(g(), end(a), end(el)))!;
      const drag = (to: Element) => {
        document.elementFromPoint = () => to;
        fireEvent.pointerDown(a, { button: 0 });
        fireEvent.pointerUp(window);
      };

      const before = g().cables.length;
      drag(panel);
      expect(g().cables.length).toBe(before);
      expect(panel.querySelector("[data-hand]")).toBeNull();
      drag(b);
      expect(g().cables.length).toBe(before + 1);
      expect(portPeers(g(), end(a).device)[end(a).port]).toEqual(end(b));
    } finally {
      document.elementFromPoint = at;
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
  it("fetches the post into a stack of sheets, browses them and scans them all", () => {
    const s = readyGame(7);
    s.letters = [];
    post(s, OFFICE_NAME, "officeRegistered", { name: "Kellerhost", reg: "4711" }, 1);
    post(s, OFFICE_NAME, "officeRegistered", { name: "Kellerhost", reg: "4712" }, 1);
    for (let i = 0; i < 4 * 24; i++) tick(s);
    expect(inLetterbox(s)).toHaveLength(2);
    useStore.setState({ game: s, speed: 0, surface: "world" });
    render(createElement(World));
    fireEvent.click(screen.getByRole("button", { name: t("world.obj.letterbox") }));
    const panel = screen.getByRole("dialog", { name: t("world.obj.letterbox") });
    const first = panel.querySelector("[data-letter]")!.getAttribute("data-letter");
    fireEvent.click(screen.getByRole("button", { name: t("world.nextLetter") }));
    expect(panel.querySelector("[data-letter]")!.getAttribute("data-letter")).not.toBe(first);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(panel.querySelector("[data-letter]")!.getAttribute("data-letter")).toBe(first);
    fireEvent.click(screen.getByRole("button", { name: t("world.scanAll") }));
    expect(atDesk(useStore.getState().game).every((l) => l.scanned)).toBe(true);
  });

  it("pulls every unit's plug with the fuse box main switch and boots them again", () => {
    const s = readyGame(7);
    useStore.setState({ game: s, speed: 0, surface: "world" });
    render(createElement(World));
    const here = roomOf(s).id, mine = () => useStore.getState().game.devices.filter((d) => d.rackId && useStore.getState().game.racks.find((r) => r.id === d.rackId)?.locationId === here);
    expect(mine().some((d) => d.on)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: t("world.obj.fusebox") }));
    const main = screen.getByRole("switch", { name: t("world.mainSwitch") });
    fireEvent.click(main);
    expect(mine().every((d) => !d.on)).toBe(true);
    fireEvent.click(main);
    expect(mine().every((d) => d.on || d.chassisId)).toBe(true);
  });
  // Renders the room at clock time hh:mm on the game's day and returns the darkening's opacity.
  const darkAt = (hh: number, mm: number) => {
    cleanup();
    const s = readyGame(7), hour = s.hour - dateOf(s.hour).getUTCHours() + hh;
    useStore.setState({ game: { ...s, hour, minute: mm }, speed: 0, surface: "world" });
    const { container } = render(createElement(World));
    return Number((container.querySelector(".w-dark") as SVGElement).style.opacity);
  };

  it("fades the room from day to night with the clock", () => {
    expect(darkAt(12, 0)).toBe(0);
    expect(darkAt(23, 0)).toBeCloseTo(NIGHT);
    const dusk = darkAt(18, 15);
    expect(dusk).toBeGreaterThan(0);
    expect(dusk).toBeLessThan(NIGHT);
  });
  it("lights the bulb and lowers the darkening with the light switch", () => {
    const dark = darkAt(23, 0), bulb = () => document.querySelector(".w-bulb");
    expect(bulb()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t("world.obj.switch") }));
    expect(bulb()).not.toBeNull();
    expect(Number((document.querySelector(".w-dark") as SVGElement).style.opacity)).toBeCloseTo(dark / 4);
  });
});

describe("connections between racks", () => {
  type R = { ok: boolean; id?: string; error?: string };
  const ok = (r: R) => { if (!r.ok) throw new Error(r.error); return r.id!; };
  // Two racks at FR5 with a switch each: two shares side by side, or one cage.
  function colo(space: "share" | "cage") {
    const s = freeFloor({ ...newGame(1), cash: 1e7 });
    s.hour = hourOf(new Date(Date.UTC(2010, 0, 1, 9)));
    const locs = space === "share" ? [ok(addLocation(s, "equinox-fr5", "share", 1)), ok(addLocation(s, "equinox-fr5", "share", 1))] : [ok(addLocation(s, "equinox-fr5", "cage", 4))];
    s.locations = s.locations.map((l) => ({ ...l, readyAt: 0 }));
    const racks = space === "share" ? locs.map((l) => s.racks.find((r) => r.locationId === l)!.id) : [1, 2].map((n) => ok(buyRack(s, locs[0], "rack-42", n)));
    const sws = racks.map((r) => { const id = ok(buyDev(s, "sw-24", "Sysko", 1, s.racks.find((x) => x.id === r)!.locationId)); ok(mountDevice(s, id, r, 20)); return id; });
    s.player.at = locs[0];
    useStore.setState({ game: s, speed: 0, surface: "world" });
    return { s, racks, sws };
  }
  const g = () => useStore.getState().game;
  const dropOn = (el: Element) => { document.elementFromPoint = () => el; };
  const at = document.elementFromPoint;

  function openPair(racks: string[]) {
    const { container } = render(createElement(World));
    expect(container.querySelectorAll("[data-rack]").length).toBe(2);
    dropOn(container.querySelector(`[data-rack="${racks[1]}"]`)!);
    fireEvent.pointerDown(container.querySelector(`[data-rack="${racks[0]}"]`)!, { button: 0 });
    fireEvent.pointerUp(container.querySelector(".world-svg")!);
    return container.querySelector(`[data-pair-panel="${racks[0]} ${racks[1]}"]`)!;
  }

  it("opens both backs side by side on a drag from rack to rack and orders a provider cable jack to jack in a share", () => {
    try {
      const { racks, sws } = colo("share");
      const pair = openPair(racks);
      expect(pair).not.toBeNull();
      expect(pair.querySelectorAll("[data-side]").length).toBe(2);
      const [pa, pb] = racks.map((r) => panelOf(g(), r)!.id);
      dropOn(pair.querySelector(`[data-end="${sws[1]}:0"]`)!);
      fireEvent.pointerDown(pair.querySelector(`[data-side] .rack-port[data-end="${sws[0]}:0"]`)!, { button: 0 });
      fireEvent.pointerUp(window);
      expect(g().cables.some((c) => c.a.device === sws[0] && c.b.device === sws[1])).toBe(false);

      dropOn(pair.querySelector(`[data-pp="${pb}"] [data-jack="2"]`)!);
      fireEvent.pointerDown(pair.querySelector(`[data-pp="${pa}"] [data-jack="0"]`)!, { button: 0 });
      fireEvent.pointerUp(window);
      expect(g().providerCables).toHaveLength(0);
      fireEvent.click(pair.querySelector("[data-slip] .wr-line")!);
      expect(g().providerCables).toMatchObject([{ a: { device: pa, port: 0 }, b: { device: pb, port: 2 } }]);
      expect(pair.querySelectorAll(".pp-due").length).toBe(2);
    } finally {
      document.elementFromPoint = at;
    }
  });

  it("cables a port on one rack to a port on the other by hand in a cage", () => {
    try {
      const { racks, sws } = colo("cage");
      const pair = openPair(racks);
      dropOn(pair.querySelector(`[data-side] .rack-port[data-end="${sws[1]}:0"]`)!);
      fireEvent.pointerDown(pair.querySelector(`[data-side] .rack-port[data-end="${sws[0]}:0"]`)!, { button: 0 });
      fireEvent.pointerUp(window);
      expect(portPeers(g(), sws[0])[0]).toEqual({ device: sws[1], port: 0 });
    } finally {
      document.elementFromPoint = at;
    }
  });
});
