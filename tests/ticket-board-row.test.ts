import { describe, expect, it } from "vitest";
import { boardRow } from "../src/ui/world/hall-edit-geom";

// Wall fixtures of a hall of height 10: door and switch at 7, meet-me door at 3, extinguisher at 5, plan board at 8; each takes one row.
const wall = [{ y: 7, len: 1 }, { y: 3, len: 1 }, { y: 5, len: 1 }, { y: 8, len: 1 }];

describe("ticket board row", () => {
  it("hangs beside the wall screen when free", () => {
    expect(boardRow(12, [{ y: 8, len: 2 }, { y: 1, len: 2 }], 1)).toBe(3);
  });
  it("takes the first free pair of rows without a screen", () => {
    expect(boardRow(10, wall, null)).toBe(0);
  });
  it("skips a door at row 1 and at row 2", () => {
    expect(boardRow(10, [...wall, { y: 1, len: 2 }], null)).toBeNull();
    expect(boardRow(10, [...wall, { y: 2, len: 2 }], null)).toBe(0);
  });
  it("falls back to the other side of the screen when a door sits next to it", () => {
    expect(boardRow(12, [{ y: 4, len: 2 }, { y: 6, len: 2 }], 4)).toBe(2);
  });
  it("returns null when the wall is full", () => {
    expect(boardRow(4, [{ y: 0, len: 2 }, { y: 2, len: 2 }], null)).toBeNull();
  });
});
