// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../src/ui/store";
import { roomOf, World } from "../src/ui/world/World";
import { readyGame } from "./fixtures";

afterEach(cleanup);

describe("card seek on an open rack", () => {
  it("turns the open front view to the back for the cabling step", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout", "performance"] });
    try {
      const s = readyGame(7);
      useStore.setState({ game: s, speed: 0, surface: "world", seek: null });
      const { container } = render(createElement(World));
      const rack = s.racks.find((r) => r.locationId === roomOf(s).id)!;
      const dev = s.devices.find((d) => d.rackId === rack.id && !d.chassisId)!;
      fireEvent.click(container.querySelector(`[data-rack="${rack.id}"]`)!);
      act(() => { vi.advanceTimersByTime(20_000); });
      const panel = screen.getByRole("dialog", { name: rack.name });
      expect(panel.querySelectorAll("[data-end]").length).toBe(0);
      act(() => { useStore.getState().setSeek(`cable:${dev.id}`); });
      act(() => { vi.advanceTimersByTime(2000); });
      expect(screen.getByRole("dialog", { name: rack.name }).querySelectorAll("[data-end]").length).toBeGreaterThan(0);
      expect(useStore.getState().seek).toBeNull();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
