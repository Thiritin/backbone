// @vitest-environment jsdom
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { RackPanel } from "../src/ui/world/rack/RackPanel";
import { clampZoom, stepZoom, tagLeft, wheelZoom } from "../src/ui/world/rack/zoom";
import { useStore } from "../src/ui/store";
import { newGame, withServer } from "./fixtures";

describe("rack zoom state", () => {
  it("clamps between fit and 4x", () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(9)).toBe(4);
    expect(stepZoom(4, 1)).toBe(4);
    expect(stepZoom(1, -1)).toBe(1);
    expect(stepZoom(1, 1)).toBeGreaterThan(1);
    expect(wheelZoom(1, { deltaY: 100000 })).toBe(1);
    expect(wheelZoom(1, { deltaY: -100000 })).toBe(4);
    expect(wheelZoom(1, { deltaY: -100, ctrlKey: true })).toBeGreaterThan(wheelZoom(1, { deltaY: -100 }));
  });
});

describe("tag placement", () => {
  it("stays inside the stage near both edges", () => {
    // A scene at content x 100 scrolled to 0 in a 1000 wide stage, tag 260 wide.
    expect(tagLeft(800, 100, 0, 1000, 260)).toBe(632);
    expect(tagLeft(-500, 100, 0, 1000, 260)).toBe(-92);
    expect(tagLeft(300, 100, 0, 1000, 260)).toBe(300);
    // Panned: the tag follows the visible window.
    expect(tagLeft(3000, 100, 2000, 1000, 260)).toBe(2632);
    expect(tagLeft(0, 100, 2000, 1000, 260)).toBe(1908);
  });
});

describe("rack close-up controls", () => {
  window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  const open = () => { useStore.setState({ game: withServer(newGame(1)) }); return render(<RackPanel rackId="rack2" onClose={() => {}} />).container; };
  const z = (c: HTMLElement) => Number((c.querySelector(".wr-stage") as HTMLElement).style.getPropertyValue("--z"));

  it("shows no words or turntable and turns by key, side face and R", () => {
    const c = open();
    expect(c.querySelector(".wr-table")).toBeNull();
    expect(c.querySelector(".wr-face .rack-port")).toBeNull();
    fireEvent.click(c.querySelector(`.wr-k[aria-label="${t("world.turn")}"]`)!);
    expect(c.querySelector(".wr-face:not(.out) .rack-port")).not.toBeNull();
    fireEvent.click(c.querySelector(".wr-flank")!);
    fireEvent.keyDown(window, { key: "r" });
    expect(c.querySelector(".wr-face-ind")!.getAttribute("aria-label")).toBe(t("locations-2.back"));
    fireEvent.keyDown(window, { key: "Tab" });
    expect(c.querySelector(".wr-face-ind")!.getAttribute("aria-label")).toBe(t("locations-2.back"));
    fireEvent.keyDown(window, { key: "R" });
    expect(c.querySelector(".wr-face-ind")!.getAttribute("aria-label")).toBe(t("locations-2.front"));
  });

  it("zooms by wheel, keys and buttons, clamped, and fits again", () => {
    const c = open(), stage = c.querySelector(".wr-stage")!;
    expect(z(c)).toBe(1);
    fireEvent.wheel(stage, { deltaY: -200, clientX: 10, clientY: 10 });
    expect(z(c)).toBeGreaterThan(1);
    for (let i = 0; i < 30; i++) fireEvent.keyDown(window, { key: "+" });
    expect(z(c)).toBe(4);
    expect((c.querySelector(`.wr-k[aria-label="${t("world.zoomIn")}"]`) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(c.querySelector(`.wr-k[aria-label="${t("world.zoomFit")}"]`)!);
    expect(z(c)).toBe(1);
    fireEvent.keyDown(window, { key: "0" });
    expect(z(c)).toBe(1);
    act(() => { fireEvent.keyDown(window, { key: "-" }); });
    expect(z(c)).toBe(1);
  });

  const zoomIn = (c: HTMLElement) => { for (let i = 0; i < 3; i++) fireEvent.keyDown(window, { key: "+" }); expect(z(c)).toBeGreaterThan(1); };
  const drag = (el: Element) => {
    fireEvent.pointerDown(el, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(el, { clientX: 140, clientY: 130, pointerId: 1 });
  };

  it("pans only from empty areas, never from a unit, and stops when the capture is lost", () => {
    const c = open(), stage = c.querySelector(".wr-stage")!;
    drag(c.querySelector(".wr-room")!);
    expect(stage.classList.contains("panning")).toBe(false);
    zoomIn(c);
    fireEvent.pointerUp(stage);
    drag(c.querySelector(".rack-dev")!);
    expect(stage.classList.contains("panning")).toBe(false);
    drag(c.querySelector(".wr-room")!);
    expect(stage.classList.contains("panning")).toBe(true);
    fireEvent(stage, new Event("lostpointercapture", { bubbles: true }));
    expect(stage.classList.contains("panning")).toBe(false);
  });

  it("leaves the wheel to the tag card and disables the zoom keys at their limits", () => {
    const c = open();
    fireEvent.keyDown(c.querySelector(".rack-dev")!, { key: "Enter" });
    fireEvent.wheel(c.querySelector(".wr-tag")!, { deltaY: -300 });
    expect(z(c)).toBe(1);
    const btn = (k: string) => c.querySelector(`.wr-k[aria-label="${t(k)}"]`) as HTMLButtonElement;
    expect(btn("world.zoomOut").disabled).toBe(true);
    for (let i = 0; i < 30; i++) fireEvent.keyDown(window, { key: "+" });
    expect(btn("world.zoomIn").disabled).toBe(true);
    expect(btn("world.zoomOut").disabled).toBe(false);
  });

  it("jumps, drags and clamps through the minimap", () => {
    const c = open(), stage = c.querySelector(".wr-stage") as HTMLElement;
    Object.defineProperty(stage, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(stage, "clientHeight", { configurable: true, value: 250 });
    act(() => { fireEvent.scroll(stage); });
    const bar = c.querySelector(".wr-mini-bar") as HTMLElement;
    expect(bar).not.toBeNull();
    bar.getBoundingClientRect = () => ({ top: 0, height: 100, bottom: 100, left: 0, right: 16, width: 16, x: 0, y: 0, toJSON() {} });
    fireEvent.pointerDown(bar, { clientY: 50, pointerId: 1 });
    expect(stage.scrollTop).toBe(375);
    fireEvent.pointerMove(bar, { clientY: 80, buttons: 1, pointerId: 1 });
    expect(stage.scrollTop).toBe(675);
    fireEvent.pointerMove(bar, { clientY: 400, buttons: 1, pointerId: 1 });
    expect(stage.scrollTop).toBe(750);
    fireEvent.pointerMove(bar, { clientY: -400, buttons: 1, pointerId: 1 });
    expect(stage.scrollTop).toBe(0);
    fireEvent.pointerMove(bar, { clientY: 10, buttons: 0, pointerId: 1 });
    expect(stage.scrollTop).toBe(0);
  });
});
