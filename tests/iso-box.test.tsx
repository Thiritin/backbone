// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MODELS, modelById } from "../src/sim/10-catalog/hardware";
import { Isometric } from "../src/ui/art/Isometric";

afterEach(cleanup);
const ids = ["part-ram", "part-hdd", "part-optic", "part-psu"].concat(MODELS.filter((m) => m.kind !== "part").slice(0, 8).map((m) => m.id));

it("draws every item in the same box and keeps small parts small", () => {
  const boxes = new Set<string>(), widths: Record<string, number> = {};
  for (const id of ids) {
    const { container, unmount } = render(<Isometric model={modelById(id)} brand="Dwell" w={160} />);
    const box = container.querySelector(".iso-box") as HTMLElement;
    boxes.add(`${box.style.width}x${box.style.height}`);
    widths[id] = Number(container.querySelector("svg")!.getAttribute("width"));
    unmount();
  }
  expect(boxes.size).toBe(1);
  expect(widths["part-ram"]).toBeLessThan(widths["part-hdd"]);
  expect(widths["part-hdd"]).toBeLessThan(160);
});
