// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { escapeStep } from "../src/ui/desktop/escape";
import { PauseMenu } from "../src/ui/desktop/PauseMenu";
import { useStore } from "../src/ui/store";

const s = () => useStore.getState();
afterEach(() => act(() => s().setPause(false)));

describe("pause menu", () => {
  it("pauses on open, restores the speed on close and Escape closes it", () => {
    useStore.setState({ speed: 8, surface: "desktop" });
    render(<PauseMenu />);
    act(() => s().setPause(true));
    expect(s().speed).toBe(0);
    screen.getByRole("button", { name: "Resume" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(s().pause).toBe(false);
    expect(s().speed).toBe(8);
  });

  it("moves focus with arrow keys and offers Logout only on the desktop", () => {
    useStore.setState({ speed: 1, surface: "desktop" });
    render(<PauseMenu />);
    act(() => s().setPause(true));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Resume" }));
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Save and main menu" }));
    screen.getByRole("button", { name: "Logout" });
    act(() => { useStore.setState({ surface: "world" }); });
    expect(screen.queryByRole("button", { name: "Logout" })).toBeNull();
  });

  it("Escape opens it only when nothing else claims the key", () => {
    const setPause = vi.fn(), close = vi.fn();
    const base = { game: { hour: 1, player: { until: 0 } }, close, setSurface: () => {}, setPause } as never;
    const e = { key: "Escape", target: document.body, defaultPrevented: false };
    expect(escapeStep(e, { ...(base as object), windows: [{ id: "a", z: 1, minimized: false }] } as never)).toBe("close");
    expect(setPause).not.toHaveBeenCalled();
    const dlg = document.body.appendChild(document.createElement("div"));
    dlg.setAttribute("role", "dialog");
    expect(escapeStep(e, { ...(base as object), windows: [] } as never)).toBeNull();
    dlg.remove();
    expect(escapeStep(e, { ...(base as object), windows: [] } as never)).toBe("pause");
    expect(setPause).toHaveBeenCalledWith(true);
  });
});
