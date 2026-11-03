// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { t } from "../src/i18n/en";
import { useStore } from "../src/ui/store";
import { roomOf, World } from "../src/ui/world/World";
import { pathTo } from "../src/ui/world/iso";
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
});
