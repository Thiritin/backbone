// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "../src/i18n/en";
import { useStore } from "../src/ui/store";
import { roomOf, World } from "../src/ui/world/World";
import { pathTo } from "../src/ui/world/grid";
import { Sprite } from "../src/ui/world/Sprite";
import { readyGame } from "./fixtures";

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

  it("walks around blocked tiles", () => {
    const p = pathTo({ x: 0, y: 0 }, [{ x: 2, y: 0 }], 3, 3, new Set(["1,0"]))!;
    expect(p.map((q) => `${q.x},${q.y}`)).toEqual(["0,1", "1,1", "2,1", "2,0"]);
    expect(pathTo({ x: 0, y: 0 }, [{ x: 2, y: 0 }], 3, 1, new Set(["1,0"]))).toBeNull();
  });

  it("draws a sprite from its rect in the mapping and nothing for an unknown name", () => {
    const map = { rack: { sheet: "atlas.png", x: 96, y: 48, w: 48, h: 96 } };
    const { container } = render(createElement("svg", null, createElement(Sprite, { name: "rack", x: 48, y: 96, map })));
    const el = container.querySelector("[data-sprite=rack]")!;
    expect(el.getAttribute("viewBox")).toBe("96 48 48 96");
    expect([el.getAttribute("x"), el.getAttribute("y"), el.getAttribute("height")]).toEqual(["48", "0", "96"]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const unknown = render(createElement("svg", null, createElement(Sprite, { name: "nope", x: 0, y: 0, map })));
    expect(unknown.container.querySelector("svg")!.childElementCount).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
