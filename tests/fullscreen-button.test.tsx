// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FullscreenButton } from "../src/ui/FullscreenButton";

const setApi = (enabled: boolean, el: Element | null = null) => {
  Object.defineProperty(document, "fullscreenEnabled", { value: enabled, configurable: true });
  Object.defineProperty(document, "fullscreenElement", { value: el, configurable: true });
};

afterEach(() => setApi(false));

describe("fullscreen button", () => {
  it("hides when the API is unavailable", () => {
    setApi(false);
    const { container } = render(<FullscreenButton className="x" />);
    expect(container.firstChild).toBeNull();
  });

  it("enters fullscreen and flips to exit on fullscreenchange", () => {
    setApi(true);
    const enter = vi.fn(() => Promise.resolve());
    document.documentElement.requestFullscreen = enter;
    render(<FullscreenButton className="x" />);
    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    expect(enter).toHaveBeenCalled();
    setApi(true, document.documentElement);
    act(() => { document.dispatchEvent(new Event("fullscreenchange")); });
    const exit = vi.fn(() => Promise.resolve());
    document.exitFullscreen = exit;
    fireEvent.click(screen.getByRole("button", { name: "Exit fullscreen" }));
    expect(exit).toHaveBeenCalled();
  });
});
