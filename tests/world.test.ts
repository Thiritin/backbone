// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "../src/i18n/en";
import { useStore } from "../src/ui/store";
import { roomOf, World } from "../src/ui/world/World";
import { pathTo } from "../src/ui/world/grid";
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

  it("walks around blocked tiles", () => {
    const p = pathTo({ x: 0, y: 0 }, [{ x: 2, y: 0 }], 3, 3, new Set(["1,0"]))!;
    expect(p.map((q) => `${q.x},${q.y}`)).toEqual(["0,1", "1,1", "2,1", "2,0"]);
    expect(pathTo({ x: 0, y: 0 }, [{ x: 2, y: 0 }], 3, 1, new Set(["1,0"]))).toBeNull();
  });
});
