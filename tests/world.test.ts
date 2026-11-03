// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "../src/i18n/en";
import { useStore } from "../src/ui/store";
import { roomOf, World } from "../src/ui/world/World";
import { tick } from "../src/sim/88-tick/tick";
import { buyDevice } from "../src/sim/90-actions/hardware";
import { readyGame } from "./fixtures";
import { devName } from "../src/ui/apps/hw";

afterEach(cleanup);

describe("world", () => {
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
  });
});
