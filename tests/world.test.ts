// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "../src/i18n/en";
import { useStore } from "../src/ui/store";
import { roomOf, World } from "../src/ui/world/World";
import { tick } from "../src/sim/88-tick/tick";
import { buyDevice } from "../src/sim/90-actions/hardware";
import { atDesk, inLetterbox, post } from "../src/sim/40-support/letters";
import { OFFICE_NAME } from "../src/sim/80-business/paperwork";
import { readyGame } from "./fixtures";
import { devName } from "../src/ui/apps/hw";
import { connectError, portPeers } from "../src/sim/60-infra/status";
import type { End } from "../src/sim/50-state";
import { dateOf } from "../src/sim/00-core/time";
import { NIGHT } from "../src/ui/world/draw";

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
});
