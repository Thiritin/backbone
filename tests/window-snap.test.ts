import { describe, expect, it } from "vitest";
import { snapBox, snapZone } from "../src/ui/desktop/AppWindow";

describe("window snapping", () => {
  it("picks halves at the sides, quarters near the corners and the full screen at the top", () => {
    expect(snapZone(0, 400, 1200, 800)).toBe("l");
    expect(snapZone(1199, 400, 1200, 800)).toBe("r");
    expect(snapZone(0, 40, 1200, 800)).toBe("tl");
    expect(snapZone(1200, 700, 1200, 800)).toBe("br");
    expect(snapZone(600, 10, 1200, 800)).toBe("max");
    expect(snapZone(600, 400, 1200, 800)).toBeNull();
  });

  it("tiles the area between the menu bar and the dock", () => {
    expect(snapBox("l", 1200, 800)).toEqual({ x: 0, y: 30, w: 600, h: 690 });
    expect(snapBox("br", 1200, 800)).toEqual({ x: 600, y: 375, w: 600, h: 345 });
  });
});
