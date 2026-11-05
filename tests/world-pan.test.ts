// @vitest-environment jsdom
import { act, fireEvent, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../src/ui/store";
import { World } from "../src/ui/world/World";
import { readyGame } from "./fixtures";

const origin = (c: HTMLElement) => c.querySelector("svg[viewBox]")!.getAttribute("viewBox")!.split(" ").slice(0, 2).join(" ");

describe("world pan", () => {
  afterEach(() => vi.useRealTimers());

  function mount() {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    document.elementFromPoint = () => null;
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    useStore.setState({ game: readyGame(7), speed: 0, surface: "world" });
    return render(createElement(World)).container;
  }
  const frames = (n: number) => act(() => { vi.advanceTimersByTime(n * 16); });

  it("stops panning when a modifier swallows the key release", () => {
    const c = mount();
    fireEvent.keyDown(window, { key: "d" });
    frames(5);
    const moved = origin(c);
    fireEvent.keyDown(window, { key: "Meta", metaKey: true });
    frames(2);
    const stopped = origin(c);
    frames(20);
    expect(origin(c)).toBe(stopped);
    expect(moved).not.toBe("");
  });

  it("ends a drag on pointercancel and on a move with no button down", () => {
    const c = mount();
    const svg = c.querySelector("svg[viewBox]")!;
    const start = origin(c);
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100, buttons: 1 });
    fireEvent.pointerCancel(svg, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 300, buttons: 1 });
    expect(origin(c)).toBe(start);
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100, buttons: 1 });
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 300, buttons: 0 });
    expect(origin(c)).toBe(start);
  });
});
